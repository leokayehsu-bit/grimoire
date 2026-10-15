// Offline support. The page itself is fetched network-first, so anyone online always gets the latest
// version (and the same rules as everyone else in their room); offline it falls back to the saved copy.
// Scripts and styles carry a ?v= stamp per release, so they are safe to serve straight from the cache.
// tools/publish.sh rewrites VERSION on every release, which makes browsers install the new worker.
const VERSION = '202610151148';
const CACHE = 'grimoire-' + VERSION;
const PEERJS = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const res = await fetch('./', { cache: 'no-cache' });
    const html = await res.clone().text();
    await cache.put('./', res);
    // Everything the page loads from this site, exactly as index.html names it (with its ?v= stamp).
    const local = [...html.matchAll(/(?:src|href)="((?:js|css|icons)\/[^"]+|manifest\.webmanifest)"/g)].map((m) => m[1]);
    await cache.addAll([...new Set(local)]);
    try { await cache.add(new Request(PEERJS, { mode: 'cors' })); } catch (err) { /* online rooms need the network anyway */ }
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith('grimoire-') && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // The page: network first, saved copy when offline (any ?room= / ?print= variant uses the same page).
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok && url.origin === location.origin) (await caches.open(CACHE)).put('./', res.clone());
        return res;
      } catch (err) {
        return (await caches.match('./')) || Response.error();
      }
    })());
    return;
  }

  // Our versioned files, PeerJS and fonts: cache first, then network (and keep a copy).
  const ours = url.origin === location.origin;
  const fonts = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!ours && !fonts && req.url !== PEERJS) return;
  e.respondWith((async () => {
    const hit = await caches.match(req);
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok || res.type === 'opaque') (await caches.open(CACHE)).put(req, res.clone());
      return res;
    } catch (err) {
      return hit || Response.error();
    }
  })());
});
