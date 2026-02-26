/**
 * Anthropic Claude 适配器
 */

import { BaseAdapter, AdapterRequest, AdapterResponse, StreamChunk } from "./base";

/**
 * Anthropic Claude 适配器
 */
export class AnthropicAdapter extends BaseAdapter {
  /**
   * 非流式对话
   */
  async chat(request: AdapterRequest): Promise<AdapterResponse> {
    const { systemMessage, messages } = this.formatMessages(request);
    const tools = request.tools ? this.formatTools(request.tools) : undefined;

    const response = await fetch(`${request.baseUrl}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": request.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: request.model,
        system: systemMessage,
        messages,
        tools,
        max_tokens: request.maxTokens || 4096,
        temperature: request.temperature ?? 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API Error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    
    let content = "";
    const toolCalls: any[] = [];

    for (const block of data.content) {
      if (block.type === "text") {
        content += block.text;
      } else if (block.type === "tool_use") {
        toolCalls.push({
          id: block.id,
          name: block.name,
          arguments: block.input,
          status: "pending",
        });
      }
    }

    return {
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: data.usage
        ? {
            promptTokens: data.usage.input_tokens,
            completionTokens: data.usage.output_tokens,
            totalTokens: data.usage.input_tokens + data.usage.output_tokens,
          }
        : undefined,
    };
  }

  /**
   * 流式对话
   */
  async *chatStream(request: AdapterRequest): AsyncGenerator<StreamChunk> {
    const { systemMessage, messages } = this.formatMessages(request);
    const tools = request.tools ? this.formatTools(request.tools) : undefined;

    const response = await fetch(`${request.baseUrl}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": request.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: request.model,
        system: systemMessage,
        messages,
        tools,
        max_tokens: request.maxTokens || 4096,
        temperature: request.temperature ?? 0.7,
        stream: true,
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

              if (parsed.type === "content_block_delta") {
                if (parsed.delta.type === "text_delta") {
                  yield { type: "text", content: parsed.delta.text };
                } else if (parsed.delta.type === "input_json_delta") {
                  // 工具调用参数
                }
              } else if (parsed.type === "content_block_start") {
                if (parsed.content_block.type === "tool_use") {
                  yield {
                    type: "tool_call",
                    toolCall: {
                      id: parsed.content_block.id,
                      name: parsed.content_block.name,
                    },
                  };
                }
              } else if (parsed.type === "message_stop") {
                yield { type: "done" };
                return;
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
    let systemMessage = "";
    const messages: any[] = [];

    for (const msg of request.messages) {
      if (msg.role === "system") {
        systemMessage = typeof msg.content === "string" 
          ? msg.content 
          : this.contentToText(msg.content);
        continue;
      }

      if (typeof msg.content === "string") {
        messages.push({ role: msg.role, content: msg.content });
      } else {
        const content: any[] = [];
        for (const item of msg.content) {
          if (item.type === "text") {
            content.push({ type: "text", text: item.text });
          } else if (item.type === "image" && item.url) {
            if (item.url.startsWith("data:")) {
              const [meta, data] = item.url.split(",");
              const mediaType = meta.match(/data:(.*);/)?.[1] || "image/png";
              content.push({
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType,
                  data,
                },
              });
            }
          }
        }
        messages.push({ role: msg.role, content });
      }
    }

    return { systemMessage, messages };
  }

  /**
   * 格式化工具
   */
  private formatTools(tools: any[]) {
    return tools.map((tool) => ({
      name: tool.id,
      description: tool.description,
      input_schema: {
        type: "object",
        properties: tool.parameters.reduce(
          (acc: any, param: any) => ({
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
          .filter((p: any) => p.required)
          .map((p: any) => p.name),
      },
    }));
  }
}
