const CACHE_NAME = 'metronome-shell-v1';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/main.js',
  '/manifest.webmanifest',
  'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&display=swap',
  'https://fonts.gstatic.com/s/montserrat/v25/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCtr6Hw5aXo.woff2'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys
        .filter(k => k !== CACHE_NAME)
        .map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  // For navigation requests, serve index.html (SPA / app shell)
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match('/index.html').then(resp =>
        resp || fetch(req).catch(() => caches.match('/index.html'))
      )
    );
    return;
  }

  // Cache-first for core assets, network fallback
  event.respondWith(
    caches.match(req).then(cached =>
      cached || fetch(req).then(r => {
        // Optionally add runtime caching for new resources:
        // const copy = r.clone();
        // caches.open(CACHE_NAME).then(c => c.put(req, copy));
        return r;
      }).catch(() => {
        // Fallback for offline
        if (req.destination === 'document') {
          return caches.match('/index.html');
        }
        return new Response('Resource not available offline', { status: 503 });
      })
    )
  );
});