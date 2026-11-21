/* Akun lokal: dipakai pada mode tanpa Supabase, tersimpan di perangkat ini.
   Alur sama seperti Supabase: daftar -> menunggu persetujuan -> disetujui admin utama.
   Akun pertama yang mendaftar menjadi admin utama (pengganti langkah SQL manual di README). */
const LOCAL_USERS_KEY='shikoku-family:users';
const LOCAL_SESSION_KEY='shikoku-family:session';
function localUsers(){try{return JSON.parse(localStorage.getItem(LOCAL_USERS_KEY)||'[]')}catch(e){return[]}}
function saveLocalUsers(users){try{localStorage.setItem(LOCAL_USERS_KEY,JSON.stringify(users))}catch(e){throw new Error('Penyimpanan lokal tidak tersedia')}}
function localPasswordHash(password,salt){let hash=5381;const text=String(salt)+':'+String(password);for(let i=0;i<text.length;i++)hash=((hash<<5)+hash+text.charCodeAt(i))>>>0;return 'h'+hash.toString(36)}
function applyLocalUser(user){
  S.uid=user.id;S.email=user.email||'';S.name=user.name||user.email||'';
  S.admin=user.role==='admin';S.mainAdmin=S.admin&&user.is_main_admin===true;
  S.approvalStatus=user.approval_status||'pending';S.authLoading=false;
}
/* Mode lokal sudah dihapus: tidak ada lagi pintu masuk ke mode lokal.
   Flag lama 'shikoku-family:force-local' yang mungkin tertinggal di peramban
   dibersihkan saat aplikasi dimuat (lihat main.js) dan selalu diabaikan,
   supaya selama konfigurasi Supabase ada aplikasi selalu berjalan online. */
const FORCE_LOCAL_KEY='shikoku-family:force-local';
function clearLegacyLocalFlag(){try{localStorage.removeItem(FORCE_LOCAL_KEY)}catch(e){}}
function localModeForced(){return false}
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
/* Keluar akun: bekerja untuk sesi Supabase maupun sesi lokal */
async function signOut(){
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
/* Jalan pintas ketuk 3x pada tulisan SHIKOKU FAMILY sudah dihapus:
   tidak ada lagi cara masuk mode lokal dari header. */
