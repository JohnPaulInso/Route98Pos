// ============================================================
// sw.js — app-shell cache so the POS still works with no signal.
// Bump CACHE_NAME whenever you change any cached file so the
// new version gets picked up instead of a stale cached copy.
// ============================================================
const CACHE_NAME = "goodmart-pos-v3";
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

// (2026-07-13) Filter unsupported schemes & handle network fail; was unhandled
self.addEventListener("fetch", (event) => {
  if(event.request.method !== "GET") return;
  const url = event.request.url;
  if(!url.startsWith("http://") && !url.startsWith("https://")) return;
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
