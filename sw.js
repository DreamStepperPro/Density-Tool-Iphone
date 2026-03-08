// sw.js - The Night Shift Advantage Service Worker (Network First)
const CACHE_NAME = 'dsi-advantage-v2';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './manifest.json'
];

// Install: Force the new worker to take over immediately
self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
    );
});

// Activate: Delete old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) return caches.delete(cache);
                })
            );
        })
    );
});

// Fetch: NETWORK FIRST, Fallback to Cache
self.addEventListener('fetch', (event) => {
    event.respondWith(
        fetch(event.request).then((networkResponse) => {
            return caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse.clone());
                return networkResponse;
            });
        }).catch(() => {
            return caches.match(event.request);
        })
    );
});
