/**
 * 智能文本截断工具
 * 在指定长度内截断文本，保持语义完整性
 */

/**
 * 智能截断选项
 */
interface SmartTruncateOptions {
  /** 最大字符数，默认 2000 */
  maxLength?: number;
  /** 省略号后缀，默认 "..." */
  suffix?: string;
  /** 是否优先在段落边界截断，默认 true */
  preferParagraphBreak?: boolean;
}

/**
 * 智能截断文本
 *
 * 截断策略:
 * 1. 如果文本长度在限制内，直接返回
 * 2. 尝试在段落（换行）边界截断
 * 3. 尝试在句子（句号/问号/感叹号）边界截断
 * 4. 最终在空白处截断以避免断词
 *
 * @param text 原始文本
 * @param options 截断选项
 * @returns 截断后的文本
 */
export function smartTruncate(
  text: string,
  options: SmartTruncateOptions = {}
): string {
  const {
    maxLength = 2000,
    suffix = "...",
    preferParagraphBreak = true,
  } = options;

  // 文本在限制内，直接返回
  if (text.length <= maxLength) {
    return text;
  }

  const effectiveMax = maxLength - suffix.length;

  if (effectiveMax <= 0) {
    return suffix;
  }

  const truncated = text.slice(0, effectiveMax);

  // 1. 尝试在段落边界截断
  if (preferParagraphBreak) {
    const lastParagraph = truncated.lastIndexOf("\n\n");
    if (lastParagraph > effectiveMax * 0.5) {
      return truncated.slice(0, lastParagraph).trimEnd() + suffix;
    }
  }

  // 2. 尝试在句子边界截断（中英文句号、问号、感叹号）
  const sentenceEndRegex = /[.!?\u3002\uff01\uff1f]/g;
  let lastSentenceEnd = -1;
  let match;

  while ((match = sentenceEndRegex.exec(truncated)) !== null) {
    if (match.index > effectiveMax * 0.5) {
      lastSentenceEnd = match.index + 1;
    }
  }

  if (lastSentenceEnd > 0) {
    return truncated.slice(0, lastSentenceEnd).trimEnd() + suffix;
  }

  // 3. 在换行处截断
  const lastNewline = truncated.lastIndexOf("\n");
  if (lastNewline > effectiveMax * 0.5) {
    return truncated.slice(0, lastNewline).trimEnd() + suffix;
  }

  // 4. 在空格/中文字符边界截断（避免英文断词）
  const lastSpace = truncated.lastIndexOf(" ");
  if (lastSpace > effectiveMax * 0.7) {
    return truncated.slice(0, lastSpace).trimEnd() + suffix;
  }

  // 5. 直接截断
  return truncated.trimEnd() + suffix;
}
