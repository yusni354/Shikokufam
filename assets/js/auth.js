/* Akun lokal: dipakai pada mode tanpa Supabase, tersimpan di perangkat ini.
   Alur sama seperti Supabase: daftar -> menunggu persetujuan -> disetujui admin utama.
   Akun pertama yang mendaftar menjadi admin utama (pengganti langkah SQL manual di README). */
const LOCAL_USERS_KEY='shikoku-family:users';
const LOCAL_SESSION_KEY='shikoku-family:session';
/* Cermin akun lokal di ingatan: di pratinjau artefak (iframe sandbox)
   localStorage bisa terblokir total — aksesnya melempar error. Tanpa
   cermin ini, menyimpan akun lokal ikut melempar error dan jalan pintas
   ketuk 3x berhenti diam-diam sebelum sempat masuk. Dengan cermin, akun
   tetap hidup selama sesi berjalan walau penyimpanan perangkat terblokir;
   di peramban biasa localStorage tetap dipakai seperti sebelumnya. */
let memoryLocalUsers=null;
function localUsers(){
  try{
    const raw=localStorage.getItem(LOCAL_USERS_KEY);
    if(raw!==null)return JSON.parse(raw)||[];
  }catch(e){}
  return memoryLocalUsers||[];
}
function saveLocalUsers(users){
  memoryLocalUsers=users;
  try{localStorage.setItem(LOCAL_USERS_KEY,JSON.stringify(users))}catch(e){/* penyimpanan terblokir: akun tetap tersimpan di ingatan untuk sesi ini */}
}
function localPasswordHash(password,salt){let hash=5381;const text=String(salt)+':'+String(password);for(let i=0;i<text.length;i++)hash=((hash<<5)+hash+text.charCodeAt(i))>>>0;return 'h'+hash.toString(36)}
function applyLocalUser(user){
  S.uid=user.id;S.email=user.email||'';S.name=user.name||user.email||'';
  S.admin=user.role==='admin';S.mainAdmin=S.admin&&user.is_main_admin===true;
  S.approvalStatus=user.approval_status||'pending';S.authLoading=false;
}
/* Mode lokal TIDAK lagi punya pintu masuk yang terlihat: tidak ada panel,
   tombol, atau petunjuk apa pun di halaman masuk. Satu-satunya jalan masuk
   adalah ketukan 3x pada tulisan SHIKOKU FAMILY (lihat bagian bawah berkas
   ini), dan itu pun hanya berlaku untuk sesi berjalan — tidak ada flag
   persisten yang ditulis. Flag lama 'shikoku-family:force-local' yang
   mungkin tertinggal di peramban tetap dibersihkan saat aplikasi dimuat
   (lihat main.js) dan selalu diabaikan, supaya aplikasi selalu DIMUAT
   online dan tidak ada peramban yang terjebak di data lokal. */
const FORCE_LOCAL_KEY='shikoku-family:force-local';
function clearLegacyLocalFlag(){try{localStorage.removeItem(FORCE_LOCAL_KEY)}catch(e){}}
function localModeForced(){return S.localMode===true}
function restoreLocalSession(){
  try{
    const id=localStorage.getItem(LOCAL_SESSION_KEY);
    if(!id)return false;
    const user=localUsers().find(item=>item.id===id);
    if(!user)return false;
    applyLocalUser(user);
    return true;
  }catch(e){return false}
}
/* Keluar akun: bekerja untuk sesi Supabase maupun sesi lokal.
   Keluar dari sesi lokal (ketukan 3x) memulihkan jalur online yang disimpan
   di ingatan, jadi sesudah keluar aplikasi kembali ke halaman masuk online
   seperti biasa — sesi lokal tidak pernah ditulis persisten. */
async function signOut(){
  if(S.localMode){
    try{localStorage.removeItem(LOCAL_SESSION_KEY)}catch(e){}
    if(typeof stopDataSubscriptions==='function')stopDataSubscriptions();
    S.messageChannel=null;
    const online=S._onlineClient||null;
    S.localMode=false;S._onlineClient=null;
    S.uid=null;S.email='';S.name='';S.admin=false;S.mainAdmin=false;S.approvalStatus='approved';
    S.members=[];S.events=[];S.topics=[];S.cleaningDuties=[];S.pins=[];
    S.keuangan=[];S.kategoriCustom=[];S.financeForm=null;S.financePhoto=null;
    S.tanya=[];S.replies=[];S.messageSignature='';S.unreadMessages=0;S.openConversation=null;S.pendingUsers=[];
    S.pengaturan=[];S.sambutan='';S.storageErrors={};
    S.view='landing';S.adminMenuOpen=false;document.body.classList.remove('open');
    if(online){
      S.supabase=online;S.db=createSupabaseDb(online);
      /* Memicu pendengar sesi di main.js: ia menggambar halaman masuk online */
      try{await online.auth.signOut()}catch(e){console.error('Gagal keluar dari sesi online:',e)}
    }else{
      S.supabase=null;S.db=createLocalDb();
    }
    S.authLoading=false;
    render();
    return;
  }
  if(S.supabase){await S.supabase.auth.signOut();return}
  try{localStorage.removeItem(LOCAL_SESSION_KEY)}catch(e){}
  S.uid=null;S.email='';S.name='';S.admin=false;S.mainAdmin=false;S.approvalStatus='approved';
  S.tanya=[];S.replies=[];S.messageSignature='';S.unreadMessages=0;S.openConversation=null;S.pendingUsers=[];
  S.view='landing';S.adminMenuOpen=false;document.body.classList.remove('open');
  render();
}
/* Formulir masuk / daftar / lupa password */
function accountForm(){
  const email=h('input',{type:'email',placeholder:'Email',autocomplete:'email'});
  const password=h('input',{type:'password',placeholder:'Password minimal 6 karakter',autocomplete:'current-password'});
  const name=h('input',{placeholder:'Nama lengkap',autocomplete:'name'});
  const notice=h('p',{class:'warn'});
  let signup=false;
  const titleText=h('span',{},'Masuk ke Shikoku Family');
  const submitLabel=h('span',{},'Masuk');
  const title=h('b',{},icon('lock',20),titleText);
  const forgot=h('button',{class:'btn s',onclick:async()=>{
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
    notice.textContent=error?'Gagal mengirim tautan reset password: '+error.message:'Tautan reset password sudah dikirim ke email Anda.';
  }},'Lupa password?');
  const forgotWrap=h('div',{class:'auth-forgot'},forgot);
  const nameLabel=h('label',{class:'lb'},'Nama lengkap',name);
  const loginTab=h('button',{class:'auth-tab on',onclick:()=>setMode(false)},'Masuk');
  const signupTab=h('button',{class:'auth-tab',onclick:()=>setMode(true)},'Daftar');
  const setMode=next=>{
    signup=next;nameLabel.style.display=signup?'':'none';
    submitLabel.textContent=signup?'Daftar':'Masuk';
    password.setAttribute('autocomplete',signup?'new-password':'current-password');
    titleText.textContent=signup?'Daftar sebagai anggota':'Masuk ke Shikoku Family';
    loginTab.className=signup?'auth-tab':'auth-tab on';signupTab.className=signup?'auth-tab on':'auth-tab';
  };
  nameLabel.style.display='none';
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
        notice.textContent='Gagal masuk dengan Google: '+error.message;
      }
    }catch(e){
      notice.className='warn auth-error';
      notice.textContent='Gagal masuk dengan Google: '+(e.message||'periksa koneksi');
    }
  }},'Masuk dengan Google');
  return h('div',{class:'card auth-card'},title,h('div',{class:'auth-tabs'},loginTab,signupTab),nameLabel,h('label',{class:'lb'},'Email',email),h('label',{class:'lb'},'Password',password),forgotWrap,notice,h('button',{class:'btn',onclick:async()=>{
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
        const newUser={id:'local-user-'+salt,name:name.value.trim(),email:emailValue,password_hash:localPasswordHash(password.value,salt),salt,role:first?'admin':'member',is_main_admin:first,approval_status:first?'approved':'pending',created_at:new Date().toISOString()};
        users.push(newUser);
        try{saveLocalUsers(users)}catch(e){notice.className='warn auth-error';notice.textContent=e.message;return}
        if(first){
          /* Akun pertama langsung disetujui sebagai admin utama: langsung masuk
             supaya pemilik perangkat bisa langsung melihat isi aplikasi. */
          try{localStorage.setItem(LOCAL_SESSION_KEY,newUser.id)}catch(e){}
          applyLocalUser(newUser);
          notice.className='warn auth-success';
          notice.textContent='Akun admin utama berhasil dibuat. Login berhasil.';
          await loadPendingUsers();
          render();
          await loadMessages();
          return;
        }
        notice.className='warn auth-success';
        notice.textContent='Akun berhasil dibuat dan menunggu persetujuan admin.';
        setMode(false);
        return;
      }
      const user=users.find(item=>(item.email||'').toLowerCase()===emailKey);
      if(!user||user.password_hash!==localPasswordHash(password.value,user.salt)){
        notice.className='warn auth-error';
        notice.textContent='Email atau password salah. Silakan coba lagi.';
        return;
      }
      if(user.approval_status==='pending'||user.approval_status==null){
        notice.className='warn auth-error';
        notice.textContent='Akun Anda masih menunggu persetujuan admin.';
        return;
      }
      if(user.approval_status==='rejected'){
        notice.className='warn auth-error';
        notice.textContent='Pendaftaran akun Anda ditolak oleh admin.';
        return;
      }
      try{localStorage.setItem(LOCAL_SESSION_KEY,user.id)}catch(e){}
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
      notice.textContent=e.message||'Terjadi kesalahan. Silakan coba lagi.';
      return;
    }
    if(result.error){
      notice.className='warn auth-error';
      const errorText=[result.error.message,result.error.details,result.error.hint,result.error.code]
        .filter(Boolean).join(' | ');
      notice.textContent=!signup&&['invalid_credentials','invalid_grant'].includes(result.error.code)
        ?'Email atau password salah. Silakan coba lagi.'
        :errorText||'Pendaftaran gagal. Periksa konfigurasi database Supabase.';
    }else{
      notice.className='warn auth-success';
      if(signup){
        notice.textContent='Akun berhasil dibuat dan menunggu persetujuan admin.';
        if(result.data.session)await S.supabase.auth.signOut();
      }else{
        const {data:profile,error:profileError}=await S.supabase.from('profiles').select('name,role,is_main_admin,approval_status').eq('id',result.data.user.id).maybeSingle();
        if(profileError){
          await S.supabase.auth.signOut();
          notice.className='warn auth-error';
          notice.textContent='Gagal memeriksa status persetujuan: '+profileError.message;
        }else if(profile?.approval_status==='pending'||profile?.approval_status==null){
          await S.supabase.auth.signOut();
          notice.className='warn auth-error';
          notice.textContent='Akun Anda masih menunggu persetujuan admin.';
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
  }},submitLabel),google);
}
/* Jalan pintas ketuk 3x pada tulisan SHIKOKU FAMILY (header & hero halaman
   masuk): mengetuknya 3 kali berturut-turut dengan jeda singkat langsung
   masuk sebagai ADMIN UTAMA MODE LOKAL tanpa formulir. Tidak ada petunjuk
   tertulis tentang jalan pintas ini di mana pun. Sesi lokal hanya hidup di
   ingatan selama sesi berjalan: aplikasi tetap dimuat online, dan sesudah
   Keluar atau muat ulang pengguna mengetuk 3x lagi bila ingin masuk lokal.
   Jalan pintas ini hanya membuka data lokal perangkat — ia TIDAK membuat
   atau memalsukan sesi Supabase. */
const LOCAL_ADMIN_EMAIL='putro@shikoku.local';
function ensureLocalMainAdmin(){
  const users=localUsers();
  let user=users.find(item=>(item.email||'').toLowerCase()===LOCAL_ADMIN_EMAIL);
  if(!user){
    const salt='u'+Date.now().toString(36)+Math.random().toString(36).slice(2,7);
    user={id:'local-user-'+salt,name:'Putro',email:LOCAL_ADMIN_EMAIL,password_hash:localPasswordHash('putro-local',salt),salt,role:'admin',is_main_admin:true,approval_status:'approved',created_at:new Date().toISOString()};
    users.push(user);
    saveLocalUsers(users);
    return user;
  }
  /* Akun lokal Putro sudah ada: pastikan tetap admin utama yang disetujui */
  if(user.role!=='admin'||user.is_main_admin!==true||user.approval_status!=='approved'){
    user.role='admin';user.is_main_admin=true;user.approval_status='approved';
    if(!user.name)user.name='Putro';
    saveLocalUsers(users);
  }
  return user;
}
let localEntryBusy=false;
async function enterLocalMainAdmin(){
  if(localEntryBusy)return;
  if(S.localMode&&S.mainAdmin&&S.uid)return;
  localEntryBusy=true;
  try{
    const user=ensureLocalMainAdmin();
    /* Simpan klien online HANYA di ingatan, untuk dipulihkan saat Keluar */
    if(S.supabase&&!S._onlineClient)S._onlineClient=S.supabase;
    if(S.messageChannel&&S._onlineClient){
      try{await S._onlineClient.removeChannel(S.messageChannel)}catch(e){}
      S.messageChannel=null;
    }
    if(typeof stopDataSubscriptions==='function')stopDataSubscriptions();
    S.localMode=true;
    /* S.supabase dikosongkan selama sesi lokal: seluruh kode yang bercabang
       pada S.supabase otomatis memakai jalur lokal, dan tidak ada sesi
       Supabase yang dibuat atau dipalsukan. */
    S.supabase=null;
    S.db=createLocalDb();
    /* Bersihkan data online agar tidak tercampur dengan data lokal */
    S.members=[];S.events=[];S.topics=[];S.cleaningDuties=[];S.pins=[];
    S.keuangan=[];S.kategoriCustom=[];S.financeForm=null;S.financePhoto=null;
    S.tanya=[];S.replies=[];S.messageSignature='';S.unreadMessages=0;S.openConversation=null;S.pendingUsers=[];
    S.pengaturan=[];S.sambutan='';S.storageErrors={};
    if(S.memberMediaUrls)S.memberMediaUrls.clear();
    if(S.memberMediaPending)S.memberMediaPending.clear();
    if(S.memberMediaFailed)S.memberMediaFailed.clear();
    S.view='landing';S.adminMenuOpen=false;document.body.classList.remove('open');
    /* Sesi lokal sengaja TIDAK disimpan ke localStorage: muat ulang selalu
       kembali online. */
    applyLocalUser(user);
    S.authLoading=false;
    if(typeof startDataSubscriptions==='function')startDataSubscriptions();
    /* Kegagalan memuat daftar sampingan tidak boleh membatalkan masuk:
       Home tetap digambar apa pun hasil kedua pemuatan ini. */
    try{await loadPendingUsers()}catch(e){console.error('Daftar persetujuan lokal gagal dimuat:',e)}
    try{await loadMessages()}catch(e){console.error('Pesan lokal gagal dimuat:',e)}
    render();
  }catch(e){
    console.error('Gagal masuk sebagai admin utama lokal:',e);
    /* Jalan terakhir: tetap masuk memakai akun admin utama di ingatan saja,
       supaya ketukan 3x tidak pernah berhenti tanpa hasil yang terlihat. */
    try{
      S.localMode=true;S.supabase=null;S.db=createLocalDb();
      S.view='landing';S.adminMenuOpen=false;document.body.classList.remove('open');
      applyLocalUser({id:'local-user-memory',name:'Putro',email:LOCAL_ADMIN_EMAIL,role:'admin',is_main_admin:true,approval_status:'approved'});
      S.authLoading=false;
      if(typeof startDataSubscriptions==='function')startDataSubscriptions();
      render();
    }catch(e2){console.error('Masuk lokal cadangan juga gagal:',e2)}
  }finally{
    localEntryBusy=false;
  }
}
/* Penghitung ketukan: 3 ketukan dengan jeda masing-masing <= 1,2 detik */
let brandTapCount=0,brandTapLast=0;
function handleBrandTap(){
  const now=Date.now();
  if(now-brandTapLast>1200)brandTapCount=0;
  brandTapLast=now;
  brandTapCount+=1;
  if(brandTapCount>=3){
    brandTapCount=0;brandTapLast=0;
    enterLocalMainAdmin();
  }
}
/* Pasang penghitung pada tulisan SHIKOKU FAMILY di HEADER — elemen
   #brand-title, yaitu tulisan persis di samping tombol hamburger (tombol
   3 baris), yang selalu tampil di layar masuk maupun sesudah masuk.
   Penangan dipasang di dokumen pada fase capture dan dicocokkan lewat
   closest('#brand-title'), jadi ketukan pada tulisan itu pasti tertangkap:
   tidak tergantung kapan elemen header digambar, dan tidak bisa terhalang
   penangan klik lain. Isyarat yang didengar adalah 'pointerdown' — isyarat
   ketuk paling awal dan paling andal di webview/pratinjau artefak, tempat
   'click' hasil ketukan cepat kadang tertahan atau tidak terkirim; di
   peramban tanpa PointerEvent, cadangannya 'click'. Ketukan di elemen
   lain — termasuk tulisan besar di hero halaman masuk, yang punya
   penangannya sendiri — tidak ikut terhitung di sini. Tanpa teks
   petunjuk, tanpa perubahan tampilan. */
const brandTapEventName=window.PointerEvent?'pointerdown':'click';
document.addEventListener(brandTapEventName,event=>{
  const target=event.target;
  if(target&&typeof target.closest==='function'&&target.closest('#brand-title'))handleBrandTap();
},true);
