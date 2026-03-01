/**
 * 模型提供商配置
 * 
 * 如何添加新的模型提供商:
 * 1. 在 .env 文件中添加配置：
 *    - XXX_ENABLED=true
 *    - XXX_BASE_URL=https://api.xxx.com
 *    - XXX_API_KEY=your-api-key
 *    - XXX_MODELS=model-id=显示名称<capabilities>,...
 * 
 * 2. capabilities 说明（用尖括号包裹，冒号分隔）:
 *    - fc: 支持函数/工具调用
 *    - vision: 支持图片输入
 *    - file: 支持文件输入
 *    - reasoning: 支持推理思考模式
 *    - imageOutput: 支持图片生成
 *    - search: 支持内置联网搜索
 * 
 * 3. 示例:
 *    OPENAI_MODELS=gpt-4o=GPT-4o<fc:vision>,gpt-4o-mini=GPT-4o Mini<fc:vision>
 */

import { ModelCapabilities, ModelConfig, ProviderConfig } from "@/types";

/**
 * 解析模型能力字符串
 * @param capStr 能力字符串，如 "fc:vision:reasoning"
 */
function parseCapabilities(capStr: string): ModelCapabilities {
  const caps: ModelCapabilities = {};
  if (!capStr) return caps;

  const parts = capStr.split(":");
  parts.forEach((cap) => {
    switch (cap.toLowerCase()) {
      case "fc":
        caps.functionCall = true;
        break;
      case "vision":
        caps.vision = true;
        break;
      case "file":
        caps.file = true;
        break;
      case "reasoning":
        caps.reasoning = true;
        break;
      case "imageoutput":
        caps.imageOutput = true;
        break;
      case "search":
        caps.search = true;
        break;
      case "tts":
        caps.tts = true;
        break;
      case "asr":
        caps.asr = true;
        break;
      case "stt":
        caps.stt = true;
        break;
    }
  });

  return caps;
}

/**
 * 解析模型配置字符串
 * @param modelStr 模型字符串，如 "gpt-4o=GPT-4o<fc:vision>"
 */
function parseModelConfig(modelStr: string): ModelConfig | null {
  // 格式: model-id=Display Name<capabilities>
  const match = modelStr.match(/^([^=]+)=([^<]+)(?:<([^>]*)>)?$/);
  if (!match) return null;

  const [, id, name, capStr] = match;
  return {
    id: id.trim(),
    name: name.trim(),
    capabilities: parseCapabilities(capStr || ""),
  };
}

/**
 * 解析模型列表字符串
 * @param modelsStr 模型列表字符串，逗号分隔
 */
function parseModels(modelsStr: string): ModelConfig[] {
  if (!modelsStr) return [];
  return modelsStr
    .split(",")
    .map((s) => parseModelConfig(s.trim()))
    .filter((m): m is ModelConfig => m !== null);
}

/**
 * 提供商配置定义
 * 添加新提供商时，在此处添加配置
 */
interface ProviderEnvConfig {
  id: string;
  name: string;
  icon: string;
  envPrefix: string;
}

/**
 * 支持的提供商列表
 * 添加新提供商时，在此数组中添加配置
 */
const PROVIDER_CONFIGS: ProviderEnvConfig[] = [
  {
    id: "openai",
    name: "OpenAI",
    icon: "/icons/openai.svg",
    envPrefix: "OPENAI",
  },
  {
    id: "google",
    name: "Google",
    icon: "/icons/google.svg",
    envPrefix: "GOOGLE",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    icon: "/icons/anthropic.svg",
    envPrefix: "ANTHROPIC",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    icon: "/icons/deepseek.svg",
    envPrefix: "DEEPSEEK",
  },
  {
    id: "qwen",
    name: "Qwen",
    icon: "/icons/qwen.svg",
    envPrefix: "QWEN",
  },
  {
    id: "cloudflare",
    name: "Cloudflare Workers AI",
    icon: "/icons/cloudflare.svg",
    envPrefix: "CLOUDFLARE",
  },
];

/**
 * 获取所有提供商配置
 * 从环境变量中读取配置
 */
export function getProviderConfigs(): ProviderConfig[] {
  const providers: ProviderConfig[] = [];

  for (const config of PROVIDER_CONFIGS) {
    const enabled = process.env[`${config.envPrefix}_ENABLED`] === "true";
    
    // 只返回启用的提供商
    if (!enabled) continue;

    const baseUrl = process.env[`${config.envPrefix}_BASE_URL`] || "";
    const apiKey = process.env[`${config.envPrefix}_API_KEY`] || "";
    const modelsStr = process.env[`${config.envPrefix}_MODELS`] || "";

    providers.push({
      id: config.id,
      name: config.name,
      enabled,
      baseUrl,
      apiKey,
      models: parseModels(modelsStr),
      icon: config.icon,
    });
  }

  return providers;
}

/**
 * 获取所有启用的模型
 * 返回扁平化的模型列表，包含提供商信息
 */
export function getAllModels(): Array<ModelConfig & { providerId: string; providerName: string }> {
  const providers = getProviderConfigs();
  const models: Array<ModelConfig & { providerId: string; providerName: string }> = [];

  for (const provider of providers) {
    for (const model of provider.models) {
      models.push({
        ...model,
        providerId: provider.id,
        providerName: provider.name,
      });
    }
  }

  return models;
}

/**
 * 根据模型 ID 获取模型配置
 */
export function getModelById(
  modelId: string,
  providerId: string
): ModelConfig | undefined {
  const providers = getProviderConfigs();
  const provider = providers.find((p) => p.id === providerId);
  return provider?.models.find((m) => m.id === modelId);
}

/**
 * 根据提供商 ID 获取提供商配置
 */
export function getProviderById(providerId: string): ProviderConfig | undefined {
  return getProviderConfigs().find((p) => p.id === providerId);
}
