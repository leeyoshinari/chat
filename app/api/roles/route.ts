/**
 * 角色 API 路由
 * 返回可用的角色列表
 */

import { NextResponse } from "next/server";
import roles from "@/config/roles.json";

/**
 * GET /api/roles
 * 获取角色列表
 */
export async function GET() {
  return NextResponse.json(roles);
}
