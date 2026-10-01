// sw.js — Valley and Creeks Farm service worker
// Cache version: bump this number whenever you deploy code changes to
// force all clients to pick up the new version on next load.
const CACHE_VERSION = 'vc-farm-v3-2026-10';
const STATIC_CACHE = CACHE_VERSION + '-static';
const RUNTIME_CACHE = CACHE_VERSION + '-runtime';

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

// ---------------------------------------------------------------------------
// INSTALL — pre-cache the app shell and CDN dependencies
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// ACTIVATE — purge old cache versions and claim open clients
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// FETCH — route requests
//
// IMPORTANT: video and Blob storage requests MUST bypass the service worker
// entirely. iPad Safari (and iOS Safari generally) requires that video
// responses return 206 Partial Content with a valid Content-Range header
// in response to Range requests. Service workers break this by intercepting
// the request, dropping the Range header, and returning a full 200 response —
// which Safari interprets as "unsupported format" and renders as a
// black box with a crossed-out play icon.
//
// Solution: let video and Blob traffic fall through to the network.
// ---------------------------------------------------------------------------
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Video and Blob storage — bypass the worker completely.
  //    Detected by destination, Range header, or Vercel Blob hostname.
  if (
    request.destination === 'video' ||
    request.headers.has('range') ||
    url.hostname.endsWith('blob.vercel-storage.com')
  ) {
    return; // let the browser hit the network directly
  }

  // 2. Non-GET requests — never intercepted (POSTs, uploads, PATCH, DELETE).
  if (request.method !== 'GET') {
    return;
  }

  // 3. Farm state API — network-first with cache fallback for offline.
  if (url.pathname === '/api/state') {
    event.respondWith(networkFirstStateApi(request));
    return;
  }

  // 4. CDN assets — network-first, fall back to cache.
  if (CDN_ASSETS.some(u => request.url.startsWith(u.split('?')[0]))) {
    event.respondWith(networkFirstStatic(request));
    return;
  }

  // 5. Same-origin app shell — network-first, fall back to cache.
  if (url.origin === self.location.origin) {
    event.respondWith(networkFirstStatic(request));
    return;
  }

  // 6. Everything else (analytics, fonts, third-party) — let the network
  //    handle it without interception.
});

// ---------------------------------------------------------------------------
// Strategy: network-first for /api/state
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Strategy: network-first for static assets and app shell
// ---------------------------------------------------------------------------
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

    // Navigation fallback — serve index.html for offline SPA routing.
    if (request.mode === 'navigate') {
      const shell = await cache.match('/index.html');
      if (shell) return shell;
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Message channel — allows the page to trigger an immediate SW update.
// ---------------------------------------------------------------------------
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
