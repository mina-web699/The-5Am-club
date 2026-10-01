const CACHE_NAME = "5amclub-cache-v3";

const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/style.css",
  "/script.js",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/sounds.mp3/grand_project-wonders-of-the-earth-550792.mp3",
  "/sounds.mp3/mickeyscat-moment-of-peace-mickeyscat-554494.mp3",
  "/sounds.mp3/miromaxmusic-music-promotion-no-copyright-513944.mp3",
  "/sounds.mp3/apalonbeats-lofi-study-549455.mp3",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("تم حفظ ملفات الصوت والموقع بنجاح في الكاش التلقائي!");
      return cache.addAll(ASSETS_TO_CACHE);
    }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches
      .match(event.request)
      .then((cachedResponse) => cachedResponse || fetch(event.request)),
  );
});
