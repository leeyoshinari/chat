/**
 * 消息列表组件
 * 展示对话消息
 */
"use client";

import React, { memo, useRef, useEffect } from "react";
import { Message } from "@/types";
import { MessageBubble } from "./message-bubble";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

/**
 * 获取当前语言
 */
function getLanguage(): "zh" | "en" {
  if (typeof window === "undefined") return "zh";
  const lang = navigator.language.toLowerCase();
  return lang.startsWith("zh") ? "zh" : "en";
}

/**
 * 多语言文本
 */
const i18n = {
  morning: { zh: "早上好", en: "Good Morning" },
  afternoon: { zh: "下午好", en: "Good Afternoon" },
  evening: { zh: "晚上好", en: "Good Evening" },
  welcome: {
    zh: "我是你的 AI 助手，有什么可以帮助你的吗？",
    en: "I'm your AI assistant. How can I help you?",
  },
  roleTip: {
    zh: "你可以输入 <code>/</code> 来选择不同的角色。",
    en: "Type <code>/</code> to select a different role.",
  },
};

/**
 * 消息列表属性
 */
interface MessageListProps {
  /** 消息列表 */
  messages: Message[];
  /** 重新生成消息 */
  onRegenerate?: (messageId: string) => void;
  /** 删除消息 */
  onDelete?: (messageId: string) => void;
  /** 正在流式输出的消息 ID */
  streamingMessageId?: string | null;
  /** 自定义类名 */
  className?: string;
}

/**
 * 欢迎消息组件
 */
const WelcomeMessage = memo(function WelcomeMessage() {
  const lang = getLanguage();

  // 根据时间显示问候语
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return { emoji: "☀️", text: i18n.morning[lang] };
    if (hour < 18) return { emoji: "🌤️", text: i18n.afternoon[lang] };
    return { emoji: "🌙", text: i18n.evening[lang] };
  };

  const greeting = getGreeting();

  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <div className="text-6xl mb-4">{greeting.emoji}</div>
      <h1 className="text-2xl font-bold mb-2">{greeting.text}</h1>
      <p className="text-muted-foreground max-w-md">
        {i18n.welcome[lang]}
        <br />
        <span dangerouslySetInnerHTML={{
          __html: i18n.roleTip[lang].replace(
            "<code>/</code>",
            '<code class="bg-muted px-1 rounded">/</code>'
          ),
        }} />
      </p>
    </div>
  );
});

/**
 * 消息列表组件
 */
export const MessageList = memo(function MessageList({
  messages,
  onRegenerate,
  onDelete,
  streamingMessageId,
  className,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingMessageId]);

  // 空状态
  if (messages.length === 0) {
    return <WelcomeMessage />;
  }

  return (
    <ScrollArea className={cn("flex-1", className)}>
      <div ref={scrollRef} className="min-h-full">
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            onRegenerate={onRegenerate}
            onDelete={onDelete}
            isStreaming={message.id === streamingMessageId}
          />
        ))}
        <div ref={bottomRef} className="h-4" />
      </div>
    </ScrollArea>
  );
});
