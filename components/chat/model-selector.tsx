/**
 * 模型选择器组件
 * 按提供商分组展示可用模型，选中后只显示图标
 */
"use client";

import React, { memo, useMemo } from "react";
import { ModelConfig, ModelCapabilities } from "@/types";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  Eye,
  FileText,
  Sparkles,
  Wrench,
  Search,
  Image,
  Bot,
  Volume2,
  Mic,
} from "lucide-react";

/**
 * 模型能力图标
 */
const CapabilityIcons: Record<
  keyof ModelCapabilities,
  { icon: React.ReactNode; label: string }
> = {
  vision: { icon: <Eye className="h-3 w-3" />, label: "图片理解" },
  file: { icon: <FileText className="h-3 w-3" />, label: "文件处理" },
  reasoning: { icon: <Sparkles className="h-3 w-3" />, label: "深度思考" },
  functionCall: { icon: <Wrench className="h-3 w-3" />, label: "工具调用" },
  search: { icon: <Search className="h-3 w-3" />, label: "联网搜索" },
  imageOutput: { icon: <Image className="h-3 w-3" />, label: "图片生成" },
  tts: { icon: <Volume2 className="h-3 w-3" />, label: "语音生成" },
  asr: { icon: <Mic className="h-3 w-3" />, label: "语音识别" },
};

/**
 * 模型能力标签
 */
const CapabilityBadges = memo(function CapabilityBadges({
  capabilities,
}: {
  capabilities: ModelCapabilities;
}) {
  const enabledCaps = Object.entries(capabilities).filter(([, v]) => v);

  if (enabledCaps.length === 0) return null;

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {enabledCaps.map(([key]) => {
        const cap = CapabilityIcons[key as keyof ModelCapabilities];
        return (
          <span
            key={key}
            className="flex items-center gap-1 px-1.5 py-0.5 bg-primary/10 text-primary rounded text-xs"
            title={cap.label}
          >
            {cap.icon}
          </span>
        );
      })}
    </div>
  );
});

/**
 * 提供商分组数据
 */
interface ProviderGroup {
  id: string;
  name: string;
  icon: string;
  models: Array<ModelConfig & { providerId: string }>;
}

/**
 * 模型选择器属性
 */
interface ModelSelectorProps {
  /** 提供商分组 */
  providers: ProviderGroup[];
  /** 当前选中的模型 ID */
  selectedModelId: string | null;
  /** 当前选中的提供商 ID */
  selectedProviderId: string | null;
  /** 选择模型回调 */
  onSelect: (modelId: string, providerId: string) => void;
  /** 是否禁用 */
  disabled?: boolean;
}

/**
 * 模型选择器组件
 * 选中后工具栏只显示提供商图标
 */
export const ModelSelector = memo(function ModelSelector({
  providers,
  selectedModelId,
  selectedProviderId,
  onSelect,
  disabled,
}: ModelSelectorProps) {
  const [open, setOpen] = React.useState(false);

  // 获取当前选中的模型信息
  const selectedModel = useMemo(() => {
    if (!selectedModelId || !selectedProviderId) return null;
    const provider = providers.find((p) => p.id === selectedProviderId);
    return provider?.models.find((m) => m.id === selectedModelId);
  }, [providers, selectedModelId, selectedProviderId]);

  // 获取当前选中的提供商信息
  const selectedProvider = useMemo(() => {
    return providers.find((p) => p.id === selectedProviderId);
  }, [providers, selectedProviderId]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                disabled={disabled}
                className="flex-shrink-0"
              >
                {selectedProvider ? (
                  <img
                    src={selectedProvider.icon}
                    alt={selectedProvider.name}
                    className="h-5 w-5"
                  />
                ) : (
                  <Bot className="h-5 w-5" />
                )}
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>
            {selectedModel?.name || "选择模型"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <PopoverContent className="w-auto min-w-[320px] max-w-[400px] p-0" align="start">
        <ScrollArea className="h-[400px]">
          <div className="p-2">
            {providers.map((provider) => (
              <div key={provider.id} className="mb-4">
                {/* 提供商标题 */}
                <div className="flex items-center gap-2 px-2 py-1.5 text-sm font-medium text-muted-foreground">
                  <img
                    src={provider.icon}
                    alt={provider.name}
                    className="h-4 w-4"
                  />
                  <span>{provider.name}</span>
                </div>

                {/* 模型列表 */}
                <div className="space-y-1">
                  {provider.models.map((model) => (
                    <button
                      key={`${provider.id}-${model.id}`}
                      className={cn(
                        "w-full flex items-center justify-between p-2 rounded-lg text-sm transition-colors",
                        "hover:bg-accent",
                        selectedModelId === model.id &&
                          selectedProviderId === provider.id &&
                          "bg-accent"
                      )}
                      onClick={() => {
                        onSelect(model.id, provider.id);
                        setOpen(false);
                      }}
                    >
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <img
                          src={provider.icon}
                          alt={provider.name}
                          className="h-4 w-4 flex-shrink-0"
                        />
                        <span>{model.name}</span>
                      </div>
                      <CapabilityBadges capabilities={model.capabilities} />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
});
