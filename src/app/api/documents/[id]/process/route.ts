import { NextRequest, NextResponse } from "next/server";
import { S3Storage } from "coze-coding-dev-sdk";
import { getSupabaseClient } from "@/storage/database/supabase-client"; 
import { 
  processDocument, 
  processDocumentImages,
  extractDefectCases,
  saveDefectCases,
  classifyKnowledge
} from "@/lib/agents/pipelines";
import { parseDocument } from "@/lib/document-parser";
import { readFileLocal } from "@/lib/local-storage";

const useLocalStorage = !process.env.COZE_BUCKET_ENDPOINT_URL;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const client = getSupabaseClient();

    const { data: doc, error: docError } = await client
      .from("documents")
      .select("id, filename, file_key, file_type, file_size, status")
      .eq("id", id)
      .maybeSingle();

    if (docError) throw new Error(`查询文档失败: ${docError.message}`);
    if (!doc) return NextResponse.json({ error: "文档不存在" }, { status: 404 });
    if (doc.status === "processing") {
      return NextResponse.json({ error: "文档正在处理中" }, { status: 409 });
    }

    let fileBuffer: Buffer;
    if (useLocalStorage) {
      fileBuffer = await readFileLocal(doc.file_key);
    } else {
      const storage = new S3Storage({
        endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
        accessKey: "",
        secretKey: "",
        bucketName: process.env.COZE_BUCKET_NAME,
        region: "cn-beijing",
      });
      fileBuffer = await storage.readFile({ fileKey: doc.file_key });
    }

    const parsedDoc = await parseDocument(fileBuffer, doc.filename, doc.file_size);

    // 记录解析结果
    console.log(`[Document ${id}] Parsed document:`);
    console.log(`  - Type: ${parsedDoc.type}`);
    console.log(`  - Images found: ${parsedDoc.images?.length || 0}`);
    if (parsedDoc.images && parsedDoc.images.length > 0) {
      parsedDoc.images.forEach((img, i) => {
        console.log(`  - Image ${i+1}: ${img.filename} (${img.mimeType}, ${img.size} bytes)`);
      });
    }

    // 异步处理所有流程
    (async () => {
      try {
        // 1. 处理图片存储
        let storedImages: Array<{ id: string; filename: string }> = [];
        if (parsedDoc.images && parsedDoc.images.length > 0) {
          storedImages = await processDocumentImages(id, parsedDoc.images);
          console.log(`[Document ${id}] Stored ${storedImages.length} images`);
        }

        // 2. 提取缺陷案例
        if (storedImages.length > 0 && parsedDoc.images) {
          const imagesWithText = parsedDoc.images.map(img => ({
            filename: img.filename,
            sourceSlide: img.sourceSlide || null,
            slideText: img.slideText || "",
          }));
          const extractedCases = await extractDefectCases(parsedDoc.content, imagesWithText);
          console.log(`[Document ${id}] Extracted ${extractedCases.length} defect cases`);

          // 3. 保存缺陷案例
          if (extractedCases.length > 0) {
            const savedCount = await saveDefectCases(id, extractedCases, storedImages);
            console.log(`[Document ${id}] Saved ${savedCount} defect cases`);
          }
        }

        // 4. 处理文档内容（原有的知识块生成）
        await processDocument(id, parsedDoc.content, request.headers);
        console.log(`[Document ${id}] Document processing completed`);

        // 5. 触发知识分类（异步，不阻塞响应）
        try {
          const classificationResult = await classifyKnowledge(request.headers);
          if (classificationResult) {
            console.log(`[Document ${id}] Knowledge classification completed: v${classificationResult.classification_version}`);
            console.log(`  - Claim categories: ${classificationResult.claim_categories?.length || 0}`);
            console.log(`  - Material categories: ${classificationResult.material_categories?.length || 0}`);
            console.log(`  - Position categories: ${classificationResult.position_categories?.length || 0}`);
          }
        } catch (classifyErr) {
          // Classification failure should not fail the whole process
          console.warn(`[Document ${id}] Knowledge classification failed (non-fatal):`, classifyErr);
        }

        // 更新状态
        const client = getSupabaseClient();
        await client.from("documents").update({ status: "completed" }).eq("id", id);
      } catch (err) {
        console.error(`[Document ${id}] Processing failed:`, err);
        
        // 更新状态为失败
        const client = getSupabaseClient();
        await client.from("documents").update({ status: "failed" }).eq("id", id);
      }
    })();

    return NextResponse.json({
      message: "文档处理已开始",
      document_id: id,
      file_type: parsedDoc.type,
      image_count: parsedDoc.images?.length || 0,
      images_preview: parsedDoc.images?.slice(0, 3).map((img) => ({
        filename: img.filename,
        mimeType: img.mimeType,
        size: img.size,
      })),
    });
  } catch (error) {
    console.error("Document processing error:", error);
    const message = error instanceof Error ? error.message : "处理失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
