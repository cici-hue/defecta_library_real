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

// 视觉模型配置
export interface VisionModelConfig {
  provider: "qwen" | "openai" | "custom";
  apiKey: string;
  baseUrl: string;
  model: string; // 如 qwen-vl-max, gpt-4o, gpt-4-turbo 等
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

# ============================================================
# 视觉模型配置（用于图片理解）
# ============================================================

# 视觉模型提供商: qwen | openai | custom
VISION_PROVIDER=qwen

# 视觉模型 API Key（可与LLM相同或不同）
VISION_API_KEY=your-vision-api-key

# 视觉模型 Base URL
# Qwen-VL 默认: https://dashscope.aliyuncs.com/compatible-mode/v1
# OpenAI 默认: https://api.openai.com/v1
VISION_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1

# 视觉模型名称
# Qwen: qwen-vl-max, qwen-vl-plus
# OpenAI: gpt-4o, gpt-4-turbo, gpt-4-vision-preview
VISION_MODEL=qwen-vl-max
`;

// 获取视觉模型配置
export function getVisionModelConfig(): VisionModelConfig | null {
  const provider = (process.env.VISION_PROVIDER as VisionModelConfig["provider"]) || "qwen";
  const apiKey = process.env.VISION_API_KEY || process.env.LLM_API_KEY || "";
  
  if (!apiKey) {
    console.warn("[Vision] No API key configured for vision model. Set VISION_API_KEY or LLM_API_KEY");
    return null;
  }

  const baseUrl = process.env.VISION_BASE_URL || 
    (provider === "qwen" ? "https://dashscope.aliyuncs.com/compatible-mode/v1" :
     provider === "openai" ? "https://api.openai.com/v1" : "");
  
  const model = process.env.VISION_MODEL || 
    (provider === "qwen" ? "qwen-vl-max" :
     provider === "openai" ? "gpt-4o" : "gpt-4o");

  return { provider, apiKey, baseUrl, model };
}

// 检查视觉模型是否已配置
export function isVisionModelConfigured(): boolean {
  return !!(process.env.VISION_API_KEY || process.env.LLM_API_KEY);
}
