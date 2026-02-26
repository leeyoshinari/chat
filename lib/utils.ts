/**
 * 工具函数库
 * 提供常用的工具函数
 */
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * 合并 Tailwind CSS 类名
 * 使用 clsx 处理条件类名，使用 tailwind-merge 处理冲突
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 生成唯一 ID
 */
export function generateId(): string {
  return crypto.randomUUID?.() || Math.random().toString(36).substring(2, 15);
}

/**
 * 格式化日期
 * @param date 日期对象或时间戳
 * @param locale 语言环境
 */
export function formatDate(
  date: Date | number,
  locale: string = "zh-CN"
): string {
  const d = typeof date === "number" ? new Date(date) : date;
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return d.toLocaleTimeString(locale, {
      hour: "2-digit",
      minute: "2-digit",
    });
  } else if (days === 1) {
    return locale === "zh-CN" ? "昨天" : "Yesterday";
  } else if (days < 7) {
    return d.toLocaleDateString(locale, { weekday: "long" });
  } else {
    return d.toLocaleDateString(locale, {
      month: "short",
      day: "numeric",
    });
  }
}

/**
 * 截断文本
 * @param text 原文本
 * @param maxLength 最大长度
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

/**
 * 防抖函数
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * 节流函数
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * 从对话内容中提取标题
 * @param content 对话内容
 * @param maxLength 标题最大长度
 */
export function extractTitle(content: string, maxLength: number = 30): string {
  // 移除 markdown 格式
  const plainText = content
    .replace(/[#*`~\[\]]/g, "")
    .replace(/\n+/g, " ")
    .trim();

  // 提取第一句话或前 N 个字符
  const firstSentence = plainText.split(/[。！？.!?]/)[0];
  return truncateText(firstSentence || plainText, maxLength);
}

/**
 * 检查是否为移动设备
 */
export function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

/**
 * 复制文本到剪贴板
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // 降级方案
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand("copy");
    document.body.removeChild(textarea);
    return success;
  }
}

/**
 * 文件大小格式化
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * 将文件转换为 base64
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
}
