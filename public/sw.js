/**
 * Service Worker
 * 缓存所有静态文件以节省流量
 * 版本号在构建时自动更新
 */

// 缓存版本号 - 每次构建时会自动更新
const CACHE_VERSION = 'v' + Date.now();
const CACHE_NAME = `chat-cache-${CACHE_VERSION}`;

// 需要缓存的静态资源路径
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icons/openai.svg',
  '/icons/google.svg',
  '/icons/anthropic.svg',
  '/icons/deepseek.svg',
  '/icons/qwen.svg',
  '/icons/cloudflare.svg',
  '/icons/web-search.svg',
];

// 需要缓存的资源类型
const CACHEABLE_TYPES = [
  'text/html',
  'text/css',
  'text/javascript',
  'application/javascript',
  'application/json',
  'image/svg+xml',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'font/woff',
  'font/woff2',
  'application/font-woff',
  'application/font-woff2',
];

// 不缓存的路径模式
const NO_CACHE_PATTERNS = [
  /^\/api\//,  // API 请求不缓存
  /\/_next\/webpack-hmr/,  // HMR 不缓存
];

/**
 * 判断请求是否应该被缓存
 */
function shouldCache(request) {
  const url = new URL(request.url);
  
  // 只缓存 GET 请求
  if (request.method !== 'GET') {
    return false;
  }
  
  // 检查是否匹配不缓存的模式
  for (const pattern of NO_CACHE_PATTERNS) {
    if (pattern.test(url.pathname)) {
      return false;
    }
  }
  
  return true;
}

/**
 * 安装事件 - 缓存静态资源
 */
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker:', CACHE_NAME);
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS).catch((error) => {
        console.warn('[SW] Failed to cache some assets:', error);
      });
    })
  );
  
  // 立即激活新的 Service Worker
  self.skipWaiting();
});

/**
 * 激活事件 - 清理旧缓存
 */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker:', CACHE_NAME);
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('chat-cache-') && name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  
  // 立即控制所有页面
  self.clients.claim();
});

/**
 * 请求拦截 - 缓存优先策略
 */
self.addEventListener('fetch', (event) => {
  // 检查是否应该缓存
  if (!shouldCache(event.request)) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // 如果有缓存，返回缓存
      if (cachedResponse) {
        // 后台更新缓存（stale-while-revalidate 策略）
        event.waitUntil(
          fetch(event.request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                const responseClone = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(event.request, responseClone);
                });
              }
            })
            .catch(() => {
              // 网络请求失败，忽略
            })
        );
        
        return cachedResponse;
      }
      
      // 没有缓存，从网络获取并缓存
      return fetch(event.request)
        .then((networkResponse) => {
          // 检查响应是否有效
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }
          
          // 克隆响应（响应只能使用一次）
          const responseToCache = networkResponse.clone();
          
          // 缓存响应
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          
          return networkResponse;
        })
        .catch(() => {
          // 网络请求失败，返回离线页面或空响应
          return new Response('Offline', {
            status: 503,
            statusText: 'Service Unavailable',
          });
        });
    })
  );
});

/**
 * 消息处理 - 用于手动更新缓存
 */
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
  
  if (event.data === 'clearCache') {
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => caches.delete(name))
      );
    });
  }
});
