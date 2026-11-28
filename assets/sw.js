/* Service worker Shikoku Family — membuat aplikasi bisa dipasang (PWA)
   dan tetap bisa dibuka saat koneksi lambat.
   Catatan penempatan: berkas ini ada di assets/. Di situs produksi,
   salin berkas ini ke folder utama situs (di samping index.html)
   dengan nama sw.js supaya cakupannya meliputi seluruh aplikasi. */
const CACHE = 'shikoku-family-v41';
const CORE = [
  './',
  '../',
  '../index.html',
  './style.css',
  './manifest.webmanifest',
  './icons/icon-192-v2.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './mascot.webp',
  /* Lukisan pertama halaman Peta & Wilayah adalah gambar lokal yang
     disematkan sebagai data URI base64 di dalam berkas JS ini:
     ikut dipasang sejak awal supaya peta tampil seketika (dan tetap
     tampil tanpa jaringan) sebelum gaya peta daring apa pun tiba. */
  './js/peta-basemap-lokal.js',
  './leaflet.css',
  './js/leaflet.js'
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

/* ===== Notifikasi Push (Web Push) =====
   Push dikirim server (Supabase Edge Function) untuk Admin Utama &
   Pengurus: pesan baru di Pesan Grup dan pendaftar baru menunggu
   persetujuan. Payload-nya JSON: {title, body, type, view, url,
   tag, badgeCount} — type/view menentukan halaman tujuan saat
   notifikasi diketuk ('pesan' -> Pesan Grup, 'approvals' ->
   Persetujuan Akun). Payload yang bukan JSON tetap ditampilkan
   sebagai teks biasa supaya tidak ada push yang hilang diam-diam. */
/* Alamat ikon & akar aplikasi dihitung dari lokasi berkas SW ini:
   benar baik SW diletakkan di akar situs (produksi) maupun di
   folder assets/ (pratinjau) — ikon selalu assets/icons/icon-192.png
   dan akar selalu halaman utama aplikasi. */
const PUSH_ICON_URL = new URL('../assets/icons/icon-192.png', self.location.href).href;
const PUSH_APP_ROOT = new URL('../', self.location.href).href;

self.addEventListener('push', event => {
  let data = {};
  if (event.data) {
    try { data = event.data.json() || {}; }
    catch (e) {
      try { data = { body: event.data.text() }; } catch (_) { data = {}; }
    }
  }
  const title = data.title || 'Shikoku Family';
  const view = data.view || (data.type === 'approvals' ? 'approvals' : (data.type === 'pesan' || data.type === 'message' || data.type === 'group' ? 'pesan' : ''));
  const options = {
    body: data.body || '',
    icon: data.icon || PUSH_ICON_URL,
    badge: PUSH_ICON_URL,
    tag: data.tag || (view ? 'shikoku-' + view : undefined),
    renotify: !!data.tag,
    data: {
      view: view,
      type: data.type || '',
      url: data.url || ''
    }
  };
  event.waitUntil((async () => {
    /* Angka lencana ikon aplikasi dari server, bila perangkat &
       peramban mendukungnya (di Android angka tampil mengikuti
       setelan lencana notifikasi perangkat). */
    if (typeof data.badgeCount === 'number' && self.navigator && typeof self.navigator.setAppBadge === 'function') {
      try {
        if (data.badgeCount > 0) await self.navigator.setAppBadge(data.badgeCount);
        else if (typeof self.navigator.clearAppBadge === 'function') await self.navigator.clearAppBadge();
      } catch (e) { /* lencana tidak didukung di konteks ini: abaikan */ }
    }
    await self.registration.showNotification(title, options);
  })());
});

/* Ketukan pada notifikasi: fokuskan jendela aplikasi yang sudah
   terbuka (atau buka yang baru), lalu minta halaman menavigasi ke
   halaman terkait lewat postMessage — halaman yang menerimanya
   (install.js) menjalankan go(view) dan menyimpan halaman itu
   sebagai halaman terakhir, jadi tujuannya juga selamat dari muat
   ulang. Jendela yang baru dibuka menerima tujuannya lewat parameter
   alamat '?push=<view>' yang dibaca install.js saat aplikasi dimuat. */
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const info = event.notification.data || {};
  const view = info.view || '';
  let targetUrl = PUSH_APP_ROOT;
  try { targetUrl = info.url ? new URL(info.url, PUSH_APP_ROOT).href : (view ? PUSH_APP_ROOT + '?push=' + encodeURIComponent(view) : PUSH_APP_ROOT); }
  catch (e) { targetUrl = PUSH_APP_ROOT; }
  event.waitUntil((async () => {
    const daftar = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of daftar) {
      try {
        await client.focus();
        if (view) client.postMessage({ type: 'shikoku-push-navigate', view: view });
        return;
      } catch (e) { /* jendela tidak bisa difokuskan: coba berikutnya */ }
    }
    if (self.clients.openWindow) await self.clients.openWindow(targetUrl);
  })());
});
