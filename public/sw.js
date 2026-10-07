// Service worker: lets the check-in screen open with no internet.
//
// - The check-in page itself: network first, falling back to the copy saved
//   the last time it opened online.
// - Next's build assets (/_next/static, content-hashed so never stale) and
//   brand images: cache first.
// - Everything else, including every POST (server actions, sync), goes
//   straight to the network — check-ins wait in IndexedDB, not here.
//
// The page tells us which assets it loaded ({ type: "cache", urls }), since
// the very first load happens before this worker is in control.

const CACHE = "check-in-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "cache") return;
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(
        event.data.urls.map((url) =>
          fetch(url, { credentials: "same-origin" })
            .then((res) => (res.ok ? cache.put(url, res) : undefined))
            .catch(() => undefined)
        )
      )
    )
  );
});

const isAsset = (url) => url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/brand/") || /icon/.test(url.pathname);

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate" && url.pathname === "/check-in") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) caches.open(CACHE).then((c) => c.put("/check-in", res.clone()));
          return res;
        })
        .catch(() => caches.match("/check-in").then((hit) => hit || Response.error()))
    );
    return;
  }

  if (isAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok) caches.open(CACHE).then((c) => c.put(request, res.clone()));
            return res;
          })
      )
    );
  }
});
