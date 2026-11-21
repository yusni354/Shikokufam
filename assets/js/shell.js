/* Perilaku kerangka: menu samping, tombol pengaturan admin, navigasi go() */
function isAdminSettingsView(){return ADMIN_MENU.some(([view])=>view===S.view)}
function syncAdminTheme(){
  document.body.classList.toggle('admin-dark',S.mainAdmin&&(S.adminMenuOpen||isAdminSettingsView()));
  $('#st').setAttribute('aria-expanded',String(S.adminMenuOpen));
}
function go(v){S.view=v;simpanViewTerakhir(v);S.adminMenuOpen=false;S.form=S.detail=S.dutyForm=null;S.financeForm=null;S.financePhoto=null;S.detailOrigin=null;if(v==='pesan'&&S.admin)S.openConversation=null;document.body.classList.remove('open');syncAdminTheme();render();if(v==='pesan'&&!S.admin)markMessagesRead()}
$('#mn').onclick=()=>document.body.classList.add('open');
$('#mn').replaceChildren(icon('menu',21));
$('#st').replaceChildren(icon('settings',19));
document.querySelector('.logo')?.replaceChildren(icon('check',19));
$('#ov').onclick=()=>{
  document.body.classList.remove('open');
  if(S.adminMenuOpen){S.adminMenuOpen=false;render()}else syncAdminTheme();
};
$('#st').onclick=()=>{
  if(!S.mainAdmin)return;
  S.adminMenuOpen=!S.adminMenuOpen;
  document.body.classList.toggle('open',S.adminMenuOpen);
  $('#st').setAttribute('aria-expanded',String(S.adminMenuOpen));
  syncAdminTheme();
  render();
};
/* ===== Halaman terakhir: muat ulang tetap di halaman yang sama =====
   Setiap perpindahan halaman lewat go() disimpan ke sessionStorage —
   pola penjagaan yang sama seperti penyimpanan lain di aplikasi
   (try/catch penuh; lingkungan yang memblokir storage tidak menimbulkan
   error, halaman terakhir cukup tidak diingat). sessionStorage berarti
   ingatan ini hanya berlaku selama tab/sesi peramban terbuka, sama
   seperti pilihan gaya peta. Sesudah muat ulang, halaman terakhir
   dipulihkan SATU KALI oleh render() (views.js) begitu sesi masuk
   terpulihkan & disetujui; alur sebelum masuk tidak berubah. Halaman
   tersimpan yang tidak dikenal atau tidak boleh dibuka pengguna ini
   diabaikan dan aplikasi tetap di Home. */
const LAST_VIEW_KEY='shikoku-family:last-view';
function simpanViewTerakhir(v){try{sessionStorage.setItem(LAST_VIEW_KEY,String(v||''))}catch(e){/* storage terblokir: abaikan */}}
function bacaViewTerakhir(){try{return sessionStorage.getItem(LAST_VIEW_KEY)||''}catch(e){return ''}}
let viewSudahDipulihkan=false;
function pulihkanViewTerakhir(){
  if(viewSudahDipulihkan)return;
  viewSudahDipulihkan=true;
  const v=bacaViewTerakhir();
  if(!v||v===S.view)return;
  if(typeof V==='undefined'||!V[v])return;
  if(v==='approvals'&&!S.mainAdmin)return;
  if(v==='pengaturan'&&!S.admin)return;
  S.view=v;
}
/* Klik tulisan merek 'SHIKOKU FAMILY' di header -> kembali ke Home;
   go('landing') sekaligus menjadikan Home halaman tersimpan. Kursor
   penunjuknya sudah diatur CSS #brand-title. Ketuk 3x rahasia pada
   elemen yang sama mendengar 'pointerdown' (auth.js), jadi klik ini
   tidak mengganggunya. */
const brandTitleEl=$('#brand-title');
if(brandTitleEl){
  brandTitleEl.setAttribute('title','Kembali ke Home');
  brandTitleEl.addEventListener('click',()=>go('landing'));
}

