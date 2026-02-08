// Service Worker - 轻量级静态资源缓存
const CACHE_VERSION = 'v1';
const CACHE_NAME = `wxchat-${CACHE_VERSION}`;

// 预缓存的核心静态资源
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/login.html',
  '/js/config.js',
  '/js/utils.js',
  '/js/auth.js',
  '/js/api.js',
  '/js/ui.js',
  '/js/fileUpload.js',
  '/js/pwa.js',
  '/js/app.js'
];

// install: 预缓存核心静态资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// activate: 清理旧版本缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('wxchat-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// fetch: 分策略处理请求
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API 请求: Network Only，不缓存
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // 导航请求: Network First，离线回退缓存的 index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // 静态资源: Cache First + 后台更新缓存
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);

      return cached || fetchPromise;
    })
  );
});
