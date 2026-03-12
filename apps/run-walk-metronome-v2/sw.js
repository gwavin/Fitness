const CACHE_NAME = 'run-walk-metronome-v2-shell-v6';
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

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => key !== CACHE_NAME)
        .map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.mode === 'navigate' && (url.pathname === ROOT_PATH || url.pathname === INDEX_PATH)) {
    event.respondWith(
      caches.match(INDEX_PATH).then((response) => response || fetch(request).catch(() => caches.match(INDEX_PATH)))
    );
    return;
  }

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          return cached;
        }

        return fetch(request).then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        }).catch(() => new Response('', { status: 200 }));
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(request).then((response) => {
        if (response.status === 200 && ['script', 'style', 'image'].includes(request.destination)) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }

        return response;
      }).catch(() => {
        if (request.mode === 'navigate') {
          return caches.match(INDEX_PATH);
        }

        return new Response('Resource unavailable offline.', { status: 503 });
      });
    })
  );
});
