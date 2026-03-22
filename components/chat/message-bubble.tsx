/**
 * 消息气泡组件
 * 展示用户和 AI 的对话消息
 */
"use client";

import React, { memo, useState, useCallback, useRef, useEffect } from "react";
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
  Play,
  Pause,
  Volume2,
  Download,
  X,
  ZoomIn,
  ZoomOut,
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
 * 将 PCM L16 raw data URL 转换为 WAV data URL
 */
function pcmToWavDataUrl(rawDataUrl: string): string {
  const pcmBase64 = rawDataUrl.split(",")[1];
  const pcmBinary = atob(pcmBase64);
  const pcmUint8 = new Uint8Array(pcmBinary.length);
  for (let i = 0; i < pcmBinary.length; i++) {
    pcmUint8[i] = pcmBinary.charCodeAt(i);
  }

  // 生成 44 字节的 WAV Header
  const header = new ArrayBuffer(44);
  const v = new DataView(header);
  v.setUint32(0, 0x52494646, false);
  v.setUint32(4, 36 + pcmUint8.length, true);
  v.setUint32(8, 0x57415645, false);
  v.setUint32(12, 0x666d7420, false);
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, 24000, true);
  v.setUint32(28, 48000, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  v.setUint32(36, 0x64617461, false);
  v.setUint32(40, pcmUint8.length, true);

  // 合并 Header 和 PCM 数据
  const fullWav = new Uint8Array(44 + pcmUint8.length);
  fullWav.set(new Uint8Array(header), 0);
  fullWav.set(pcmUint8, 44);

  // 分块转 Base64，避免 btoa 溢出
  const chunkSize = 8192;
  let base64Audio = "";
  for (let i = 0; i < fullWav.length; i += chunkSize) {
    const chunk = fullWav.subarray(i, i + chunkSize);
    base64Audio += String.fromCharCode(...chunk);
  }
  base64Audio = btoa(base64Audio);

  return `data:audio/wav;base64,${base64Audio}`;
}

/**
 * 通用下载函数：将 data URL 或 blob URL 下载为文件
 */
function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * 图片预览弹窗组件
 * 支持放大、缩小、拖拽平移、双指缩放（移动端）、滚轮缩放（PC端）
 */
const ImagePreview = memo(function ImagePreview({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const posStart = useRef({ x: 0, y: 0 });
  const lastPinchDist = useRef(0);

  // ESC 关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  // 滚轮缩放（PC）
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setScale((prev) => Math.max(0.25, Math.min(5, prev - e.deltaY * 0.001)));
  }, []);

  // 鼠标拖拽
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    posStart.current = { ...position };
  }, [position]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: posStart.current.x + (e.clientX - dragStart.current.x),
      y: posStart.current.y + (e.clientY - dragStart.current.y),
    });
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // 触摸拖拽 + 双指缩放（移动端）
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      posStart.current = { ...position };
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastPinchDist.current = Math.sqrt(dx * dx + dy * dy);
    }
  }, [position]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      setPosition({
        x: posStart.current.x + (e.touches[0].clientX - dragStart.current.x),
        y: posStart.current.y + (e.touches[0].clientY - dragStart.current.y),
      });
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (lastPinchDist.current > 0) {
        const ratio = dist / lastPinchDist.current;
        setScale((prev) => Math.max(0.25, Math.min(5, prev * ratio)));
      }
      lastPinchDist.current = dist;
    }
  }, []);

  // 重置
  const handleReset = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/80"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* 工具栏 - 顶部居中，手机友好 */}
      <div className="flex items-center justify-center gap-2 p-3 z-10 flex-shrink-0">
        <Button variant="secondary" size="icon" className="h-9 w-9 rounded-full" onClick={() => setScale((s) => Math.min(5, s + 0.25))}>
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button variant="secondary" size="icon" className="h-9 w-9 rounded-full" onClick={() => setScale((s) => Math.max(0.25, s - 0.25))}>
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button variant="secondary" size="icon" className="h-9 w-9 rounded-full" onClick={handleReset} title="重置">
          <span className="text-xs font-bold">{Math.round(scale * 100)}%</span>
        </Button>
        <Button variant="secondary" size="icon" className="h-9 w-9 rounded-full" onClick={() => downloadDataUrl(src, alt || `image_${Date.now()}.png`)}>
          <Download className="h-4 w-4" />
        </Button>
        <Button variant="secondary" size="icon" className="h-9 w-9 rounded-full" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* 图片区域 - 填充剩余空间 */}
      <div
        className="flex-1 flex items-center justify-center overflow-hidden select-none min-h-0"
        style={{ cursor: isDragging ? "grabbing" : "grab", touchAction: "none" }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
      >
        <img
          src={src}
          alt={alt}
          className="max-w-[90vw] max-h-[80vh] object-contain pointer-events-none"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transition: isDragging ? "none" : "transform 0.15s ease-out",
          }}
          draggable={false}
        />
      </div>
    </div>
  );
});

/**
 * 音频播放器组件
 * 展示播放按钮，点击播放/暂停音频
 * 支持 PCM L16 (Gemini TTS) 和常规音频
 */
const AudioPlayer = memo(function AudioPlayer({
  url,
  mimeType,
}: {
  url: string;
  mimeType: string;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleToggle = useCallback(() => {
    if (!audioRef.current) {
      const audio = new Audio();
      // PCM L16 需要转换为 WAV
      const isPCM = url.includes("audio/L16") || url.includes("codec=pcm");
      audio.src = isPCM ? pcmToWavDataUrl(url) : url;
      audio.onended = () => setIsPlaying(false);
      audio.onerror = () => setIsPlaying(false);
      audioRef.current = audio;
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(() => setIsPlaying(false));
      setIsPlaying(true);
    }
  }, [url, isPlaying]);

  const handleDownload = useCallback(() => {
    const ext = mimeType.includes("wav") ? "wav" : mimeType.includes("mp3") ? "mp3" : "audio";
    downloadDataUrl(url, `audio_${Date.now()}.${ext}`);
  }, [url, mimeType]);

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
      <Button
        variant="default"
        size="icon"
        className="h-10 w-10 rounded-full flex-shrink-0"
        onClick={handleToggle}
      >
        {isPlaying ? (
          <Pause className="h-5 w-5" />
        ) : (
          <Play className="h-5 w-5 ml-0.5" />
        )}
      </Button>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Volume2 className="h-4 w-4" />
        <span>{isPlaying ? "Playing..." : "Audio"}</span>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 ml-auto"
        onClick={handleDownload}
        title="下载音频"
      >
        <Download className="h-4 w-4" />
      </Button>
    </div>
  );
});

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
  const [previewImage, setPreviewImage] = useState<{ url: string; alt: string } | null>(null);

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
              <div key={index} className="relative group inline-block">
                <img
                  src={item.url}
                  alt={item.fileName || "Image"}
                  className="max-w-full max-h-96 rounded-lg object-contain cursor-pointer"
                  loading="lazy"
                  onClick={() => setPreviewImage({ url: item.url || "", alt: item.fileName || "Image" })}
                />
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                  onClick={(e) => { e.stopPropagation(); downloadDataUrl(item.url || "", item.fileName || `image_${Date.now()}.png`); }}
                  title="下载图片"
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
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
              <AudioPlayer key={index} url={item.url || ""} mimeType={item.mimeType || "audio/wav"} />
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

      {/* 图片预览弹窗 */}
      {previewImage && (
        <ImagePreview
          src={previewImage.url}
          alt={previewImage.alt}
          onClose={() => setPreviewImage(null)}
        />
      )}
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
          "flex flex-col min-w-0",
          isUser
            ? "max-w-[85%] sm:max-w-[75%]"
            : "flex-1 sm:max-w-[85%]",
          isUser ? "items-end" : "items-start"
        )}
      >
        {/* 消息气泡 */}
        <div
          className={cn(
            "rounded-2xl px-4 py-3 w-full",
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
