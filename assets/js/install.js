/* Pasang Aplikasi (PWA): tombol pasang di Android, panduan di iPhone,
   dan jalan membuat file .apk sungguhan lewat PWABuilder.
   APK hanya untuk Android — iPhone tidak memakai APK, caranya lewat
   "Tambah ke Layar Utama" dan hasilnya sama seperti aplikasi biasa. */
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstallPrompt = e;
  document.querySelectorAll('[data-install-btn]').forEach(btn => { btn.disabled = false; btn.textContent = 'Pasang Sekarang'; });
  const hint = document.querySelector('[data-install-hint]');
  if (hint) hint.textContent = 'Tombol di bawah siap dipakai — ketuk untuk memasang.';
});
window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  if (typeof render === 'function' && S.view === 'pasang') render();
});
function isStandaloneApp() {
  try {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  } catch (e) { return false; }
}
function isiOSDevice() { return /iphone|ipad|ipod/i.test(navigator.userAgent || ''); }
function isAndroidDevice() { return /android/i.test(navigator.userAgent || ''); }
async function installAppNow(btn) {
  if (deferredInstallPrompt) {
    try {
      deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      if (choice && choice.outcome === 'accepted') {
        if (btn) btn.textContent = 'Terpasang ✓';
        return true;
      }
    } catch (e) { /* lanjut ke panduan manual di bawah */ }
  }
  // Prompt otomatis tidak tersedia (iPhone / sudah pernah ditolak / dibuka
  // dari dalam aplikasi lain): gulir ke langkah manual sesuai perangkat.
  const target = document.querySelector(isiOSDevice() ? '[data-steps-ios]' : '[data-steps-android]');
  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return false;
}
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

function vPasang() {
  const standalone = isStandaloneApp();
  const ios = isiOSDevice();
  const android = isAndroidDevice();
  const iconImg = h('img', { class: 'install-app-icon', src: 'assets/icons/icon-192.png', alt: 'Ikon aplikasi Shikoku Family' });
  const installBtn = h('button', {
    class: 'btn install-main-btn', 'data-install-btn': 'true',
    onclick: (ev) => installAppNow(ev.currentTarget)
  }, standalone ? 'Sudah Terpasang ✓' : (deferredInstallPrompt ? 'Pasang Sekarang' : 'Pasang Aplikasi'));
  if (standalone) installBtn.disabled = true;

  const androidSteps = h('section', { class: 'card install-steps', 'data-steps-android': 'true', style: 'display:block' },
    h('b', {}, 'Android — lewat Chrome'),
    h('ol', { class: 'install-ol' },
      h('li', {}, 'Buka situs aplikasi ini di Chrome.'),
      h('li', {}, 'Ketuk tombol "Pasang Sekarang" di atas, atau ketuk menu ⋮ di kanan atas Chrome.'),
      h('li', {}, 'Pilih "Pasang aplikasi" / "Tambahkan ke Layar Utama", lalu ketuk Pasang.'),
      h('li', {}, 'Ikon Shikoku Family muncul di layar utama — buka dari situ, tampilannya seperti aplikasi biasa tanpa bilah alamat.')
    )
  );
  const iosSteps = h('section', { class: 'card install-steps', 'data-steps-ios': 'true', style: 'display:block' },
    h('b', {}, 'iPhone / iPad — lewat Safari'),
    h('p', { class: 'sub', style: 'margin:6px 0 0' }, 'iPhone tidak memakai file APK. Caranya lewat Safari, hasilnya sama: ikon di layar utama dan dibuka layar penuh.'),
    h('ol', { class: 'install-ol' },
      h('li', {}, 'Buka situs aplikasi ini di Safari (bukan dari dalam aplikasi chat).'),
      h('li', {}, 'Ketuk tombol Bagikan (kotak dengan panah ke atas) di bawah layar.'),
      h('li', {}, 'Gulir lalu pilih "Tambah ke Layar Utama" (Add to Home Screen).'),
      h('li', {}, 'Ketuk "Tambah" — ikon Shikoku Family muncul di layar utama.')
    )
  );
  const apkCard = h('section', { class: 'card install-steps', style: 'display:block' },
    h('b', {}, 'Mau file .apk sungguhan untuk Android?'),
    h('p', { class: 'sub', style: 'margin:6px 0 0;line-height:1.55' },
      'File .apk dibuat dari versi situs yang sudah online (yang terhubung ke Vercel), bukan dari pratinjau ini. Pakai layanan gratis PWABuilder dari Microsoft:'),
    h('ol', { class: 'install-ol' },
      h('li', {}, 'Buka pwabuilder.com, tempel alamat situs Shikoku Family kamu, lalu Start.'),
      h('li', {}, 'Setelah laporan selesai, pilih "Package for Stores" → Android → Download. Di dalamnya ada file .apk (untuk uji coba) dan .aab (untuk Play Store).'),
      h('li', {}, 'Pindahkan .apk ke HP Android, buka berkasnya, dan izinkan "Pasang dari sumber ini" bila diminta. Aplikasi terpasang dengan ikon dan nama yang sama.')
    ),
    h('div', { class: 'fl' },
      h('a', { class: 'btn s', href: 'https://www.pwabuilder.com', target: '_blank', rel: 'noopener' }, 'Buka PWABuilder ↗')
    ),
    h('p', { class: 'sub', style: 'margin:10px 0 0;line-height:1.55' },
      'Catatan: cara "Pasang Aplikasi" di atas lebih disarankan untuk pemakaian sehari-hari — otomatis ikut diperbarui setiap situs diperbarui, tanpa pasang ulang file. File .apk cocok bila ingin membagikan berkas pasang secara langsung.')
  );

  return [
    h('h1', {}, 'Pasang Aplikasi'),
    h('section', { class: 'card install-hero', style: 'display:block;text-align:center' },
      iconImg,
      h('b', { style: 'font-size:19px;display:block;margin-top:10px' }, 'Shikoku Family'),
      h('p', { class: 'sub', style: 'margin:6px auto 0;max-width:420px;line-height:1.55' },
        standalone
          ? 'Aplikasi ini sudah terpasang di perangkat kamu dan sedang dibuka sebagai aplikasi. Selamat memakai!'
          : 'Pasang Shikoku Family di layar utama HP — dibuka layar penuh seperti aplikasi biasa, tanpa perlu Play Store atau App Store.'),
      h('div', { style: 'margin-top:14px' }, installBtn),
      h('p', { class: 'sub', 'data-install-hint': 'true', style: 'margin:10px 0 0;font-size:13px' },
        standalone ? '' : (ios
          ? 'Di iPhone tombol pasang otomatis tidak tersedia — ikuti langkah Safari di bawah, cepat kok.'
          : (android
            ? 'Bila tombol belum memunculkan jendela pasang, ikuti langkah manual di bawah.'
            : 'Di komputer, tombol ini memunculkan jendela pasang bila browser mendukung. Di HP, ikuti langkah sesuai perangkat di bawah.')))
    ),
    // Langkah yang paling sesuai perangkat ditampilkan lebih dulu
    ...(ios ? [iosSteps, androidSteps] : [androidSteps, iosSteps]),
    apkCard
  ];
}
