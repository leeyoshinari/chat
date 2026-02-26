/**
 * 消息气泡组件
 * 展示用户和 AI 的对话消息
 */
"use client";

import React, { memo, useState } from "react";
import { Message, MessageContentItem, SearchResults } from "@/types";
import { cn, copyToClipboard, formatDate } from "@/lib/utils";
import { Markdown } from "./markdown";
import { Button } from "@/components/ui/button";
import {
  Copy,
  Check,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  User,
  Bot,
  Globe,
  ExternalLink,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * 消息气泡属性
 */
interface MessageBubbleProps {
  message: Message;
  onRegenerate?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
  isStreaming?: boolean;
}

/**
 * 渲染消息内容
 */
const MessageContent = memo(function MessageContent({
  content,
  isUser,
}: {
  content: MessageContentItem[];
  isUser: boolean;
}) {
  return (
    <div className="space-y-2">
      {content.map((item, index) => {
        switch (item.type) {
          case "text":
            return isUser ? (
              <p key={index} className="whitespace-pre-wrap">
                {item.text}
              </p>
            ) : (
              <Markdown key={index} content={item.text || ""} />
            );

          case "image":
            return (
              <img
                key={index}
                src={item.url}
                alt={item.fileName || "Image"}
                className="max-w-full max-h-96 rounded-lg object-contain"
                loading="lazy"
              />
            );

          case "file":
            return (
              <a
                key={index}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
              >
                <span className="text-2xl">📎</span>
                <span className="text-sm truncate">{item.fileName}</span>
              </a>
            );

          case "audio":
            return (
              <audio key={index} controls className="w-full max-w-md">
                <source src={item.url} type={item.mimeType} />
                Your browser does not support the audio element.
              </audio>
            );

          case "video":
            return (
              <video
                key={index}
                controls
                className="max-w-full max-h-96 rounded-lg"
              >
                <source src={item.url} type={item.mimeType} />
                Your browser does not support the video element.
              </video>
            );

          default:
            return null;
        }
      })}
    </div>
  );
});

/**
 * 思考过程展示
 */
const ThinkingBlock = memo(function ThinkingBlock({
  thinking,
}: {
  thinking: string;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mb-3">
      <button
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="animate-pulse">💭</span>
        <span>思考过程</span>
        {expanded ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="thinking-content mt-2">
              <Markdown content={thinking} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

/**
 * 搜索结果展示
 */
const SearchResultsBlock = memo(function SearchResultsBlock({
  searchResults,
}: {
  searchResults: SearchResults;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mb-3">
      <button
        className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <Globe className="h-4 w-4" />
        <span>
          已搜索「{searchResults.query}」· 找到 {searchResults.resultCount} 条结果
        </span>
        {expanded ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-2 space-y-2">
              {searchResults.results.map((result, index) => (
                <a
                  key={index}
                  href={result.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      [{index + 1}]
                    </span>
                    <span className="text-sm font-medium text-foreground group-hover:text-primary line-clamp-1">
                      {result.title}
                    </span>
                    <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                    {result.snippet}
                  </p>
                </a>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

/**
 * 工具调用展示
 */
const ToolCallBlock = memo(function ToolCallBlock({
  tools,
}: {
  tools: Message["tools"];
}) {
  if (!tools || tools.length === 0) return null;

  return (
    <div className="mb-3 space-y-2">
      {tools.map((tool) => (
        <div
          key={tool.id}
          className={cn(
            "flex items-center gap-2 p-2 rounded-lg text-sm",
            tool.status === "running" && "bg-primary/10 text-primary",
            tool.status === "success" && "bg-green-500/10 text-green-600",
            tool.status === "error" && "bg-destructive/10 text-destructive"
          )}
        >
          <span>
            {tool.status === "running" && "⏳"}
            {tool.status === "success" && "✅"}
            {tool.status === "error" && "❌"}
            {tool.status === "pending" && "⏸️"}
          </span>
          <span className="font-medium">{tool.name}</span>
          {tool.status === "running" && (
            <span className="animate-pulse">调用中...</span>
          )}
        </div>
      ))}
    </div>
  );
});

/**
 * 加载动画组件
 */
const LoadingDots = memo(function LoadingDots() {
  return (
    <div className="flex items-center gap-1 py-2">
      <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
      <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
      <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
    </div>
  );
});

/**
 * 消息气泡组件
 */
export const MessageBubble = memo(function MessageBubble({
  message,
  onRegenerate,
  onDelete,
  isStreaming,
}: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";
  
  // 检查消息内容是否为空（显示加载状态）
  const isEmptyContent = message.content.length === 0 || 
    (message.content.length === 1 && message.content[0].type === "text" && !message.content[0].text);

  // 复制消息内容
  const handleCopy = async () => {
    const textContent = message.content
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("\n");

    await copyToClipboard(textContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex gap-3 p-4",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* 头像 */}
      <div
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted"
        )}
      >
        {isUser ? <User className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
      </div>

      {/* 消息内容 */}
      <div
        className={cn(
          "flex flex-col max-w-[85%]",
          isUser ? "items-end" : "items-start"
        )}
      >
        {/* 消息气泡 */}
        <div
          className={cn(
            "rounded-2xl px-4 py-3",
            isUser
              ? "bg-user-message text-user-message-foreground"
              : "bg-assistant-message text-assistant-message-foreground"
          )}
        >
          {/* 搜索结果 */}
          {message.searchResults && (
            <SearchResultsBlock searchResults={message.searchResults} />
          )}

          {/* 思考过程 */}
          {message.thinking && <ThinkingBlock thinking={message.thinking} />}

          {/* 工具调用 */}
          {message.tools && <ToolCallBlock tools={message.tools} />}

          {/* 加载动画（内容为空时显示） */}
          {isStreaming && isEmptyContent && <LoadingDots />}

          {/* 消息内容 */}
          {!isEmptyContent && <MessageContent content={message.content} isUser={isUser} />}

          {/* 流式输出光标 */}
          {isStreaming && (
            <span className="inline-block w-2 h-5 bg-foreground animate-blink ml-1" />
          )}
        </div>

        {/* 操作按钮 - 默认显示，不需要悬停 */}
        <div
          className={cn(
            "flex items-center gap-1 mt-2",
            isUser ? "flex-row-reverse" : "flex-row"
          )}
        >
          {/* 复制 */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleCopy}
            className="h-7 w-7"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>

          {/* 重新生成（仅 AI 消息） */}
          {!isUser && onRegenerate && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onRegenerate(message.id)}
              className="h-7 w-7"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          )}

          {/* 时间 */}
          <span className="text-xs text-muted-foreground px-2">
            {formatDate(message.createdAt)}
          </span>
        </div>
      </div>
    </motion.div>
  );
});
