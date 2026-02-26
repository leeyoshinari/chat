/**
 * Google Gemini 适配器
 */

import { BaseAdapter, AdapterRequest, AdapterResponse, StreamChunk } from "./base";
import { toOpenAITools } from "@/config/tools";

/**
 * Google Gemini 适配器
 */
export class GeminiAdapter extends BaseAdapter {
  /**
   * 非流式对话
   */
  async chat(request: AdapterRequest): Promise<AdapterResponse> {
    const contents = this.formatMessages(request);
    const tools = request.tools ? this.formatTools(request.tools) : undefined;

    const url = `${request.baseUrl}/models/${request.model}:generateContent?key=${request.apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents,
        tools,
        generationConfig: {
          temperature: request.temperature ?? 0.7,
          maxOutputTokens: request.maxTokens,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API Error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const candidate = data.candidates[0];
    const parts = candidate.content.parts;

    let content = "";
    let thinking = "";
    const toolCalls: any[] = [];

    for (const part of parts) {
      if (part.text) {
        content += part.text;
      }
      if (part.thought) {
        thinking += part.thought;
      }
      if (part.functionCall) {
        toolCalls.push({
          id: crypto.randomUUID(),
          name: part.functionCall.name,
          arguments: part.functionCall.args,
          status: "pending",
        });
      }
    }

    return {
      content,
      thinking: thinking || undefined,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    };
  }

  /**
   * 流式对话
   */
  async *chatStream(request: AdapterRequest): AsyncGenerator<StreamChunk> {
    const contents = this.formatMessages(request);
    const tools = request.tools ? this.formatTools(request.tools) : undefined;

    const url = `${request.baseUrl}/models/${request.model}:streamGenerateContent?key=${request.apiKey}&alt=sse`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents,
        tools,
        generationConfig: {
          temperature: request.temperature ?? 0.7,
          maxOutputTokens: request.maxTokens,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      yield { type: "error", error: `API Error: ${response.status} - ${error}` };
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      yield { type: "error", error: "No response body" };
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            try {
              const parsed = JSON.parse(data);
              const parts = parsed.candidates?.[0]?.content?.parts || [];

              for (const part of parts) {
                if (part.text) {
                  yield { type: "text", content: part.text };
                }
                if (part.thought) {
                  yield { type: "thinking", content: part.thought };
                }
                if (part.functionCall) {
                  yield {
                    type: "tool_call",
                    toolCall: {
                      id: crypto.randomUUID(),
                      name: part.functionCall.name,
                      arguments: part.functionCall.args,
                    },
                  };
                }
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    yield { type: "done" };
  }

  /**
   * 格式化消息
   */
  private formatMessages(request: AdapterRequest) {
    return request.messages.map((msg) => {
      const role = msg.role === "assistant" ? "model" : "user";
      
      if (typeof msg.content === "string") {
        return { role, parts: [{ text: msg.content }] };
      }

      const parts: any[] = [];
      for (const item of msg.content) {
        if (item.type === "text") {
          parts.push({ text: item.text });
        } else if (item.type === "image" && item.url) {
          // 支持 base64 图片
          if (item.url.startsWith("data:")) {
            const [meta, data] = item.url.split(",");
            const mimeType = meta.match(/data:(.*);/)?.[1] || "image/png";
            parts.push({
              inlineData: { mimeType, data },
            });
          } else {
            parts.push({
              fileData: { fileUri: item.url },
            });
          }
        }
      }

      return { role, parts };
    });
  }

  /**
   * 格式化工具
   */
  private formatTools(tools: any[]) {
    return [
      {
        functionDeclarations: tools.map((tool) => ({
          name: tool.id,
          description: tool.description,
          parameters: {
            type: "OBJECT",
            properties: tool.parameters.reduce(
              (acc: any, param: any) => ({
                ...acc,
                [param.name]: {
                  type: param.type.toUpperCase(),
                  description: param.description,
                  ...(param.enum ? { enum: param.enum } : {}),
                },
              }),
              {}
            ),
            required: tool.parameters
              .filter((p: any) => p.required)
              .map((p: any) => p.name),
          },
        })),
      },
    ];
  }
}
