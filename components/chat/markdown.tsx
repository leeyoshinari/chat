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
        <div className="absolute top-0 left-4 px-2 py-1 text-xs text-muted-foreground bg-muted rounded-b-md z-10">
          {language}
        </div>
      )}
      {/* 复制按钮 */}
      <Button
        variant="ghost"
        size="icon-sm"
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10"
        onClick={handleCopy}
      >
        {copied ? (
          <Check className="h-4 w-4 text-green-500" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </Button>
      {/* 代码内容：横向可滚动 */}
      <pre className="bg-muted rounded-lg p-4 pt-8 overflow-x-auto max-w-full">
        <code
          className={cn(
            "text-sm whitespace-pre",
            language && `language-${language}`
          )}
        >
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
    <div
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none",
        "[&>*]:break-words [&>p]:break-words [&>ul]:break-words [&>ol]:break-words",
        "overflow-visible",
        className
      )}
    >
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
                  className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono break-words"
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
          // 预格式化文本（非围栏代码块）
          pre({ children }) {
            return (
              <pre className="bg-muted rounded-lg p-4 overflow-x-auto max-w-full my-4">
                {children}
              </pre>
            );
          },
          // 段落：强制换行
          p({ children }) {
            return (
              <p className="my-2 break-words leading-relaxed">{children}</p>
            );
          },
          // 链接
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline break-all"
              >
                {children}
              </a>
            );
          },
          // 表格：横向可滚动容器包裹
          table({ children }) {
            return (
              <div className="overflow-x-auto my-4 max-w-full">
                <table className="min-w-full border border-border rounded-lg">
                  {children}
                </table>
              </div>
            );
          },
          th({ children }) {
            return (
              <th className="border border-border bg-muted px-4 py-2 text-left font-semibold whitespace-nowrap">
                {children}
              </th>
            );
          },
          td({ children }) {
            return (
              <td className="border border-border px-4 py-2 break-words max-w-xs">
                {children}
              </td>
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
              <blockquote className="border-l-4 border-primary/50 pl-4 my-4 italic text-muted-foreground break-words">
                {children}
              </blockquote>
            );
          },
          // 列表
          ul({ node, children, ...rest }: any) {
            return (
              <ul className="list-disc pl-6 my-2 break-words" {...rest}>
                {children}
              </ul>
            );
          },
          ol({ node, children, ...rest }: any) {
            return (
              <ol className="list-decimal pl-6 my-2 break-words" {...rest}>
                {children}
              </ol>
            );
          },
          li({ children }) {
            return <li className="my-0.5 break-words">{children}</li>;
          },
          // 标题
          h1({ children }) {
            return (
              <h1 className="text-2xl font-bold mt-6 mb-4 break-words">
                {children}
              </h1>
            );
          },
          h2({ children }) {
            return (
              <h2 className="text-xl font-bold mt-5 mb-3 break-words">
                {children}
              </h2>
            );
          },
          h3({ children }) {
            return (
              <h3 className="text-lg font-semibold mt-4 mb-2 break-words">
                {children}
              </h3>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});
