/**
 * Tailwind CSS 配置文件
 * 定义了整个项目的设计系统，包括颜色、间距、动画等
 */
import type { Config } from "tailwindcss";

const config: Config = {
  // 启用暗黑模式，通过 class 切换
  darkMode: ["class"],
  // 扫描这些路径下的文件以提取 Tailwind 类名
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    // 容器配置
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      // 自定义颜色，使用 CSS 变量实现主题切换
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // 自定义聊天消息颜色
        "user-message": {
          DEFAULT: "hsl(var(--user-message))",
          foreground: "hsl(var(--user-message-foreground))",
        },
        "assistant-message": {
          DEFAULT: "hsl(var(--assistant-message))",
          foreground: "hsl(var(--assistant-message-foreground))",
        },
        // 侧边栏颜色
        sidebar: {
          DEFAULT: "hsl(var(--sidebar))",
          foreground: "hsl(var(--sidebar-foreground))",
          border: "hsl(var(--sidebar-border))",
          hover: "hsl(var(--sidebar-hover))",
        },
      },
      // 自定义边框圆角
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      // 自定义字体大小（支持跟随系统设置）
      fontSize: {
        "chat-sm": ["0.875rem", { lineHeight: "1.5" }],
        "chat-base": ["1rem", { lineHeight: "1.75" }],
        "chat-lg": ["1.125rem", { lineHeight: "1.75" }],
      },
      // 自定义关键帧动画
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        // 消息淡入动画
        "fade-in": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        // 打字机光标闪烁
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        // 思考中动画
        pulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
        // 滑入动画
        "slide-in-right": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
        "slide-in-left": {
          from: { transform: "translateX(-100%)" },
          to: { transform: "translateX(0)" },
        },
        "slide-up": {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" },
        },
      },
      // 动画类名
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
        blink: "blink 1s step-end infinite",
        pulse: "pulse 2s ease-in-out infinite",
        "slide-in-right": "slide-in-right 0.3s ease-out",
        "slide-in-left": "slide-in-left 0.3s ease-out",
        "slide-up": "slide-up 0.3s ease-out",
      },
      // 响应式断点
      screens: {
        xs: "480px",
        "3xl": "1920px",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
