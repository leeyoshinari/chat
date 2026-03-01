/**
 * Cloudflare Workers AI 适配器
 *
 * Cloudflare Workers AI 的 baseUrl 格式:
 *   https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai
 *
 * 文生文走接口: {baseUrl}/v1/chat/completions
 * 其他能力走原生接口:       {baseUrl}/run/{model}
 */

import { BaseAdapter, AdapterRequest, AdapterResponse, StreamChunk } from "./base";
import { toOpenAITools } from "@/config/tools";
import type { ModelCapabilities } from "@/types";

/**
 * 根据模型能力标识判断模型类型
 */
function detectModelType(capabilities?: ModelCapabilities): "chat" | "tts" | "asr" | "stt" | "image" {
  if (!capabilities) return "chat";
  if (capabilities.tts) return "tts";
  if (capabilities.asr) return "asr";
  if (capabilities.stt) return "stt";
  if (capabilities.imageOutput) return "image";
  return "chat";
}

/**
 * 去除 URL 末尾的斜杠，防止拼接时出现 // 导致路由错误
 */
function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

/**
 * 构建 Cloudflare Workers AI /run/ 端点 URL
 * Cloudflare 接受这些字符作为路径的一部分，无需编码
 */
function buildRunUrl(baseUrl: string, model: string): string {
  const base = normalizeBaseUrl(baseUrl);
  return `${base}/run/${model}`;
}

/**
 * 构建 chat completions 端点 URL
 */
function buildChatUrl(baseUrl: string): string {
  const base = normalizeBaseUrl(baseUrl);
  return `${base}/v1/chat/completions`;
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
      case "stt":
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

    const response = await fetch(buildChatUrl(request.baseUrl), {
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
        reasoning: "enabled",
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

    const response = await fetch(buildChatUrl(request.baseUrl), {
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

    const imageItem = typeof lastMsg.content === "string"
      ? null
      : lastMsg.content.find((c) => c.type === "image" && c.url);

    if (imageItem?.url) {
      return this.imageToImage(request, text, imageItem.url, imageItem.mimeType, imageItem.fileName);
    }

    const url = buildRunUrl(request.baseUrl, request.model);
    const formData = new FormData();
    formData.append("prompt", text);
    formData.append("num_steps", "4");
    formData.append("guidance", "7.5");

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${request.apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Image API Error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    if (!data.success || !data.result?.image) {
      throw new Error(`Image API Error: ${JSON.stringify(data.errors || data)}`);
    }
    const dataUrl = `data:image/png;base64,${data.result.image}`;
    return {
      content: "",
      images: [dataUrl],
    };
  }

  private async imageToImage(
    request: AdapterRequest,
    prompt: string,
    imageUrl: string,
    mimeType?: string,
    fileName?: string
  ): Promise<AdapterResponse> {

    const url = buildRunUrl(request.baseUrl, request.model);
    const imageBytes: number[] = await this.imageUrlToByteArray(imageUrl);
    const imageUint8 = new Uint8Array(imageBytes);

    const resolvedMimeType = mimeType
      || this.parseMimeTypeFromDataUrl(imageUrl)
      || "image/png";

    const ext = this.mimeToExtension(resolvedMimeType);
    const resolvedFileName = fileName || `input.${ext}`;

    const formData = new FormData();
    formData.append("prompt", prompt);
    formData.append("strength", "0.6");
    formData.append("guidance", "7.5");
    const blob = new Blob([imageUint8], { type: resolvedMimeType });
    formData.append("image", blob, resolvedFileName);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${request.apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Image-to-Image API Error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    if (!data.success || !data.result?.image) {
      throw new Error(`Image-to-Image API Error: ${JSON.stringify(data.errors || data)}`);
    }
    const dataUrl = `data:image/png;base64,${data.result.image}`;
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

    const url = buildRunUrl(request.baseUrl, request.model);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${request.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: text,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`TTS API Error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    if (!data.success || !data.result?.audio) {
      throw new Error(`TTS API Error: ${JSON.stringify(data.errors || data)}`);
    }
    const audioDataUrl = `data:audio/wav;base64,${data.result.audio}`;
    return {
      content: "",
      audio: { url: audioDataUrl, mimeType: "audio/wav" },
    };
  }

  // ============================================
  // 语音转文字 (STT)
  // ============================================

  private async speechToText(request: AdapterRequest): Promise<AdapterResponse> {
    const lastMsg = request.messages[request.messages.length - 1];
    const content = lastMsg.content;
    let audioBase64: string | null = null;
    if (typeof content !== "string") {
      const audioItem = content.find(
        (c) => c.type === "audio" || c.type === "file"
      );
      if (audioItem?.url) {
        if (audioItem.url.startsWith("data:")) {
          audioBase64 = audioItem.url.split(",")[1];
        } else {
          const resp = await fetch(audioItem.url);
          const buffer = await resp.arrayBuffer();
          audioBase64 = this.arrayBufferToBase64(buffer);
        }
      }
    }

    if (!audioBase64) {
      return { content: "请上传音频文件进行语音识别。" };
    }

    const url = buildRunUrl(request.baseUrl, request.model);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${request.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        audio: audioBase64,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`ASR API Error: ${response.status} - ${error}`);
    }

    const resp = await response.json();
    const data = resp.result;

    if (!data || !data.text) {
      throw new Error(`ASR API Error: ${JSON.stringify(resp.errors || resp)}`);
    }

    // 格式化带时间戳的识别结果
    let allText = "";
    const fullText = data.text;
    const segments = data.segments || [];

    if (segments.length > 0) {
      const lastSegment = segments[segments.length - 1];
      const lastWords = lastSegment.words || [];
      const endTime = lastWords.length > 0 ? lastWords[lastWords.length - 1].end : 0;
      allText += `**[0.00 → ${endTime.toFixed(2)}]** ${fullText}\n\n`;

      for (const segment of segments) {
        const words = segment.words || [];
        if (words.length === 0) continue;
        const startTime = words[0].start;
        const segEnd = words[words.length - 1].end;
        const segText = (segment.text || "").trim();
        allText += `**[${startTime.toFixed(2)} → ${segEnd.toFixed(2)}]** ${segText}\n`;
      }
    } else {
      allText = fullText;
    }
    return { content: allText.trim() };
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

  /**
   * 从 data URL 中解析 MIME 类型
   * 例如 data:image/jpeg;base64,... → image/jpeg
   */
  private parseMimeTypeFromDataUrl(url: string): string | null {
    if (!url.startsWith("data:")) return null;
    const match = url.match(/^data:([^;,]+)/);
    return match ? match[1] : null;
  }

  /**
   * 根据 MIME 类型返回文件扩展名
   */
  private mimeToExtension(mimeType: string): string {
    const map: Record<string, string> = {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/jpg": "jpg",
      "image/gif": "gif",
      "image/webp": "webp",
      "image/bmp": "bmp",
      "image/svg+xml": "svg",
      "image/tiff": "tiff",
    };
    return map[mimeType.toLowerCase()] || "png";
  }
}
