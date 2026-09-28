const CACHE_VERSION = 'vc-farm-v2-2026-09';
const STATIC_CACHE = CACHE_VERSION + '-static';
const RUNTIME_CACHE = CACHE_VERSION + '-runtime';
const MEDIA_CACHE = CACHE_VERSION + '-media';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/plantations/index.html',
  '/plantations/coconut.html',
  '/plantations/lanzones.html',
  '/plantations/durian.html',
  '/plantations/rambutan.html',
  '/plantations/maize-right-bank.html',
  '/plantations/maize-left-bank.html',
  '/plantations/maize-upper-valley.html',
  '/plantations/string-beans.html',
  '/plantations/tomato.html',
  '/plantations/potato.html',
  '/plantations/squash.html',
  '/plantations/eggplant.html',
  '/plantations/zucchini.html',
  '/plantations/peanut.html',
  '/plantations/tuber.html'
];

const CDN_ASSETS = [
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
  'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'
];

const MEDIA_CACHE_MAX_BYTES = 60 * 1024 * 1024;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);

    await Promise.allSettled(
      STATIC_ASSETS.map(url =>
        cache.add(new Request(url, { cache: 'reload' })).catch(err =>
          console.warn('SW: failed to cache', url, err)
        )
      )
    );

    await Promise.allSettled(
      CDN_ASSETS.map(url =>
        cache.add(new Request(url, { mode: 'cors' })).catch(err =>
          console.warn('SW: failed to cache CDN', url, err)
        )
      )
    );

    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(k => !k.startsWith(CACHE_VERSION))
        .map(k => caches.delete(k))
    );
    await self.clients.claim();

    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach(c => c.postMessage({ type: 'SW_ACTIVATED', version: CACHE_VERSION }));
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') {
    if (url.pathname === '/api/state' && request.method === 'POST') {
      return;
    }
    if (url.pathname === '/api/upload') {
      return;
    }
    return;
  }

  if (url.pathname === '/api/state') {
    event.respondWith(networkFirstStateApi(request));
    return;
  }

  if (url.hostname.endsWith('.public.blob.vercel-storage.com')) {
    event.respondWith(cacheFirstMedia(request));
    return;
  }

  if (CDN_ASSETS.some(u => request.url.startsWith(u.split('?')[0]))) {
    event.respondWith(networkFirstStatic(request));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(networkFirstStatic(request));
    return;
  }
});

async function networkFirstStateApi(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ state: null, updated_at: null }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    });
  }
}

async function networkFirstStatic(request) {
  const cache = await caches.open(STATIC_CACHE);

  try {
    const response = await fetch(request);
    if (response && response.ok && request.method === 'GET') {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;

    if (request.mode === 'navigate') {
      const shell = await cache.match('/index.html');
      if (shell) return shell;
    }
    throw err;
  }
}

async function cacheFirstMedia(request) {
  const cache = await caches.open(MEDIA_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const len = parseInt(response.headers.get('content-length') || '0', 10);
      if (len > 0 && len <= MEDIA_CACHE_MAX_BYTES) {
        cache.put(request, response.clone());
      }
    }
    return response;
  } catch (err) {
    return new Response('', { status: 503, statusText: 'Offline and not cached' });
  }
}

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
