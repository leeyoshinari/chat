/**
 * 工具执行器注册表
 * 
 * 如何添加新工具:
 * 1. 在 config/tools.ts 中添加工具定义
 * 2. 在 services/tools/ 目录下创建执行器文件
 * 3. 在此文件中导入并注册执行器
 */

import { BaseTool, ToolResult } from "./base";
import { WebSearchTool } from "./web-search";

/**
 * 工具执行器注册表
 * key 为工具 ID，value 为执行器类
 */
const TOOLS: Record<string, new () => BaseTool> = {
  web_search: WebSearchTool,
  // 添加更多工具:
  // code_interpreter: CodeInterpreterTool,
};

/**
 * 获取工具执行器实例
 * @param toolId 工具 ID
 */
export function getTool(toolId: string): BaseTool | null {
  const ToolClass = TOOLS[toolId];
  if (!ToolClass) {
    return null;
  }
  return new ToolClass();
}

/**
 * 执行工具调用
 * @param toolId 工具 ID
 * @param args 工具参数
 */
export async function executeTool(
  toolId: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const tool = getTool(toolId);
  if (!tool) {
    return { success: false, error: `Unknown tool: ${toolId}` };
  }
  return tool.execute(args);
}

/**
 * 检查工具是否存在
 */
export function isToolSupported(toolId: string): boolean {
  return toolId in TOOLS;
}

// 导出类型和基类
export type { ToolResult } from "./base";
export { BaseTool } from "./base";
