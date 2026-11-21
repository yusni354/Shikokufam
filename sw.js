/* Service worker Shikoku Family — membuat aplikasi bisa dipasang (PWA)
   dan tetap bisa dibuka saat koneksi lambat.
   Catatan penempatan: berkas ini ada di assets/. Di situs produksi,
   salin berkas ini ke folder utama situs (di samping index.html)
   dengan nama sw.js supaya cakupannya meliputi seluruh aplikasi. */
const CACHE = 'shikoku-family-v3';
const CORE = [
  './',
  '../',
  '../index.html',
  './style.css',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './mascot.webp'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(CORE).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Data Supabase & CDN: selalu dari jaringan, jangan disimpan di cache
  if (url.hostname.endsWith('supabase.co') || url.hostname.includes('jsdelivr') || url.hostname.includes('googleapis')) return;
  // Halaman & berkas aplikasi: jaringan dulu, cache sebagai cadangan offline
  event.respondWith(
    fetch(req)
      .then(res => {
        if (res && res.ok && url.origin === self.location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then(cache => cache.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match('../index.html')))
  );
});
