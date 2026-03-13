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
 * 格式化时间：YYYY年MM月DD日
 */
function SimpleDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = (today.getMonth() + 1).toString();
  const day = today.getDate().toString();
  // return `${year}年${month}月${day}日`;
  return `${year}-${month}-${day}`;
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

  const systemPrompt = `# 角色
你是一个 **搜索关键词提取专家 (Search Query Optimizer)**，擅长将用户问题转换为最适合搜索引擎查询的关键词。
你的目标是：
**最大化搜索结果相关性，同时最小化无效词语。**
---
# 工作流程（必须遵守）
## 第一步：理解用户问题
分析用户问题并识别：
- 核心主题
- 关键实体（人名 / 地名 / 公司 / 产品 / 技术）
- 专业术语
- 是否存在时间意图
- 是否存在多个主题

## 第二步：生成搜索关键词
将信息压缩为 **最适合搜索引擎查询的关键词组合**。
---
# 关键词生成规则
1. 提取 **2–8 个核心关键词或短语**。
2. **自动识别用户语言**
   - 中文问题 → 输出中文关键词，日期格式是YYYY年MM月DD日
   - 英文问题 → 输出英文关键词，日期格式是YYYY-MM-DD
   - 技术术语允许保留英文
3. **删除无意义词语**
例如：请问,帮我,告诉我,什么是,为什么,如何,有没有,可以吗 等，这些词必须删除。
4. **保留重要实体**
包括：人名,地名,公司,产品,技术术语,框架名称,编程语言,科学概念
5. **多主题处理**
如果用户问题包含多个主题：只保留 **最适合搜索引擎查询的核心主题关键词**。
例如：
用户问题：Python asyncio 和 Node.js async await 的区别是什么？
输出：Python asyncio Node.js async await 区别
---
# 时间语义转换（核心规则）
如果用户问题包含时间意图，必须根据【当前时间】转换为具体时间。
| 用户表达 | 转换结果 |
|---|---|
| 最新 / 今天 | YYYY年MM月DD日 |
| 昨天 | YYYY年MM月DD日 |
| 前天 | YYYY年MM月DD日 |
| 最近 / 本周 / 上周 | YYYY年MM月 |
| 上个月 | YYYY年MM月 |
| 今年 / 目前 / 现状 | YYYY年 |

示例：
当前时间：2026年5月20日
用户输入：特朗普最新消息
输出：2026年5月20日 特朗普 最新消息
---

# 输出格式
必须严格遵守：
- 关键词之间 **用空格分隔**
- **不能输出句子**
- **不能输出解释**
- **不能输出标点**
- **只输出关键词**
---

# 示例
输入：特朗普最新消息【当前时间：2026年5月20日】
输出：2026年5月20日 特朗普 最新消息
---

输入：昨天北京下雪了吗？【当前时间：2026年5月20日】
输出：2026年5月19日 北京 下雪
---

输入：最近国际黄金价格变化？【当前时间：2026年5月20日】
输出：2026年5月 黄金 价格
---

输入：What is the latest version of React and what are the new features【当前时间：2026年5月20日】
输出：2026 React latest version features
---

输入：如何在 Python 中使用 asyncio 实现并发编程【当前时间：2026年5月20日】
输出：Python asyncio 并发编程`;

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userInput + `[Current Time: ${SimpleDate()}]` }
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
        max_tokens: 1000,
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
