/* Lencana angka pada IKON APLIKASI yang terinstal (Web App Badging API:
   navigator.setAppBadge). Angkanya = total hal yang menunggu perhatian
   pengguna, sama seperti lencana di dalam aplikasi:
   - pesan grup yang belum dibaca (S.unreadMessages), dan
   - akun yang menunggu persetujuan (S.pendingUsers, khusus admin).
   Dipanggil dari updateMessageBadges() dan updateApprovalBadges() —
   dua titik yang memang sudah dipanggil setiap kali kedua hitungan itu
   berubah (muat awal, pesan realtime, render) — jadi ikon selalu
   mengikuti angka terbaru selama aplikasi hidup, dan lencana hilang
   sendiri begitu totalnya nol (termasuk sesudah keluar akun, karena
   render() sesudah signOut memanggil updateApprovalBadges() dengan
   keadaan yang sudah dikosongkan).
   Peramban/perangkat yang tidak mendukung API ini dilewati diam-diam:
   lencana di dalam aplikasi tetap bekerja seperti biasa. */
let appBadgeTerakhir=null;
function updateAppIconBadge(){
  if(!('setAppBadge' in navigator)&&!('clearAppBadge' in navigator))return;
  const total=(S.unreadMessages||0)+(S.admin?(S.pendingUsers||[]).length:0);
  if(total===appBadgeTerakhir)return;
  appBadgeTerakhir=total;
  try{
    if(total>0){
      if('setAppBadge' in navigator)navigator.setAppBadge(total).catch(()=>{});
    }else if('clearAppBadge' in navigator){
      navigator.clearAppBadge().catch(()=>{});
    }else if('setAppBadge' in navigator){
      navigator.setAppBadge(0).catch(()=>{});
    }
  }catch(e){/* API lencana tidak tersedia di konteks ini: abaikan */}
}
/* Kembali ke aplikasi dari latar belakang: hitung ulang dari keadaan
   terakhir yang diketahui, untuk berjaga bila ada pembaruan lencana
   yang terlewat selama aplikasi tidak terlihat. */
document.addEventListener('visibilitychange',()=>{
  if(!document.hidden)updateAppIconBadge();
});
