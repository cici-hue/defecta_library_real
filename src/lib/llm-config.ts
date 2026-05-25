/**
 * LLM Configuration
 * 支持多种模型提供商：Coze/Doubao、DeepSeek、OpenAI 等
 */

export type LLMProvider = "coze" | "deepseek" | "openai" | "custom";

export interface LLMConfig {
  provider: LLMProvider;
  apiKey: string;
  baseUrl?: string;
  model: string;
  temperature?: number;
}

// 默认模型配置
export const DEFAULT_MODELS: Record<LLMProvider, { model: string; baseUrl?: string }> = {
  coze: {
    model: "doubao-seed-2-0-pro-260215",
    // Coze SDK 使用内置配置
  },
  deepseek: {
    model: "deepseek-chat",
    baseUrl: "https://api.deepseek.com/v1",
  },
  openai: {
    model: "gpt-4",
    baseUrl: "https://api.openai.com/v1",
  },
  custom: {
    model: "custom-model",
  },
};

// 从环境变量获取 LLM 配置
export function getLLMConfig(agentType?: "extraction" | "construction" | "intent" | "retrieval" | "answer"): LLMConfig {
  // 获取全局默认配置
  const provider = (process.env.LLM_PROVIDER as LLMProvider) || "coze";

  // 根据 agent 类型获取特定配置（如果设置了）
  const envPrefix = agentType ? `LLM_${agentType.toUpperCase()}_` : "LLM_";

  const apiKey = process.env[`${envPrefix}API_KEY`] || process.env.LLM_API_KEY || "";
  const baseUrl = process.env[`${envPrefix}BASE_URL`] || process.env.LLM_BASE_URL || DEFAULT_MODELS[provider].baseUrl;
  const model = process.env[`${envPrefix}MODEL`] || process.env.LLM_MODEL || DEFAULT_MODELS[provider].model;
  const temperature = parseFloat(process.env[`${envPrefix}TEMPERATURE`] || process.env.LLM_TEMPERATURE || "0.1");

  return {
    provider,
    apiKey,
    baseUrl,
    model,
    temperature,
  };
}

// 检查是否配置了 DeepSeek
export function isDeepSeekConfigured(): boolean {
  return !!(
    process.env.LLM_PROVIDER === "deepseek" &&
    process.env.LLM_API_KEY
  );
}

// 获取当前使用的提供商
export function getCurrentProvider(): LLMProvider {
  return (process.env.LLM_PROVIDER as LLMProvider) || "coze";
}

// 环境变量配置示例（用于文档）
export const ENV_EXAMPLE = `
# LLM 提供商配置
# 可选值: coze | deepseek | openai | custom
LLM_PROVIDER=deepseek

# API 密钥
LLM_API_KEY=your-api-key-here

# 基础 URL（可选，使用默认值可不填）
# DeepSeek 默认: https://api.deepseek.com/v1
# OpenAI 默认: https://api.openai.com/v1
LLM_BASE_URL=https://api.deepseek.com/v1

# 默认模型（可选）
# DeepSeek: deepseek-chat, deepseek-coder
# OpenAI: gpt-4, gpt-3.5-turbo
LLM_MODEL=deepseek-chat

# 默认温度（可选，默认 0.1）
LLM_TEMPERATURE=0.1

# 为特定 Agent 单独配置（可选）
# LLM_EXTRACTION_MODEL=deepseek-chat
# LLM_CONSTRUCTION_MODEL=deepseek-chat
# LLM_INTENT_MODEL=deepseek-chat
# LLM_RETRIEVAL_MODEL=deepseek-chat
# LLM_ANSWER_MODEL=deepseek-chat
`;
