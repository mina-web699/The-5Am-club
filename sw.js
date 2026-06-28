const CACHE_NAME = "pomodoro-soundscape-v1";

// قائمة بالملفات التي سيقوم الموقع بحفظها داخل جهاز المستخدم لتعمل أوفلاين
const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/style.css",
  "/script.js",
  "/sounds.mp3/grand_project-wonders-of-the-earth-550792.mp3",
  "/sounds.mp3/mickeyscat-moment-of-peace-mickeyscat-554494.mp3",
  "/sounds.mp3/miromaxmusic-music-promotion-no-copyright-513944.mp3",
  "/sounds.mp3/apalonbeats-lofi-study-549455.mp3",
];

// خطوة التثبيت: حفظ الملفات في الكاش
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("تم حفظ ملفات الصوت والموقع بنجاح في الكاش التلقائي!");
      return cache.addAll(ASSETS_TO_CACHE);
    }),
  );
});

// خطوة جلب البيانات: تشغيل الملفات من الكاش مباشرة لو النت مقطوع
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // إذا كان الملف موجوداً في الكاش، أرجعه فوراً، وإلا اجلبه من الإنترنت
      return cachedResponse || fetch(event.request);
    }),
  );
});
