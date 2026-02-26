/**
 * 联网搜索工具
 * 支持 Google Search API 和 Serper API
 * 搜索后抓取页面内容提取正文
 */

import { BaseTool, ToolResult } from "./base";
import { extractReadableContent } from "./readability-lite";
import { smartTruncate } from "./smartTruncate";

/**
 * 搜索结果项
 */
interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  /** 抓取到的页面正文内容 */
  content?: string;
}

/** 每个页面内容的最大字符数 */
const MAX_CONTENT_LENGTH = 3000;
/** 抓取页面的超时时间(ms) */
const FETCH_TIMEOUT = 8000;

/**
 * 联网搜索工具
 */
export class WebSearchTool extends BaseTool {
  /**
   * 执行搜索
   */
  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const query = args.query as string;
    const numResults = (args.num_results as number) || 5;

    if (!query) {
      return { success: false, error: "Missing query parameter" };
    }

    const searchType = process.env.SEARCH_API_TYPE || "serper";

    try {
      let results: SearchResult[];

      if (searchType === "google") {
        results = await this.googleSearch(query, numResults);
      } else {
        results = await this.serperSearch(query, numResults);
      }

      // 并发抓取所有搜索结果页面的内容
      results = await this.fetchAllPageContents(results);

      return {
        success: true,
        data: {
          query,
          results,
          resultCount: results.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Search failed",
      };
    }
  }

  /**
   * 并发抓取所有页面内容
   */
  private async fetchAllPageContents(
    results: SearchResult[]
  ): Promise<SearchResult[]> {
    const fetchPromises = results.map((result) =>
      this.fetchPageContent(result.url)
        .then((content) => ({
          ...result,
          content: content || result.snippet,
        }))
        .catch(() => ({
          ...result,
          content: result.snippet,
        }))
    );

    return Promise.all(fetchPromises);
  }

  /**
   * 抓取单个页面并提取正文
   */
  private async fetchPageContent(url: string): Promise<string | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; ChatBot/1.0; +https://example.com)",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        },
        redirect: "follow",
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return null;
      }

      // 只处理 HTML 内容
      const contentType = response.headers.get("content-type") || "";
      if (
        !contentType.includes("text/html") &&
        !contentType.includes("application/xhtml")
      ) {
        return null;
      }

      const html = await response.text();

      // 过小的页面可能不是有效内容
      if (html.length < 200) {
        return null;
      }

      // 提取可读内容
      const readable = extractReadableContent(html);

      if (!readable.textContent || readable.textContent.length < 50) {
        return null;
      }

      // 智能截断
      const truncated = smartTruncate(readable.textContent, {
        maxLength: MAX_CONTENT_LENGTH,
        preferParagraphBreak: true,
      });

      return truncated;
    } catch {
      return null;
    }
  }

  /**
   * Google Search API
   */
  private async googleSearch(
    query: string,
    numResults: number
  ): Promise<SearchResult[]> {
    const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
    const engineId = process.env.GOOGLE_SEARCH_ENGINE_ID;

    if (!apiKey || !engineId) {
      throw new Error("Google Search API not configured");
    }

    const url = new URL("https://www.googleapis.com/customsearch/v1");
    url.searchParams.set("key", apiKey);
    url.searchParams.set("cx", engineId);
    url.searchParams.set("q", query);
    url.searchParams.set("num", String(Math.min(numResults, 10)));

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`Google Search API error: ${response.status}`);
    }

    const data = await response.json();

    return (data.items || []).map((item: any) => ({
      title: item.title,
      url: item.link,
      snippet: item.snippet,
    }));
  }

  /**
   * Serper API
   */
  private async serperSearch(
    query: string,
    numResults: number
  ): Promise<SearchResult[]> {
    const apiKey = process.env.SERPER_API_KEY;

    if (!apiKey) {
      throw new Error("Serper API not configured");
    }

    const response = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: query,
        num: numResults,
      }),
    });

    if (!response.ok) {
      throw new Error(`Serper API error: ${response.status}`);
    }

    const data = await response.json();

    return (data.organic || []).map((item: any) => ({
      title: item.title,
      url: item.link,
      snippet: item.snippet,
    }));
  }
}
