const CACHE_NAME = 'metronome-shell-v4';
const ROOT_PATH = new URL('./', self.location).pathname;
const INDEX_PATH = new URL('./index.html', self.location).pathname;
const CSS_PATH = new URL('./metronome.css', self.location).pathname;
const JS_PATH = new URL('./metronome.js', self.location).pathname;
const MANIFEST_PATH = new URL('./manifest.webmanifest', self.location).pathname;

const CORE_ASSETS = [
  INDEX_PATH,
  CSS_PATH,
  JS_PATH,
  MANIFEST_PATH,
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-192.png',
  '/icons/maskable-512.png'
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
  const url = new URL(req.url);
  
  // For navigation requests to the metronome app, serve its index.html
  if (req.mode === 'navigate' && (url.pathname === ROOT_PATH || url.pathname === INDEX_PATH)) {
    event.respondWith(
      caches.match(INDEX_PATH).then(resp =>
        resp || fetch(req).catch(() => caches.match(INDEX_PATH))
      )
    );
    return;
  }

  // Handle font requests gracefully
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached;
        return fetch(req).then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
          return response;
        }).catch(() => {
          // Fallback: continue without custom fonts
          return new Response('', { status: 200 });
        });
      })
    );
    return;
  }

  // Cache-first for core assets, network fallback
  event.respondWith(
    caches.match(req).then(cached =>
      cached || fetch(req).then(r => {
        // Runtime caching for new resources
        if (r.status === 200 && (req.destination === 'script' || req.destination === 'style' || req.destination === 'image')) {
          const copy = r.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copy));
        }
        return r;
      }).catch(() => {
        // Fallback for offline - only for PWA routes
        if (req.mode === 'navigate' && (url.pathname === ROOT_PATH || url.pathname === INDEX_PATH)) {
          return caches.match(INDEX_PATH);
        }
        return new Response('Resource not available offline', { status: 503 });
      })
    )
  );
});