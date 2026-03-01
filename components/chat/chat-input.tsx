/**
 * 输入框组件
 * 支持文本输入、文件上传、角色选择等功能
 */
"use client";

import React, { memo, useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn, fileToBase64 } from "@/lib/utils";
import {
  Send,
  Image,
  FileUp,
  Sparkles,
  Trash2,
  Plus,
  X,
  Loader2,
  Square,
  Globe,
  AudioLines,
  Mic,
} from "lucide-react";
import { ModelSelector } from "./model-selector";
import { ToolSelector } from "./tool-selector";
import type { Role, ModelConfig, ToolDefinition } from "@/types";

/**
 * 语音模式类型
 */
export type SpeechMode = "asr" | "stt" | "asr+stt";

/**
 * 语音能力选择状态
 */
export interface SpeechSelection {
  asrEnabled: boolean;
  sttEnabled: boolean;
}

/**
 * 附件类型
 */
interface Attachment {
  id: string;
  type: "image" | "file";
  name: string;
  url: string;
  mimeType: string;
}

/**
 * 提供商分组
 */
interface ProviderGroup {
  id: string;
  name: string;
  icon: string;
  models: Array<ModelConfig & { providerId: string }>;
}

/**
 * 输入框属性
 */
interface ChatInputProps {
  /** 发送消息回调 */
  onSend: (content: string, attachments: Attachment[]) => void;
  /** 提供商分组 */
  providers: ProviderGroup[];
  /** 当前选中的模型 ID */
  selectedModelId: string | null;
  /** 当前选中的提供商 ID */
  selectedProviderId: string | null;
  /** 选择模型回调 */
  onSelectModel: (modelId: string, providerId: string) => void;
  /** 可用工具列表 */
  tools: ToolDefinition[];
  /** 已启用的工具 */
  enabledTools: string[];
  /** 切换工具回调 */
  onToggleTool: (toolId: string) => void;
  /** 是否启用推理模式 */
  reasoningEnabled: boolean;
  /** 切换推理模式回调 */
  onToggleReasoning: () => void;
  /** 清空历史回调 */
  onClearHistory: () => void;
  /** 新建对话回调 */
  onNewChat: () => void;
  /** 角色列表 */
  roles: Role[];
  /** 选择角色回调，返回 systemPrompt */
  onSelectRole: (roleId: string) => string | undefined;
  /** 是否正在加载 */
  isLoading?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** 停止响应回调 */
  onStop?: () => void;
  /** 联网搜索是否启用 */
  searchEnabled?: boolean;
  /** 切换联网搜索 */
  onToggleSearch?: () => void;
  /** 语音能力选择状态 */
  speechSelection?: SpeechSelection;
  /** 切换 ASR 能力 */
  onToggleAsr?: () => void;
  /** 切换 STT 能力 */
  onToggleStt?: () => void;
}

/**
 * 获取当前语言
 */
function getLanguage(): "zh" | "en" {
  if (typeof navigator === "undefined") return "en";
  const lang = navigator.language.toLowerCase();
  return lang.startsWith("zh") ? "zh" : "en";
}

const i18n = {
  placeholder: {
    zh: "输入消息... Enter 发送，Shift+Enter 换行",
    en: "Type a message... Enter to send, Shift+Enter for new line",
  },
  asr: { zh: "语音转语音", en: "Speech to Speech" },
  stt: { zh: "语音转文字", en: "Speech to Text" },
  uploadAudio: { zh: "上传音频", en: "Upload Audio" },
};

/**
 * 输入框组件
 */
export const ChatInput = memo(function ChatInput({
  onSend,
  providers,
  selectedModelId,
  selectedProviderId,
  onSelectModel,
  tools,
  enabledTools,
  onToggleTool,
  reasoningEnabled,
  onToggleReasoning,
  onClearHistory,
  onNewChat,
  roles,
  onSelectRole,
  isLoading,
  disabled,
  onStop,
  searchEnabled,
  onToggleSearch,
  speechSelection = { asrEnabled: false, sttEnabled: false },
  onToggleAsr,
  onToggleStt,
}: ChatInputProps) {
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [showRoles, setShowRoles] = useState(false);
  const [roleFilter, setRoleFilter] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  // 获取当前模型能力
  const currentModel = React.useMemo(() => {
    if (!selectedModelId || !selectedProviderId) return null;
    const provider = providers.find((p) => p.id === selectedProviderId);
    return provider?.models.find((m) => m.id === selectedModelId);
  }, [providers, selectedModelId, selectedProviderId]);

  const capabilities = currentModel?.capabilities || {};

  // 过滤角色
  const filteredRoles = React.useMemo(() => {
    if (!roleFilter) return roles;
    const lower = roleFilter.toLowerCase();
    return roles.filter(
      (r) =>
        r.name.toLowerCase().includes(lower) ||
        r.description?.toLowerCase().includes(lower)
    );
  }, [roles, roleFilter]);

  // 处理输入变化
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setInput(value);

      // 检测 / 开头，显示角色选择
      if (value.startsWith("/")) {
        setShowRoles(true);
        setRoleFilter(value.slice(1));
      } else {
        setShowRoles(false);
        setRoleFilter("");
      }
    },
    []
  );

  // 收起移动端键盘 - iOS Safari 需要特殊处理
  const dismissKeyboard = useCallback(() => {
    // 立即 blur 当前活跃元素
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    // 双重保障：textarea 也显式 blur
    textareaRef.current?.blur();
    // iOS Safari 需要延迟再次尝试，因为 React 状态更新可能导致重新聚焦
    setTimeout(() => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      textareaRef.current?.blur();
    }, 50);
  }, []);

  // 处理发送
  const handleSend = useCallback(() => {
    if (!input.trim() && attachments.length === 0) return;
    if (isLoading || disabled) return;

    // 先收起键盘，再更新状态（顺序很重要，iOS 上反过来会失效）
    dismissKeyboard();

    onSend(input.trim(), attachments);
    setInput("");
    setAttachments([]);
  }, [input, attachments, isLoading, disabled, onSend, dismissKeyboard]);

  // 处理键盘事件
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Enter 发送（不带 Shift）
      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        handleSend();
      }
      // Shift+Enter 换行（浏览器默认行为，无需处理）
    },
    [handleSend]
  );

  const lang = useMemo(() => getLanguage(), []);

  // 检查是否有音频文件附件
  const hasAudioAttachment = useMemo(() => {
    return attachments.some((a) => 
      a.mimeType.startsWith("audio/") || 
      [".mp3", ".wav", ".flac", ".ogg", ".m4a"].some(ext => a.name.toLowerCase().endsWith(ext))
    );
  }, [attachments]);

  // 计算发送按钮是否禁用
  const isSendDisabled = useMemo(() => {
    // 正在加载时禁用
    if (disabled) return true;
    // 如果正在流式输出，显示停止按钮，不禁用
    if (isLoading) return false;
    
    // 基本条件：有输入或有附件
    const hasContent = input.trim() || attachments.length > 0;
    if (!hasContent) return true;

    // 如果模型同时支持 asr 和 stt
    if (capabilities.asr && capabilities.stt) {
      // 如果有音频文件，必须至少选择一个能力
      if (hasAudioAttachment) {
        const hasSelectedCapability = speechSelection.asrEnabled || speechSelection.sttEnabled;
        if (!hasSelectedCapability) return true;
      }
    }
    
    return false;
  }, [disabled, isLoading, input, attachments, capabilities, hasAudioAttachment, speechSelection]);

  // 处理文件上传
  const handleFileUpload = useCallback(
    async (files: FileList | null, type: "image" | "file") => {
      if (!files) return;

      for (const file of Array.from(files)) {
        const url = await fileToBase64(file);
        const attachment: Attachment = {
          id: crypto.randomUUID(),
          type,
          name: file.name,
          url,
          mimeType: file.type,
        };
        setAttachments((prev) => [...prev, attachment]);
      }
    },
    []
  );

  // 移除附件
  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // 选择角色 - 将 systemPrompt 填充到输入框
  const handleSelectRole = useCallback(
    (roleId: string) => {
      const prompt = onSelectRole(roleId);
      if (prompt) {
        setInput(prompt);
      }
      setShowRoles(false);
      setRoleFilter("");
      textareaRef.current?.focus();
    },
    [onSelectRole]
  );

  // 点击外部关闭角色选择
  useEffect(() => {
    const handleClickOutside = () => {
      if (showRoles) {
        setShowRoles(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [showRoles]);

  return (
    <div className="border-t bg-background p-4">
      {/* 工具栏 */}
      <div className="flex items-center gap-1 mb-3 flex-wrap">
        {/* 模型选择器 */}
        <ModelSelector
          providers={providers}
          selectedModelId={selectedModelId}
          selectedProviderId={selectedProviderId}
          onSelect={onSelectModel}
          disabled={disabled}
        />

        {/* 推理模式（如果支持） */}
        {capabilities.reasoning && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={reasoningEnabled ? "default" : "ghost"}
                  size="icon"
                  onClick={onToggleReasoning}
                  disabled={disabled}
                >
                  <Sparkles className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>推理模式</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* 上传图片（如果支持） */}
        {capabilities.vision && (
          <>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleFileUpload(e.target.files, "image")}
            />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={disabled}
                  >
                    <Image className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>上传图片</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </>
        )}

        {/* 上传文件（如果支持） */}
        {capabilities.file && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleFileUpload(e.target.files, "file")}
            />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={disabled}
                  >
                    <FileUp className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>上传文件</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </>
        )}

        {/* ASR 能力开关（如果支持） */}
        {capabilities.asr && onToggleAsr && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={speechSelection.asrEnabled ? "default" : "ghost"}
                  size="icon"
                  onClick={onToggleAsr}
                  disabled={disabled}
                >
                  <Mic className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{i18n.asr[lang]}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* STT 能力开关（如果支持） */}
        {capabilities.stt && onToggleStt && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={speechSelection.sttEnabled ? "default" : "ghost"}
                  size="icon"
                  onClick={onToggleStt}
                  disabled={disabled}
                >
                  <AudioLines className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{i18n.stt[lang]}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* 上传音频（如果支持语音识别 asr 或 stt） */}
        {(capabilities.asr || capabilities.stt) && (
          <>
            <input
              ref={audioInputRef}
              type="file"
              accept=".mp3,.wav,.flac,.ogg,.m4a,audio/mp3,audio/wav,audio/flac,audio/ogg"
              className="hidden"
              onChange={(e) => handleFileUpload(e.target.files, "file")}
            />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => audioInputRef.current?.click()}
                    disabled={disabled}
                  >
                    <FileUp className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{i18n.uploadAudio[lang]}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </>
        )}

        {/* 工具选择器（如果支持且工具列表不为空） */}
        {capabilities.functionCall && tools.length > 0 && (
          <ToolSelector
            tools={tools}
            enabledTools={enabledTools}
            onToggle={onToggleTool}
            disabled={disabled}
          />
        )}

        {/* 联网搜索（如果模型支持） */}
        {capabilities.search && onToggleSearch && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={searchEnabled ? "default" : "ghost"}
                  size="icon"
                  onClick={onToggleSearch}
                  disabled={disabled}
                >
                  <Globe className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>联网搜索</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* 分隔符 */}
        <div className="flex-1" />

        {/* 清空历史 */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClearHistory}
                disabled={disabled}
              >
                <Trash2 className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>清空历史</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* 新建对话 */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onNewChat}
                disabled={disabled}
              >
                <Plus className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>新建对话</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* 附件预览 */}
      {attachments.length > 0 && (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="relative group flex items-center gap-2 p-2 bg-muted rounded-lg"
            >
              {attachment.type === "image" ? (
                <img
                  src={attachment.url}
                  alt={attachment.name}
                  className="h-16 w-16 object-cover rounded"
                />
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-2xl">📎</span>
                  <span className="text-sm truncate max-w-[100px]">
                    {attachment.name}
                  </span>
                </div>
              )}
              <button
                className="absolute -top-2 -right-2 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => removeAttachment(attachment.id)}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 输入区域 */}
      <div className="relative">
        {/* 角色选择弹窗 */}
        {showRoles && (
          <div
            className="absolute bottom-full left-0 w-full mb-2 bg-popover border rounded-lg shadow-lg z-50"
            onClick={(e) => e.stopPropagation()}
          >
            <ScrollArea className="max-h-60">
              <div className="p-2">
                {filteredRoles.length > 0 ? (
                  filteredRoles.map((role) => (
                    <button
                      key={role.id}
                      className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors text-left"
                      onClick={() => handleSelectRole(role.id)}
                    >
                      <span className="text-2xl">{role.icon}</span>
                      <div>
                        <div className="font-medium">{role.name}</div>
                        <div className="text-xs text-muted-foreground line-clamp-1">
                          {role.description}
                        </div>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="py-4 text-center text-sm text-muted-foreground">
                    未找到匹配的角色
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        )}

        <div className="flex items-end gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={i18n.placeholder[lang]}
            className="min-h-[44px] max-h-[200px] resize-none"
            autoResize
            disabled={disabled}
          />
          <Button
            onMouseDown={(e) => {
              // 阻止按钮获取焦点，防止 iOS 键盘先收再弹
              e.preventDefault();
            }}
            onClick={isLoading ? onStop : handleSend}
            disabled={isSendDisabled}
            className="h-[44px] px-4"
            variant={isLoading ? "destructive" : "default"}
          >
            {isLoading ? (
              <Square className="h-5 w-5" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
});
