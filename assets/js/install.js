/* PWA: pendaftaran service worker + tombol unduh di drawer.
   Halaman/menu "Pasang Aplikasi" terpisah TIDAK dibuat; pemasangan
   ditawarkan lewat dua tombol di bawah tombol Keluar pada drawer:
   'Download Android' memakai perintah pasang peramban
   (beforeinstallprompt) bila tersedia, dan 'Download iOS' maupun
   cadangan Android menampilkan panel petunjuk singkat. Berkas
   manifest dan service worker tetap dipertahankan apa adanya. */
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
/* Download Android: jalankan perintah pasang PWA bila peramban
   menyediakannya; bila tidak tersedia (atau pengguna membatalkannya),
   tampilkan panel petunjuk memasang lewat menu browser. */
async function unduhAndroid(){
  if(aplikasiSudahTerpasang()){panelPetunjukPasang('android');return}
  if(pwaDeferredPrompt){
    const prompt=pwaDeferredPrompt;
    pwaDeferredPrompt=null;
    try{
      prompt.prompt();
      const pilihan=await prompt.userChoice;
      if(pilihan&&pilihan.outcome==='accepted')return;
    }catch(e){/* perintah pasang gagal: lanjut ke petunjuk manual */}
  }
  panelPetunjukPasang('android');
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
