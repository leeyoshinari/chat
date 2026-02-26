/**
 * 模型适配器基类
 * 
 * 如何添加新的模型提供商:
 * 1. 在 services/adapters/ 目录下创建新的适配器文件
 * 2. 继承 BaseAdapter 类
 * 3. 实现 chat 和 chatStream 方法
 * 4. 在 services/adapters/index.ts 中注册适配器
 * 
 * @example
 * ```typescript
 * // services/adapters/my-provider.ts
 * export class MyProviderAdapter extends BaseAdapter {
 *   async chat(request: AdapterRequest): Promise<AdapterResponse> {
 *     // 实现非流式对话
 *   }
 *   
 *   async *chatStream(request: AdapterRequest): AsyncGenerator<StreamChunk> {
 *     // 实现流式对话
 *   }
 * }
 * 
 * // services/adapters/index.ts
 * import { MyProviderAdapter } from './my-provider';
 * ADAPTERS['my-provider'] = MyProviderAdapter;
 * ```
 */

import { MessageContentItem, ToolCall, ToolDefinition } from "@/types";

/**
 * 适配器请求
 */
export interface AdapterRequest {
  /** 消息历史 */
  messages: Array<{
    role: "user" | "assistant" | "system";
    content: string | MessageContentItem[];
  }>;
  /** 模型 ID */
  model: string;
  /** API 地址 */
  baseUrl: string;
  /** API 密钥 */
  apiKey: string;
  /** 是否启用推理模式 */
  reasoning?: boolean;
  /** 工具列表 */
  tools?: ToolDefinition[];
  /** 温度 */
  temperature?: number;
  /** 最大输出 token */
  maxTokens?: number;
}

/**
 * 适配器响应
 */
export interface AdapterResponse {
  /** 文本内容 */
  content: string;
  /** 思考过程 */
  thinking?: string;
  /** 工具调用 */
  toolCalls?: ToolCall[];
  /** 生成的图片 */
  images?: string[];
  /** 使用的 token 数量 */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * 流式响应块
 */
export interface StreamChunk {
  /** 类型 */
  type: "text" | "thinking" | "tool_call" | "tool_result" | "image" | "done" | "error";
  /** 内容 */
  content?: string;
  /** 工具调用 */
  toolCall?: Partial<ToolCall>;
  /** 图片 URL */
  imageUrl?: string;
  /** 错误信息 */
  error?: string;
}

/**
 * 模型适配器基类
 */
export abstract class BaseAdapter {
  /**
   * 非流式对话
   */
  abstract chat(request: AdapterRequest): Promise<AdapterResponse>;

  /**
   * 流式对话
   */
  abstract chatStream(request: AdapterRequest): AsyncGenerator<StreamChunk>;

  /**
   * 将消息内容转换为纯文本
   */
  protected contentToText(content: string | MessageContentItem[]): string {
    if (typeof content === "string") return content;
    return content
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("\n");
  }

  /**
   * 提取图片 URL
   */
  protected extractImages(content: MessageContentItem[]): string[] {
    return content.filter((c) => c.type === "image").map((c) => c.url!);
  }
}
