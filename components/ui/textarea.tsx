/**
 * Textarea 组件
 * 多行文本输入框
 */
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Textarea 属性接口
 */
export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** 是否自动调整高度 */
  autoResize?: boolean;
  /** 最小行数 */
  minRows?: number;
  /** 最大行数 */
  maxRows?: number;
}

/**
 * Textarea 组件
 */
const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    { className, autoResize = false, minRows = 1, maxRows = 10, ...props },
    ref
  ) => {
    const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

    // 合并 ref
    React.useImperativeHandle(ref, () => textareaRef.current!);

    // 自动调整高度
    const adjustHeight = React.useCallback(() => {
      const textarea = textareaRef.current;
      if (!textarea || !autoResize) return;

      // 重置高度以获取正确的 scrollHeight
      textarea.style.height = "auto";

      // 计算行高
      const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 24;
      const minHeight = lineHeight * minRows;
      const maxHeight = lineHeight * maxRows;

      // 设置新高度
      const newHeight = Math.min(
        Math.max(textarea.scrollHeight, minHeight),
        maxHeight
      );
      textarea.style.height = `${newHeight}px`;
    }, [autoResize, minRows, maxRows]);

    // 监听内容变化
    React.useEffect(() => {
      adjustHeight();
    }, [props.value, adjustHeight]);

    return (
      <textarea
        className={cn(
          "flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm transition-colors",
          "placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "resize-none",
          className
        )}
        ref={textareaRef}
        onInput={adjustHeight}
        rows={minRows}
        {...props}
      />
    );
  }
);

Textarea.displayName = "Textarea";

export { Textarea };
