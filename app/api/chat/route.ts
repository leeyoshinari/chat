/**
 * 聊天 API 路由
 * 处理聊天请求，支持流式和非流式响应
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdapter } from "@/services/adapters";
import { getProviderById, getModelById } from "@/config/providers";
import { executeTool } from "@/services/tools";
import { getToolById } from "@/config/tools";
import { WebSearchTool } from "@/services/tools/web-search";

/**
 * 验证访问密码
 */
function validatePassword(password: string | null): boolean {
  const accessPassword = process.env.ACCESS_PASSWORD;
  // 如果没有设置密码，则允许访问
  if (!accessPassword) return true;
  return password === accessPassword;
}

/**
 * POST /api/chat
 * 处理聊天请求
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      messages,
      model,
      provider,
      stream = true,
      reasoning,
      tools,
      temperature,
      maxTokens,
      password,
      search,
    } = body;

    // 验证密码
    if (!validatePassword(password)) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 获取提供商配置
    const providerConfig = getProviderById(provider);
    if (!providerConfig) {
      return NextResponse.json(
        { error: "Provider not found" },
        { status: 404 }
      );
    }

    // 获取适配器
    const adapter = getAdapter(provider);

    // 获取模型配置（用于能力标识）
    const modelConfig = getModelById(model, provider);

    // 联网搜索逻辑
    let searchResults: {
      query: string;
      results: Array<{ title: string; url: string; snippet: string; content?: string }>;
      resultCount: number;
    } | null = null;
    let enhancedMessages = messages;

    if (search && process.env.WEB_SEARCH_ENABLED === "true") {
      // 获取最后一条用户消息作为搜索查询
      const lastUserMessage = messages
        .filter((m: any) => m.role === "user")
        .pop();
      const userQuery =
        typeof lastUserMessage?.content === "string"
          ? lastUserMessage.content
          : lastUserMessage?.content?.find((c: any) => c.type === "text")?.text;

      if (userQuery) {
        const searchTool = new WebSearchTool();
        const searchResult = await searchTool.execute({
          query: userQuery,
          num_results: 5,
        });

        if (searchResult.success && searchResult.data) {
          const data = searchResult.data as {
            query: string;
            results: Array<{ title: string; url: string; snippet: string; content: string }>;
            resultCount: number;
          };
          searchResults = data;

          // 将搜索结果注入到系统消息中，优先使用抓取到的页面内容
          const searchContext = `以下是关于用户问题的网络搜索结果，请参考这些信息回答：

搜索关键词: ${searchResults!.query}
搜索结果数量: ${searchResults!.resultCount}

${searchResults!.results
  .map(
    (r, i) => `[${i + 1}] ${r.title}
链接: ${r.url}
内容: ${r.content || r.snippet}`
  )
  .join("\n\n---\n\n")}

请基于以上搜索结果回答用户的问题，并在回答中适当引用来源（使用 [序号] 格式标注）。`;

          // 在消息列表开头添加搜索上下文
          enhancedMessages = [
            { role: "system", content: searchContext },
            ...messages,
          ];
        }
      }
    }

    // 构建请求
    const adapterRequest = {
      messages: enhancedMessages,
      model,
      baseUrl: providerConfig.baseUrl,
      apiKey: providerConfig.apiKey,
      reasoning,
      tools: tools?.map((id: string) => getToolById(id)).filter(Boolean),
      temperature,
      maxTokens,
      capabilities: modelConfig?.capabilities,
    };

    // 流式响应
    if (stream) {
      const encoder = new TextEncoder();
      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            // 先发送搜索结果
            if (searchResults) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "search_results",
                    data: searchResults,
                  })}\n\n`
                )
              );
            }

            for await (const chunk of adapter.chatStream(adapterRequest)) {
              // 处理工具调用
              if (chunk.type === "tool_call" && chunk.toolCall?.name) {
                const toolResult = await executeTool(
                  chunk.toolCall.name,
                  chunk.toolCall.arguments || {}
                );
                // 发送工具结果
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: "tool_result",
                      toolId: chunk.toolCall.name,
                      result: toolResult,
                    })}\n\n`
                  )
                );
              }

              // 发送原始块
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`)
              );

              if (chunk.type === "done" || chunk.type === "error") {
                break;
              }
            }
          } catch (error) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "error",
                  error: error instanceof Error ? error.message : "Unknown error",
                })}\n\n`
              )
            );
          } finally {
            controller.close();
          }
        },
      });

      return new Response(readableStream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // 非流式响应
    const response = await adapter.chat(adapterRequest);

    // 处理工具调用
    if (response.toolCalls) {
      for (const toolCall of response.toolCalls) {
        const result = await executeTool(toolCall.name, toolCall.arguments);
        toolCall.result = result.data;
        toolCall.status = result.success ? "success" : "error";
        if (!result.success) {
          toolCall.error = result.error;
        }
      }
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
