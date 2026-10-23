/**
 * WasteWise Service Worker
 * Strategy:
 *   - App shell (HTML, icons, bridge JS) → Cache-first
 *   - API calls (/api/*) → Network-first with 10s timeout, no caching
 *   - Google Fonts / CDN assets → Stale-while-revalidate
 *   - Everything else → Network-first
 */

const CACHE_NAME = 'wastewise-v1';
const OFFLINE_URL = '/wastewise.html';

/** Files to pre-cache on SW install */
const PRECACHE_URLS = [
  '/',
  '/wastewise.html',
  '/wastewise-bridge.js',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// ─── Install ────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        // Non-fatal: some files may not exist in dev
        console.warn('[SW] Pre-cache partial failure:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// ─── Activate ───────────────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ─── Fetch ──────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin + Google Fonts CDN
  const isSameOrigin = url.origin === self.location.origin;
  const isGoogleFonts = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  const isTailwindCDN = url.hostname === 'cdn.tailwindcss.com';

  if (!isSameOrigin && !isGoogleFonts && !isTailwindCDN) return;

  // ── API calls: network-first, never cache ──
  if (isSameOrigin && url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, /* useCache */ false));
    return;
  }

  // ── Google Fonts / Tailwind CDN: stale-while-revalidate ──
  if (isGoogleFonts || isTailwindCDN) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // ── Navigation requests: serve app shell ──
  if (request.mode === 'navigate') {
    event.respondWith(
      cacheFirst(request).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  // ── Static assets: cache-first ──
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // ── Everything else: network-first ──
  event.respondWith(networkFirst(request, /* useCache */ true));
});

// ─── Strategies ─────────────────────────────────────────────────────────────

/** Cache-first: return cached version, fall back to network and cache result */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    throw new Error('Offline and no cache available');
  }
}

/** Network-first: try network with 10s timeout, fall back to cache */
async function networkFirst(request, useCache = true) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timeout);
    if (useCache && response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    clearTimeout(timeout);
    if (useCache) {
      const cached = await caches.match(request);
      if (cached) return cached;
    }
    throw new Error('Network request failed');
  }
}

/** Stale-while-revalidate: serve from cache immediately, update in background */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const networkPromise = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => {});
  return cached || networkPromise;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function isStaticAsset(pathname) {
  return (
    pathname.endsWith('.html') ||
    pathname.endsWith('.js') ||
    pathname.endsWith('.css') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.jpeg') ||
    pathname.endsWith('.webp') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.ico') ||
    pathname.endsWith('.woff') ||
    pathname.endsWith('.woff2') ||
    pathname === '/manifest.json'
  );
}

// ─── Push Notifications (future-ready placeholder) ──────────────────────────

self.addEventListener('push', (event) => {
  if (!event.data) return;
  const { title = 'WasteWise', body = '', icon = '/icon-192.png' } = event.data.json();
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge: '/icon-192.png',
      vibrate: [100, 50, 100],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});
