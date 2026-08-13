const CACHE = "worktrade-v20260813j";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css?v=20260813j",
  "./app.js?v=20260813j",
  "./config.js",
  "./data.js",
  "./manifest.webmanifest",
  "./assets/icon.svg",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/icon-maskable-512.png",
  "./assets/worktrade-hero.webp",
  "./modules/store.js",
  "./modules/ui.js",
  "./modules/request-mapper.js",
  "./modules/agreements.js",
  "./modules/backend.js",
  "./modules/backend/core.js",
  "./modules/backend/trust.js",
  "./modules/backend/requests.js",
  "./modules/backend/network.js",
  "./modules/backend/circles.js",
  "./modules/backend/chains.js",
  "./modules/backend/agreements.js",
  "./modules/backend/pilot.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)));
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && new URL(event.request.url).origin === location.origin) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE).then((cache) => cache.put(event.request, copy)));
        }
        return response;
      })
      .catch(async () =>
        (await caches.match(event.request, { ignoreSearch: true })) ||
        (event.request.mode === "navigate" ? caches.match("./index.html") : Response.error()),
      ),
  );
});
