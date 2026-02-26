/**
 * Markdown 渲染组件
 * 支持代码高亮、表格、链接等
 */
"use client";

import React, { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { copyToClipboard } from "@/lib/utils";

/**
 * 代码块组件
 */
const CodeBlock = memo(function CodeBlock({
  language,
  children,
}: {
  language?: string;
  children: string;
}) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    await copyToClipboard(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-4">
      {/* 语言标签 */}
      {language && (
        <div className="absolute top-0 left-4 px-2 py-1 text-xs text-muted-foreground bg-muted rounded-b-md">
          {language}
        </div>
      )}
      {/* 复制按钮 */}
      <Button
        variant="ghost"
        size="icon-sm"
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={handleCopy}
      >
        {copied ? (
          <Check className="h-4 w-4 text-green-500" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </Button>
      {/* 代码内容 */}
      <pre className="bg-muted rounded-lg p-4 pt-8 overflow-x-auto">
        <code className={cn("text-sm", language && `language-${language}`)}>
          {children}
        </code>
      </pre>
    </div>
  );
});

/**
 * Markdown 组件属性
 */
interface MarkdownProps {
  content: string;
  className?: string;
}

/**
 * Markdown 渲染组件
 */
export const Markdown = memo(function Markdown({
  content,
  className,
}: MarkdownProps) {
  return (
    <div className={cn("prose prose-sm dark:prose-invert max-w-none", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // 代码块
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            const isInline = !match;

            if (isInline) {
              return (
                <code
                  className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            return (
              <CodeBlock language={match?.[1]}>
                {String(children).replace(/\n$/, "")}
              </CodeBlock>
            );
          },
          // 预格式化文本
          pre({ children }) {
            return <>{children}</>;
          },
          // 链接
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                {children}
              </a>
            );
          },
          // 表格
          table({ children }) {
            return (
              <div className="overflow-x-auto my-4">
                <table className="min-w-full border border-border rounded-lg">
                  {children}
                </table>
              </div>
            );
          },
          th({ children }) {
            return (
              <th className="border border-border bg-muted px-4 py-2 text-left font-semibold">
                {children}
              </th>
            );
          },
          td({ children }) {
            return (
              <td className="border border-border px-4 py-2">{children}</td>
            );
          },
          // 图片
          img({ src, alt }) {
            return (
              <img
                src={src}
                alt={alt || ""}
                className="max-w-full h-auto rounded-lg my-4"
                loading="lazy"
              />
            );
          },
          // 引用
          blockquote({ children }) {
            return (
              <blockquote className="border-l-4 border-primary/50 pl-4 my-4 italic text-muted-foreground">
                {children}
              </blockquote>
            );
          },
          // 列表
          ul({ children }) {
            return <ul className="list-disc pl-6 my-2">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal pl-6 my-2">{children}</ol>;
          },
          // 标题
          h1({ children }) {
            return (
              <h1 className="text-2xl font-bold mt-6 mb-4">{children}</h1>
            );
          },
          h2({ children }) {
            return (
              <h2 className="text-xl font-bold mt-5 mb-3">{children}</h2>
            );
          },
          h3({ children }) {
            return (
              <h3 className="text-lg font-semibold mt-4 mb-2">{children}</h3>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});
