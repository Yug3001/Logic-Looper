/**
 * Logic Looper — Service Worker
 * Provides offline support via Cache-First strategy for app shell + assets,
 * and Network-First for API calls (with cache fallback when offline).
 */

const CACHE_NAME = 'logic-looper-v1';
const API_CACHE = 'logic-looper-api-v1';

// App shell assets to pre-cache on install
const PRECACHE_ASSETS = [
    '/',
    '/index.html',
];

// ── Install: pre-cache app shell ───────────────────────────────────────────────
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(PRECACHE_ASSETS);
        }).then(() => self.skipWaiting())
    );
});

// ── Activate: clean old caches ────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(
                keyList
                    .filter((key) => key !== CACHE_NAME && key !== API_CACHE)
                    .map((key) => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

// ── Fetch: smart routing ───────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip chrome-extension, non-http requests
    if (!request.url.startsWith('http')) return;

    // API routes: Network-First with offline fallback
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(networkFirst(request, API_CACHE));
        return;
    }

    // Navigation requests: return index.html (SPA)
    if (request.mode === 'navigate') {
        event.respondWith(
            caches.match('/index.html').then((cached) => {
                return fetch(request).catch(() => cached || new Response('Offline', { status: 503 }));
            })
        );
        return;
    }

    // Static assets: Cache-First
    event.respondWith(cacheFirst(request, CACHE_NAME));
});

// ── Strategies ─────────────────────────────────────────────────────────────────

async function cacheFirst(request, cacheName) {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(cacheName);
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        return new Response('Offline asset', { status: 503 });
    }
}

async function networkFirst(request, cacheName) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(cacheName);
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        const cached = await caches.match(request);
        return cached || new Response(JSON.stringify({ error: 'Offline' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
