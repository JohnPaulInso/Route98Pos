// ============================================================
// sw.js — app-shell cache for Route 98 POS (Cache-first images/assets)
// ============================================================
// (2026-07-13) Cache-first for images/assets with v9 shell; was network-first v8
const CACHE_NAME = "route98-pos-v9";
const SHELL_FILES = [
  "./",
  "./index.html",
  "./manifest.json",
  "./js/icons.js",
  "./js/uiselect.js",
  "./icon.svg",
  "./icon.png",
  "./route98_logo.png",
  "./logo.png",
  "./css/tokens.css",
  "./css/base.css",
  "./css/views.css",
  "./js/utils.js",
  "./js/db.js",
  "./js/modal.js",
  "./js/auth.js",
  "./js/sync.js",
  "./js/barcode.js",
  "./js/importExport.js",
  "./js/analytics.js",
  "./js/pos.js",
  "./js/gasoline.js",
  "./js/inventory.js",
  "./js/dashboard.js",
  "./js/venue.js",
  "./js/restaurant.js",
  "./js/reports.js",
  "./js/settings.js",
  "./js/app.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if(event.request.method !== "GET") return;
  const url = event.request.url;
  if(!url.startsWith("http://") && !url.startsWith("https://")) return;

  // Cache-first for images, fonts, icons, and CDN libraries
  const isImageOrFont = /\.(png|jpg|jpeg|svg|webp|gif|ico|woff2|woff|ttf)(\?.*)?$/i.test(url) ||
                        url.includes("fonts.gstatic.com") ||
                        url.includes("fonts.googleapis.com") ||
                        url.includes("cdn.jsdelivr.net");

  if(isImageOrFont){
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if(cached) return cached;
        return fetch(event.request).then((networkResp) => {
          if(networkResp && networkResp.status === 200){
            const clone = networkResp.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone)).catch(() => {});
          }
          return networkResp;
        }).catch(() => new Response("", { status: 408, statusText: "Offline" }));
      })
    );
    return;
  }

  // Stale-while-revalidate / fast network for app files
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((networkResp) => {
          if(networkResp && networkResp.status === 200){
            const clone = networkResp.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone)).catch(() => {});
          }
          return networkResp;
        })
        .catch(() => cached || new Response("", { status: 408, statusText: "Offline" }));

      return cached || fetchPromise;
    })
  );
});
