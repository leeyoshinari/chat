/**
 * Google Gemini 适配器
 */

import { BaseAdapter, AdapterRequest, AdapterResponse, StreamChunk } from "./base";
import { toOpenAITools } from "@/config/tools";

// Google Gemini API 默认基础 URL
const DEFAULT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

/**
 * 将 PCM 数据添加 WAV 头
 * Gemini Native Audio 默认输出 24kHz, 16bit, 单声道 PCM
 */
function encodeWavHeader(pcmBuffer: Buffer, sampleRate: number = 24000): Buffer {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcmBuffer.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM 格式
  header.writeUInt16LE(1, 22); // 单声道
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28); // byteRate = sampleRate * channels * bitsPerSample/8
  header.writeUInt16LE(2, 32); // blockAlign = channels * bitsPerSample/8
  header.writeUInt16LE(16, 34); // bitsPerSample
  header.write("data", 36);
  header.writeUInt32LE(pcmBuffer.length, 40);
  return Buffer.concat([header, pcmBuffer]);
}

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
        thinking_level: "HIGH",
      };
    }

    return config;
  }

  /**
   * 构建语音识别的 generationConfig
   * 根据 speechMode 设置 responseModalities
   */
  private buildSpeechConfig(request: AdapterRequest) {
    const config: Record<string, any> = {};
    const speechMode = request.speechMode || "stt";

    // 根据语音模式设置响应类型
    if (speechMode === "asr") {
      config.responseModalities = ["AUDIO"];
    } else if (speechMode === "stt") {
      config.responseModalities = ["TEXT"];
    } else if (speechMode === "asr+stt") {
      config.responseModalities = ["AUDIO", "TEXT"];
    }

    // 语音配置
    config.speechConfig = {
      voiceConfig: {
        prebuiltVoiceConfig: {
          voiceName: "Aoede",
        },
      },
    };

    return config;
  }

  /**
   * 判断是否为 TTS 模型
   */
  private isTTSModel(model: string): boolean {
    return model.toLowerCase().includes("tts");
  }

  /**
   * 判断是否需要使用原生音频流（ASR/STT）
   */
  private needsNativeAudio(request: AdapterRequest): boolean {
    const caps = request.capabilities;
    if (!caps) return false;
    return Boolean(caps.asr || caps.stt) && this.hasAudioInput(request);
  }

  /**
   * 检查请求中是否包含音频输入
   */
  private hasAudioInput(request: AdapterRequest): boolean {
    const lastMsg = request.messages[request.messages.length - 1];
    if (typeof lastMsg.content === "string") return false;
    return lastMsg.content.some(
      (c) => c.type === "audio" || c.type === "file" && c.mimeType?.startsWith("audio/")
    );
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
        const rawMimeType = part.inlineData.mimeType || "";
        const isPCM = rawMimeType.includes("L16") || rawMimeType.includes("pcm");
        const mimeType = isPCM ? "audio/wav" : (rawMimeType || "audio/wav");
        const audioDataUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
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

    // 原生音频流（ASR/STT）
    if (this.needsNativeAudio(request)) {
      yield* this.nativeAudioStream(request, baseUrl);
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
   * 原生音频流（ASR/STT）
   * 支持语音转语音、语音转文字、或同时输出
   */
  private async *nativeAudioStream(
    request: AdapterRequest,
    baseUrl: string
  ): AsyncGenerator<StreamChunk> {
    const url = `${baseUrl}/models/${request.model}:streamGenerateContent?alt=sse&key=${request.apiKey}`;
    const lastMsg = request.messages[request.messages.length - 1];

    // 构建请求内容
    const parts: any[] = [];
    if (typeof lastMsg.content === "string") {
      parts.push({ text: lastMsg.content });
    } else {
      for (const c of lastMsg.content) {
        if (c.type === "text") {
          parts.push({ text: c.text });
        } else if ((c.type === "audio" || c.type === "file") && c.url) {
          // 提取音频数据
          let mimeType = c.mimeType || "audio/wav";
          let data = "";
          if (c.url.startsWith("data:")) {
            const [meta, b64] = c.url.split(",");
            const match = meta.match(/data:(.*?);/);
            mimeType = match ? match[1] : mimeType;
            data = b64;
          }
          if (data) {
            parts.push({ inlineData: { mimeType, data } });
          }
        }
      }
    }

    const payload = {
      contents: [{ parts }],
      generationConfig: this.buildSpeechConfig(request),
    };

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      yield { type: "error", error: `Native Audio API Error: ${response.status} - ${error}` };
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      yield { type: "error", error: "No response body" };
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";
    const pcmChunks: Buffer[] = [];

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const parsed = JSON.parse(line.slice(6));
              const resParts = parsed.candidates?.[0]?.content?.parts || [];

              for (const part of resParts) {
                // 文字流：立即返回给前端 (STT)
                if (part.text) {
                  yield { type: "text", content: part.text };
                }

                // 语音流：暂存在内存中，不立即发送
                if (part.inlineData?.data) {
                  const b64Data = part.inlineData.data;
                  pcmChunks.push(Buffer.from(b64Data, "base64"));
                }

                // 工具调用处理
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

      // 所有流结束后，合并 PCM 并添加 WAV 头一次性返回
      if (pcmChunks.length > 0) {
        const fullPcmBuffer = Buffer.concat(pcmChunks);
        // Gemini Native Audio 默认输出 24kHz, 16bit, 单声道 PCM
        const wavBuffer = encodeWavHeader(fullPcmBuffer, 24000);

        yield {
          type: "audio",
          content: wavBuffer.toString("base64"),
          mimeType: "audio/wav",
        };
      }
    } finally {
      reader?.releaseLock();
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
        } else if ((item.type === "audio" || item.type === "file") && item.url?.startsWith("data:")) {
          // 支持 base64 音频
          const [meta, data] = item.url.split(",");
          const mimeType = meta.match(/data:(.*);/)?.[1] || item.mimeType || "audio/wav";
          parts.push({
            inlineData: { mimeType, data },
          });
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
