/**
 * 多语言配置
 */

/**
 * 支持的语言列表
 */
export const locales = ["en", "zh"] as const;

/**
 * 默认语言
 */
export const defaultLocale = "en";

/**
 * 语言类型
 */
export type Locale = (typeof locales)[number];

/**
 * 语言显示名称
 */
export const localeNames: Record<Locale, string> = {
  en: "English",
  zh: "中文",
};

/**
 * 获取浏览器语言
 */
export function getBrowserLocale(): Locale {
  if (typeof navigator === "undefined") return defaultLocale;
  
  const browserLang = navigator.language.split("-")[0];
  return locales.includes(browserLang as Locale)
    ? (browserLang as Locale)
    : defaultLocale;
}
