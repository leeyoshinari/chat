/**
 * 类型定义文件
 * 定义整个项目的核心类型
 */

// ============================================
// 消息相关类型
// ============================================

/**
 * 消息角色类型
 */
export type MessageRole = "user" | "assistant" | "system";

/**
 * 消息内容类型 - 支持多模态
 */
export type MessageContentType = "text" | "image" | "file" | "audio" | "video";

/**
 * 消息内容项
 */
export interface MessageContentItem {
  /** 内容类型 */
  type: MessageContentType;
  /** 文本内容 */
  text?: string;
  /** 媒体 URL 或 base64 */
  url?: string;
  /** 文件名 */
  fileName?: string;
  /** MIME 类型 */
  mimeType?: string;
}

/**
 * 搜索结果项
 */
export interface SearchResultItem {
  title: string;
  url: string;
  snippet: string;
}

/**
 * 搜索结果
 */
export interface SearchResults {
  query: string;
  results: SearchResultItem[];
  resultCount: number;
}

/**
 * 聊天消息
 */
export interface Message {
  /** 消息唯一 ID */
  id: string;
  /** 所属会话 ID */
  sessionId: string;
  /** 消息角色 */
  role: MessageRole;
  /** 消息内容（支持多模态） */
  content: MessageContentItem[];
  /** 思考过程（仅 assistant） */
  thinking?: string;
  /** 搜索结果 */
  searchResults?: SearchResults;
  /** 使用的模型 */
  model?: string;
  /** 调用的工具列表 */
  tools?: ToolCall[];
  /** 创建时间 */
  createdAt: number;
  /** 是否正在生成 */
  isStreaming?: boolean;
}

// ============================================
// 会话相关类型
// ============================================

/**
 * 对话会话
 */
export interface Session {
  /** 会话唯一 ID */
  id: string;
  /** 会话标题 */
  title: string;
  /** 使用的模型 ID */
  modelId: string;
  /** 使用的角色/提示词 ID */
  roleId?: string;
  /** 启用的工具列表 */
  enabledTools?: string[];
  /** 创建时间 */
  createdAt: number;
  /** 更新时间 */
  updatedAt: number;
}

// ============================================
// 模型相关类型
// ============================================

/**
 * 模型能力
 */
export interface ModelCapabilities {
  /** 支持函数调用 */
  functionCall?: boolean;
  /** 支持图片输入 */
  vision?: boolean;
  /** 支持文件输入 */
  file?: boolean;
  /** 支持推理思考 */
  reasoning?: boolean;
  /** 支持图片生成 */
  imageOutput?: boolean;
  /** 支持联网搜索 */
  search?: boolean;
  /** 支持语音生成 */
  tts?: boolean;
}

/**
 * 模型配置
 */
export interface ModelConfig {
  /** 模型 ID（API 调用时使用） */
  id: string;
  /** 显示名称 */
  name: string;
  /** 模型能力 */
  capabilities: ModelCapabilities;
  /** 上下文窗口大小 */
  contextWindow?: number;
}

/**
 * 模型提供商配置
 */
export interface ProviderConfig {
  /** 提供商 ID */
  id: string;
  /** 提供商名称 */
  name: string;
  /** 是否启用 */
  enabled: boolean;
  /** API 地址 */
  baseUrl: string;
  /** API 密钥 */
  apiKey: string;
  /** 模型列表 */
  models: ModelConfig[];
  /** 图标路径 */
  icon?: string;
}

// ============================================
// 工具相关类型
// ============================================

/**
 * 工具参数定义
 */
export interface ToolParameter {
  /** 参数名 */
  name: string;
  /** 参数类型 */
  type: "string" | "number" | "boolean" | "object" | "array";
  /** 参数描述 */
  description: string;
  /** 是否必填 */
  required?: boolean;
  /** 枚举值 */
  enum?: string[];
}

/**
 * 工具定义
 */
export interface ToolDefinition {
  /** 工具唯一 ID */
  id: string;
  /** 工具名称 */
  name: string;
  /** 工具描述 */
  description: string;
  /** 工具图标 */
  icon?: string;
  /** 工具参数 */
  parameters: ToolParameter[];
  /** 是否为内置工具 */
  builtin?: boolean;
  /** 是否启用 */
  enabled?: boolean;
}

/**
 * 工具调用
 */
export interface ToolCall {
  /** 调用 ID */
  id: string;
  /** 工具名称 */
  name: string;
  /** 调用参数 */
  arguments: Record<string, unknown>;
  /** 调用结果 */
  result?: unknown;
  /** 调用状态 */
  status: "pending" | "running" | "success" | "error";
  /** 错误信息 */
  error?: string;
}

// ============================================
// 角色/提示词相关类型
// ============================================

/**
 * 角色定义
 */
export interface Role {
  /** 角色 ID */
  id: string;
  /** 角色名称 */
  name: string;
  /** 角色描述 */
  description?: string;
  /** 系统提示词 */
  systemPrompt: string;
  /** 角色图标 */
  icon?: string;
  /** 标签 */
  tags?: string[];
}

// ============================================
// 聊天请求/响应类型
// ============================================

/**
 * 聊天请求
 */
export interface ChatRequest {
  /** 消息历史 */
  messages: Array<{
    role: MessageRole;
    content: string | MessageContentItem[];
  }>;
  /** 模型 ID */
  model: string;
  /** 提供商 ID */
  provider: string;
  /** 是否启用流式输出 */
  stream?: boolean;
  /** 是否启用推理模式 */
  reasoning?: boolean;
  /** 启用的工具 */
  tools?: ToolDefinition[];
  /** 温度 */
  temperature?: number;
  /** 最大输出 token */
  maxTokens?: number;
  /** 访问密码 */
  password?: string;
}

/**
 * 流式响应事件类型
 */
export type StreamEventType =
  | "text" // 文本内容
  | "thinking" // 思考过程
  | "tool_call" // 工具调用
  | "tool_result" // 工具结果
  | "image" // 图片输出
  | "error" // 错误
  | "done"; // 完成

/**
 * 流式响应事件
 */
export interface StreamEvent {
  type: StreamEventType;
  data: unknown;
}

// ============================================
// 应用状态类型
// ============================================

/**
 * 应用设置
 */
export interface AppSettings {
  /** 当前语言 */
  locale: string;
  /** 主题模式 */
  theme: "light" | "dark" | "system";
  /** 默认模型 */
  defaultModel?: string;
  /** 历史消息限制 */
  historyLimit: number;
  /** 访问密码 */
  accessPassword?: string;
}

/**
 * 聊天状态
 */
export interface ChatState {
  /** 当前会话 ID */
  currentSessionId: string | null;
  /** 会话列表 */
  sessions: Session[];
  /** 当前会话的消息 */
  messages: Message[];
  /** 是否正在加载 */
  isLoading: boolean;
  /** 当前选择的模型 */
  selectedModel: string | null;
  /** 当前选择的提供商 */
  selectedProvider: string | null;
  /** 是否启用推理模式 */
  reasoningEnabled: boolean;
  /** 启用的工具列表 */
  enabledTools: string[];
}
