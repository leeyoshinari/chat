/**
 * 标题总结 API 路由
 * 调用配置的模型生成对话标题
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdapter } from "@/services/adapters";
import { getProviderById } from "@/config/providers";

/**
 * 验证访问密码
 */
function validatePassword(password: string | null): boolean {
  const accessPassword = process.env.ACCESS_PASSWORD;
  if (!accessPassword) return true;
  return password === accessPassword;
}

/**
 * POST /api/summarize
 * 根据对话内容生成标题
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content, password } = body;

    // 验证密码
    if (!validatePassword(password)) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 获取配置的总结模型
    const summaryProvider = process.env.TITLE_SUMMARY_PROVIDER || "openai";
    const summaryModel = process.env.TITLE_SUMMARY_MODEL || "gpt-4o-mini";

    // 获取提供商配置
    const providerConfig = getProviderById(summaryProvider);
    if (!providerConfig) {
      // 如果配置的提供商不存在，返回默认标题
      return NextResponse.json({ title: content.slice(0, 30) });
    }

    // 获取适配器
    const adapter = getAdapter(summaryProvider);

    // 构建请求
    const adapterRequest = {
      messages: [
        {
          role: "system" as const,
          content: "你是一个标题生成助手。请根据用户的消息内容，生成一个简短的对话标题（不超过15个字符），直接返回标题文本，不要加引号或其他格式。",
        },
        {
          role: "user" as const,
          content: `请为以下内容生成一个简短的标题：\n\n${content}`,
        },
      ],
      model: summaryModel,
      baseUrl: providerConfig.baseUrl,
      apiKey: providerConfig.apiKey,
      maxTokens: 50,
    };

    // 调用模型
    const response = await adapter.chat(adapterRequest);
    const title = response.content?.trim() || content.slice(0, 30);

    return NextResponse.json({ title: title.slice(0, 30) });
  } catch (error) {
    console.error("Summarize API error:", error);
    // 出错时返回截取的内容作为标题
    return NextResponse.json(
      { error: "Failed to generate title" },
      { status: 500 }
    );
  }
}
