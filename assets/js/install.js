/* PWA: pendaftaran service worker + tombol unduh di drawer.
   Halaman/menu "Pasang Aplikasi" terpisah TIDAK dibuat; pemasangan
   ditawarkan lewat dua tombol di bawah tombol Keluar pada drawer:
   'Download Android' langsung mengunduh berkas APK resmi aplikasi
   (ShikokuFamily.apk di situs ini) lalu menampilkan petunjuk
   memasangnya, sedangkan 'Download iOS' menampilkan panel petunjuk
   memasang lewat menu Safari. Berkas manifest dan service worker
   tetap dipertahankan apa adanya. */
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
/* Panel sesudah unduhan APK dimulai: petunjuk membuka berkas hasil
   unduhan untuk memasang, termasuk izin instal dari peramban bila
   Android memintanya. Pola dialog yang sama seperti panel pasang. */
function panelUnduhanApkMulai(){
  tutupPanelPasang();
  const overlay=h('div',{class:'confirm-overlay install-overlay',onclick:()=>tutupPanelPasang()},
    h('div',{class:'card confirm-card install-card',onclick:ev=>ev.stopPropagation()},
      h('b',{class:'confirm-title'},'Unduhan dimulai'),
      h('ol',{class:'install-steps'},
        h('li',{},'Tunggu sampai berkas ShikokuFamily.apk selesai diunduh.'),
        h('li',{},'Buka berkas itu dari pemberitahuan unduhan, atau dari folder Unduhan/Downloads di HP.'),
        h('li',{},'Ketuk "Instal". Bila HP meminta izin memasang dari peramban ini, pilih "Izinkan".')),
      h('div',{class:'fl confirm-actions'},h('button',{class:'btn',onclick:()=>tutupPanelPasang()},'Selesai'))));
  document.body.append(overlay);
}
/* Panel gagal: berkas APK tidak terjangkau (mis. tidak ada koneksi).
   Ditampilkan sebagai pesan jujur, bukan klik yang diam saja. */
function panelUnduhanApkGagal(){
  tutupPanelPasang();
  const overlay=h('div',{class:'confirm-overlay install-overlay',onclick:()=>tutupPanelPasang()},
    h('div',{class:'card confirm-card install-card',onclick:ev=>ev.stopPropagation()},
      h('b',{class:'confirm-title'},'Unduhan gagal'),
      h('p',{class:'confirm-text'},'Berkas aplikasi belum bisa diunduh saat ini. Periksa koneksi internet HP, lalu coba lagi.'),
      h('div',{class:'fl confirm-actions'},h('button',{class:'btn',onclick:()=>tutupPanelPasang()},'Selesai'))));
  document.body.append(overlay);
}
/* Download Android: sekali klik langsung mengunduh berkas APK resmi.
   Keterjangkauan berkas dicek dulu (HEAD); bila tidak terjangkau,
   tampilkan pesan gagal. Unduhan dipicu lewat tautan dengan atribut
   download supaya peramban mengunduh, bukan membuka halaman baru. */
async function unduhAndroid(){
  let terjangkau=false;
  try{
    const r=await fetch(ALAMAT_APK,{method:'HEAD'});
    terjangkau=r.ok;
  }catch(e){
    /* Beda asal (mis. pratinjau) bisa menolak baca respons walau berkas
       ada; coba mode no-cors: selesai tanpa galat berarti server menjawab. */
    try{await fetch(ALAMAT_APK,{method:'HEAD',mode:'no-cors'});terjangkau=true}catch(e2){terjangkau=false}
  }
  if(!terjangkau){panelUnduhanApkGagal();return}
  const tautan=document.createElement('a');
  tautan.href=ALAMAT_APK;
  tautan.download='ShikokuFamily.apk';
  document.body.append(tautan);
  tautan.click();
  tautan.remove();
  panelUnduhanApkMulai();
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
