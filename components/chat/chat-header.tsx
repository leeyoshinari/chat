/**
 * 对话头部组件
 * 显示会话标题、模型名称、工具调用等信息
 */
"use client";

import React, { memo } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * 获取当前语言
 */
function getLanguage(): "zh" | "en" {
  if (typeof window === "undefined") return "zh";
  const lang = navigator.language.toLowerCase();
  return lang.startsWith("zh") ? "zh" : "en";
}

/**
 * 头部属性
 */
interface ChatHeaderProps {
  /** 会话标题 */
  title: string;
  /** 模型名称 */
  modelName?: string;
  /** 角色名称 */
  roleName?: string;
  /** 工具名称列表 */
  toolNames?: string[];
  /** 消息数量 */
  messageCount?: number;
  /** 打开侧边栏 */
  onOpenSidebar?: () => void;
  /** 是否为移动端 */
  isMobile?: boolean;
  /** 提供商图标 */
  providerIcon?: string;
  /** 是否启用推理模式 */
  reasoningEnabled?: boolean;
  /** 是否启用联网搜索 */
  searchEnabled?: boolean;
}

/**
 * 多语言文本
 */
const i18n = {
  role: {
    zh: "角色",
    en: "Role",
  },
  reasoning: {
    zh: "推理模式",
    en: "Reasoning",
  },
  search: {
    zh: "联网搜索",
    en: "Web Search",
  },
};

/**
 * 对话头部组件
 */
export const ChatHeader = memo(function ChatHeader({
  title,
  modelName,
  roleName,
  toolNames,
  messageCount,
  onOpenSidebar,
  isMobile,
  providerIcon,
  reasoningEnabled,
  searchEnabled,
}: ChatHeaderProps) {
  const lang = getLanguage();
  
  return (
    <header className="flex items-center justify-between px-4 py-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-3">
        {/* 移动端菜单按钮 */}
        {isMobile && onOpenSidebar && (
          <Button variant="ghost" size="icon-sm" onClick={onOpenSidebar}>
            <Menu className="h-5 w-5" />
          </Button>
        )}

        {/* 标题和信息 */}
        <div>
          <h1 className="font-semibold flex items-center gap-2">
            {title}
            {messageCount !== undefined && messageCount > 0 && (
              <span className="text-xs text-muted-foreground">
                ({messageCount})
              </span>
            )}
          </h1>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {/* 模型名称和图标 */}
            {modelName && (
              <span className="flex items-center gap-1">
                {providerIcon ? (
                  <img src={providerIcon} alt="" className="w-3.5 h-3.5" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                )}
                {modelName}
              </span>
            )}

            {/* 推理模式 */}
            {reasoningEnabled && (
              <>
                <span>·</span>
                <span className="text-primary">{i18n.reasoning[lang]}</span>
              </>
            )}

            {/* 联网搜索 */}
            {searchEnabled && (
              <>
                <span>·</span>
                <span className="text-primary">{i18n.search[lang]}</span>
              </>
            )}

            {/* 角色名称 */}
            {roleName && (
              <>
                <span>·</span>
                <span>{i18n.role[lang]}: {roleName}</span>
              </>
            )}

            {/* 工具名称 */}
            {toolNames && toolNames.length > 0 && (
              <>
                <span>·</span>
                <span>{toolNames.join(", ")}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
});
