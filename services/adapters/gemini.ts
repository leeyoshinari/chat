/**
 * Google Gemini 适配器
 */

import { BaseAdapter, AdapterRequest, AdapterResponse, StreamChunk } from "./base";
import { toOpenAITools } from "@/config/tools";

// Google Gemini API 默认基础 URL
const DEFAULT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

/**
 * Google Gemini 适配器
 */
export class GeminiAdapter extends BaseAdapter {
  /**
   * 获取基础 URL
   */
  private getBaseUrl(request: AdapterRequest): string {
    return request.baseUrl || DEFAULT_GEMINI_BASE_URL;
  }

  /**
   * 构建 generationConfig
   */
  private buildGenerationConfig(request: AdapterRequest, isTTS = false) {
    const config: Record<string, any> = {};

    if (isTTS) {
      config.responseModalities = ["AUDIO"];
      return config;
    }

    config.temperature = request.temperature ?? 0.7;
    if (request.maxTokens) {
      config.maxOutputTokens = request.maxTokens;
    }

    // 推理/思考模式
    if (request.reasoning) {
      config.thinkingConfig = {
        includeThoughts: true,
        thinkingBudget: 2048,
      };
    }

    return config;
  }

  /**
   * 判断是否为 TTS 模型
   */
  private isTTSModel(model: string): boolean {
    return model.toLowerCase().includes("tts");
  }

  /**
   * 非流式对话
   */
  async chat(request: AdapterRequest): Promise<AdapterResponse> {
    const baseUrl = this.getBaseUrl(request);

    // TTS 模型走专用逻辑
    if (this.isTTSModel(request.model)) {
      return this.ttsChat(request, baseUrl);
    }

    const contents = this.formatMessages(request);
    const tools = request.tools ? this.formatTools(request.tools) : undefined;

    const url = `${baseUrl}/models/${request.model}:generateContent?key=${request.apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents,
        tools,
        generationConfig: this.buildGenerationConfig(request),
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
      if (part.thought === true && part.text) {
        // 思考内容：thought 是布尔标记，text 是实际内容
        thinking += part.text;
      } else if (part.text) {
        content += part.text;
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
   * TTS 专用非流式对话
   * 返回 base64 音频数据
   */
  private async ttsChat(request: AdapterRequest, baseUrl: string): Promise<AdapterResponse> {
    const url = `${baseUrl}/models/${request.model}:generateContent?key=${request.apiKey}`;

    // 获取用户发送的文本
    const lastMsg = request.messages[request.messages.length - 1];
    const text = typeof lastMsg.content === "string"
      ? lastMsg.content
      : lastMsg.content.find((c) => c.type === "text")?.text || "";

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: { parts: [{ text }] },
        generationConfig: this.buildGenerationConfig(request, true),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`TTS API Error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const parts = data.candidates?.[0]?.content?.parts || [];

    // 提取 base64 音频数据
    for (const part of parts) {
      if (part.inlineData?.data) {
        const mimeType = part.inlineData.mimeType || "audio/mp3";
        const audioDataUrl = `data:${mimeType};base64,${part.inlineData.data}`;
        return {
          content: "",
          audio: { url: audioDataUrl, mimeType },
        };
      }
    }

    throw new Error("TTS response did not contain audio data");
  }

  /**
   * 流式对话
   */
  async *chatStream(request: AdapterRequest): AsyncGenerator<StreamChunk> {
    const baseUrl = this.getBaseUrl(request);

    // TTS 模型不走流式，走非流式后返回音频
    if (this.isTTSModel(request.model)) {
      try {
        const result = await this.ttsChat(request, baseUrl);
        if (result.audio) {
          yield { type: "audio", content: result.audio.url, mimeType: result.audio.mimeType };
        }
      } catch (error) {
        yield { type: "error", error: error instanceof Error ? error.message : "TTS failed" };
      }
      yield { type: "done" };
      return;
    }

    const contents = this.formatMessages(request);
    const tools = request.tools ? this.formatTools(request.tools) : undefined;

    const url = `${baseUrl}/models/${request.model}:streamGenerateContent?key=${request.apiKey}&alt=sse`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents,
        tools,
        generationConfig: this.buildGenerationConfig(request),
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
                if (part.thought === true && part.text) {
                  // 思考内容：thought 是布尔标记，text 是实际内容
                  yield { type: "thinking", content: part.text };
                } else if (part.text) {
                  yield { type: "text", content: part.text };
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
                // TTS 音频支持
                if (part.inlineData?.mimeType?.startsWith("audio/")) {
                  yield {
                    type: "audio",
                    content: part.inlineData.data,
                    mimeType: part.inlineData.mimeType,
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
