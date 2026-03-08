// sw.js - The Night Shift Advantage Service Worker
const CACHE_NAME = 'dsi-advantage-v1';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './manifest.json'
];

// Install Event: Caches all core files
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('Caching App Assets');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

// Fetch Event: Serves files from cache if offline
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            return cachedResponse || fetch(event.request);
        })
    );
});
