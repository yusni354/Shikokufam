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
  return h('div',{class:'card auth-card'},title,h('p',{class:'sub'},'Masuk untuk bergabung atau daftar akun baru sebagai anggota komunitas.'),h('div',{class:'auth-tabs'},loginTab,signupTab),nameLabel,h('label',{class:'lb'},'Email',email),h('label',{class:'lb'},'Password',password),forgotWrap,notice,h('button',{class:'btn',onclick:async()=>{
    const emailValue=email.value.trim();
    notice.className='warn';
    notice.textContent='Memproses...';
    if(!emailValue||!password.value){notice.textContent='Email dan password wajib diisi.';return}
    if(signup&&(!name.value.trim()||password.value.length<6)){
      notice.textContent=!name.value.trim()?'Nama lengkap wajib diisi.':'Password minimal 6 karakter.';
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
  }},submitLabel));
}
