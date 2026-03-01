/**
 * 搜索关键词智能提取服务
 * 支持 OpenAI、DeepSeek、Cloudflare 模型提供商
 */

import { getProviderById } from "@/config/providers";

interface ExtractorConfig {
  provider: string;
  model: string;
  apiKey: string;
  baseUrl: string;
}

/**
 * 获取提取器配置
 * 自动从对应提供商读取 API 配置
 */
function getExtractorConfig(): ExtractorConfig | null {
  const provider = process.env.KEYWORD_EXTRACTOR_PROVIDER || "cloudflare";
  const model = process.env.KEYWORD_EXTRACTOR_MODEL || "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
  
  // 从提供商配置中获取 API 信息
  const providerConfig = getProviderById(provider);
  if (!providerConfig || !providerConfig.apiKey) {
    return null;
  }
  
  return {
    provider,
    model,
    apiKey: providerConfig.apiKey,
    baseUrl: providerConfig.baseUrl,
  };
}

/**
 * 从用户输入中智能提取搜索关键词
 * @param userInput 用户输入的内容
 * @returns 提取的搜索关键词
 */
export async function extractSearchKeywords(userInput: string): Promise<string> {
  const config = getExtractorConfig();
  
  if (!config) {
    console.warn("Keyword extractor provider not configured or not enabled, using original input");
    return userInput.slice(0, 100);
  }

  const systemPrompt = `你是一个搜索关键词提取专家。你的任务是从用户的问题中提取最相关的搜索关键词。

规则：
1. 提取2-5个最核心的关键词或短语
2. 移除无意义的词汇（如"请问"、"帮我"、"什么是"等）
3. 保留专业术语、人名、地名、产品名等实体
4. 如果是中文问题，优先输出中文关键词；如果涉及技术或英文概念，可以保留英文
5. 关键词之间用空格分隔
6. 只输出关键词，不要任何解释

示例：
输入：请帮我查一下2024年诺贝尔物理学奖得主是谁？
输出：2024 诺贝尔物理学奖 得主

输入：What is the latest version of React and what are the new features?
输出：React latest version new features

输入：如何在 Python 中使用 asyncio 实现并发编程？
输出：Python asyncio 并发编程`;

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userInput }
  ];

  try {
    // 构建 API URL
    let apiUrl = `${config.baseUrl}/chat/completions`;
    
    // Google Gemini 使用不同的 API 格式
    if (config.provider === "google") {
      apiUrl = `${config.baseUrl}/models/${config.model}:generateContent?key=${config.apiKey}`;
      
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemPrompt}\n\n用户输入：${userInput}` }] }],
        }),
      });

      if (!response.ok) {
        console.error(`Keyword extraction failed: ${response.status}`);
        return userInput.slice(0, 100);
      }

      const data = await response.json();
      const keywords = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      return keywords || userInput.slice(0, 100);
    }

    if (config.provider === "cloudflare") {
      apiUrl = `${config.baseUrl}/v1/chat/completions`;
    }
    // OpenAI 兼容 API（OpenAI、DeepSeek、Qwen、Cloudflare）
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: 0.3,
        max_tokens: 100,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`Keyword extraction failed: ${response.status} - ${error}`);
      return userInput.slice(0, 100);
    }

    const data = await response.json();
    const keywords = data.choices?.[0]?.message?.content?.trim();
    
    if (!keywords) {
      return userInput.slice(0, 100);
    }

    return keywords;
  } catch (error) {
    console.error("Keyword extraction error:", error);
    return userInput.slice(0, 100);
  }
}

/**
 * 检查关键词提取服务是否可用
 */
// export function isKeywordExtractorEnabled(): boolean {
//   const config = getExtractorConfig();
//   return config !== null;
// }
