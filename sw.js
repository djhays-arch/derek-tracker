// Derek Hays Tracker — Service Worker v5
// Provides offline support: the app shell loads from cache when offline.
const CACHE_NAME = 'dht-v5-cache-v1';
const APP_FILES = [
  './',
  './index.html',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Cache the current page (whatever URL the user hit)
      return cache.addAll(APP_FILES).catch(() => {
        // If specific files fail (e.g. renamed HTML file), just cache what we can on first fetch
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Network-first for API calls (Claude, Google Calendar). Cache-first for everything else.
  const url = new URL(req.url);
  const isApi = url.hostname.includes('anthropic.com') || url.hostname.includes('googleapis.com');

  if (isApi) {
    event.respondWith(fetch(req).catch(() => new Response('Offline', { status: 503 })));
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req).then((networkRes) => {
        // Update cache in background
        if (networkRes && networkRes.status === 200 && req.method === 'GET') {
          caches.open(CACHE_NAME).then((cache) => cache.put(req, networkRes.clone()));
        }
        return networkRes;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
