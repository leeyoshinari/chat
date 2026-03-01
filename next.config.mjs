/**
 * Next.js 配置文件
 * 配置 PWA、国际化等功能
 */

import withPWAInit from '@ducanh2912/next-pwa';
/** @type {import('next').NextConfig} */

const buildVersion = process.env.VERCEL_GIT_COMMIT_SHA || 'dev';

const withPWA = withPWAInit({
  dest: 'public',
  register: false,
  skipWaiting: true,
  clientsClaim: true,
  disable: process.env.NODE_ENV === 'development',
  swSrc: 'sw-custom.js',
});

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
  // 服务端组件优化
  serverExternalPackages: [],

  env: {
    NEXT_PUBLIC_BUILD_VERSION: buildVersion,
  },
};

export default withPWA(nextConfig);
