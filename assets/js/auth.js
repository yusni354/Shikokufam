/* Akun lokal: dipakai pada mode tanpa Supabase, tersimpan di perangkat ini.
   Alur sama seperti Supabase: daftar -> menunggu persetujuan -> disetujui admin utama.
   Akun pertama yang mendaftar menjadi admin utama (pengganti langkah SQL manual di README). */
const LOCAL_USERS_KEY='shikoku-family:users';
const LOCAL_SESSION_KEY='shikoku-family:session';
/* Cermin akun lokal di ingatan: di pratinjau artefak (iframe sandbox)
   localStorage bisa terblokir total — aksesnya melempar error. Tanpa
   cermin ini, menyimpan akun lokal ikut melempar error. Dengan cermin,
   akun tetap hidup selama sesi berjalan walau penyimpanan perangkat
   terblokir; di peramban biasa localStorage tetap dipakai seperti
   sebelumnya. */
let memoryLocalUsers=null;
function localUsers(){
  /* Cermin ingatan didahulukan: ia selalu berisi salinan TERBARU hasil
     saveLocalUsers() pada sesi ini. Membaca localStorage lebih dulu
     berbahaya bila penulisan ke penyimpanan perangkat gagal diam-diam
     (webview/penyimpanan penuh): salinan lama di sana akan dibaca lagi,
     sehingga akun yang baru dihapus/diubah muncul kembali apa adanya —
     penghapusan tampak tidak pernah terjadi. localStorage hanya dibaca
     sekali, saat cermin masih kosong (awal sesi), lalu hasilnya menjadi
     cermin untuk sisa sesi. */
  if(memoryLocalUsers)return memoryLocalUsers;
  try{
    const raw=localStorage.getItem(LOCAL_USERS_KEY);
    if(raw!==null){memoryLocalUsers=JSON.parse(raw)||[];return memoryLocalUsers}
  }catch(e){}
  return memoryLocalUsers||[];
}
function saveLocalUsers(users){
  memoryLocalUsers=users;
  try{localStorage.setItem(LOCAL_USERS_KEY,JSON.stringify(users))}catch(e){/* penyimpanan terblokir: akun tetap tersimpan di ingatan untuk sesi ini */}
}
function localPasswordHash(password,salt){let hash=5381;const text=String(salt)+':'+String(password);for(let i=0;i<text.length;i++)hash=((hash<<5)+hash+text.charCodeAt(i))>>>0;return 'h'+hash.toString(36)}
/* ===== Hash kata sandi KUAT (WebCrypto PBKDF2) =====
   Kata sandi akun lokal BARU tidak lagi memakai hash djb2 di atas —
   djb2 32-bit bisa dibobol dalam hitungan detik. Kata sandi kini
   disimpan sebagai
   PBKDF2-SHA256 (150.000 putaran, salt acak 16 byte per kata sandi)
   lewat WebCrypto, dalam format teks 'pbkdf2$<putaran>$<salt>$<hash>'
   (salt & hash base64). localPasswordHash lama HANYA dipertahankan
   untuk MEMERIKSA akun lokal lama yang terlanjur tersimpan dengan
   format lama, supaya pemilik akun lama tetap bisa masuk seperti
   biasa; tidak ada kata sandi baru yang disimpan dengannya. */
const PBKDF2_PUTARAN=150000;
function b64DariBytes(bytes){let s='';bytes.forEach(b=>{s+=String.fromCharCode(b)});return btoa(s)}
function bytesDariB64(teks){const bin=atob(String(teks||''));const out=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);return out}
async function pbkdf2Turunkan(password,saltBytes,putaran){
  if(!window.crypto||!crypto.subtle)throw new Error('Peramban ini tidak mendukung penyimpanan kata sandi yang aman (WebCrypto tidak tersedia).');
  const bahan=await crypto.subtle.importKey('raw',new TextEncoder().encode(String(password)),'PBKDF2',false,['deriveBits']);
  const bit=await crypto.subtle.deriveBits({name:'PBKDF2',salt:saltBytes,iterations:putaran,hash:'SHA-256'},bahan,256);
  return new Uint8Array(bit);
}
async function hashKataSandiKuat(password){
  const salt=crypto.getRandomValues(new Uint8Array(16));
  const hasil=await pbkdf2Turunkan(password,salt,PBKDF2_PUTARAN);
  return 'pbkdf2$'+PBKDF2_PUTARAN+'$'+b64DariBytes(salt)+'$'+b64DariBytes(hasil);
}
async function cocokKataSandiKuat(password,tersimpan){
  try{
    const bagian=String(tersimpan||'').split('$');
    if(bagian.length!==4||bagian[0]!=='pbkdf2')return false;
    const putaran=parseInt(bagian[1],10);
    if(!(putaran>=1000&&putaran<=2000000))return false;
    const hasil=await pbkdf2Turunkan(password,bytesDariB64(bagian[2]),putaran);
    const target=bytesDariB64(bagian[3]);
    if(hasil.length!==target.length)return false;
    let beda=0;
    for(let i=0;i<hasil.length;i++)beda|=hasil[i]^target[i];
    return beda===0;
  }catch(e){return false}
}
/* Periksa kata sandi akun lokal: format kuat PBKDF2 diperiksa lewat
   WebCrypto; akun lama berformat djb2 diperiksa dengan cara lamanya
   (satu-satunya sisa pemakaian hash lama, hanya untuk membaca). */
async function verifikasiKataSandiLokal(user,password){
  if(!user)return false;
  if(String(user.password_hash||'').startsWith('pbkdf2$'))return cocokKataSandiKuat(password,user.password_hash);
  return user.password_hash===localPasswordHash(password,user.salt);
}
function applyLocalUser(user){
  S.uid=user.id;S.email=user.email||'';S.name=user.name||user.email||'';
  S.admin=user.role==='admin';S.mainAdmin=S.admin&&user.is_main_admin===true;
  S.approvalStatus=user.approval_status||'pending';S.authLoading=false;
}
/* Akun lokal hanya dipakai pada jalur TANPA Supabase (mode uji coba di
   perangkat ini): masuk lewat formulir masuk biasa dengan alur
   persetujuan yang sama. Sesudah masuk, id sesi lokal disimpan
   (simpanSesiLokal); sesi itu hanya dipulihkan pada jalur TANPA
   Supabase. Pada jalur online, sesi Supabase yang sah SELALU didahulukan
   dan sesi lokal tidak pernah dipulihkan mendahului sesi Supabase
   (lihat main.js); tombol Keluar menghapus sesi lokal seperti biasa.
   Flag lama 'shikoku-family:force-local' yang mungkin tertinggal di
   peramban tetap dibersihkan saat aplikasi dimuat (lihat main.js) dan
   selalu diabaikan, supaya tidak ada peramban yang terjebak di data lokal. */
const FORCE_LOCAL_KEY='shikoku-family:force-local';
function clearLegacyLocalFlag(){try{localStorage.removeItem(FORCE_LOCAL_KEY)}catch(e){}}
function localModeForced(){return S.localMode===true}
/* Id sesi lokal disimpan di DUA tempat: localStorage (bertahan antar
   kunjungan) dan sessionStorage (cermin yang tetap terbaca saat muat ulang
   di lingkungan yang memblokir localStorage tapi membiarkan sessionStorage,
   mis. webview tertentu). Yang disimpan hanya id akun lokal, bukan kata sandi. */
function simpanSesiLokal(id){
  try{localStorage.setItem(LOCAL_SESSION_KEY,id)}catch(e){}
  try{sessionStorage.setItem(LOCAL_SESSION_KEY,id)}catch(e){}
}
function hapusSesiLokal(){
  try{localStorage.removeItem(LOCAL_SESSION_KEY)}catch(e){}
  try{sessionStorage.removeItem(LOCAL_SESSION_KEY)}catch(e){}
}
function restoreLocalSession(){
  let id=null;
  try{id=localStorage.getItem(LOCAL_SESSION_KEY)}catch(e){}
  if(!id){try{id=sessionStorage.getItem(LOCAL_SESSION_KEY)}catch(e){}}
  if(!id)return false;
  const user=localUsers().find(item=>item.id===id);
  if(!user)return false;
  applyLocalUser(user);
  return true;
}
/* Keluar akun: bekerja untuk sesi Supabase maupun sesi lokal.
   Keluar dari sesi lokal menghapus id sesi yang tersimpan, lalu memulihkan
   jalur online yang disimpan di ingatan, jadi sesudah keluar aplikasi
   kembali ke halaman masuk online seperti biasa. Bila sesi lokal ini
   dipulihkan saat aplikasi dimuat (tidak ada klien online di ingatan),
   aplikasi dimuat ulang ke pintu masuk online. */
async function signOut(){
  if(S.localMode){
    hapusSesiLokal();
    if(typeof stopDataSubscriptions==='function')stopDataSubscriptions();
    S.messageChannel=null;
    const online=S._onlineClient||null;
    S.localMode=false;S._onlineClient=null;
    S.uid=null;S.email='';S.name='';S.admin=false;S.mainAdmin=false;S.approvalStatus='approved';
    S.members=[];S.events=[];S.topics=[];S.cleaningDuties=[];S.pins=[];
    S.keuangan=[];S.kategoriCustom=[];S.financeForm=null;S.financePhoto=null;
    S.tanya=[];S.replies=[];S.messageSignature='';S.unreadMessages=0;S.openConversation=null;S.pendingUsers=[];
    S.pengaturan=[];S.sambutan='';S.sumberPeta={gaya:'jalan'};S.menuAktif={};S.menuUrutan=[];S.susunanPemegang={};S.susunanSimpul=null;S.susunanInline=null;S.susunanKelompok=[];S.susunanLabelPuncak='';S.susunanLabelEdit=null;S.storageErrors={};
    S.view='landing';S.adminMenuOpen=false;document.body.classList.remove('open');
    if(online){
      S.supabase=online;S.db=createSupabaseDb(online);
      /* Memicu pendengar sesi di main.js: ia menggambar halaman masuk online */
      try{await online.auth.signOut()}catch(e){console.error('Gagal keluar dari sesi online:',e)}
    }else{
      /* Sesi lokal ini dipulihkan saat aplikasi dimuat, jadi tidak ada
         klien online yang disimpan di ingatan: muat ulang aplikasi
         supaya pintu masuk online tampil lagi. Id sesi lokal sudah
         dihapus di atas, jadi muat ulang tidak memulihkannya. */
      location.reload();
      return;
    }
    S.authLoading=false;
    render();
    return;
  }
  if(S.supabase){await S.supabase.auth.signOut();return}
  hapusSesiLokal();
  S.uid=null;S.email='';S.name='';S.admin=false;S.mainAdmin=false;S.approvalStatus='approved';
  S.tanya=[];S.replies=[];S.messageSignature='';S.unreadMessages=0;S.openConversation=null;S.pendingUsers=[];
  S.view='landing';S.adminMenuOpen=false;document.body.classList.remove('open');
  render();
}
/* Pesan galat untuk halaman masuk/daftar: galat mentah Supabase tidak
   pernah ditampilkan apa adanya. Khusus batas pengiriman email
   (over_email_send_rate_limit) — batas sisi Supabase yang tidak bisa
   dihapus dari aplikasi — tampilkan pesan sederhana bahasa Indonesia
   tanpa kode galat. Jalur MASUK tidak mengirim email sama sekali, jadi
   galat ini hanya mungkin muncul pada jalur daftar / lupa password. */
const EMAIL_RATE_LIMIT_MESSAGE='Email konfirmasi sedang dibatasi. Tunggu beberapa menit lalu coba lagi, atau hubungi admin.';
function isEmailRateLimitError(error){
  const raw=[error&&error.message,error&&error.code,error&&error.details,error&&error.hint]
    .filter(Boolean).join(' ');
  return /over_email_send_rate_limit|email rate limit/i.test(raw);
}
function friendlyAuthError(error,fallback){
  if(isEmailRateLimitError(error))return EMAIL_RATE_LIMIT_MESSAGE;
  return (error&&error.message)||fallback;
}
/* Keterangan menunggu persetujuan: satu bunyi yang sama di formulir masuk
   (sesudah daftar / saat masuk sebagai akun menunggu) dan di layar
   menunggu persetujuan, supaya pendaftar paham status akunnya. */
const PENDING_APPROVAL_MESSAGE='Akun Anda sedang menunggu persetujuan admin. Silakan tunggu — Anda bisa masuk setelah akun disetujui.';
/* Draf formulir masuk/daftar, disimpan di ingatan selama aplikasi terbuka:
   render() menggambar ulang seluruh halaman (mis. sesudah daftar berhasil
   sesi ditutup lalu halaman digambar lagi), dan tanpa draf ini field yang
   sudah diisi ikut terhapus. Dengan draf, berpindah tab Masuk <-> Daftar
   maupun gambar ulang sesudah pendaftaran TIDAK mengosongkan email, kata
   sandi, nama, dan keterangan yang sedang tampil — pendaftar yang diarahkan
   ke formulir Masuk mendapati email & kata sandinya sudah terisi. */
let authDraft={email:'',password:'',name:'',signup:false,notice:'',noticeKind:''};
let authNoticeEl=null;
function setAuthNotice(text,kind){
  authDraft.notice=text||'';authDraft.noticeKind=kind||'';
  if(authNoticeEl){authNoticeEl.className='warn'+(kind?' '+kind:'');authNoticeEl.textContent=text||''}
}
/* Penanda per akun (kunci: email) di perangkat ini:
   - 'pernah-menunggu': akun ini pernah melihat keterangan menunggu
     persetujuan di perangkat ini (sesudah daftar, saat mencoba masuk, atau
     di layar menunggu).
   - 'selamat-ditampilkan': keterangan 'Selamat, akun Anda telah disetujui.'
     sudah pernah ditampilkan untuk akun ini.
   Keduanya disimpan di localStorage dengan cermin ingatan (penyimpanan
   bisa terblokir di webview; penanda tetap bekerja selama sesi berjalan). */
const PENDING_SEEN_PREFIX='shikoku-family:pernah-menunggu:';
const APPROVED_SHOWN_PREFIX='shikoku-family:selamat-ditampilkan:';
const memoryPendingSeen=new Set(),memoryApprovedShown=new Set();
function authMarkerKey(value){return String(value||'').trim().toLowerCase()}
function markPendingSeen(email){
  const key=authMarkerKey(email);if(!key)return;
  memoryPendingSeen.add(key);
  try{localStorage.setItem(PENDING_SEEN_PREFIX+key,'1')}catch(e){/* terblokir: cermin ingatan tetap berlaku sesi ini */}
}
function pendingSeen(email){
  const key=authMarkerKey(email);if(!key)return false;
  if(memoryPendingSeen.has(key))return true;
  try{return localStorage.getItem(PENDING_SEEN_PREFIX+key)==='1'}catch(e){return false}
}
function markApprovedShown(email){
  const key=authMarkerKey(email);if(!key)return;
  memoryApprovedShown.add(key);
  try{localStorage.setItem(APPROVED_SHOWN_PREFIX+key,'1')}catch(e){/* terblokir: cermin ingatan tetap berlaku sesi ini */}
}
function approvedShown(email){
  const key=authMarkerKey(email);if(!key)return false;
  if(memoryApprovedShown.has(key))return true;
  try{return localStorage.getItem(APPROVED_SHOWN_PREFIX+key)==='1'}catch(e){return false}
}
/* Dipanggil Home setiap kali digambar untuk pengguna yang sudah masuk &
   disetujui: membersihkan sisa keterangan/kata sandi draf formulir, lalu
   mengembalikan true TEPAT SATU KALI bagi akun yang pernah terlihat
   menunggu di perangkat ini dan kini sudah disetujui — Home menampilkan
   spanduk 'Selamat, akun Anda telah disetujui.' pada saat itu saja.
   Akun yang tidak pernah tercatat menunggu di perangkat ini tidak
   memicu spanduk apa pun. */
function authOnSignedIn(){
  setAuthNotice('','');authDraft.password='';
  const key=authMarkerKey(S.email||S.uid);
  if(!key)return false;
  if(pendingSeen(key)&&!approvedShown(key)){markApprovedShown(key);return true}
  return false;
}
/* Formulir masuk / daftar / lupa password */
function accountForm(){
  const email=h('input',{type:'email',placeholder:'Email',autocomplete:'email'});
  const password=h('input',{type:'password',placeholder:'Password minimal 6 karakter',autocomplete:'current-password'});
  /* Tombol mata di tepi kanan field kata sandi: mengalihkan field antara
     tersembunyi (type=password) dan terlihat (type=text); nilai yang sudah
     diketik tidak berubah, ikon & aria-label mengikuti keadaan. */
  let passwordVisible=false;
  const eyeButton=h('button',{type:'button',class:'pw-eye','aria-label':'Tampilkan kata sandi'},icon('eye',20));
  eyeButton.addEventListener('click',()=>{
    passwordVisible=!passwordVisible;
    password.type=passwordVisible?'text':'password';
    eyeButton.setAttribute('aria-label',passwordVisible?'Sembunyikan kata sandi':'Tampilkan kata sandi');
    eyeButton.replaceChildren(icon(passwordVisible?'eyeOff':'eye',20));
    password.focus();
  });
  const passwordWrap=h('span',{class:'pw-wrap'},password,eyeButton);
  const name=h('input',{placeholder:'Nama lengkap',autocomplete:'name'});
  const notice=h('p',{class:'warn'});
  /* Pulihkan isi dari draf: field yang sudah diketik (di tab mana pun)
     dan keterangan terakhir tetap ada walau formulir digambar ulang. */
  authNoticeEl=notice;
  email.value=authDraft.email;password.value=authDraft.password;name.value=authDraft.name;
  email.addEventListener('input',()=>{authDraft.email=email.value});
  password.addEventListener('input',()=>{authDraft.password=password.value});
  name.addEventListener('input',()=>{authDraft.name=name.value});
  if(authDraft.notice){notice.className='warn'+(authDraft.noticeKind?' '+authDraft.noticeKind:'');notice.textContent=authDraft.notice}
  /* Cerminkan setiap perubahan keterangan ke draf, supaya keterangan yang
     ditulis penangan lama (yang menulis langsung ke elemen ini) tetap
     selamat dari gambar ulang halaman. */
  if(window.MutationObserver)new MutationObserver(()=>{authDraft.notice=notice.textContent||'';authDraft.noticeKind=notice.className.replace(/\bwarn\b/,'').trim()}).observe(notice,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class']});
  let signup=authDraft.signup===true;
  const titleText=h('span',{},'Masuk ke Shikoku Family');
  const submitLabel=h('span',{},'Masuk');
  /* Ikon gembok judul kartu masuk: elemen tampil biasa (bukan tombol,
     tanpa penangan ketuk apa pun) — sekadar penanda judul formulir. */
  const lockIcon=h('span',{class:'auth-lock-icon','aria-hidden':'true'},icon('lock',20));
  const title=h('b',{},lockIcon,titleText);
  const forgot=h('button',{type:'button',class:'btn s',onclick:async()=>{
    const emailValue=email.value.trim();
    if(!emailValue){notice.textContent='Masukkan email terlebih dahulu untuk menerima tautan reset password.';email.focus();return}
    if(!S.supabase){
      const known=localUsers().some(user=>(user.email||'').toLowerCase()===emailValue.toLowerCase());
      notice.className='warn '+(known?'auth-success':'auth-error');
      notice.textContent=known?'Reset password lewat email tidak tersedia. Bila lupa password, minta admin utama membantu menggantinya.':'Email tidak terdaftar.';
      return;
    }
    forgot.disabled=true;notice.textContent='Mengirim tautan reset password...';
    const {error}=await S.supabase.auth.resetPasswordForEmail(emailValue);
    forgot.disabled=false;
    notice.className=error?'warn auth-error':'warn auth-success';
    notice.textContent=error?(isEmailRateLimitError(error)?EMAIL_RATE_LIMIT_MESSAGE:'Gagal mengirim tautan reset password: '+friendlyAuthError(error,'')):'Tautan reset password sudah dikirim ke email Anda.';
  }},'Lupa password?');
  const forgotWrap=h('div',{class:'auth-forgot'},forgot);
  const nameLabel=h('label',{class:'lb'},'Nama lengkap',name);
  const loginTab=h('button',{type:'button',class:'auth-tab on',onclick:()=>setMode(false)},'Masuk');
  const signupTab=h('button',{type:'button',class:'auth-tab',onclick:()=>setMode(true)},'Daftar');
  const setMode=next=>{
    signup=next;authDraft.signup=next;nameLabel.style.display=signup?'':'none';
    submitLabel.textContent=signup?'Daftar':'Masuk';
    password.setAttribute('autocomplete',signup?'new-password':'current-password');
    titleText.textContent=signup?'Daftar sebagai anggota':'Masuk ke Shikoku Family';
    loginTab.className=signup?'auth-tab':'auth-tab on';signupTab.className=signup?'auth-tab on':'auth-tab';
  };
  setMode(signup);
  /* Masuk dengan Google (Supabase Auth OAuth); alur persetujuan akun tidak berubah */
  const google=h('button',{class:'btn s auth-alt',style:'width:100%;margin-top:10px',onclick:async()=>{
    if(!S.supabase){
      notice.className='warn auth-error';
      notice.textContent='Masuk dengan Google memerlukan koneksi Supabase. Periksa koneksi internet Anda, lalu muat ulang aplikasi.';
      return;
    }
    notice.className='warn';
    notice.textContent='Mengalihkan ke halaman masuk Google...';
    try{
      const {error}=await S.supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo:window.location.origin+window.location.pathname}});
      if(error){
        notice.className='warn auth-error';
        notice.textContent='Gagal masuk dengan Google: '+friendlyAuthError(error,'periksa koneksi');
      }
    }catch(e){
      notice.className='warn auth-error';
      notice.textContent='Gagal masuk dengan Google: '+friendlyAuthError(e,'periksa koneksi');
    }
  }},'Masuk dengan Google');
  /* Penangan kirim formulir: dipakai tombol Masuk/Daftar (type=submit)
     DAN tombol Enter di field mana pun, karena seluruh isian dibungkus
     <form> sungguhan — Enter memicu submit formulir yang sama. */
  const submitAuth=async()=>{
    const emailValue=email.value.trim();
    notice.className='warn';
    notice.textContent='Memproses...';
    if(!emailValue||!password.value){notice.textContent='Email dan password wajib diisi.';return}
    if(signup&&(!name.value.trim()||password.value.length<6)){
      notice.textContent=!name.value.trim()?'Nama lengkap wajib diisi.':'Password minimal 6 karakter.';
      return;
    }
    if(!S.supabase){
      /* Mode lokal: akun disimpan di perangkat ini dengan alur persetujuan yang sama */
      const users=localUsers(),emailKey=emailValue.toLowerCase();
      if(signup){
        if(users.some(user=>(user.email||'').toLowerCase()===emailKey)){
          notice.className='warn auth-error';
          notice.textContent='Email sudah terdaftar. Silakan masuk.';
          return;
        }
        const first=users.length===0;
        const salt='u'+Date.now().toString(36)+Math.random().toString(36).slice(2,7);
        /* Kata sandi akun lokal baru disimpan dengan hash kuat PBKDF2
           (bukan djb2); kolom salt lama dikosongkan karena salt kini
           menyatu di dalam nilai hash-nya. */
        let kuatHash='';
        try{kuatHash=await hashKataSandiKuat(password.value)}catch(e){notice.className='warn auth-error';notice.textContent=e.message;return}
        const newUser={id:'local-user-'+salt,name:name.value.trim(),email:emailValue,password_hash:kuatHash,salt:'',role:first?'admin':'member',is_main_admin:first,approval_status:first?'approved':'pending',created_at:new Date().toISOString()};
        users.push(newUser);
        try{saveLocalUsers(users)}catch(e){notice.className='warn auth-error';notice.textContent=e.message;return}
        if(first){
          /* Akun pertama langsung disetujui sebagai admin utama: langsung masuk
             supaya pemilik perangkat bisa langsung melihat isi aplikasi. */
          simpanSesiLokal(newUser.id);
          applyLocalUser(newUser);
          notice.className='warn auth-success';
          notice.textContent='Akun admin utama berhasil dibuat. Login berhasil.';
          await loadPendingUsers();
          render();
          await loadMessages();
          return;
        }
        markPendingSeen(emailValue);
        setAuthNotice(PENDING_APPROVAL_MESSAGE,'auth-success');
        setMode(false);
        return;
      }
      const user=users.find(item=>(item.email||'').toLowerCase()===emailKey);
      /* Akun baru diperiksa dengan PBKDF2; akun lama berformat djb2
         tetap diperiksa dengan cara lamanya (lihat verifikasiKataSandiLokal). */
      if(!user||!(await verifikasiKataSandiLokal(user,password.value))){
        notice.className='warn auth-error';
        notice.textContent='Email atau password salah. Silakan coba lagi.';
        return;
      }
      if(user.approval_status==='pending'||user.approval_status==null){
        markPendingSeen(emailValue);
        setAuthNotice(PENDING_APPROVAL_MESSAGE,'auth-error');
        return;
      }
      if(user.approval_status==='rejected'){
        notice.className='warn auth-error';
        notice.textContent='Pendaftaran akun Anda ditolak oleh admin.';
        return;
      }
      simpanSesiLokal(user.id);
      applyLocalUser(user);
      notice.className='warn auth-success';
      notice.textContent='Akun Anda telah disetujui. Login berhasil.';
      await loadPendingUsers();
      render();
      await loadMessages();
      return;
    }
    let result,approvedProfile=null;
    try{
      result=signup
        ?await S.supabase.auth.signUp({email:emailValue,password:password.value,options:{data:{name:name.value.trim()}}})
        :await S.supabase.auth.signInWithPassword({email:emailValue,password:password.value});
    }catch(e){
      notice.className='warn auth-error';
      notice.textContent=friendlyAuthError(e,'Terjadi kesalahan. Silakan coba lagi.');
      return;
    }
    if(result.error){
      notice.className='warn auth-error';
      /* Galat batas email (daftar) tampil sebagai pesan sederhana Indonesia;
         teks/kode mentah Supabase tidak pernah ditampilkan. */
      const errorText=isEmailRateLimitError(result.error)
        ?EMAIL_RATE_LIMIT_MESSAGE
        :[result.error.message,result.error.details,result.error.hint,result.error.code]
          .filter(part=>part&&!/over_email_send_rate_limit/i.test(part)).join(' | ');
      notice.textContent=!signup&&['invalid_credentials','invalid_grant'].includes(result.error.code)
        ?'Email atau password salah. Silakan coba lagi.'
        :errorText||'Pendaftaran gagal. Periksa konfigurasi database Supabase.';
    }else{
      notice.className='warn auth-success';
      if(signup){
        markPendingSeen(emailValue);
        authDraft.signup=false;
        setAuthNotice(PENDING_APPROVAL_MESSAGE,'auth-success');
        setMode(false);
        if(result.data.session)await S.supabase.auth.signOut();
      }else{
        const {data:profile,error:profileError}=await S.supabase.from('profiles').select('name,role,is_main_admin,approval_status').eq('id',result.data.user.id).maybeSingle();
        if(profileError){
          await S.supabase.auth.signOut();
          notice.className='warn auth-error';
          notice.textContent='Gagal memeriksa status persetujuan: '+profileError.message;
        }else if(profile?.approval_status==='pending'||profile?.approval_status==null){
          await S.supabase.auth.signOut();
          markPendingSeen(emailValue);
          setAuthNotice(PENDING_APPROVAL_MESSAGE,'auth-error');
        }else if(profile.approval_status==='rejected'){
          await S.supabase.auth.signOut();
          notice.className='warn auth-error';
          notice.textContent='Pendaftaran akun Anda ditolak oleh admin.';
        }else{
          approvedProfile=profile;
          notice.textContent='Akun Anda telah disetujui. Login berhasil.';
        }
      }
    }
    if(!result.error&&!signup&&approvedProfile){
      const user=result.data.user;
      S.uid=user.id;S.email=user.email||emailValue;S.name=approvedProfile.name||S.email;
      S.admin=approvedProfile.role==='admin';S.mainAdmin=S.admin&&approvedProfile.is_main_admin===true;
      S.approvalStatus=approvedProfile.approval_status;S.authLoading=false;
      render();
      await loadMessages();
      if(!S.messageChannel)await subscribeToMessages();
    }
  };
  /* Formulir sungguhan: Enter di field mana pun (termasuk kata sandi)
     mengirim formulir yang sama seperti menekan tombol Masuk/Daftar.
     Formulir tidak pernah dikunci oleh keadaan email apa pun — tombol
     kirim selalu aktif dan masuk selalu bisa dicoba. */
  const submitButton=h('button',{type:'submit',class:'btn'},submitLabel);
  const form=h('form',{class:'auth-form',novalidate:'',onsubmit:event=>{event.preventDefault();submitAuth();}},
    nameLabel,
    h('label',{class:'lb'},'Email',email),
    h('label',{class:'lb'},'Password',passwordWrap),
    forgotWrap,notice,submitButton);
  return h('div',{class:'card auth-card'},title,h('div',{class:'auth-tabs'},loginTab,signupTab),form,google);
}
/* ===== Pembersihan sisa pintu masuk lokal lama (sekali jalan) =====
   Pintu masuk lokal lama — jalan pintas ketuk berulang pada halaman
   masuk yang membuka panel kata sandi khusus dan masuk sebagai admin
   utama lokal — sudah DIHAPUS seluruhnya dari aplikasi: tidak ada
   pemicu ketukan, tidak ada panel, dan tidak ada akun khusus pintu itu.
   Yang tertinggal hanya pembersihan sekali jalan di bawah ini,
   dipanggil main.js saat aplikasi dimuat sebelum sesi apa pun dibaca:
   1) id sesi lokal yang tersimpan dibuang, supaya tidak ada perangkat
      yang tertinggal masuk memakai sesi lokal lama (sesi Supabase
      tidak disentuh dan tetap selalu didahulukan);
   2) catatan kata sandi pintu lama di penyimpanan perangkat dihapus;
   3) akun lokal khusus pintu lama (email pintu lama, bertanda khusus,
      atau ber-id awalan 'local-emergency-') dihapus dari daftar akun
      lokal, jadi akun itu tidak bisa dipakai masuk lewat jalur mana pun.
   Akun lokal biasa (mode tanpa Supabase) dan akun online tidak
   disentuh, dan pengguna tetap bisa masuk seperti biasa sesudahnya —
   tidak ada perangkat yang terkunci oleh pembersihan ini.
   Penanda selesai disimpan di perangkat; pembersihan berjalan tepat
   satu kali per perangkat (cermin ingatan menjaga lingkungan dengan
   penyimpanan terblokir tetap satu kali per sesi). Kunci penanda baru
   dipakai supaya perangkat yang sudah menjalankan pembersihan versi
   sebelumnya tetap menjalankan pembersihan ini satu kali. */
const PINTU_LAMA_CLEANUP_KEY='shikoku-family:hapus-pintu-lama-v2';
const PINTU_LAMA_EMAIL='putro@shikoku.local';
const PINTU_LAMA_KUNCI_CATATAN='shikoku-family:emergency-admin';
let pintuLamaCleanupDone=false;
function bersihkanWarisanPintuLama(){
  if(pintuLamaCleanupDone)return;
  pintuLamaCleanupDone=true;
  try{if(localStorage.getItem(PINTU_LAMA_CLEANUP_KEY)==='1')return}catch(e){}
  hapusSesiLokal();
  try{localStorage.removeItem(PINTU_LAMA_KUNCI_CATATAN)}catch(e){}
  try{sessionStorage.removeItem(PINTU_LAMA_KUNCI_CATATAN)}catch(e){}
  try{
    const users=localUsers();
    const bersih=users.filter(item=>{
      const email=(item&&item.email||'').toLowerCase();
      const id=String((item&&item.id)||'');
      return !(email===PINTU_LAMA_EMAIL||(item&&item.emergency===true)||id.indexOf('local-emergency-')===0);
    });
    if(bersih.length!==users.length)saveLocalUsers(bersih);
  }catch(e){console.error('Pembersihan akun pintu lama gagal (diabaikan):',e)}
  try{localStorage.setItem(PINTU_LAMA_CLEANUP_KEY,'1')}catch(e){/* terblokir: cermin ingatan di atas tetap menjaga satu kali per sesi */}
}
