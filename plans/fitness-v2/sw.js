// Bump the shell version whenever a cached asset changes. No skipWaiting: an
// active workout keeps its current shell until every v2 tab has closed.
const CACHE = 'fitness-v2-shell-1';
const ASSETS = ['./', './index.html', './style.css', './app.mjs', './model.mjs', './manifest.webmanifest', './README.md', '../coaching-runner/current-workout.js', '../../icons/icon-192.png', '../../icons/icon-512.png', '../../icons/maskable-512.png'];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS))); });
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // Only this app's old shell caches; never touch other apps or browser records.
    for (const key of await caches.keys()) if (key.startsWith('fitness-v2-shell-') && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(event.request, { ignoreSearch: true })) || fetch(event.request)));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const url = new URL('./index.html', self.location.href).href;
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = clients.find(client => client.url.startsWith(new URL('./', self.location.href).href));
    if (existing) return existing.focus();
    return self.clients.openWindow(url);
  })());
});
