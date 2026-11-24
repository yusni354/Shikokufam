/* Service worker Shikoku Family — membuat aplikasi bisa dipasang (PWA)
   dan tetap bisa dibuka saat koneksi lambat.
   Catatan penempatan: berkas ini ada di assets/. Di situs produksi,
   salin berkas ini ke folder utama situs (di samping index.html)
   dengan nama sw.js supaya cakupannya meliputi seluruh aplikasi. */
const CACHE = 'shikoku-family-v24';
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
  // Semua permintaan lintas origin TIDAK disentuh service worker: data
  // Supabase, CDN, font, dan terutama ubin peta (Esri/OpenStreetMap) harus
  // langsung dari jaringan. Bila ubin gagal, peramban harus menerima error
  // jaringan yang bersih supaya Leaflet bisa pindah ke penyedia berikutnya
  // atau ke peta cadangan lokal — bukan jawaban halaman HTML dari sini.
  if (url.origin !== self.location.origin) return;
  // Berkas aplikasi berversi (?v=… di alamatnya): pola token versi yang
  // sudah berjalan menjamin alamat yang sama selalu berisi berkas yang
  // sama, jadi layani dari cache lebih dulu agar kunjungan ulang instan,
  // sambil memperbarui cache dari jaringan di belakang layar. Berkas
  // baru tetap sampai karena token versinya ikut berubah.
  if (url.search.includes('v=')) {
    event.respondWith(
      caches.match(req).then(hit => {
        const jaringan = fetch(req)
          .then(res => {
            if (res && res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then(cache => cache.put(req, copy)).catch(() => {});
            }
            return res;
          })
          .catch(() => hit);
        return hit || jaringan;
      })
    );
    return;
  }
  // Halaman & berkas aplikasi: jaringan dulu, cache sebagai cadangan offline
  event.respondWith(
    fetch(req)
      .then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(cache => cache.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match('../index.html')))
  );
});
