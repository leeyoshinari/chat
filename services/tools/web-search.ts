/**
 * 联网搜索工具
 * 支持 Google Search API 和 Serper API
 */

import { BaseTool, ToolResult } from "./base";

/**
 * 搜索结果项
 */
interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

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
   * Google Search API
   */
  private async googleSearch(query: string, numResults: number): Promise<SearchResult[]> {
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
  private async serperSearch(query: string, numResults: number): Promise<SearchResult[]> {
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
