// Service worker ringan: cache kerangka aplikasi supaya PWA bisa dibuka cepat.
// Data dari Supabase TIDAK di-cache di sini, selalu diambil terbaru.
const CACHE = "shikoku-family-v10";
const FILES = [
  "index.html",
  "manifest.json",
  "css/style.css",
  "css/form.css",
  "js/config.js",
  "js/supabase.js",
  "js/auth.js",
  "js/app.js",
  "js/dashboard.js",
  "js/members.js",
  "js/attendance.js",
  "js/gallery.js",
  "js/forum.js",
  "js/map.js",
  "js/regions.js",
  "js/operators.js",
  "js/import.js",
  "js/admin.js",
  "pages/dashboard.html",
  "pages/login.html",
  "pages/members.html",
  "pages/attendance.html",
  "pages/gallery.html",
  "pages/forum.html",
  "pages/map.html",
  "pages/regions.html",
  "pages/operators.html",
  "pages/import.html",
  "pages/admin.html"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)));
});

self.addEventListener("fetch", (event) => {
  // Hanya cache GET untuk berkas lokal; permintaan Supabase selalu ke jaringan.
  if (event.request.method !== "GET" || event.request.url.includes("supabase")) return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
