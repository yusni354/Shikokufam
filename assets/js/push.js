/* Notifikasi Push (Web Push / VAPID) — khusus Admin Utama & Pengurus.
   Sasarannya dua kejadian: (1) pesan baru di Pesan Grup dari orang
   lain, dan (2) pendaftar baru yang menunggu persetujuan. Yang
   dibangun di sisi aplikasi di sini hanya LANGGANANNYA: peramban
   berlangganan lewat pushManager.subscribe() dengan kunci publik
   VAPID, lalu langganannya disimpan ke tabel Supabase
   'push_subscriptions' (satu baris per endpoint perangkat) memakai
   sesi pengguna sendiri. Pengiriman push-nya sendiri dilakukan
   server (Supabase Edge Function + pemicu basis data, disiapkan
   terpisah); service worker (assets/sw.js) yang menampilkan
   notifikasinya saat push tiba. Untuk Anggota biasa tidak ada
   langganan dan tidak ada tampilannya sama sekali. */
const VAPID_PUBLIC_KEY = window.VAPID_PUBLIC_KEY || 'BB9PO1Le5I0jrPwmj8HKWZoTYwWUa9Vr2gsjx75s1GqoRowXEeGP458urTA1ExeLvAzM0v6o-FgQIiHSeRkSCn8';
/* Kunci VAPID untuk pushManager.subscribe harus berupa Uint8Array
   hasil dekode base64url dari kunci publiknya. */
function vapidKeyBytes(){
  const teks=String(VAPID_PUBLIC_KEY||'');
  const padding='='.repeat((4-(teks.length%4))%4);
  const base64=(teks+padding).replace(/-/g,'+').replace(/_/g,'/');
  const mentah=atob(base64);
  const bytes=new Uint8Array(mentah.length);
  for(let i=0;i<mentah.length;i++)bytes[i]=mentah.charCodeAt(i);
  return bytes;
}
function pushDidukung(){
  return 'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
}
/* Registrasi service worker aplikasi: install.js mendaftarkannya saat
   halaman dimuat; navigator.serviceWorker.ready menunggu sampai
   registrasi untuk halaman ini aktif. Batas 10 detik supaya status
   tidak menggantung di perangkat dengan service worker bermasalah. */
async function pushRegistrasi(){
  if(!('serviceWorker' in navigator))return null;
  try{
    const siap=await Promise.race([
      navigator.serviceWorker.ready,
      new Promise(resolve=>setTimeout(()=>resolve(null),10000))
    ]);
    if(siap)return siap;
    const semua=await navigator.serviceWorker.getRegistrations();
    return semua&&semua.length?semua[0]:null;
  }catch(e){return null}
}
/* Simpan / perbarui langganan perangkat ini ke tabel push_subscriptions
   memakai sesi pengguna sendiri. Upsert berdasarkan endpoint: satu
   perangkat = satu baris, berlangganan ulang hanya memperbaruinya. */
async function pushSimpanLangganan(sub){
  if(!S.supabase||!sub)throw new Error('Langganan push tidak tersedia.');
  const json=typeof sub.toJSON==='function'?sub.toJSON():null;
  const endpoint=(json&&json.endpoint)||sub.endpoint||'';
  const keys=(json&&json.keys)||{};
  if(!endpoint||!keys.p256dh||!keys.auth)throw new Error('Data langganan push dari peramban tidak lengkap.');
  const {error}=await S.supabase.from('push_subscriptions').upsert(
    {user_id:S.uid,endpoint:endpoint,p256dh:keys.p256dh,auth:keys.auth},
    {onConflict:'endpoint'}
  );
  if(error)throw error;
}
/* Baca keadaan nyata perangkat ini (izin + langganan yang ada) dan
   cerminkan ke S.pushStatus/S.pushPesan untuk baris Notifikasi Push.
   Dipanggil saat barisnya pertama kali digambar untuk pengguna ini;
   perubahan status menggambar ulang halaman akun/pengaturan. */
let pushSedangPeriksa=false;
async function pushSegarkanStatus(){
  if(pushSedangPeriksa||!S.uid||!S.admin)return;
  pushSedangPeriksa=true;
  try{
    let status,pesan;
    if(!pushDidukung()){
      status='tidak-didukung';
      pesan='Peramban ini tidak mendukung notifikasi push. Gunakan Chrome di Android atau peramban desktop untuk mengaktifkannya.';
    }else if(!S.supabase){
      status='tidak-aktif';
      pesan='Notifikasi push memerlukan aplikasi yang terhubung ke Supabase (mode online).';
    }else if(Notification.permission==='denied'){
      status='ditolak';
      pesan='Izin notifikasi ditolak di peramban ini. Aktifkan izin notifikasi untuk situs ini lewat pengaturan peramban, lalu kembali ke halaman ini.';
    }else{
      const reg=await pushRegistrasi();
      const sub=reg?await reg.pushManager.getSubscription():null;
      if(sub&&Notification.permission==='granted'){
        status='aktif';
        pesan='Aktif di perangkat ini — Anda menerima pemberitahuan saat ada pesan baru di Pesan Grup dan pendaftar baru yang menunggu persetujuan.';
      }else if(Notification.permission==='granted'){
        status='tidak-aktif';
        pesan='Izin notifikasi sudah diberikan, tetapi perangkat ini belum berlangganan. Ketuk Aktifkan untuk menyelesaikannya.';
      }else{
        status='tidak-aktif';
        pesan='Belum aktif. Ketuk Aktifkan, lalu pilih "Izinkan" saat peramban meminta izin notifikasi.';
      }
    }
    const berubah=status!==S.pushStatus||pesan!==S.pushPesan;
    S.pushStatus=status;S.pushPesan=pesan;
    if(berubah&&(S.view==='dash'||S.view==='pengaturan'||S.view==='landing'))renderDariData();
  }catch(e){
    console.error('Status notifikasi push gagal diperiksa:',e);
  }
  pushSedangPeriksa=false;
}
/* Aktifkan: minta izin (hanya dari ketukan pengguna), berlangganan,
   lalu simpan langganannya ke Supabase. Langganan lama yang dibuat
   dengan kunci VAPID berbeda dibuang dulu supaya tidak basi. */
async function pushAktifkan(){
  if(S.pushSibuk||!S.admin||!S.uid)return;
  if(!pushDidukung()){
    S.pushStatus='tidak-didukung';
    S.pushPesan='Peramban ini tidak mendukung notifikasi push. Gunakan Chrome di Android atau peramban desktop untuk mengaktifkannya.';
    render();
    return;
  }
  if(!S.supabase){alert('Notifikasi push memerlukan aplikasi yang terhubung ke Supabase (mode online).');return}
  S.pushSibuk=true;render();
  try{
    const izin=await Notification.requestPermission();
    if(izin!=='granted'){
      S.pushSibuk=false;
      S.pushStatus=izin==='denied'?'ditolak':'tidak-aktif';
      S.pushPesan=izin==='denied'
        ?'Izin notifikasi ditolak. Aktifkan izin notifikasi untuk situs ini lewat pengaturan peramban, lalu kembali ke halaman ini.'
        :'Izin notifikasi belum diberikan. Ketuk Aktifkan lalu pilih "Izinkan" untuk melanjutkan.';
      render();
      return;
    }
    const reg=await pushRegistrasi();
    if(!reg)throw new Error('Service worker belum aktif. Muat ulang aplikasi, lalu coba lagi.');
    let sub=await reg.pushManager.getSubscription();
    if(sub&&sub.options&&sub.options.applicationServerKey){
      try{
        const lama=new Uint8Array(sub.options.applicationServerKey),baru=vapidKeyBytes();
        let sama=lama.length===baru.length;
        if(sama)for(let i=0;i<lama.length;i++){if(lama[i]!==baru[i]){sama=false;break}}
        if(!sama){await sub.unsubscribe();sub=null}
      }catch(e){/* perbandingan kunci gagal: langganan yang ada tetap dipakai */}
    }
    if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:vapidKeyBytes()});
    await pushSimpanLangganan(sub);
    S.pushStatus='aktif';
    S.pushPesan='Aktif di perangkat ini — Anda menerima pemberitahuan saat ada pesan baru di Pesan Grup dan pendaftar baru yang menunggu persetujuan.';
  }catch(e){
    console.error('Notifikasi push gagal diaktifkan:',e);
    S.pushPesan='Gagal mengaktifkan notifikasi push: '+((e&&e.message)||'periksa koneksi')+'. Coba lagi.';
  }
  S.pushSibuk=false;
  render();
}
/* Matikan: hapus baris langganan perangkat ini dari Supabase, lalu
   berhenti berlangganan di peramban. Izin notifikasi peramban tidak
   diubah — mengaktifkan lagi cukup satu ketukan. */
async function pushMatikan(){
  if(S.pushSibuk||!S.admin||!S.uid)return;
  S.pushSibuk=true;render();
  try{
    const reg=pushDidukung()?await pushRegistrasi():null;
    const sub=reg?await reg.pushManager.getSubscription():null;
    if(S.supabase){
      if(sub&&sub.endpoint){
        const {error}=await S.supabase.from('push_subscriptions').delete().eq('endpoint',sub.endpoint);
        if(error)console.error('Baris langganan push gagal dihapus:',error);
      }else{
        const {error}=await S.supabase.from('push_subscriptions').delete().eq('user_id',S.uid);
        if(error)console.error('Baris langganan push gagal dihapus:',error);
      }
    }
    if(sub)await sub.unsubscribe();
    S.pushStatus='tidak-aktif';
    S.pushPesan='Sudah dimatikan di perangkat ini. Ketuk Aktifkan bila ingin menerima pemberitahuan lagi.';
  }catch(e){
    console.error('Notifikasi push gagal dimatikan:',e);
    S.pushPesan='Gagal mematikan notifikasi push: '+((e&&e.message)||'periksa koneksi')+'. Coba lagi.';
  }
  S.pushSibuk=false;
  render();
}
/* Pembaruan otomatis saat masuk: bila izin SUDAH pernah diberikan,
   langganan perangkat ini dibuat/diperbarui dan disimpan lagi tanpa
   meminta izin apa pun — jadi langganan tidak basi sesudah service
   worker atau kunci berubah. Izin tidak pernah diminta dari sini:
   permintaan izin hanya terjadi lewat tombol Aktifkan. Khusus admin
   & pengurus; kegagalan apa pun diabaikan supaya tidak mengganggu
   pemeriksaan sesi. */
async function pushPerbaruiLanggananOtomatis(){
  try{
    if(!S.admin||!S.uid||!S.supabase||!pushDidukung())return;
    if(Notification.permission!=='granted')return;
    const reg=await pushRegistrasi();
    if(!reg)return;
    let sub=await reg.pushManager.getSubscription();
    if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:vapidKeyBytes()});
    await pushSimpanLangganan(sub);
    if(S.pushStatus!=='aktif'){
      S.pushStatus='aktif';
      S.pushPesan='Aktif di perangkat ini — Anda menerima pemberitahuan saat ada pesan baru di Pesan Grup dan pendaftar baru yang menunggu persetujuan.';
      if(S.view==='dash'||S.view==='pengaturan'||S.view==='landing')renderDariData();
    }
  }catch(e){
    console.error('Pembaruan langganan push otomatis gagal (diabaikan):',e);
  }
}
/* Baris "Notifikasi Push" di halaman Profil/akun (vDash) dan halaman
   Pengaturan: judul, keterangan status perangkat ini, dan satu tombol
   Aktifkan/Matikan. HANYA untuk Admin Utama & Pengurus (S.admin) —
   untuk Anggota fungsi ini mengembalikan null (tidak ada apa-apa).
   Keadaan awal 'memeriksa' memicu satu kali pemeriksaan status nyata
   (izin + langganan) untuk pengguna yang sedang masuk. */
function barisNotifikasiPush(){
  if(!S.admin||!S.uid)return null;
  if(S.pushTerakhirUid!==S.uid){
    S.pushTerakhirUid=S.uid;
    S.pushStatus='memeriksa';S.pushPesan='';
    setTimeout(()=>{void pushSegarkanStatus()},30);
  }
  const status=S.pushStatus||'memeriksa';
  const pesan=S.pushPesan||(status==='memeriksa'?'Memeriksa status notifikasi di perangkat ini…':'');
  let tombol;
  if(S.pushSibuk){
    tombol=h('button',{class:'btn',disabled:''},'Memproses…');
  }else if(status==='aktif'){
    tombol=h('button',{class:'btn s',onclick:()=>{void pushMatikan()}},'Matikan');
  }else if(status==='ditolak'||status==='tidak-didukung'){
    tombol=h('button',{class:'btn',disabled:''},'Aktifkan');
  }else if(status==='memeriksa'){
    tombol=h('button',{class:'btn',disabled:''},'Aktifkan');
  }else{
    tombol=h('button',{class:'btn',onclick:()=>{void pushAktifkan()}},'Aktifkan');
  }
  return box(
    h('b',{},icon('bell',18),h('span',{},' Notifikasi Push')),
    h('p',{class:'sub',style:'margin-top:8px'},'Pemberitahuan ke perangkat ini untuk dua hal: pesan baru di Pesan Grup dan pendaftar baru yang menunggu persetujuan. Pengaturan ini berlaku per perangkat — aktifkan di tiap HP/peramban yang Anda pakai.'),
    h('p',{class:'warn',style:'margin:10px 0 2px'},pesan),
    h('div',{class:'fl'},tombol)
  );
}
