// ============================================================
// sw.js — app-shell cache for Route 98 POS (Network-first with offline fallback)
// ============================================================
// (2026-07-13) Network-first cache strategy with v8 shell. Prev: cache-first v3
const CACHE_NAME = "route98-pos-v8";
const SHELL_FILES = [
  "./",
  "./index.html",
  "./manifest.json",
  "./js/icons.js",
  "./js/uiselect.js",
  "./icon.svg",
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

  // Network-first for fresh logic updates, cache fallback if offline
  event.respondWith(
    fetch(event.request)
      .then((networkResp) => {
        if(networkResp && networkResp.status === 200){
          const clone = networkResp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone)).catch(() => {});
        }
        return networkResp;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || new Response("", { status: 408, statusText: "Offline" })))
  );
});
