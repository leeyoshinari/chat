/**
 * Next.js 配置文件
 * 配置 PWA、国际化等功能
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 图片域名白名单
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  // 实验性功能
  experimental: {
    // 服务端组件优化
    serverComponentsExternalPackages: [],
  },
};

export default nextConfig;
