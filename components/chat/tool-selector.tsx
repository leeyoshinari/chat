/**
 * 工具选择器组件
 * 展示可用工具列表，支持启用/禁用
 */
"use client";

import React, { memo } from "react";
import { ToolDefinition } from "@/types";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Wrench, Search, Code, FileBox } from "lucide-react";

/**
 * 工具图标映射
 */
const toolIcons: Record<string, React.ReactNode> = {
  web_search: <Search className="h-5 w-5" />,
  code_interpreter: <Code className="h-5 w-5" />,
};

/**
 * 工具选择器属性
 */
interface ToolSelectorProps {
  /** 可用工具列表 */
  tools: ToolDefinition[];
  /** 已启用的工具 ID 列表 */
  enabledTools: string[];
  /** 切换工具启用状态 */
  onToggle: (toolId: string) => void;
  /** 是否禁用 */
  disabled?: boolean;
}

/**
 * 工具选择器组件
 */
export const ToolSelector = memo(function ToolSelector({
  tools,
  enabledTools,
  onToggle,
  disabled,
}: ToolSelectorProps) {
  const [open, setOpen] = React.useState(false);

  // 分类工具：内置和第三方
  const builtinTools = tools.filter((t) => t.builtin);
  const thirdPartyTools = tools.filter((t) => !t.builtin);

  // 启用的工具数量
  const enabledCount = enabledTools.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "relative",
            enabledCount > 0 && "text-primary"
          )}
          disabled={disabled}
        >
          <Wrench className="h-5 w-5" />
          {/* 启用数量标记 */}
          {enabledCount > 0 && (
            <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 text-[10px] font-medium bg-primary text-primary-foreground rounded-full">
              {enabledCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-72 p-0" align="start">
        <ScrollArea className="max-h-[400px]">
          <div className="p-2">
            {/* 内置工具 */}
            {builtinTools.length > 0 && (
              <div className="mb-4">
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase">
                  内置工具
                </div>
                <div className="space-y-1">
                  {builtinTools.map((tool) => (
                    <ToolItem
                      key={tool.id}
                      tool={tool}
                      enabled={enabledTools.includes(tool.id)}
                      onToggle={() => onToggle(tool.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 第三方工具 */}
            {thirdPartyTools.length > 0 && (
              <div>
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase">
                  第三方工具
                </div>
                <div className="space-y-1">
                  {thirdPartyTools.map((tool) => (
                    <ToolItem
                      key={tool.id}
                      tool={tool}
                      enabled={enabledTools.includes(tool.id)}
                      onToggle={() => onToggle(tool.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 空状态 */}
            {tools.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                暂无可用工具
              </div>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
});

/**
 * 工具项组件
 */
const ToolItem = memo(function ToolItem({
  tool,
  enabled,
  onToggle,
}: {
  tool: ToolDefinition;
  enabled: boolean;
  onToggle: () => void;
}) {
  const icon = toolIcons[tool.id] || <Wrench className="h-5 w-5" />;

  return (
    <div
      className={cn(
        "flex items-center justify-between p-2 rounded-lg transition-colors",
        "hover:bg-accent cursor-pointer"
      )}
      onClick={onToggle}
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted">
          {icon}
        </div>
        <div>
          <div className="text-sm font-medium">{tool.name}</div>
          <div className="text-xs text-muted-foreground line-clamp-1">
            {tool.description}
          </div>
        </div>
      </div>
      <Switch checked={enabled} onCheckedChange={onToggle} />
    </div>
  );
});
