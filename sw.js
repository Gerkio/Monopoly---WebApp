/*
 * sw.js — Monopoly Service Worker
 *
 * Sprint 4: PWA offline cache.
 *
 * Strategy: cache-first with network fallback.
 *
 * NOTE: Service Workers only run over HTTPS or http://localhost. Opening
 * index.html directly via the file:// protocol will silently bypass this
 * worker (navigator.serviceWorker is undefined on file:// in most browsers).
 * Host the game on GitHub Pages / a static server to benefit from offline
 * support.
 *
 * Bump CACHE_NAME whenever cached assets change so the activate step purges
 * the old cache on the next page load.
 */

const CACHE_NAME = "monopoly-cache-v1";

const PRECACHE_URLS = [
  "./",
  "index.html",
  "classicedition.js",
  "newyorkcityedition.js",
  "ai.js",
  "monopoly.js",
  "styles.css",
  "manifest.webmanifest",
  "images/maderafondo.png",
  "images/arrow.png",
  "images/arrow_icon.png",
  "images/chance_icon.png",
  "images/close.png",
  "images/community_chest_icon.png",
  "images/electric_icon.png",
  "images/free_parking_icon.png",
  "images/hori-bar.png",
  "images/hotel.png",
  "images/hotel_faded.png",
  "images/house.png",
  "images/house_faded.png",
  "images/jake_icon.png",
  "images/menu_background.png",
  "images/menu_background_hover.png",
  "images/tax_icon.png",
  "images/train_icon.png",
  "images/vert-bar.png",
  "images/water_icon.png",
  "images/Die_1.png",
  "images/Die_2.png",
  "images/Die_3.png",
  "images/Die_4.png",
  "images/Die_5.png",
  "images/Die_6.png",
  "images/icon-192.png",
  "images/icon-512.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      // addAll is atomic — if any single asset 404s the whole install fails.
      // Wrap individual fetches so a missing optional asset doesn't break SW.
      return Promise.all(
        PRECACHE_URLS.map(function (url) {
          return cache.add(url).catch(function (err) {
            console.warn("[SW] precache miss:", url, err && err.message);
          });
        })
      );
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.map(function (key) {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener("fetch", function (event) {
  var req = event.request;

  // Only handle GETs — POST/PUT/etc. always go straight to network.
  if (req.method !== "GET") {
    return;
  }

  // Skip non-http(s) schemes (chrome-extension://, data:, etc.).
  if (req.url.indexOf("http") !== 0) {
    return;
  }

  event.respondWith(
    caches.match(req).then(function (cached) {
      if (cached) {
        return cached;
      }
      return fetch(req).then(function (resp) {
        // Only cache successful same-origin responses we can clone.
        if (resp && resp.status === 200 && resp.type === "basic") {
          var clone = resp.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(req, clone);
          });
        }
        return resp;
      }).catch(function () {
        // Last resort: fall back to the cached index.html so SPA navigations
        // still resolve to something when offline.
        if (req.mode === "navigate") {
          return caches.match("index.html");
        }
      });
    })
  );
});
