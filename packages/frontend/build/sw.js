// Service worker: makes the app installable and keeps the shell usable offline.
// Pages are network-first (always fresh when online); Vite's content-hashed build files are
// cache-first because their names change on every release. Everything else (OCR models,
// viewer assets, the office-editor iframe) goes straight to the network, so the cache stays small.
//
// Each release gets its own cache (the build fills in __BUILD_ID__, see serviceWorker.ts), so the
// previous release's files are dropped when this one takes over. A new release doesn't take over
// on its own: it waits until the user clicks "새로고침" (SKIP_WAITING) or closes every tab, so a
// page still running the old code keeps its old files.

const PREFIX = 'sejong-office-';
const CACHE = 'sejong-office-__BUILD_ID__';
const HASHED_ASSET = /^\/assets\/.+-[A-Za-z0-9_-]{8}\.(?:js|css|woff2?|png|svg|wasm)$/;

self.addEventListener('install', (event) => {
  // The app shell this release belongs to, so it opens offline right after the update.
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add('/')));
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k)),
        ),
      )
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
        .catch(() => caches.match('/', { cacheName: CACHE }).then((r) => r || Response.error())),
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
