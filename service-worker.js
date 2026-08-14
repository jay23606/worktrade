const CACHE_PREFIX = "worktrade-";
const CACHE = `${CACHE_PREFIX}v20260813project-activity-router`;
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css?v=20260813projects",
  "./app.js?v=20260813project-activity-router",
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
  "./modules/backend/pilot.js",
  "./features/matching.js",
  "./features/communities.js",
  "./features/collaboration-dialogs.js",
  "./features/messages.js",
  "./features/network.js",
  "./features/projects.js",
  "./features/profile.js",
  "./features/operations-dialogs.js",
  "./features/notifications.js",
  "./features/core-click-handler.js",
  "./features/project-click-handler.js",
  "./features/social-click-handler.js",
  "./features/community-click-handler.js",
  "./features/profile-click-handler.js",
  "./features/management-click-handler.js",
  "./features/coordination-click-handler.js",
  "./features/coordination-submit-handler.js",
  "./features/network-submit-handler.js",
  "./features/community-submit-handler.js",
  "./features/profile-submit-handler.js",
  "./features/account-submit-handler.js",
  "./features/project-activity-submit-handler.js",
  "./features/project-coordination-dialogs.js",
  "./features/workspace.js",
  "./shell/pwa.js",
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
      Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE).map((key) => caches.delete(key))),
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
