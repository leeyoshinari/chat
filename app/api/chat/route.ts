/**
 * 聊天 API 路由
 * 处理聊天请求，支持流式和非流式响应
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdapter } from "@/services/adapters";
import { getProviderById } from "@/config/providers";
import { executeTool } from "@/services/tools";
import { getToolById } from "@/config/tools";

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

    // 构建请求
    const adapterRequest = {
      messages,
      model,
      baseUrl: providerConfig.baseUrl,
      apiKey: providerConfig.apiKey,
      reasoning,
      tools: tools?.map((id: string) => getToolById(id)).filter(Boolean),
      temperature,
      maxTokens,
    };

    // 流式响应
    if (stream) {
      const encoder = new TextEncoder();
      const readableStream = new ReadableStream({
        async start(controller) {
          try {
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
