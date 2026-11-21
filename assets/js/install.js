/* Pendaftaran service worker (PWA) saja. Menu dan halaman "Pasang
   Aplikasi" di dalam aplikasi sudah dihapus atas permintaan pengguna;
   berkas manifest dan service worker tetap dipertahankan apa adanya,
   jadi kemampuan memasang dari menu peramban sendiri tidak berubah. */
/* Daftarkan service worker bila memungkinkan. Di situs produksi sw.js
   diletakkan di folder utama; di pratinjau ini dicoba dari assets/. */
(function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {
      navigator.serviceWorker.register('assets/sw.js').catch(() => {});
    });
  });
})();
