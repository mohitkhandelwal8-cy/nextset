/* NextSet service worker — offline-first cache of the app shell */
const CACHE = "nextset-v41";
const ASSETS = ["./", "./index.html", "./exercise-library.json", "./manifest.webmanifest", "./icon.svg", "./icon-180.png", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});
// the page tells us when to activate (via the "Update" banner) so it can reload cleanly
self.addEventListener("message", e => { if (e.data === "SKIP_WAITING") self.skipWaiting(); });
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  // Only manage our own app shell. Cross-origin requests (e.g. exercise demo photos on
  // jsdelivr) go straight to the network — never let the SW cache an opaque response or
  // hand an <img> the index.html fallback. This keeps images reliable across browsers (iOS).
  if (new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.match(e.request).then(hit =>
      hit || fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match("./index.html"))
    )
  );
});
