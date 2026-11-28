/* PWA: pendaftaran service worker + tombol unduh di drawer.
   Halaman/menu "Pasang Aplikasi" terpisah TIDAK dibuat; pemasangan
   ditawarkan lewat dua tombol di bawah tombol Keluar pada drawer:
   'Download Android' adalah tautan unduh langsung ke berkas APK resmi
   aplikasi (ShikokuFamily.apk di situs ini) — sekali ketuk, unduhan
   bawaan peramban langsung mulai, tanpa cek atau panel apa pun —
   sedangkan 'Download iOS' menampilkan panel petunjuk memasang lewat
   menu Safari. Berkas manifest dan service worker tetap
   dipertahankan apa adanya. */
const ALAMAT_APK='https://shikokufam.vercel.app/ShikokuFamily.apk';
let pwaDeferredPrompt=null;
window.addEventListener('beforeinstallprompt',event=>{
  event.preventDefault();
  pwaDeferredPrompt=event;
});
window.addEventListener('appinstalled',()=>{pwaDeferredPrompt=null});
function aplikasiSudahTerpasang(){
  try{return window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true}catch(e){return false}
}
function tutupPanelPasang(){
  const lama=document.querySelector('.install-overlay');
  if(lama)lama.remove();
}
/* Panel petunjuk pasang: pola dialog aplikasi (confirm-overlay, tanpa
   tombol X — mengetuk bidang di luar kotak atau tombol Selesai
   menutupnya). */
function panelPetunjukPasang(platform){
  tutupPanelPasang();
  const ios=platform==='ios';
  const langkah=ios
    ?['Ketuk ikon Bagikan (kotak dengan panah ke atas) di Safari.','Gulir ke bawah, lalu pilih "Tambahkan ke Layar Utama".','Ketuk "Tambah" di kanan atas.']
    :['Ketuk menu titik tiga di kanan atas browser.','Pilih "Instal aplikasi" atau "Tambahkan ke Layar Utama".','Ketuk "Instal" untuk memasang.'];
  const isi=aplikasiSudahTerpasang()
    ?[h('p',{class:'confirm-text'},'Aplikasi Shikoku Family sudah terpasang di perangkat ini — ikonnya ada di layar utama.')]
    :[h('ol',{class:'install-steps'},...langkah.map(t=>h('li',{},t))),h('p',{class:'confirm-text'},'Sesudah terpasang, ikon Shikoku Family muncul di layar utama dan aplikasi terbuka tanpa bilah browser.')];
  const overlay=h('div',{class:'confirm-overlay install-overlay',onclick:()=>tutupPanelPasang()},
    h('div',{class:'card confirm-card install-card',onclick:ev=>ev.stopPropagation()},
      h('b',{class:'confirm-title'},ios?'Pasang di iOS':'Pasang di Android'),
      ...isi,
      h('div',{class:'fl confirm-actions'},h('button',{class:'btn',onclick:()=>tutupPanelPasang()},'Selesai'))));
  document.body.append(overlay);
}
/* Download Android: tautan unduh langsung biasa — sekali ketuk,
   unduhan bawaan peramban langsung mulai saat itu juga, tanpa cek
   keterjangkauan dan tanpa panel pemberitahuan apa pun. */
function unduhAndroid(){
  const tautan=document.createElement('a');
  tautan.href=ALAMAT_APK;
  tautan.download='ShikokuFamily.apk';
  document.body.append(tautan);
  tautan.click();
  tautan.remove();
}
/* Download iOS: iOS tidak menyediakan perintah pasang terprogram,
   jadi selalu tampilkan petunjuk Bagikan -> Layar Utama. */
function unduhIOS(){panelPetunjukPasang('ios')}
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
