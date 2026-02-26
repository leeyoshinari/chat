/**
 * 模型适配器注册表
 * 
 * 如何添加新的模型提供商:
 * 1. 在 services/adapters/ 目录下创建适配器文件
 * 2. 继承 BaseAdapter 实现 chat 和 chatStream 方法
 * 3. 在此文件中导入并注册适配器
 */

import { BaseAdapter } from "./base";
import { OpenAIAdapter } from "./openai";
import { GeminiAdapter } from "./gemini";
import { AnthropicAdapter } from "./anthropic";
import { CloudflareAdapter } from "./cloudflare";

/**
 * 适配器注册表
 * key 为提供商 ID，value 为适配器类
 */
const ADAPTERS: Record<string, new () => BaseAdapter> = {
  // OpenAI 及其兼容 API（DeepSeek、Qwen 等）
  openai: OpenAIAdapter,
  deepseek: OpenAIAdapter,
  qwen: OpenAIAdapter,
  
  // Cloudflare Workers AI（独立适配器，支持文生图/TTS/ASR）
  cloudflare: CloudflareAdapter,
  
  // Google Gemini
  google: GeminiAdapter,
  
  // Anthropic Claude
  anthropic: AnthropicAdapter,
};

/**
 * 获取适配器实例
 * @param providerId 提供商 ID
 */
export function getAdapter(providerId: string): BaseAdapter {
  const AdapterClass = ADAPTERS[providerId];
  if (!AdapterClass) {
    throw new Error(`Unknown provider: ${providerId}`);
  }
  return new AdapterClass();
}

/**
 * 检查提供商是否支持
 */
export function isProviderSupported(providerId: string): boolean {
  return providerId in ADAPTERS;
}

// 导出类型和基类
export type { AdapterRequest, AdapterResponse, StreamChunk } from "./base";
export { BaseAdapter } from "./base";
