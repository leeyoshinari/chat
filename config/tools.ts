/**
 * 工具配置
 * 
 * 如何添加新工具:
 * 1. 在此文件的 TOOL_DEFINITIONS 数组中添加工具定义
 * 2. 在 services/tools/ 目录下创建工具实现文件
 * 3. 在 services/tools/index.ts 中注册工具执行器
 * 
 * 工具定义说明:
 * - id: 工具唯一标识
 * - name: 工具显示名称
 * - description: 工具描述（会发送给 AI）
 * - icon: 工具图标路径
 * - parameters: 工具参数列表
 * - builtin: 是否为内置工具
 */

import { ToolDefinition } from "@/types";

/**
 * 内置工具定义
 */
export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    id: "web_search",
    name: "Web Search",
    description:
      "Search the web for information. Use this when you need to find current information, news, or facts that may not be in your training data.",
    icon: "/icons/tools/search.svg",
    builtin: true,
    parameters: [
      {
        name: "query",
        type: "string",
        description: "The search query",
        required: true,
      },
      {
        name: "num_results",
        type: "number",
        description: "Number of results to return (default: 5)",
        required: false,
      },
    ],
  },
  {
    id: "code_interpreter",
    name: "Code Interpreter",
    description:
      "Execute Python code to perform calculations, data analysis, or generate visualizations.",
    icon: "/icons/tools/code.svg",
    builtin: true,
    parameters: [
      {
        name: "code",
        type: "string",
        description: "The Python code to execute",
        required: true,
      },
    ],
  }
];

/**
 * 获取所有启用的工具
 * 从环境变量中读取工具启用状态
 */
export function getEnabledTools(): ToolDefinition[] {
  return TOOL_DEFINITIONS.filter((tool) => {
    // 检查环境变量是否启用该工具
    const envKey = `TOOL_${tool.id.toUpperCase()}_ENABLED`;
    return process.env[envKey] === "true";
  });
}

/**
 * 根据 ID 获取工具定义
 */
export function getToolById(toolId: string): ToolDefinition | undefined {
  return TOOL_DEFINITIONS.find((t) => t.id === toolId);
}

/**
 * 将工具定义转换为 OpenAI 格式
 */
export function toOpenAITools(tools: ToolDefinition[]) {
  return tools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.id,
      description: tool.description,
      parameters: {
        type: "object",
        properties: tool.parameters.reduce(
          (acc, param) => ({
            ...acc,
            [param.name]: {
              type: param.type,
              description: param.description,
              ...(param.enum ? { enum: param.enum } : {}),
            },
          }),
          {}
        ),
        required: tool.parameters
          .filter((p) => p.required)
          .map((p) => p.name),
      },
    },
  }));
}
