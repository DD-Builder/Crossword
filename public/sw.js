/* Cache strategy for offline play, tuned so a new deploy is always picked up:
 *  - Navigation requests (the HTML shell) are NETWORK-FIRST — a fresh deploy
 *    is visible on the very next load, with the cached shell as an offline
 *    fallback only.
 *  - Everything else (Vite's content-hashed JS/CSS/assets) is CACHE-FIRST —
 *    safe and fast, since a new deploy ships new hashed URLs rather than
 *    mutating an old one.
 * Bump CACHE when this file's strategy changes, so `activate` purges old
 * entries cached under the previous (buggier) logic. */
const CACHE = 'xw-v2';
const SHELL_URL = self.registration.scope; // e.g. https://…/Crossword/

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.add(SHELL_URL).catch(() => {})),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(SHELL_URL, clone));
          }
          return res;
        })
        .catch(() => caches.match(SHELL_URL).then((hit) => hit || caches.match(req))),
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(req, clone));
        }
        return res;
      });
    }),
  );
});
