/* The POS service worker was removed (there is no installable app any more). This stub replaces it
 * so any device that still has the old worker clears its cache and unregisters itself. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.registration.unregister()),
  );
});
