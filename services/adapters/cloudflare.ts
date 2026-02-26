/**
 * Cloudflare Workers AI 适配器
 * 支持文生文(OpenAI兼容)、文生图、图生图、TTS、ASR
 *
 * Cloudflare Workers AI 的 baseUrl 格式:
 *   https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai
 *
 * 文生文走 OpenAI 兼容接口: {baseUrl}/v1/chat/completions
 * 其他能力走原生接口:       {baseUrl}/run/{model}
 */

import { BaseAdapter, AdapterRequest, AdapterResponse, StreamChunk } from "./base";
import { toOpenAITools } from "@/config/tools";
import type { ModelCapabilities } from "@/types";

/**
 * 根据模型能力标识判断模型类型
 */
function detectModelType(capabilities?: ModelCapabilities): "chat" | "tts" | "asr" | "image" {
  if (!capabilities) return "chat";
  if (capabilities.tts) return "tts";
  if (capabilities.asr) return "asr";
  if (capabilities.imageOutput) return "image";
  return "chat";
}

export class CloudflareAdapter extends BaseAdapter {
  /**
   * 非流式对话
   */
  async chat(request: AdapterRequest): Promise<AdapterResponse> {
    const modelType = detectModelType(request.capabilities);

    switch (modelType) {
      case "tts":
        return this.textToSpeech(request);
      case "asr":
        return this.speechToText(request);
      case "image":
        return this.textToImage(request);
      default:
        return this.chatCompletion(request);
    }
  }

  /**
   * 流式对话
   */
  async *chatStream(request: AdapterRequest): AsyncGenerator<StreamChunk> {
    const modelType = detectModelType(request.capabilities);

    // 非文生文模型不支持流式，走非流式后转换
    if (modelType !== "chat") {
      try {
        const result = await this.chat(request);
        if (result.audio) {
          yield { type: "audio", content: result.audio.url, mimeType: result.audio.mimeType };
        } else if (result.images && result.images.length > 0) {
          for (const img of result.images) {
            yield { type: "image", imageUrl: img };
          }
        } else if (result.content) {
          yield { type: "text", content: result.content };
        }
        yield { type: "done" };
        return;
      } catch (error) {
        yield { type: "error", error: error instanceof Error ? error.message : "Request failed" };
        yield { type: "done" };
        return;
      }
    }

    // 文生文走 OpenAI 兼容的流式接口
    const messages = this.formatMessages(request);
    const tools = request.tools ? toOpenAITools(request.tools) : undefined;

    const response = await fetch(`${request.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${request.apiKey}`,
      },
      body: JSON.stringify({
        model: request.model,
        messages,
        tools: tools?.length ? tools : undefined,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens,
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
            if (data === "[DONE]") {
              yield { type: "done" };
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta;

              if (delta?.content) {
                yield { type: "text", content: delta.content };
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

  // ============================================
  // 文生文（OpenAI 兼容）
  // ============================================

  private async chatCompletion(request: AdapterRequest): Promise<AdapterResponse> {
    const messages = this.formatMessages(request);
    const tools = request.tools ? toOpenAITools(request.tools) : undefined;

    const response = await fetch(`${request.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${request.apiKey}`,
      },
      body: JSON.stringify({
        model: request.model,
        messages,
        tools: tools?.length ? tools : undefined,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API Error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const choice = data.choices[0];

    return {
      content: choice.message.content || "",
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

  // ============================================
  // 文生图 / 图生图
  // ============================================

  private async textToImage(request: AdapterRequest): Promise<AdapterResponse> {
    const lastMsg = request.messages[request.messages.length - 1];
    const text = this.contentToText(lastMsg.content);
    const images = typeof lastMsg.content === "string"
      ? []
      : this.extractImages(lastMsg.content);

    // 有图片附件 -> 图生图，否则 -> 文生图
    if (images.length > 0) {
      return this.imageToImage(request, text, images[0]);
    }

    const url = `${request.baseUrl}/run/${request.model}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${request.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: text,
        num_steps: 4,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Image API Error: ${response.status} - ${error}`);
    }

    // 返回二进制图片数据
    const imageBuffer = await response.arrayBuffer();
    const base64 = this.arrayBufferToBase64(imageBuffer);
    const dataUrl = `data:image/png;base64,${base64}`;

    return {
      content: "",
      images: [dataUrl],
    };
  }

  private async imageToImage(
    request: AdapterRequest,
    prompt: string,
    imageUrl: string
  ): Promise<AdapterResponse> {
    const url = `${request.baseUrl}/run/${request.model}`;

    // 将图片 URL/data URL 转为字节数组
    const imageBytes = await this.imageUrlToByteArray(imageUrl);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${request.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        image: imageBytes,
        strength: 0.5,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Image-to-Image API Error: ${response.status} - ${error}`);
    }

    const imageBuffer = await response.arrayBuffer();
    const base64 = this.arrayBufferToBase64(imageBuffer);
    const dataUrl = `data:image/png;base64,${base64}`;

    return {
      content: "",
      images: [dataUrl],
    };
  }

  // ============================================
  // 文字转语音 (TTS)
  // ============================================

  private async textToSpeech(request: AdapterRequest): Promise<AdapterResponse> {
    const lastMsg = request.messages[request.messages.length - 1];
    const text = this.contentToText(lastMsg.content);

    const url = `${request.baseUrl}/run/${request.model}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${request.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: text,
        lang: "zh",
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`TTS API Error: ${response.status} - ${error}`);
    }

    // 返回二进制 WAV 音频数据
    const audioBuffer = await response.arrayBuffer();
    const base64 = this.arrayBufferToBase64(audioBuffer);
    const audioDataUrl = `data:audio/wav;base64,${base64}`;

    return {
      content: "",
      audio: { url: audioDataUrl, mimeType: "audio/wav" },
    };
  }

  // ============================================
  // 语音转文字 (ASR)
  // ============================================

  private async speechToText(request: AdapterRequest): Promise<AdapterResponse> {
    const lastMsg = request.messages[request.messages.length - 1];
    const content = lastMsg.content;

    // 从消息中提取音频附件
    let audioData: Uint8Array | null = null;

    if (typeof content !== "string") {
      const audioItem = content.find(
        (c) => c.type === "audio" || c.type === "file"
      );
      if (audioItem?.url) {
        audioData = await this.dataUrlToUint8Array(audioItem.url);
      }
    }

    if (!audioData) {
      // 没有音频附件，返回提示
      return { content: "请上传音频文件进行语音识别。" };
    }

    const url = `${request.baseUrl}/run/${request.model}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${request.apiKey}`,
        "Content-Type": "application/octet-stream",
      },
      body: audioData.buffer as ArrayBuffer,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`ASR API Error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const transcript = data.result?.text || "";

    return { content: transcript };
  }

  // ============================================
  // 工具函数
  // ============================================

  private formatMessages(request: AdapterRequest) {
    return request.messages.map((msg) => {
      if (typeof msg.content === "string") {
        return { role: msg.role, content: msg.content };
      }

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

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 8192;
    let binary = "";
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
  }

  private async imageUrlToByteArray(imageUrl: string): Promise<number[]> {
    if (imageUrl.startsWith("data:")) {
      const base64 = imageUrl.split(",")[1];
      const binary = atob(base64);
      return Array.from({ length: binary.length }, (_, i) =>
        binary.charCodeAt(i)
      );
    }

    // 远程 URL
    const response = await fetch(imageUrl);
    const buffer = await response.arrayBuffer();
    return Array.from(new Uint8Array(buffer));
  }

  private async dataUrlToUint8Array(dataUrl: string): Promise<Uint8Array> {
    if (dataUrl.startsWith("data:")) {
      const base64 = dataUrl.split(",")[1];
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    }

    const response = await fetch(dataUrl);
    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  }
}
