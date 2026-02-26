/**
 * 工具执行器基类
 * 
 * 如何添加新工具:
 * 1. 在 services/tools/ 目录下创建工具执行器文件
 * 2. 继承 BaseTool 类
 * 3. 实现 execute 方法
 * 4. 在 services/tools/index.ts 中注册执行器
 * 
 * @example
 * ```typescript
 * // services/tools/my-tool.ts
 * export class MyTool extends BaseTool {
 *   async execute(args: Record<string, unknown>): Promise<ToolResult> {
 *     // 实现工具逻辑
 *     return { success: true, data: result };
 *   }
 * }
 * 
 * // services/tools/index.ts
 * import { MyTool } from './my-tool';
 * TOOLS['my_tool'] = MyTool;
 * ```
 */

/**
 * 工具执行结果
 */
export interface ToolResult {
  /** 是否成功 */
  success: boolean;
  /** 结果数据 */
  data?: unknown;
  /** 错误信息 */
  error?: string;
}

/**
 * 工具执行器基类
 */
export abstract class BaseTool {
  /**
   * 执行工具
   * @param args 工具参数
   */
  abstract execute(args: Record<string, unknown>): Promise<ToolResult>;
}
