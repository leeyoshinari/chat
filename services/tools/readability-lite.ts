/**
 * 轻量级网页正文提取工具
 * 从 HTML 中提取可读的主要内容，去除导航、广告、脚本等无关元素
 */

/**
 * 提取结果
 */
export interface ReadableContent {
  /** 标题 */
  title: string;
  /** 正文纯文本 */
  textContent: string;
}

/**
 * 需要移除的标签（不包含有用内容）
 */
const REMOVE_TAGS = [
  "script",
  "style",
  "noscript",
  "iframe",
  "svg",
  "canvas",
  "video",
  "audio",
  "form",
  "button",
  "input",
  "select",
  "textarea",
  "nav",
  "footer",
  "header",
  "aside",
  "menu",
  "menuitem",
];

/**
 * 需要移除的 class/id 关键词（通常是非正文区域）
 */
const NOISE_PATTERNS = [
  "sidebar",
  "comment",
  "footer",
  "header",
  "nav",
  "menu",
  "banner",
  "ad",
  "advertisement",
  "social",
  "share",
  "related",
  "recommend",
  "widget",
  "popup",
  "modal",
  "cookie",
  "gdpr",
];

/**
 * 从 HTML 字符串中提取标题
 */
function extractTitle(html: string): string {
  // 尝试 <title> 标签
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) {
    return decodeHtmlEntities(titleMatch[1].trim());
  }

  // 尝试 <h1> 标签
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match) {
    return stripTags(h1Match[1]).trim();
  }

  // 尝试 og:title
  const ogMatch = html.match(
    /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i
  );
  if (ogMatch) {
    return decodeHtmlEntities(ogMatch[1].trim());
  }

  return "";
}

/**
 * 解码 HTML 实体
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)));
}

/**
 * 移除 HTML 标签
 */
function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}

/**
 * 移除指定标签及其内容
 */
function removeTagsWithContent(html: string, tags: string[]): string {
  let result = html;
  for (const tag of tags) {
    // 匹配开闭标签及其内容
    const regex = new RegExp(
      `<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`,
      "gi"
    );
    result = result.replace(regex, " ");

    // 匹配自闭合标签
    const selfClosingRegex = new RegExp(`<${tag}[^>]*\\/?>`, "gi");
    result = result.replace(selfClosingRegex, " ");
  }
  return result;
}

/**
 * 移除含有噪音关键词的 class/id 的 div 块
 * 简化版：只处理较短的 div 块避免误删正文
 */
function removeNoiseBlocks(html: string): string {
  let result = html;
  for (const pattern of NOISE_PATTERNS) {
    // 移除 class 或 id 包含噪音关键词的较短块
    const regex = new RegExp(
      `<div[^>]*(?:class|id)=["'][^"']*${pattern}[^"']*["'][^>]*>[\\s\\S]{0,2000}?<\\/div>`,
      "gi"
    );
    result = result.replace(regex, " ");
  }
  return result;
}

/**
 * 清理提取后的文本
 */
function cleanText(text: string): string {
  return (
    text
      // 解码 HTML 实体
      .replace(/&[a-zA-Z]+;/g, (entity) => decodeHtmlEntities(entity))
      // 移除多余空白
      .replace(/[\t ]+/g, " ")
      // 合并多个换行为最多两个
      .replace(/\n{3,}/g, "\n\n")
      // 移除行首尾空白
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .join("\n")
      .trim()
  );
}

/**
 * 尝试提取 <article> 或 <main> 中的内容
 */
function extractMainContent(html: string): string | null {
  // 优先提取 <article>
  const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  if (articleMatch) {
    return articleMatch[1];
  }

  // 其次提取 <main>
  const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch) {
    return mainMatch[1];
  }

  // 尝试 role="main"
  const roleMainMatch = html.match(
    /<[^>]*role=["']main["'][^>]*>([\s\S]*?)<\/[^>]+>/i
  );
  if (roleMainMatch) {
    return roleMainMatch[1];
  }

  return null;
}

/**
 * 从 HTML 中提取可读内容
 * @param html 原始 HTML 字符串
 * @returns 提取的标题和正文
 */
export function extractReadableContent(html: string): ReadableContent {
  const title = extractTitle(html);

  // 1. 尝试提取结构化主内容
  let contentHtml = extractMainContent(html);

  // 2. 如果没有找到结构化内容，使用 <body> 内容
  if (!contentHtml) {
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    contentHtml = bodyMatch ? bodyMatch[1] : html;
  }

  // 3. 移除无用标签
  contentHtml = removeTagsWithContent(contentHtml, REMOVE_TAGS);

  // 4. 移除噪音块
  contentHtml = removeNoiseBlocks(contentHtml);

  // 5. 移除所有剩余标签，保留文本
  let textContent = stripTags(contentHtml);

  // 6. 清理文本
  textContent = cleanText(textContent);

  return {
    title: title || "",
    textContent,
  };
}
