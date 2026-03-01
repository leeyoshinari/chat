/**
 * 主布局组件
 */
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

// 使用 Inter 字体
const inter = Inter({ subsets: ["latin"] });

/**
 * 页面元数据
 */
export const metadata: Metadata = {
  title: "AI Chat ∙ 快来聊几句",
  description: "支持多模型、工具调用、流式输出的 AI 对话应用",
  keywords: ["AI", "Chat", "GPT", "Gemini", "Claude", "DeepSeek"],
  authors: [{ name: "AI Chat" }],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "AI Chat",
  },
};

/**
 * 视口配置
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a1a" },
  ],
};

/**
 * 根布局
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        {/* PWA 图标 */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className={inter.className}>
        {/* 主题检测脚本 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                const theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                document.documentElement.classList.add(theme);
              })();
            `,
          }}
        />
        {/* Service Worker 注册脚本 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                if ('serviceWorker' in navigator) {
                  window.addEventListener('load', async () => {
                    try {
                      const registration = await navigator.serviceWorker.register('/sw.js');
                      registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;
                        if (!newWorker) return;
                        newWorker.addEventListener('statechange', () => {
                          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            console.log('New SW version available');
                          }
                        });
                      });
                    } catch (error) {
                      console.error('SW registration failed:', error);
                    }
                  });
                }
              })();
            `,
          }}
        />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
