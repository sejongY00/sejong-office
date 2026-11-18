// Minimal service worker: makes the app installable and keeps the shell usable offline.
// Pages are network-first (always fresh when online); Vite's content-hashed build files are
// cache-first because their names change on every release. Everything else (OCR models,
// viewer assets, the office-editor iframe) goes straight to the network, so the cache stays small.

const CACHE = 'sejong-office-v1';
const HASHED_ASSET = /^\/assets\/.+-[A-Za-z0-9_-]{8}\.(?:js|css|woff2?|png|svg|wasm)$/;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    // SPA: every route is index.html, so cache it under '/' and serve it for any offline route.
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put('/', copy));
          }
          return res;
        })
        .catch(() => caches.match('/').then((r) => r || Response.error())),
    );
    return;
  }

  if (HASHED_ASSET.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(request, copy));
            }
            return res;
          }),
      ),
    );
  }
});
