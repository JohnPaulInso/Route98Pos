// ============================================================
// sw.js — app-shell cache for Route 98 POS (Offline Web Support)
// ============================================================
// (2026-07-13) Cache app shell and enable offline web view; was unregistering
const CACHE_NAME = "route98-pos-v11";
const SHELL_FILES = [
  "./",
  "./index.html",
  "./manifest.json",
  "./route98_logo.png",
  "./icon.png",
  "./css/tokens.css",
  "./css/base.css",
  "./css/views.css",
  "./css/mobile.css",
  "./css/mobile-fixes.css",
  "./css/dropdown-fix.css",
  "./css/apk-fixes.css",
  "./js/chart.umd.min.js",
  "./js/mobile-touch-fix.js",
  "./js/icons.js",
  "./js/uiselect.js",
  "./js/utils.js",
  "./js/mobile.js",
  "./js/catalog_seed.js",
  "./js/sales_seed.js",
  "./js/db.js",
  "./js/modal.js",
  "./js/auth.js",
  "./js/sync.js",
  "./js/realtime-sync.js",
  "./js/barcode.js",
  "./js/importExport.js",
  "./js/analytics.js",
  "./js/pos.js",
  "./js/gasoline.js",
  "./js/inventory.js",
  "./js/dashboard.js",
  "./js/expenses.js",
  "./js/venue.js",
  "./js/restaurant.js",
  "./js/shift.js",
  "./js/reports.js",
  "./js/csv-importer.js",
  "./js/inventory-importer.js",
  "./js/settings.js",
  "./js/app.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const file of SHELL_FILES) {
        try {
          await cache.add(file);
        } catch(e) {
          console.warn("[SW] Cache add skipped:", file, e);
        }
      }
    }).then(() => self.skipWaiting())
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
  if (event.request.method !== "GET") return;
  const url = event.request.url;

  if (url.includes("firestore.googleapis.com") ||
      url.includes("firebaseio.com") ||
      url.includes("identitytoolkit.googleapis.com")) {
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((resp) => {
          if (resp && resp.status === 200) {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", clone)).catch(() => {});
          }
          return resp;
        })
        .catch(async () => {
          const cached = await caches.match("./index.html") || await caches.match("./");
          return cached || new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
        })
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResp) => {
        if (networkResp && networkResp.status === 200 && (url.startsWith("http://") || url.startsWith("https://"))) {
          const clone = networkResp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone)).catch(() => {});
        }
        return networkResp;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        const urlObj = new URL(url);
        const path = urlObj.pathname;
        const relativePath = "." + path;
        const fallback = await caches.match(relativePath) || await caches.match(path);
        if (fallback) return fallback;
        return new Response("", { status: 408, statusText: "Offline" });
      })
  );
});

// (2026-07-13) Purge image cache on service worker message; was unhandled
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "PURGE_IMAGE_CACHE") {
    const { oldUrl, newUrl } = event.data;
    caches.open(CACHE_NAME).then((cache) => {
      if (oldUrl) {
        cache.delete(oldUrl, { ignoreSearch: true });
        cache.delete(oldUrl);
      }
      if (newUrl) {
        cache.delete(newUrl, { ignoreSearch: true });
        cache.delete(newUrl);
        fetch(newUrl, { mode: "no-cors" }).then((resp) => {
          if (resp && (resp.status === 200 || resp.type === "opaque")) cache.put(newUrl, resp);
        }).catch(() => {});
      }
    });
  }
});

