const CACHE_NAME = "beat-app-shell-v1";
const BASE_PATH = new URL("./", self.location).pathname.replace(/\/$/, "");
const appPath = (path) => `${BASE_PATH}${path}` || "/";
const APP_SHELL = [
  appPath("/"),
  appPath("/manifest.webmanifest"),
  appPath("/icons/beat-192.png"),
  appPath("/icons/beat-512.png"),
  appPath("/icons/beat-maskable-512.png"),
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith("beat-app-shell-"))
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (
    url.pathname.startsWith(appPath("/auth/")) ||
    url.pathname.startsWith(appPath("/admin/")) ||
    url.pathname.startsWith(appPath("/api/"))
  ) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(appPath("/"))));
    return;
  }

  const isStaticAsset =
    url.pathname.startsWith(appPath("/_next/static/")) ||
    url.pathname.startsWith(appPath("/icons/")) ||
    url.pathname === appPath("/manifest.webmanifest");

  if (!isStaticAsset) return;

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ??
        fetch(request).then((response) => {
          if (!response.ok) return response;
          const copy = response.clone();
          void caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(request, copy));
          return response;
        }),
    ),
  );
});
