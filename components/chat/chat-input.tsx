/**
 * 输入框组件
 * 支持文本输入、文件上传、角色选择等功能
 */
"use client";

import React, { memo, useState, useRef, useCallback, useEffect } from "react";
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
} from "lucide-react";
import { ModelSelector } from "./model-selector";
import { ToolSelector } from "./tool-selector";
import type { Role, ModelConfig, ToolDefinition } from "@/types";

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
  /** 选择角色回调 */
  onSelectRole: (roleId: string) => void;
  /** 是否正在加载 */
  isLoading?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
}

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
}: ChatInputProps) {
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [showRoles, setShowRoles] = useState(false);
  const [roleFilter, setRoleFilter] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

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

  // 处理发送
  const handleSend = useCallback(() => {
    if (!input.trim() && attachments.length === 0) return;
    if (isLoading || disabled) return;

    onSend(input.trim(), attachments);
    setInput("");
    setAttachments([]);
    textareaRef.current?.focus();
  }, [input, attachments, isLoading, disabled, onSend]);

  // 处理键盘事件
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Cmd/Ctrl + Enter 发送
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

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

  // 选择角色
  const handleSelectRole = useCallback(
    (roleId: string) => {
      onSelectRole(roleId);
      setInput("");
      setShowRoles(false);
      setRoleFilter("");
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

        {/* 工具选择器（如果支持） */}
        {capabilities.functionCall && (
          <ToolSelector
            tools={tools}
            enabledTools={enabledTools}
            onToggle={onToggleTool}
            disabled={disabled}
          />
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
            placeholder="输入消息... 按 Cmd+Enter 发送"
            className="min-h-[44px] max-h-[200px] resize-none"
            autoResize
            disabled={disabled}
          />
          <Button
            onClick={handleSend}
            disabled={(!input.trim() && attachments.length === 0) || isLoading || disabled}
            className="h-[44px] px-4"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
});
