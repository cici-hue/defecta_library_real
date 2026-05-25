/**
 * Agent Orchestration Layer
 *
 * This layer only handles data flow between agents.
 * All business intelligence lives in the agent prompts.
 */

import { LLMClient, Config, HeaderUtils } from "coze-coding-dev-sdk";
import { EmbeddingClient } from "coze-coding-dev-sdk";
import { AGENT_CONFIG, type AgentName } from "./prompts";
import { getLLMConfig, type LLMProvider } from "@/lib/llm-config";

// DeepSeek/OpenAI 兼容的 API 调用
async function callDeepSeekAPI(
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  model: string,
  temperature: number,
  apiKey: string,
  baseUrl: string,
  stream: boolean = false
): Promise<Response> {
  const url = `${baseUrl}/chat/completions`;

  const body = {
    model,
    messages,
    temperature,
    stream,
  };

  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
}

// 解析流式响应
async function* parseStreamResponse(response: Response): AsyncGenerator<string> {
  const reader = response.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === "data: [DONE]") continue;
        if (trimmed.startsWith("data: ")) {
          try {
            const data = JSON.parse(trimmed.slice(6));
            const content = data.choices?.[0]?.delta?.content || "";
            if (content) yield content;
          } catch {
            // 忽略解析错误
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Call an agent with structured output (non-streaming)
 */
export async function callAgent(
  agentName: AgentName,
  input: string,
  requestHeaders?: Headers
): Promise<string> {
  const config = AGENT_CONFIG[agentName];
  const llmConfig = getLLMConfig(
    agentName === "doc-extraction" ? "extraction" :
    agentName === "knowledge-construction" ? "construction" :
    agentName === "intent-recognition" ? "intent" :
    agentName === "case-retrieval" ? "retrieval" :
    agentName === "answer-generation" ? "answer" : undefined
  );

  // 如果使用 Coze/Doubao
  if (llmConfig.provider === "coze") {
    const customHeaders = requestHeaders
      ? HeaderUtils.extractForwardHeaders(requestHeaders)
      : undefined;

    const llmClient = new LLMClient(new Config(), customHeaders);

    const messages = [
      { role: "system" as const, content: config.systemPrompt },
      { role: "user" as const, content: input },
    ];

    const response = await llmClient.invoke(messages, {
      model: config.model,
      temperature: config.temperature,
    });

    return response.content;
  }

  // 如果使用 DeepSeek/OpenAI
  if (llmConfig.provider === "deepseek" || llmConfig.provider === "openai") {
    const response = await callDeepSeekAPI(
      [
        { role: "system", content: config.systemPrompt },
        { role: "user", content: input },
      ],
      llmConfig.model,
      llmConfig.temperature ?? config.temperature,
      llmConfig.apiKey,
      llmConfig.baseUrl || "https://api.deepseek.com/v1",
      false
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LLM API error: ${error}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
  }

  throw new Error(`Unsupported LLM provider: ${llmConfig.provider}`);
}

/**
 * Call an agent with streaming output
 */
export async function* callAgentStream(
  agentName: AgentName,
  input: string,
  requestHeaders?: Headers
): AsyncGenerator<string> {
  const config = AGENT_CONFIG[agentName];
  const llmConfig = getLLMConfig(
    agentName === "answer-generation" ? "answer" : undefined
  );

  // 如果使用 Coze/Doubao
  if (llmConfig.provider === "coze") {
    const customHeaders = requestHeaders
      ? HeaderUtils.extractForwardHeaders(requestHeaders)
      : undefined;

    const llmClient = new LLMClient(new Config(), customHeaders);

    const messages = [
      { role: "system" as const, content: config.systemPrompt },
      { role: "user" as const, content: input },
    ];

    const stream = llmClient.stream(messages, {
      model: config.model,
      temperature: config.temperature,
    });

    for await (const chunk of stream) {
      if (chunk.content) {
        yield chunk.content.toString();
      }
    }
    return;
  }

  // 如果使用 DeepSeek/OpenAI
  if (llmConfig.provider === "deepseek" || llmConfig.provider === "openai") {
    const response = await callDeepSeekAPI(
      [
        { role: "system", content: config.systemPrompt },
        { role: "user", content: input },
      ],
      llmConfig.model,
      llmConfig.temperature ?? config.temperature,
      llmConfig.apiKey,
      llmConfig.baseUrl || "https://api.deepseek.com/v1",
      true
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LLM API error: ${error}`);
    }

    yield* parseStreamResponse(response);
    return;
  }

  throw new Error(`Unsupported LLM provider: ${llmConfig.provider}`);
}

/**
 * Generate embedding for a text
 */
export async function generateEmbedding(
  text: string,
  requestHeaders?: Headers
): Promise<number[]> {
  const llmConfig = getLLMConfig();

  // 如果使用 Coze/Doubao
  if (llmConfig.provider === "coze") {
    const customHeaders = requestHeaders
      ? HeaderUtils.extractForwardHeaders(requestHeaders)
      : undefined;

    const client = new EmbeddingClient(new Config(), customHeaders);
    const embedding = await client.embedText(text, { dimensions: 1024 });
    return embedding;
  }

  // 如果使用 DeepSeek/OpenAI，使用他们的 embedding API
  if (llmConfig.provider === "deepseek" || llmConfig.provider === "openai") {
    const baseUrl = llmConfig.baseUrl || "https://api.deepseek.com/v1";
    const response = await fetch(`${baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${llmConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: llmConfig.provider === "deepseek" ? "deepseek-embedding" : "text-embedding-3-small",
        input: text,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Embedding API error: ${error}`);
    }

    const data = await response.json();
    return data.data?.[0]?.embedding || [];
  }

  throw new Error(`Unsupported LLM provider for embedding: ${llmConfig.provider}`);
}

/**
 * Generate embeddings for multiple texts
 */
export async function generateEmbeddings(
  texts: string[],
  requestHeaders?: Headers
): Promise<number[][]> {
  const embeddings: number[][] = [];
  for (const text of texts) {
    const embedding = await generateEmbedding(text, requestHeaders);
    embeddings.push(embedding);
  }
  return embeddings;
}

/**
 * Compute cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  return dotProduct / denominator;
}

/**
 * Parse JSON from agent output, handling possible markdown code blocks
 */
export function parseAgentJson<T = unknown>(content: string): T {
  // Try to extract JSON from markdown code blocks
  const jsonMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  const jsonStr = jsonMatch ? jsonMatch[1] : content;

  try {
    return JSON.parse(jsonStr.trim()) as T;
  } catch {
    // Try to find the first { and last } and extract
    const firstBrace = jsonStr.indexOf("{");
    const lastBrace = jsonStr.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1) {
      return JSON.parse(jsonStr.slice(firstBrace, lastBrace + 1)) as T;
    }
    throw new Error("Failed to parse agent JSON output");
  }
}
