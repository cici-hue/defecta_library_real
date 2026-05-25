/**
 * Pipeline implementations
 * 
 * Pipeline A: Knowledge ingestion (doc-extraction → knowledge-construction)
 * Pipeline B: Intelligent Q&A (intent-recognition → knowledge-retrieval → answer-generation)
 */

import { getSupabaseClient } from "@/storage/database/supabase-client";
import {
  callAgent,
  callAgentStream,
  generateEmbedding,
  generateEmbeddings,
  cosineSimilarity,
  parseAgentJson,
} from "./orchestration";
import { uploadFileLocal } from "@/lib/local-storage";
import type { ExtractedImage } from "@/lib/document-parser";
import type { NextRequest } from "next/server";
import { DEFECT_CASE_EXTRACTION_PROMPT } from "./prompts";
import type { ExtractedDefectCase, DefectCase } from "@/lib/types";

// ============================================================
// Pipeline A: Knowledge Ingestion
// ============================================================

interface ExtractionPoint {
  title: string;
  content: string;
  relations?: string[];
}

interface ExtractionResult {
  core_topic: string;
  key_points: ExtractionPoint[];
}

/**
 * Process a single document through the extraction agent
 */
export async function processDocument(
  documentId: string,
  documentContent: string,
  requestHeaders?: Headers
): Promise<void> {
  const client = getSupabaseClient();

  try {
    // Update status to processing
    const { error: updateError } = await client
      .from("documents")
      .update({ status: "processing" })
      .eq("id", documentId);
    if (updateError) throw new Error(`更新状态失败: ${updateError.message}`);

    // Step 1: Call doc-extraction agent
    const extractionRaw = await callAgent(
      "doc-extraction",
      `文档内容如下：\n\n${documentContent}`,
      requestHeaders
    );

    // Save extraction result
    let extractionResult: ExtractionResult;
    try {
      extractionResult = parseAgentJson<ExtractionResult>(extractionRaw);
    } catch {
      // If parsing fails, store raw content as a single point
      extractionResult = {
        core_topic: "文档内容",
        key_points: [{ title: "提取内容", content: extractionRaw }],
      };
    }

    const { error: insertError } = await client
      .from("document_extractions")
      .insert({
        document_id: documentId,
        extraction_result: extractionResult,
      });
    if (insertError) throw new Error(`保存提取结果失败: ${insertError.message}`);

    // Step 2: Trigger knowledge base rebuild
    await rebuildKnowledgeBase(requestHeaders);

    // Update status to completed
    const { error: completeError } = await client
      .from("documents")
      .update({ status: "completed" })
      .eq("id", documentId);
    if (completeError) throw new Error(`更新完成状态失败: ${completeError.message}`);
  } catch (error) {
    // Update status to failed
    await client
      .from("documents")
      .update({ status: "failed" })
      .eq("id", documentId);

    throw error;
  }
}

/**
 * Rebuild the entire knowledge base from all document extractions
 */
export async function rebuildKnowledgeBase(requestHeaders?: Headers): Promise<void> {
  const client = getSupabaseClient();

  // Get all extractions
  const { data: extractions, error: fetchError } = await client
    .from("document_extractions")
    .select("id, document_id, extraction_result, created_at")
    .order("created_at", { ascending: true });
  if (fetchError) throw new Error(`获取提取结果失败: ${fetchError.message}`);
  if (!extractions || extractions.length === 0) return;

  // Deactivate previous schemas
  const { data: activeSchemas } = await client
    .from("knowledge_schemas")
    .select("id, version")
    .eq("is_active", "true")
    .order("version", { ascending: false })
    .limit(1);

  const nextVersion = activeSchemas && activeSchemas.length > 0 ? activeSchemas[0].version + 1 : 1;

  // Call knowledge-construction agent with all extractions
  const constructionInput = JSON.stringify(
    extractions.map((e) => ({
      extraction_id: e.id,
      document_id: e.document_id,
      extraction_result: e.extraction_result,
    })),
    null,
    2
  );

  const constructionRaw = await callAgent(
    "knowledge-construction",
    `以下是所有文档的提取结果，请综合归纳构建知识体系：\n\n${constructionInput}`,
    requestHeaders
  );

  // Parse the construction result
  let constructionResult: {
    schema_description: string;
    schema_structure: unknown;
    chunks: Array<{
      chunk_text: string;
      metadata?: Record<string, unknown>;
      related_to?: (string | number)[];
    }>;
  };

  try {
    constructionResult = parseAgentJson(constructionRaw);
  } catch {
    // Fallback: create simple chunks from raw content
    constructionResult = {
      schema_description: "自动构建的知识库",
      schema_structure: { type: "flat" },
      chunks: [{ chunk_text: constructionRaw, metadata: {} }],
    };
  }

  // Insert new schema
  const { data: newSchema, error: schemaError } = await client
    .from("knowledge_schemas")
    .insert({
      schema_description: constructionResult.schema_description,
      schema_structure: constructionResult.schema_structure,
      version: nextVersion,
      is_active: "true",
    })
    .select("id")
    .single();
  if (schemaError) throw new Error(`创建知识体系失败: ${schemaError.message}`);

  // Generate embeddings for all chunks
  const chunks = constructionResult.chunks || [];
  const chunkTexts = chunks.map((c) => c.chunk_text);
  
  let embeddings: number[][];
  try {
    embeddings = await generateEmbeddings(chunkTexts, requestHeaders);
  } catch {
    // If embedding fails, continue without embeddings
    embeddings = chunks.map(() => []);
  }

  // Collect source document IDs
  const sourceDocIds = [...new Set(extractions.map((e) => e.document_id))];

  // Insert knowledge chunks
  const chunkRecords = chunks.map((chunk, index) => ({
    chunk_text: chunk.chunk_text,
    metadata: chunk.metadata || {},
    source_document_ids: sourceDocIds,
    related_chunk_ids: chunk.related_to || [],
    embedding: embeddings[index]?.length > 0 ? embeddings[index] : null,
    knowledge_schema_id: newSchema.id,
  }));

  if (chunkRecords.length > 0) {
    const { error: chunkError } = await client
      .from("knowledge_chunks")
      .insert(chunkRecords);
    if (chunkError) throw new Error(`保存知识块失败: ${chunkError.message}`);
  }

  // Deactivate old schemas
  if (activeSchemas && activeSchemas.length > 0) {
    const oldSchemaIds = activeSchemas.map((s) => s.id);
    if (oldSchemaIds.length > 0) {
      await client
        .from("knowledge_schemas")
        .update({ is_active: "false" })
        .in("id", oldSchemaIds);
    }
  }
}

// ============================================================
// Pipeline B: Intelligent Q&A
// ============================================================

interface RetrievalResult {
  has_relevant: boolean;
  results: Array<{
    chunk_id: string;
    chunk_text: string;
    relevance: "high" | "medium" | "low";
    reason: string;
  }>;
  coverage_assessment: string;
}

/**
 * Hybrid search: vector similarity + keyword matching
 */
export async function hybridSearch(
  queries: string[],
  topK: number = 10,
  requestHeaders?: Headers
): Promise<Array<{ id: string; chunk_text: string; metadata: unknown; score: number }>> {
  const client = getSupabaseClient();

  // Get all active chunks
  const { data: activeSchema } = await client
    .from("knowledge_schemas")
    .select("id")
    .eq("is_active", "true")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!activeSchema) return [];

  const { data: chunks, error: chunksError } = await client
    .from("knowledge_chunks")
    .select("id, chunk_text, metadata, embedding")
    .eq("knowledge_schema_id", activeSchema.id);
  if (chunksError) throw new Error(`查询知识块失败: ${chunksError.message}`);
  if (!chunks || chunks.length === 0) return [];

  // Generate embedding for the primary query
  let queryEmbedding: number[];
  try {
    queryEmbedding = await generateEmbedding(queries[0], requestHeaders);
  } catch {
    // Fallback to keyword-only search
    queryEmbedding = [];
  }

  // Score each chunk
  const scored = chunks
    .map((chunk) => {
      let vectorScore = 0;
      let keywordScore = 0;

      // Vector similarity
      if (queryEmbedding.length > 0 && chunk.embedding) {
        const emb = chunk.embedding as number[];
        if (Array.isArray(emb) && emb.length === queryEmbedding.length) {
          vectorScore = cosineSimilarity(queryEmbedding, emb);
        }
      }

      // Keyword matching
      const lowerText = chunk.chunk_text.toLowerCase();
      for (const query of queries) {
        const keywords = query.toLowerCase().split(/\s+/);
        for (const kw of keywords) {
          if (kw.length > 1 && lowerText.includes(kw)) {
            keywordScore += 0.1;
          }
        }
      }

      // Combine scores: vector has higher weight
      const combinedScore = vectorScore * 0.7 + Math.min(keywordScore, 0.3);

      return {
        id: chunk.id,
        chunk_text: chunk.chunk_text,
        metadata: chunk.metadata,
        score: combinedScore,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored;
}

/**
 * Full chat pipeline: intent → retrieval → generation
 */
export async function* chatPipeline(
  question: string,
  sessionId: string,
  requestHeaders?: Headers
): AsyncGenerator<string> {
  const client = getSupabaseClient();

  // Step 1: Intent recognition
  const intentRaw = await callAgent(
    "intent-recognition",
    `用户问题：${question}`,
    requestHeaders
  );

  let intent: IntentResult;
  try {
    intent = parseAgentJson<IntentResult>(intentRaw);
  } catch {
    intent = {
      query_type: "text_only",
      scope: "in_scope",
      user_intent: question,
      search_strategy: {
        use_image_search: false,
        use_text_search: true,
        filters: {},
      },
      search_queries: [question],
      key_entities: [],
      reasoning: "默认允许检索",
    };
  }

  // Save user message
  await client.from("chat_messages").insert({
    session_id: sessionId,
    role: "user",
    content: question,
    intent_result: intent,
  });

  // If out of scope, return rejection
  if (intent.scope === "out_of_scope") {
    const rejectionMsg = "抱歉，我是服装行业知识库助手，只能回答与服装行业相关的问题。请尝试提问与服装缺陷、工艺标准、质量检测等相关的主题。";
    
    await client.from("chat_messages").insert({
      session_id: sessionId,
      role: "assistant",
      content: rejectionMsg,
      sources: [],
      intent_result: intent,
    });

    yield rejectionMsg;
    return;
  }

  // Step 2: Hybrid search
  const candidates = await hybridSearch(
    intent.search_queries,
    10,
    requestHeaders
  );

  // If no candidates at all
  if (candidates.length === 0) {
    const noResultMsg = "根据现有知识库，暂未找到与您问题相关的信息。建议您尝试换个描述方式提问，或联系管理员补充相关文档。";
    
    await client.from("chat_messages").insert({
      session_id: sessionId,
      role: "assistant",
      content: noResultMsg,
      sources: [],
      intent_result: intent,
    });

    yield noResultMsg;
    return;
  }

  // Step 3: Knowledge retrieval agent (rerank)
  const candidatesText = candidates
    .map(
      (c, i) =>
        `[候选${i + 1}] ID: ${c.id}\n内容: ${c.chunk_text}\n相似度: ${c.score.toFixed(4)}`
    )
    .join("\n\n");

  const retrievalInput = `用户问题：${question}\n意图分析：${JSON.stringify(intent)}\n\n候选知识块：\n${candidatesText}`;

  const retrievalRaw = await callAgent(
    "case-retrieval",
    retrievalInput,
    requestHeaders
  );

  let retrieval: RetrievalResult;
  try {
    retrieval = parseAgentJson<RetrievalResult>(retrievalRaw);
  } catch {
    // Fallback: use top candidates directly
    retrieval = {
      has_relevant: candidates.length > 0 && candidates[0].score > 0.3,
      results: candidates.slice(0, 5).map((c) => ({
        chunk_id: c.id,
        chunk_text: c.chunk_text,
        relevance: c.score > 0.7 ? "high" : c.score > 0.4 ? "medium" : "low",
        reason: `相似度: ${c.score.toFixed(4)}`,
      })),
      coverage_assessment: candidates[0].score > 0.5 ? "较好" : "一般",
    };
  }

  // If no relevant results
  if (!retrieval.has_relevant) {
    const noRelevantMsg = "根据现有知识库，暂未找到与您问题直接相关的信息。建议您尝试换个描述方式提问，或联系管理员补充相关文档。";
    
    await client.from("chat_messages").insert({
      session_id: sessionId,
      role: "assistant",
      content: noRelevantMsg,
      sources: [],
      intent_result: intent,
    });

    yield noRelevantMsg;
    return;
  }

  // Step 4: Answer generation (streaming)
  const references = retrieval.results
    .map((r) => `[知识块 ${r.chunk_id}]\n${r.chunk_text}`)
    .join("\n\n---\n\n");

  const answerInput = `用户问题：${question}\n\n参考资料：\n${references}`;

  let fullAnswer = "";
  const sources = retrieval.results.map((r) => ({
    chunk_id: r.chunk_id,
    relevance: r.relevance,
    reason: r.reason,
  }));

  for await (const chunk of callAgentStream("answer-generation", answerInput, requestHeaders)) {
    fullAnswer += chunk;
    yield chunk;
  }

  // Save assistant message
  await client.from("chat_messages").insert({
    session_id: sessionId,
    role: "assistant",
    content: fullAnswer,
    sources,
    intent_result: intent,
  });
}

// ============================================================
// Image Processing Pipeline
// ============================================================

/**
 * Process and store images extracted from documents
 * Returns the stored image records with IDs
 */
export async function processDocumentImages(
  documentId: string,
  images: ExtractedImage[]
): Promise<Array<{ id: string; filename: string; [key: string]: any }>> {
  const client = getSupabaseClient();
  const storedImages: Array<{ id: string; filename: string; [key: string]: any }> = [];

  for (const image of images) {
    try {
      const fileKey = await uploadFileLocal({
        fileContent: image.data,
        fileName: image.filename,
        contentType: image.mimeType,
      });

      const imageHash = image.data.toString("base64").substring(0, 100);

      const { data, error } = await client
        .from("document_images")
        .insert({
          document_id: documentId,
          filename: image.filename,
          file_key: fileKey,
          mime_type: image.mimeType,
          file_size: image.size,
          source_slide: image.sourceSlide,
          slide_text: image.slideText,
          image_hash: imageHash,
          // 保存直接解析出的缺陷信息
          materials: image.materials,
          claim_reason: image.claimReason,
          style: image.style,
          position: image.position,
          defect_description: image.defectDescription,
        })
        .select("*")
        .single();

      if (!error && data) {
        storedImages.push(data);
      }
    } catch (err) {
      console.error(`Failed to store image ${image.filename}:`, err);
    }
  }

  return storedImages;
}

// ============================================================
// Defect Case Processing Pipeline
// ============================================================

export interface ImageWithSlideText {
  filename: string;
  sourceSlide: number | null;
  slideText: string;
}

/**
 * Extract defect cases from document content and images
 */
export async function extractDefectCases(
  documentContent: string,
  images: ImageWithSlideText[]
): Promise<ExtractedDefectCase[]> {
  if (images.length === 0) {
    return [];
  }

  try {
    // 构建图片信息表格，包含幻灯片文字
    const imageInfoList = images.map((img, i) =>
      `图片 ${i + 1}: ${img.filename}${img.sourceSlide ? ` (第 ${img.sourceSlide} 页)` : ""}\n幻灯片文字: ${img.slideText || "(无文字)"}`
    ).join("\n\n");

    const prompt = `${DEFECT_CASE_EXTRACTION_PROMPT}

---
# 文档内容
${documentContent}

---
# 图片详细信息列表
${imageInfoList}

请根据每张图片及其所在幻灯片的文字内容，提取对应的缺陷案例信息。`;

    const response = await callAgent("defect-case-extraction", prompt);

    const cases = parseAgentJson<ExtractedDefectCase[]>(response);
    return cases || [];
  } catch (err) {
    console.error("Failed to extract defect cases:", err);
    return [];
  }
}

/**
 * Save defect cases to database
 */
export async function saveDefectCases(
  documentId: string,
  extractedCases: ExtractedDefectCase[],
  storedImages: Array<{ id: string; filename: string }>
): Promise<number> {
  const client = getSupabaseClient();
  let savedCount = 0;

  for (const extractedCase of extractedCases) {
    try {
      // Find matching image
      const matchingImage = storedImages.find(
        (img) => img.filename === extractedCase.image_reference
      );

      const { error } = await client.from("defect_cases").insert({
        document_id: documentId,
        image_id: matchingImage?.id || null,
        materials: extractedCase.materials || null,
        style: extractedCase.style || null,
        claim_reason: extractedCase.claim_reason,
        defect_description: extractedCase.defect_description || null,
        position: extractedCase.position || null,
      });

      if (!error) {
        savedCount++;
      }
    } catch (err) {
      console.error("Failed to save defect case:", err);
    }
  }

  return savedCount;
}

// ============================================================
// Knowledge Classification Pipeline
// ============================================================

interface ClassificationResult {
  classification_version: string;
  generated_at: string;
  claim_categories: Array<{
    id: string;
    category_name: string;
    standard_terms: string[];
    description: string;
    parent_id: string | null;
    sub_categories: any[];
    case_ids: string[];
    image_ids: string[];
    statistics: any;
    common_causes: string[];
    prevention_tips: string[];
    risk_level: string;
    related_materials: string[];
  }>;
  material_categories: Array<{
    id: string;
    material_name: string;
    aliases: string[];
    common_defects: any[];
    total_case_count: number;
    risk_level: string;
    characteristics: string[];
  }>;
  position_categories: Array<{
    id: string;
    position_name: string;
    aliases: string[];
    common_defects: any[];
    total_case_count: number;
  }>;
  cross_analysis: any;
  summary: any;
}

/**
 * Classify all defect cases in the knowledge base
 * This should be called after new cases are added
 */
export async function classifyKnowledge(
  requestHeaders?: Headers
): Promise<ClassificationResult | null> {
  const client = getSupabaseClient();

  try {
    // Step 1: Get all defect cases with their images
    const { data: allCases, error: casesError } = await client
      .from("defect_cases")
      .select(`
        *,
        document_images (
          id, filename, file_key
        ),
        documents (
          id, filename
        )
      `)
      .order("created_at", { ascending: false });

    if (casesError || !allCases || allCases.length === 0) {
      console.log("No defect cases to classify");
      return null;
    }

    // Step 2: Build the input for knowledge classifier agent
    const casesText = allCases.map((c: any, i: number) =>
      `案例 ${i + 1} (ID: ${c.id}):
- 索赔原因/缺陷类型: ${c.claim_reason || '未知'}
- 材料: ${c.materials || '未知'}
- 款式: ${c.style || '未知'}
- 位置: ${c.position || '未知'}
- 缺陷描述: ${c.defect_description || '无'}
- 关联图片: ${c.document_images?.filename || '无图片'}`
    ).join("\n\n");

    const prompt = `${casesText}

请对以上所有缺陷案例进行智能分类，建立完整的知识分类体系。`;

    // Step 3: Call knowledge-classifier agent
    const response = await callAgent("knowledge-classifier", prompt, requestHeaders);
    
    let classification: ClassificationResult;
    try {
      classification = parseAgentJson<ClassificationResult>(response);
    } catch (err) {
      console.error("Failed to parse classification result:", err);
      return null;
    }

    if (!classification) {
      return null;
    }

    // Step 4: Save classifications to database
    await saveClassifications(classification, allCases);

    // Step 5: Save version record
    await client.from("classification_versions").insert({
      version: classification.classification_version,
      generated_at: new Date().toISOString(),
      total_classifications: 
        (classification.claim_categories?.length || 0) +
        (classification.material_categories?.length || 0) +
        (classification.position_categories?.length || 0),
      total_cases_analyzed: allCases.length,
      summary: classification.summary,
      classification_data: classification as any,
      triggered_by: "pipeline",
    });

    console.log(`Knowledge classification completed: v${classification.classification_version}`);
    return classification;

  } catch (err) {
    console.error("Failed to classify knowledge:", err);
    return null;
  }
}

/**
 * Save classification results to database
 */
async function saveClassifications(
  classification: ClassificationResult,
  allCases: any[]
): Promise<void> {
  const client = getSupabaseClient();

  // Deactivate old classifications
  await client
    .from("knowledge_classifications")
    .update({ is_active: false })
    .eq("is_active", true);

  // Save claim categories
  if (classification.claim_categories) {
    for (const cat of classification.claim_categories) {
      const { data: newCat, error } = await client
        .from("knowledge_classifications")
        .insert({
          category_type: "claim_reason",
          category_name: cat.category_name,
          standard_terms: cat.standard_terms,
          aliases: [],  // Could extract from standard_terms
          description: cat.description,
          case_count: cat.case_ids?.length || 0,
          image_count: cat.image_ids?.length || 0,
          risk_level: cat.risk_level,
          sub_categories: cat.sub_categories || [],
          statistics: cat.statistics || {},
          common_causes: cat.common_causes || [],
          prevention_tips: cat.prevention_tips || [],
          related_materials: cat.related_materials || [],
          version: classification.classification_version,
          is_active: true,
        })
        .select()
        .single();

      if (!error && newCat) {
        // Save case mappings for this category
        if (cat.case_ids && cat.case_ids.length > 0) {
          const mappings = cat.case_ids.map((caseId: string, idx: number) => ({
            case_id: caseId,
            classification_id: newCat.id,
            relevance_score: idx < Math.ceil(cat.case_ids.length / 2) ? 0.9 : 0.7,
            is_primary: idx === 0,
            match_reason: `Classified under ${cat.category_name}`,
          }));

          await client.from("case_classification_mapping").insert(mappings);
        }
      }
    }
  }

  // Save material categories
  if (classification.material_categories) {
    for (const mat of classification.material_categories) {
      const { data: newMat, error } = await client
        .from("knowledge_classifications")
        .insert({
          category_type: "material",
          category_name: mat.material_name,
          standard_terms: [mat.material_name, ...(mat.aliases || [])],
          aliases: mat.aliases || [],
          description: `${mat.material_name} - ${mat.total_case_count} cases`,
          case_count: mat.total_case_count,
          risk_level: mat.risk_level,
          characteristics: mat.characteristics || [],
          statistics: { common_defects: mat.common_defects },
          version: classification.classification_version,
          is_active: true,
        })
        .select()
        .single();

      if (!error && newMat) {
        // Find and map relevant cases for this material
        const relevantCases = allCases.filter((c: any) => 
          c.materials?.toLowerCase().includes(mat.material_name.toLowerCase()) ||
          mat.aliases?.some((alias: string) => 
            c.materials?.toLowerCase().includes(alias.toLowerCase())
          )
        );

        if (relevantCases.length > 0) {
          const mappings = relevantCases.slice(0, 20).map((c: any, idx: number) => ({
            case_id: c.id,
            classification_id: newMat.id,
            relevance_score: 0.8,
            is_primary: idx === 0,
            match_reason: `Material match: ${mat.material_name}`,
          }));

          await client.from("case_classification_mapping").insert(mappings);
        }
      }
    }
  }

  // Save position categories
  if (classification.position_categories) {
    for (const pos of classification.position_categories) {
      const { data: newPos, error } = await client
        .from("knowledge_classifications")
        .insert({
          category_type: "position",
          category_name: pos.position_name,
          standard_terms: [pos.position_name, ...(pos.aliases || [])],
          aliases: pos.aliases || [],
          description: `${pos.position_name} - ${pos.total_case_count} cases`,
          case_count: pos.total_case_count,
          statistics: { common_defects: pos.common_defects },
          version: classification.classification_version,
          is_active: true,
        })
        .select()
        .single();

      if (!error && newPos) {
        // Find and map relevant cases for this position
        const relevantCases = allCases.filter((c: any) => 
          c.position?.toLowerCase().includes(pos.position_name.toLowerCase()) ||
          pos.aliases?.some((alias: string) => 
            c.position?.toLowerCase().includes(alias.toLowerCase())
          )
        );

        if (relevantCases.length > 0) {
          const mappings = relevantCases.slice(0, 20).map((c: any, idx: number) => ({
            case_id: c.id,
            classification_id: newPos.id,
            relevance_score: 0.8,
            is_primary: idx === 0,
            match_reason: `Position match: ${pos.position_name}`,
          }));

          await client.from("case_classification_mapping").insert(mappings);
        }
      }
    }
  }
}

/**
 * Search by classification - find cases belonging to a specific category
 */
export async function searchByClassification(
  categoryType: string,
  categoryName: string,
  limit: number = 10
): Promise<any[]> {
  const client = getSupabaseClient();

  // Find the classification
  const { data: classification, error } = await client
    .from("knowledge_classifications")
    .select("*")
    .eq("category_type", categoryType)
    .eq("is_active", true)
    .or(`category_name.ilike.%${categoryName}%,standard_terms.cs.{${categoryName}}`)
    .maybeSingle();

  if (error || !classification) {
    return [];
  }

  // Get mapped cases
  const { data: mappings } = await client
    .from("case_classification_mapping")
    .select(`
      case_id,
      relevance_score,
      is_primary,
      defect_cases (
        *,
        document_images (*),
        documents (filename)
      )
    `)
    .eq("classification_id", classification.id)
    .order("relevance_score", { ascending: false })
    .limit(limit);

  if (!mappings) return [];

  return mappings.map((m: any) => ({
    ...m.defect_cases,
    _relevance: m.relevance_score,
    _isPrimary: m.is_primary,
    _classification: {
      id: classification.id,
      name: classification.category_name,
      type: classification.category_type,
    },
  }));
}

/**
 * Get all active classifications for a type
 */
export async function getClassifications(
  categoryType?: string
): Promise<any[]> {
  const client = getSupabaseClient();

  let query = client
    .from("knowledge_classifications")
    .select("*")
    .eq("is_active", true)
    .order("case_count", { ascending: false });

  if (categoryType) {
    query = query.eq("category_type", categoryType);
  }

  const { data, error } = await query;

  if (error || !data) return [];
  return data;
}

/**
 * Search images by semantic query using classifications
 * Example: "给我几张抽丝的照片" → finds Frayed Yarn category → returns images
 */
export async function searchImagesBySemanticQuery(
  query: string,
  limit: number = 6,
  requestHeaders?: Headers
): Promise<{
  results: any[];
  classification: any;
  understoodQuery: any;
}> {
  const client = getSupabaseClient();

  try {
    // Step 1: Use semantic understanding to parse the query
    const semanticPrompt = `用户查询：${query}

请分析这个查询，提取用户想要的缺陷类型或关键词。`;

    const semanticRaw = await callAgent("semantic-understanding", semanticPrompt, requestHeaders);
    
    let understoodQuery: any;
    try {
      understoodQuery = parseAgentJson(semanticRaw);
    } catch {
      understoodQuery = {
        normalized_query: {
          standard_defect_type: query,
          expanded_synonyms: [query],
        },
        understood_intent: {
          intent_category: "image_retrieval",
          output_format_preference: "image_gallery",
        },
      };
    }

    // Step 2: Extract search terms
    const searchTerms = [
      understoodQuery.normalized_query?.standard_defect_type,
      ...(understoodQuery.normalized_query?.expanded_synonyms || []),
    ].filter(Boolean);

    if (searchTerms.length === 0) {
      searchTerms.push(query);
    }

    // Step 3: Search in classifications
    const { data: classifications, error } = await client
      .from("knowledge_classifications")
      .select("*")
      .eq("is_active", true)
      .eq("category_type", "claim_reason")
      .or(searchTerms.map(term => 
        `category_name.ilike.%${term}%,standard_terms.cs.{${term}}`
      ).join(","));

    if (error || !classifications || classifications.length === 0) {
      // Fallback: direct text search on defect_cases
      const { data: fallbackResults } = await client
        .from("defect_cases")
        .select(`
          *,
          document_images (*),
          documents (filename)
        `)
        .or(searchTerms.map(term => 
          `claim_reason.ilike.%${term}%,defect_description.ilike.%${term}%`
        ).join(","))
        .limit(limit);

      return {
        results: fallbackResults || [],
        classification: null,
        understoodQuery,
      };
    }

    // Step 4: Get the best matching classification and its cases
    const bestMatch = classifications[0];
    
    const { data: mappings } = await client
      .from("case_classification_mapping")
      .select(`
        defect_cases (
          *,
          document_images (*),
          documents (filename)
        ),
        relevance_score
      `)
      .eq("classification_id", bestMatch.id)
      .order("relevance_score", { ascending: false })
      .limit(limit);

    const results = (mappings || []).map((m: any) => ({
      ...m.defect_cases,
      _relevance: m.relevance_score,
    }));

    return {
      results,
      classification: bestMatch,
      understoodQuery,
    };

  } catch (err) {
    console.error("Failed to search images by semantic query:", err);
    return { results: [], classification: null, understoodQuery: null };
  }
}

/**
 * Search for similar images based on image hash or metadata
 */
export async function searchSimilarImages(
  imageBuffer: Buffer,
  topK: number = 5
): Promise<Array<{
  id: string;
  filename: string;
  file_key: string;
  source_document_ids: string[];
  source_slide: number | null;
  similarity: number;
}>> {
  const client = getSupabaseClient();

  const { data: allImages, error } = await client
    .from("document_images")
    .select("id, filename, file_key, source_slide, document_id");

  if (error || !allImages) return [];

  const queryHash = imageBuffer.toString("base64").substring(0, 100);

  const scored = allImages.map((img) => {
    const storedBuffer = Buffer.from(img.filename.substring(0, 100), "base64");
    const storedHash = storedBuffer.toString("base64").substring(0, 100);
    const similarity = queryHash === storedHash ? 1.0 : 0.5;
    return {
      id: img.id,
      filename: img.filename,
      file_key: img.file_key,
      source_document_ids: [img.document_id],
      source_slide: img.source_slide,
      similarity,
    };
  });

  return scored
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
}

/**
 * Get image by file key for serving to users
 */
export async function getImageByKey(fileKey: string): Promise<Buffer | null> {
  const { readFileLocal } = await import("@/lib/local-storage");
  try {
    return await readFileLocal(fileKey);
  } catch {
    return null;
  }
}

// ============================================================
// Pipeline B (New): Defect Case Retrieval
// 支持图片+文字混合查询的缺陷案例检索流程
// ============================================================

interface IntentResult {
  query_type: "image_only" | "text_only" | "image_and_text";
  scope: "in_scope" | "out_of_scope";
  user_intent: string;
  search_strategy: {
    use_image_search: boolean;
    use_text_search: boolean;
    filters: {
      materials?: string;
      style?: string;
      claim_reason?: string;
      position?: string;
    };
  };
  search_queries: string[];
  key_entities: string[];
  reasoning: string;
}

interface CaseRetrievalResult {
  has_relevant: boolean;
  results: Array<{
    case_id: string;
    relevance_score: number;
    match_reason: string;
    image_similarity?: number;
    text_relevance?: number;
    filter_match?: {
      materials_match?: boolean;
      style_match?: boolean;
      position_match?: boolean;
    };
  }>;
  coverage_assessment: string;
}

interface AnswerGenerationResult {
  has_answer: boolean;
  answer: string;
  referenced_cases: string[];
  confidence: "high" | "medium" | "low" | "none";
}

/**
 * 缺陷案例检索 Pipeline V2（增强版）
 * 支持图片+文字混合查询 + 语义理解 + 智能回答聚合
 * 
 * 流程：
 * 1. Intent-Recognition Agent - 分析用户查询意图
 * 2. [新增] Semantic-Understanding Agent - 语义理解与同义词扩展
 * 3. 混合检索 - 图片相似度 + 文本匹配 + 分类检索
 * 4. Case-Retrieval Agent - 综合排序候选案例
 * 5. [新增] Response-Aggregator Agent - 智能回答生成（支持多种模式）
 */
export async function* defectCaseRetrievalPipeline(
  question: string,
  sessionId: string,
  requestHeaders?: Headers,
  imageData?: Buffer | null,
  imageMimeType?: string
): AsyncGenerator<string> {
  const client = getSupabaseClient();

  // Step 1: Intent Recognition
  let intentInput = `用户查询内容：${question}`;
  
  if (imageData) {
    intentInput += `\n\n[用户上传了图片，文件类型: ${imageMimeType || '未知'}]`;
    intentInput += `\n请分析用户的查询意图，包括图片和文字信息。`;
  }

  let intent: IntentResult;
  try {
    const intentRaw = await callAgent("intent-recognition", intentInput, requestHeaders);
    intent = parseAgentJson<IntentResult>(intentRaw);
  } catch (err) {
    console.error("Intent recognition failed:", err);
    intent = {
      query_type: imageData ? "image_and_text" : "text_only",
      scope: "in_scope",
      user_intent: question,
      search_strategy: {
        use_image_search: !!imageData,
        use_text_search: true,
        filters: {},
      },
      search_queries: [question],
      key_entities: [],
      reasoning: "默认意图识别",
    };
  }

  // Save user message with intent
  await client.from("chat_messages").insert({
    session_id: sessionId,
    role: "user",
    content: question,
    intent_result: intent,
  });

  // If out of scope, return rejection
  if (intent.scope === "out_of_scope") {
    const rejectionMsg = "抱歉，我是服装缺陷案例库助手，只能回答与服装缺陷、质量问题相关的问题。请尝试提问与缺陷类型、材料问题、工艺标准等相关的主题。";
    
    yield rejectionMsg;
    return;
  }

  // Step 1.5: Semantic Understanding (NEW)
  let semanticResult: any = null;
  try {
    const semanticPrompt = `用户查询：${question}
意图识别结果：${JSON.stringify(intent)}

请对用户查询进行语义理解，提取标准化术语和潜在需求。`;

    const semanticRaw = await callAgent("semantic-understanding", semanticPrompt, requestHeaders);
    semanticResult = parseAgentJson(semanticRaw);
  } catch (err: any) {
    console.log("Semantic understanding failed, using fallback:", err?.message);
    semanticResult = {
      normalized_query: {
        standard_defect_type: null,
        expanded_synonyms: intent.search_queries,
      },
      understood_intent: {
        intent_category: "general_qa",
        output_format_preference: "simple_answer",
      },
      search_strategy: {
        primary_search_terms: intent.search_queries,
        secondary_search_terms: [],
      },
    };
  }

  // Enhanced search terms from semantic understanding
  const enhancedSearchTerms = [
    ...(semanticResult?.search_strategy?.primary_search_terms || intent.search_queries),
    ...(semanticResult?.search_strategy?.secondary_search_terms || []),
    ...(semanticResult?.normalized_query?.expanded_synonyms || []),
  ];

  // Check if this is an image retrieval query (e.g., "给我几张抽丝的照片")
  const isImageRequest = 
    question.includes("照片") || 
    question.includes("图片") || 
    question.includes("例子") ||
    question.includes("example",) ||
    question.includes("show me") ||
    semanticResult?.understood_intent?.output_format_preference === "image_gallery";

  // Step 2: Hybrid Search for Defect Cases (enhanced with semantic terms)
  let candidates = await hybridCaseSearch(
    enhancedSearchTerms.length > 0 ? enhancedSearchTerms : intent.search_queries,
    intent.search_strategy.filters,
    isImageRequest ? 12 : 8,  // Get more results for image requests
    requestHeaders
  );

  // If semantic search found classification-based results, merge them
  if (semanticResult?.normalized_query?.standard_defect_type && candidates.length < 6) {
    try {
      const semanticResults = await searchImagesBySemanticQuery(
        semanticResult.normalized_query.standard_defect_type,
        8,
        requestHeaders
      );
      
      if (semanticResults.results.length > 0) {
        // Merge results, avoiding duplicates
        const existingIds = new Set(candidates.map(c => c.id));
        const newResults = semanticResults.results.filter((r: any) => !existingIds.has(r.id));
        candidates = [...candidates, ...newResults].slice(0, 15);
      }
    } catch (err: any) {
      console.log("Semantic image search failed:", err?.message);
    }
  }

  if (candidates.length === 0) {
    // Use response aggregator for friendly "no results" message
    const noResultInput = `用户查询：${question}
语义理解结果：${JSON.stringify(semanticResult)}
查询意图：${intent.user_intent}

当前知识库中没有找到相关案例。请生成友好的无结果回复。`;

    for await (const chunk of callAgentStream("response-aggregator", noResultInput, requestHeaders)) {
      yield chunk;
    }
    return;
  }

  // Step 3: Case Retrieval Agent (rerank)
  const candidatesText = candidates
    .slice(0, 10)
    .map((c: any, i: number) => `[案例${i + 1}]\nID: ${c.id}\n索赔原因: ${c.claim_reason}\n材料: ${c.materials || '未知'}\n位置: ${c.position || '未知'}\n描述: ${c.defect_description || ''}${c.document_images ? '\n有图片: 是' : ''}`)
    .join("\n\n---\n\n");

  const retrievalInput = `用户查询：${question}
查询类型：${intent.query_type}
语义理解结果：${JSON.stringify(semanticResult)}
是否图片请求：${isImageRequest}
意图分析：${JSON.stringify(intent)}

候选缺陷案例：
${candidatesText}`;

  let retrieval: CaseRetrievalResult;
  try {
    const retrievalRaw = await callAgent("case-retrieval", retrievalInput, requestHeaders);
    retrieval = parseAgentJson<CaseRetrievalResult>(retrievalRaw);
  } catch (err) {
    console.error("Case retrieval failed:", err);
    retrieval = {
      has_relevant: true,
      results: candidates.slice(0, 5).map((c: any) => ({
        case_id: c.id,
        relevance_score: 0.7,
        match_reason: `匹配到缺陷案例`,
      })),
      coverage_assessment: "一般",
    };
  }

  if (!retrieval.has_relevant) {
    const noRelevantInput = `用户查询：${question}
语义理解：${JSON.stringify(semanticResult)}

没有找到直接相关的案例，但可能有一些间接相关的信息。请基于以下候选案例给出有帮助的回答。

候选案例：
${candidatesText.slice(0, 2000)}`;

    for await (const chunk of callAgentStream("response-aggregator", noRelevantInput, requestHeaders)) {
      yield chunk;
    }
    return;
  }

  // Step 4 & 5: Response Aggregation (NEW - replaces simple answer generation)
  const referencedCases = retrieval.results.map((r) => r.case_id);
  
  // 获取引用案例的详细信息（包含图片）
  const caseDetails = await Promise.all(
    referencedCases.map(async (caseId) => {
      const { data } = await client
        .from("defect_cases")
        .select(`
          *,
          document_images (
            id, filename, file_key
          ),
          documents (
            id, filename
          )
        `)
        .eq("id", caseId)
        .maybeSingle();
      return data;
    })
  );

  // Build rich context for response aggregator
  const references = caseDetails
    .filter(Boolean)
    .map((c: any, i: number) => {
      let caseText = `[案例 ${i + 1}] ID: ${c.id}\n`;
      caseText += `索赔原因: ${c.claim_reason}\n`;
      caseText += `材料: ${c.materials || '未知'}\n`;
      caseText += `位置: ${c.position || '未知'}\n`;
      caseText += `描述: ${c.defect_description || '无'}\n`;
      if (c.document_images) {
        caseText += `图片文件: ${c.document_images.filename}\n`;
        caseText += `图片路径: /api/images/${c.document_images.id}\n`;
      }
      return caseText;
    })
    .join("\n\n---\n\n");

  // Get knowledge classifications for context
  let classificationContext = "";
  try {
    const classifications = await getClassifications("claim_reason");
    if (classifications.length > 0) {
      classificationContext = "\n\n# 可用的知识分类体系\n";
      classificationContext += classifications.slice(0, 10).map((cat: any) => 
        `- ${cat.category_name} (${cat.case_count}例)`
      ).join("\n");
    }
  } catch (err) {
    // Ignore classification fetch errors
  }

  const aggregatorInput = `# 用户查询
${question}

# 查询元数据
- 查询类型: ${intent.query_type}
- 是否请求图片: ${isImageRequest}
- 期望输出格式: ${semanticResult?.understood_intent?.output_format_preference || 'auto'}

# 语义理解结果
${JSON.stringify(semanticResult, null, 2)}

# 意图识别结果
${JSON.stringify(intent, null, 2)}

# 参考缺陷案例（共 ${caseDetails.filter(Boolean).length} 例）
${references}

# 知识分类上下文
${classificationContext || '(暂无分类数据)'}

---
请根据以上所有信息，为用户生成最合适的回答。
${isImageRequest ? '\n注意：用户明确要求查看图片，请在回答中展示相关案例的图片。' : ''}
${semanticResult?.understood_intent?.intent_category === 'material_analysis' ? '\n注意：这是关于材料的分析请求，请提供详细的分析报告格式。' : ''}`;

  // Stream the aggregated response
  let fullResponse = "";
  for await (const chunk of callAgentStream("response-aggregator", aggregatorInput, requestHeaders)) {
    fullResponse += chunk;
    yield chunk;
  }

  // Save assistant message
  await client.from("chat_messages").insert({
    session_id: sessionId,
    role: "assistant",
    content: fullResponse,
    sources: retrieval.results.map(r => ({
      chunk_id: r.case_id,
      relevance: r.relevance_score > 0.8 ? "high" : r.relevance_score > 0.5 ? "medium" : "low",
      reason: r.match_reason,
    })),
    intent_result: { ...intent, semantic_result: semanticResult },
  });
}

/**
 * 混合搜索缺陷案例
 * 支持：文本搜索 + 筛选条件过滤
 */
async function hybridCaseSearch(
  searchQueries: string[],
  filters: IntentResult["search_strategy"]["filters"],
  limit: number = 10,
  requestHeaders?: Headers
): Promise<Array<{
  id: string;
  claim_reason: string;
  materials: string | null;
  style: string | null;
  position: string | null;
  defect_description: string | null;
}>> {
  const client = getSupabaseClient();
  
  let query = client
    .from("defect_cases")
    .select(`
      id,
      claim_reason,
      materials,
      style,
      position,
      defect_description,
      text_embedding,
      document_images (
        id, filename, file_key
      )
    `)
    .order("created_at", { ascending: false })
    .limit(limit);

  // Apply filters
  if (filters.materials) {
    query = query.ilike("materials", `%${filters.materials}%`);
  }
  if (filters.style) {
    query = query.ilike("style", `%${filters.style}%`);
  }
  if (filters.claim_reason) {
    query = query.ilike("claim_reason", `%${filters.claim_reason}%`);
  }
  if (filters.position) {
    query = query.ilike("position", `%${filters.position}%`);
  }

  // Text search using search queries
  if (searchQueries.length > 0) {
    const searchText = searchQueries.join(" ");
    query = query.or(`claim_reason.ilike.%${searchText}%,defect_description.ilike.%${searchText}%,materials.ilike.%${searchText}%`);
  }

  const { data, error } = await query;

  if (error || !data) {
    console.error("Hybrid case search error:", error);
    return [];
  }

  return data as any[];
}

/**
 * 为缺陷案例生成文本向量并存储
 */
export async function generateAndStoreCaseEmbedding(caseId: string): Promise<void> {
  const client = getSupabaseClient();
  
  // 获取案例详情
  const { data: caseData, error } = await client
    .from("defect_cases")
    .select("*")
    .eq("id", caseId)
    .maybeSingle();

  if (error || !caseData) {
    console.error("Failed to get case for embedding:", error);
    return;
  }

  // 构建文本用于生成向量
  const textToEmbed = [
    caseData.claim_reason,
    caseData.materials,
    caseData.style,
    caseData.position,
    caseData.defect_description,
  ].filter(Boolean).join(" ");

  try {
    // 生成文本向量
    const embedding = await generateEmbedding(textToEmbed);
    
    // 存储向量
    await client
      .from("defect_cases")
      .update({ text_embedding: JSON.stringify(embedding) })
      .eq("id", caseId);
      
    console.log(`Generated and stored embedding for case ${caseId}`);
  } catch (err) {
    console.error("Failed to generate case embedding:", err);
  }
}

/**
 * 批量为所有缺陷案例生成向量
 */
export async function batchGenerateCaseEmbeddings(): Promise<number> {
  const client = getSupabaseClient();
  
  // 获取所有没有向量的案例
  const { data: cases, error } = await client
    .from("defect_cases")
    .select("id")
    .is("text_embedding", null);

  if (error || !cases || cases.length === 0) {
    return 0;
  }

  let processedCount = 0;
  for (const caseItem of cases) {
    await generateAndStoreCaseEmbedding(caseItem.id);
    processedCount++;
    
    // 避免请求过快
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return processedCount;
}
