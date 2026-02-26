/**
 * 配置 API 路由
 * 返回前端需要的配置信息
 */

import { NextRequest, NextResponse } from "next/server";
import { getProviderConfigs } from "@/config/providers";
import { getEnabledTools } from "@/config/tools";

/**
 * GET /api/config
 * 获取前端配置
 */
export async function GET() {
  try {
    // 获取提供商配置（不包含 API 密钥）
    const providers = getProviderConfigs().map((provider) => ({
      id: provider.id,
      name: provider.name,
      icon: provider.icon,
      models: provider.models,
    }));

    // 获取启用的工具
    const tools = getEnabledTools();

    // 是否需要密码
    const requirePassword = !!process.env.ACCESS_PASSWORD;

    // 历史消息限制
    const historyLimit = parseInt(process.env.HISTORY_LIMIT || "50", 10);

    // 联网搜索是否启用
    const webSearchEnabled = process.env.WEB_SEARCH_ENABLED === "true";

    return NextResponse.json({
      providers,
      tools,
      requirePassword,
      historyLimit,
      webSearchEnabled,
    });
  } catch (error) {
    console.error("Config API error:", error);
    return NextResponse.json(
      { error: "Failed to load config" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/config
 * 验证访问密码
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password } = body;

    const accessPassword = process.env.ACCESS_PASSWORD;
    
    // 如果没有设置密码，则允许访问
    if (!accessPassword) {
      return NextResponse.json({ valid: true });
    }

    // 验证密码
    if (password === accessPassword) {
      return NextResponse.json({ valid: true });
    }

    return NextResponse.json(
      { valid: false, error: "Invalid password" },
      { status: 401 }
    );
  } catch (error) {
    console.error("Config API error:", error);
    return NextResponse.json(
      { error: "Failed to verify password" },
      { status: 500 }
    );
  }
}
