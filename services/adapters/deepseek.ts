/**
 * DeepSeek 适配器
 */

import { BaseAdapter, AdapterRequest, AdapterResponse, StreamChunk } from "./base";
import { toOpenAITools } from "@/config/tools";

export class DeepSeekAdapter extends BaseAdapter {
  /**
   * 非流式对话
   */
  async chat(request: AdapterRequest): Promise<AdapterResponse> {
    const messages = this.formatMessages(request);
    const tools = request.tools ? toOpenAITools(request.tools) : undefined;

    const body: Record<string, any> = {
      model: request.model,
      messages,
      tools: tools?.length ? tools : undefined,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens,
    };

    if (request.reasoning) {
      body.reasoning_effort = "high";
    }

    const response = await fetch(`${request.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${request.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API Error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const choice = data.choices[0];

    return {
      content: choice.message.content || "",
      thinking: choice.message.reasoning_content || undefined,
      toolCalls: choice.message.tool_calls?.map((tc: any) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments),
        status: "pending" as const,
      })),
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
    };
  }

  /**
   * 流式对话
   */
  async *chatStream(request: AdapterRequest): AsyncGenerator<StreamChunk> {
    const messages = this.formatMessages(request);
    const tools = request.tools ? toOpenAITools(request.tools) : undefined;

    const body: Record<string, any> = {
      model: request.model,
      messages,
      tools: tools?.length ? tools : undefined,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens,
      stream: true,
    };

    if (request.reasoning) {
      body.reasoning_effort = "high";
    }

    const response = await fetch(`${request.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${request.apiKey}`,
      },
      body: JSON.stringify(body),
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
            if (data === "[DONE]") {
              yield { type: "done" };
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices[0]?.delta;

              if (delta?.content) {
                yield { type: "text", content: delta.content };
              }

              if (delta?.reasoning_content) {
                yield { type: "thinking", content: delta.reasoning_content };
              }

              if (delta?.tool_calls) {
                for (const tc of delta.tool_calls) {
                  yield {
                    type: "tool_call",
                    toolCall: {
                      id: tc.id,
                      name: tc.function?.name,
                      arguments: tc.function?.arguments
                        ? JSON.parse(tc.function.arguments)
                        : undefined,
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
      if (typeof msg.content === "string") {
        return { role: msg.role, content: msg.content };
      }

      // 处理多模态消息
      const content: any[] = [];
      for (const item of msg.content) {
        if (item.type === "text") {
          content.push({ type: "text", text: item.text });
        } else if (item.type === "image") {
          content.push({
            type: "image_url",
            image_url: { url: item.url },
          });
        }
      }

      return { role: msg.role, content };
    });
  }
}
