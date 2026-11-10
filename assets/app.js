const S={members:[],events:[],topics:[],cleaningDuties:[],view:'landing',openConversation:null,messageSignature:'',admin:false,mainAdmin:false,adminMenuOpen:false,uid:null,email:'',name:'',approvalStatus:'approved',pendingUsers:[],mapError:'',siteVisits:[],siteVisitsLoading:false,siteVisitsError:'',siteTrackingError:'',visitConsent:null,visitLocation:null,lastTrackedVisit:'',visitorMap:null,db:null,supabase:null,messageChannel:null,authLoading:true,unreadMessages:0};
const $=s=>document.querySelector(s);
function h(t,p,...k){const e=document.createElement(t);for(const a in p||{}){if(a==='onclick')e.onclick=p[a];else if(a==='class')e.className=p[a];else e.setAttribute(a,p[a])}k.flat().forEach(c=>{if(c!=null&&c!==false)e.append(c)});return e}
const WILAYAH=[['Tokushima','#d95763'],['Takamatsu','#3985c6'],['Marugame','#e28b36'],['Zentsuji / Takuma','#8e68b5'],['Kochi','#24947e'],['Matsuyama','#d45e9f'],['Ehime','#6f9e3b'],['Niihama','#6073c4']];
const ALL=[['landing','🏠 Home'],['dash','📊 Ringkasan'],['members','👥 Daftar Anggota'],['absen','📝 Absensi'],['piket','🧹 Jadwal Piket'],['peta','🗺️ Peta & Wilayah'],['forum','💬 Forum'],['import','📥 Import Database',1],['pesan','📨 Pesan Masuk']];
const ADMIN_MENU=[['map-settings','🗺️ Pengaturan Peta'],['visitor-map','🌍 Peta Kunjungan Jepang'],['approvals','👥 Persetujuan Akun']];
function isAdminSettingsView(){return ADMIN_MENU.some(([view])=>view===S.view)}
function syncAdminTheme(){
  document.body.classList.toggle('admin-dark',S.mainAdmin&&(S.adminMenuOpen||isAdminSettingsView()));
  $('#st').setAttribute('aria-expanded',String(S.adminMenuOpen));
}
function go(v){S.view=v;S.adminMenuOpen=false;S.form=S.detail=S.dutyForm=null;S.detailOrigin=null;if(v==='pesan'&&S.admin)S.openConversation=null;document.body.classList.remove('open');syncAdminTheme();render();if(v==='pesan'&&!S.admin)markMessagesRead()}
$('#mn').onclick=()=>document.body.classList.add('open');
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

function regionColor(value){return WILAYAH.find(([name])=>name===value)?.[1]||'#718096'}
function memberRegion(member){
  const known=value=>WILAYAH.find(([name])=>name.toLowerCase()===String(value||'').trim().toLowerCase())?.[0];
  const fromText=value=>{
    const text=normalizeImportLabel(String(value||''));
    if(text.includes('tokushima'))return 'Tokushima';
    if(text.includes('takamatsu'))return 'Takamatsu';
    if(text.includes('marugame'))return 'Marugame';
    if(text.includes('zentsuji')||text.includes('takuma'))return 'Zentsuji / Takuma';
    if(text.includes('kochi'))return 'Kochi';
    if(text.includes('matsuyama'))return 'Matsuyama';
    if(text.includes('niihama')||text.includes('nihama'))return 'Niihama';
    return '';
  };
  return known(member.wilayah)||fromText(member.kota)||fromText(member.alamat_jp)||
    (known(member.pref==='Kagawa'?'':member.pref))||'Belum dipilih';
}
function wilayah(){const m={};S.members.forEach(x=>{const w=memberRegion(x);(m[w]=m[w]||[]).push(x)});return m}
function openMember(member,origin){S.detail=member;S.detailOrigin=origin;S.view='members';render()}
function whatsappUrl(value){
  const raw=String(value||'').trim();
  let number=raw.replace(/\D/g,'');
  if(raw.startsWith('00'))number=number.slice(2);
  else if(!raw.startsWith('+')&&number.startsWith('0'))number='62'+number.slice(1);
  else if(!raw.startsWith('+')&&!number.startsWith('62')&&!number.startsWith('81'))number='62'+number;
  return number.length>=8&&number.length<=15?'https://wa.me/'+number:'';
}
function socialUrl(platform,value){
  const raw=String(value||'').trim();
  if(!raw)return '';
  if(/^https?:\/\//i.test(raw)){
    try{
      const url=new URL(raw);
      const hosts={facebook:['facebook.com','www.facebook.com','m.facebook.com'],instagram:['instagram.com','www.instagram.com'],tiktok:['tiktok.com','www.tiktok.com','vm.tiktok.com']};
      if(url.protocol==='http:')url.protocol='https:';
      return url.protocol==='https:'&&hosts[platform]?.includes(url.hostname.toLowerCase())?url.href:'';
    }catch(error){return ''}
  }
  const handle=raw.replace(/^@/,'').trim();
  if(!handle)return '';
  if(platform==='facebook')return /\s/.test(handle)?'https://www.facebook.com/search/top/?q='+encodeURIComponent(handle):'https://www.facebook.com/'+encodeURIComponent(handle);
  if(platform==='instagram')return 'https://www.instagram.com/'+encodeURIComponent(handle.toLowerCase())+'/';
  return 'https://www.tiktok.com/@'+encodeURIComponent(handle.toLowerCase());
}
function memberValue(key,value){
  if(value==null||value==='')return '';
  const phones=['wa','hp_pengurus','hp_ortu'];
  const platforms={facebook:'facebook',instagram:'instagram',tiktok:'tiktok'};
  const href=phones.includes(key)?whatsappUrl(value):platforms[key]?socialUrl(platforms[key],value):'';
  const text=String(value).toUpperCase();
  return href?h('a',{class:'member-contact-link',href,target:'_blank',rel:'noopener noreferrer'},text):text;
}
function createLocalDb(){
  const listeners={};
  const key=name=>'shikoku-family:'+name;
  const read=name=>{try{return JSON.parse(localStorage.getItem(key(name))||'[]')}catch(e){return []}};
  const write=(name,rows)=>{try{localStorage.setItem(key(name),JSON.stringify(rows))}catch(e){throw new Error('Penyimpanan lokal tidak tersedia')}};
  const notify=name=>(listeners[name]||[]).forEach(fn=>fn({docs:read(name).map(data=>({id:data.id,data:()=>({...data})}))}));
  const collection=name=>({
    onSnapshot(fn){(listeners[name]||(listeners[name]=[])).push(fn);notify(name)},
    add:async data=>{const rows=read(name),id='local-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7);rows.push({id,...data});write(name,rows);notify(name);return {id}},
    doc:id=>({
      set:async data=>{const rows=read(name),i=rows.findIndex(x=>x.id===id),next={id,...data};if(i<0)rows.push(next);else rows[i]=next;write(name,rows);notify(name)},
      update:async data=>{const rows=read(name),i=rows.findIndex(x=>x.id===id);if(i<0)throw new Error('Data tidak ditemukan');rows[i]={...rows[i],...data};write(name,rows);notify(name)},
      delete:async()=>{write(name,read(name).filter(x=>x.id!==id));notify(name)}
    })
  });
  return {collection};
}
function messageFromRow(row){return {id:row.id,nama:row.name,teks:row.message,attachments:row.attachments||[],at:new Date(row.created_at).getTime(),status:row.status,sender_id:row.sender_id}}
function replyFromRow(row){return {id:row.id,message_id:row.message_id,by:row.sender_id,teks:row.message,attachments:row.attachments||[],at:new Date(row.created_at).getTime()}}
function updateMessageBadges(){
  const value=String(S.unreadMessages||0);
  document.querySelectorAll('[data-message-badge]').forEach(badge=>{
    badge.textContent=value;
    badge.style.display=S.unreadMessages>0?'':'none';
  });
  const nav=document.querySelector('[data-message-nav]');
  if(nav){
    let badge=nav.querySelector('.nav-badge');
    if(S.unreadMessages>0&&!badge){badge=h('span',{class:'nav-badge'},value);nav.append(badge)}
    if(badge){badge.textContent=value;badge.style.display=S.unreadMessages>0?'':'none'}
  }
}
function userMessageSeen(){
  try{return JSON.parse(localStorage.getItem('shikoku-family:message-seen:'+S.uid)||'{}')}catch(e){return {}}
}
function incomingMessageItems(){
  const replies=(S.replies||[]).filter(reply=>reply.by!==S.uid);
  return S.admin?[...(S.tanya||[]),...replies]:replies;
}
function conversationGroups(){
  const groups=[],byUser=new Map();
  (S.tanya||[]).forEach(message=>{
    const key=S.admin?(message.sender_id||'unknown-'+message.nama):(S.uid||'self');
    let group=byUser.get(key);
    if(!group){group={key,name:message.nama||'Anggota',messages:[]};byUser.set(key,group);groups.push(group)}
    group.messages.push(message);
  });
  return groups;
}
function conversationUnread(group){
  const seen=userMessageSeen(),items=[];
  group.messages.forEach(message=>{
    if(S.admin)items.push(message);
    (S.replies||[]).filter(reply=>reply.message_id===message.id&&reply.by!==S.uid).forEach(reply=>items.push(reply));
  });
  return items.filter(item=>!seen[item.id]).length;
}
function markMessagesRead(group){
  if(!S.uid)return;
  const seen=userMessageSeen();
  const items=group?[
    ...(S.admin?group.messages:[]),
    ...(S.replies||[]).filter(reply=>group.messages.some(message=>message.id===reply.message_id)&&reply.by!==S.uid)
  ]:incomingMessageItems();
  items.forEach(item=>{if(item.at)seen[item.id]=item.at});
  try{localStorage.setItem('shikoku-family:message-seen:'+S.uid,JSON.stringify(seen))}catch(e){console.error('Status pesan tidak dapat disimpan:',e)}
  if(S.admin&&S.supabase){
    let query=S.supabase.from('messages').update({status:'read',read_at:new Date().toISOString()}).eq('status','unread');
    if(group)query=query.in('id',group.messages.map(message=>message.id));
    query
      .then(({error})=>{if(error)console.error('Status pesan admin tidak dapat diperbarui:',error)});
  }
  const seenNow=userMessageSeen();
  S.unreadMessages=incomingMessageItems().filter(item=>!seenNow[item.id]).length;
  render();
}
async function subscribeToMessages(){
  if(!S.supabase||!S.uid)return;
  if(S.messageChannel)await S.supabase.removeChannel(S.messageChannel);
  S.messageChannel=S.supabase.channel('messages-'+S.uid)
    .on('postgres_changes',{event:'*',schema:'public',table:'messages'},()=>loadMessages())
    .on('postgres_changes',{event:'*',schema:'public',table:'message_replies'},()=>loadMessages());
  S.messageChannel.subscribe(status=>{
    if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')console.error('Realtime pesan tidak tersedia:',status);
  });
}
async function loadMessages(){
  if(!S.supabase||!S.uid)return;
  let query=S.supabase.from('messages').select('*').order('created_at',{ascending:true});
  if(!S.admin)query=query.eq('sender_id',S.uid);
  const {data,error}=await query;
  if(error){console.error(error);return}
  const nextMessages=(data||[]).map(messageFromRow);
  const ids=(data||[]).map(x=>x.id);
  let nextReplies=[];
  if(ids.length){
    const {data:replies}=await S.supabase.from('message_replies').select('*').in('message_id',ids).order('created_at',{ascending:true});
    nextReplies=(replies||[]).map(replyFromRow);
  }
  const signature=JSON.stringify({
    messages:nextMessages.map(item=>[item.id,item.status,item.at,item.attachments]),
    replies:nextReplies.map(item=>[item.id,item.message_id,item.at,item.attachments])
  });
  const changed=signature!==S.messageSignature;
  S.messageSignature=signature;
  S.tanya=nextMessages;
  S.replies=nextReplies;
  const seen=userMessageSeen();
  S.unreadMessages=incomingMessageItems().filter(item=>!seen[item.id]).length;
  updateMessageBadges();
  if(changed&&S.view==='pesan')render();
}
async function submitMessage(data){
  if(!S.supabase)throw new Error('Supabase belum tersedia');
  if(!S.uid)throw new Error('Silakan login terlebih dahulu');
  const {error}=await S.supabase.from('messages').insert({
    name:data.nama,
    message:data.teks,
    sender_id:S.uid,
    attachments:data.attachments||[]
  });
  if(error)throw error;
}
async function submitReply(messageId,text,attachments=[]){
  if(!S.supabase||!S.uid)throw new Error('Silakan login terlebih dahulu');
  const {error}=await S.supabase.from('message_replies').insert({message_id:messageId,sender_id:S.uid,message:text,attachments});
  if(error)throw error;
  if(S.admin){
    const {error:statusError}=await S.supabase.from('messages').update({
      status:'replied',
      replied_at:new Date().toISOString()
    }).eq('id',messageId);
    if(statusError)throw statusError;
  }
}
function accountForm(){
  const email=h('input',{type:'email',placeholder:'Email',autocomplete:'email'});
  const password=h('input',{type:'password',placeholder:'Password minimal 6 karakter',autocomplete:'current-password'});
  const name=h('input',{placeholder:'Nama lengkap',autocomplete:'name'});
  const notice=h('p',{class:'warn'});
  let signup=false;
  const title=h('b',{},'🔐 Masuk ke Shikoku Family');
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
    title.textContent=signup?'📝 Daftar sebagai anggota':'🔐 Masuk ke Shikoku Family';
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
  }},signup?'Daftar':'Masuk'));
}
function loginForm(){
  const email=h('input',{type:'email',placeholder:'Email admin',autocomplete:'email'});
  const password=h('input',{type:'password',placeholder:'Password',autocomplete:'current-password'});
  const notice=h('p',{class:'warn'});
  return box(h('b',{},'🔐 Login Admin'),h('p',{class:'sub'},'Masuk untuk membaca pesan yang diterima.'),h('label',{class:'lb'},'Email',email),h('label',{class:'lb'},'Password',password),notice,h('button',{class:'btn',onclick:async()=>{
    notice.textContent='Memproses...';
    const {error}=await S.supabase.auth.signInWithPassword({email:email.value.trim(),password:password.value});
    notice.textContent=error?error.message:'Login berhasil.';
    if(!error)await loadMessages();
  }},'Masuk'));
}
async function uploadMessageFiles(files){
  if(!files.length)return [];
  if(!S.supabase)throw new Error('Supabase belum tersedia');
  const uploaded=[];
  for(const file of files){
    const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,'-');
    const path=S.uid+'/'+crypto.randomUUID()+'-'+safeName;
    const {error}=await S.supabase.storage.from('message-attachments').upload(path,file,{contentType:file.type||'application/octet-stream'});
    if(error)throw error;
    const {data}=S.supabase.storage.from('message-attachments').getPublicUrl(path);
    uploaded.push({url:data.publicUrl,name:file.name,type:file.type||'application/octet-stream'});
  }
  return uploaded;
}
function attachmentView(attachment){
  if(!attachment?.url)return null;
  if(attachment.type?.startsWith('image/'))return h('a',{href:attachment.url,target:'_blank'},h('img',{src:attachment.url,alt:attachment.name||'Gambar lampiran',class:'chat-image'}));
  if(attachment.type?.startsWith('audio/'))return h('audio',{controls:true,src:attachment.url});
  return h('a',{href:attachment.url,target:'_blank',class:'chat-file'},'📎 '+(attachment.name||'Buka lampiran'));
}
function attachmentPicker(){
  const files=[];
  const label=h('small',{class:'attachment-list'},'');
  const update=input=>{
    files.push(...Array.from(input.files||[]));
    label.textContent=files.length?files.map(file=>file.name).join(', '):'';
  };
  const file=h('input',{type:'file',multiple:true,accept:'image/*,audio/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx',style:'display:none'});
  const camera=h('input',{type:'file',accept:'image/*',capture:'environment',style:'display:none'});
  file.onchange=()=>update(file);camera.onchange=()=>update(camera);
  return {files,label,buttons:h('div',{class:'attachment-tools'},
    h('button',{class:'btn s',onclick:()=>file.click()},'📎 File'),
    h('button',{class:'btn s',onclick:()=>camera.click()},'📷 Kamera'))};
}
function replyBox(messageId){
  const input=h('textarea',{rows:2,placeholder:'Tulis balasan...'});
  const picker=attachmentPicker(),record=h('button',{class:'btn s'},'🎙️ Rekam');
  let recorder,recorded=[];
  record.onclick=async()=>{
    if(recorder){recorder.stop();return}
    if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){alert('Perekaman suara tidak didukung browser ini.');return}
    const stream=await navigator.mediaDevices.getUserMedia({audio:true});
    recorded=[];
    recorder=new MediaRecorder(stream);
    recorder.ondataavailable=e=>{if(e.data.size)recorded.push(e.data)};
    recorder.onstop=()=>{stream.getTracks().forEach(track=>track.stop());picker.files.push(new File(recorded,'voice-note.webm',{type:'audio/webm'}));picker.label.textContent='Voice note siap dikirim';recorder=null;record.textContent='🎙️ Rekam'};
    recorder.start();record.textContent='⏹️ Selesai';
  };
  const menu=h('div',{class:'attachment-menu'},picker.buttons,record);
  const plus=h('button',{class:'composer-plus',type:'button',title:'Lampiran',onclick:()=>menu.classList.toggle('open')},'+');
  const send=h('button',{class:'btn',onclick:async e=>{
    if(!input.value.trim()&&!picker.files.length)return;
    try{
      e.currentTarget.disabled=true;
      const attachments=await uploadMessageFiles(picker.files);
      await submitReply(messageId,input.value.trim(),attachments);
      await loadMessages();
    }catch(error){e.currentTarget.disabled=false;alert('Gagal mengirim balasan: '+error.message)}
  }},'Kirim');
  return h('div',{class:'reply-box'},menu,h('div',{class:'composer-row'},input,plus,send),picker.label);
}
function guard(){return S.db?null:h('p',{class:'warn'},'Penyimpanan belum tersedia.')}

function vHome(){
  const today=new Date(),todayKey=[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-');
  const upcomingDuties=[...S.cleaningDuties].filter(duty=>duty.tanggal&&duty.tanggal>=todayKey).sort((a,b)=>a.tanggal.localeCompare(b.tanggal)).slice(0,2);
  const recentEvents=[...S.events].sort((a,b)=>(b.at||0)-(a.at||0)).slice(0,2);
  const memberGroups=wilayah();
  const regionCards=WILAYAH.map(([name,color])=>{
    const members=[...(memberGroups[name]||[])].sort((a,b)=>(a.nama||'').localeCompare(b.nama||'','id'));
    return h('section',{class:'home-region-card',style:'--region-color:'+color},
      h('div',{class:'home-region-heading'},h('b',{},name),h('span',{},members.length+' anggota')),
      members.length
        ?h('div',{class:'home-region-members'},...members.map(member=>
          h('button',{class:'home-region-member',onclick:()=>openMember(member,'landing')},
            member.foto?h('img',{src:'/_blob/'+member.foto,alt:''}):h('span',{class:'member-avatar-placeholder'},(member.nama||'?').trim().slice(0,1).toUpperCase()),
            h('span',{},member.nama||'Nama belum diisi'),h('span',{class:'home-region-arrow'},'›'))))
        :h('p',{class:'home-region-empty'},'Belum ada anggota di wilayah ini.')
    );
  });
  if(memberGroups['Belum dipilih']?.length)regionCards.push(h('section',{class:'home-region-card home-region-unknown'},h('div',{class:'home-region-heading'},h('b',{},'Wilayah belum dipilih'),h('span',{},memberGroups['Belum dipilih'].length+' anggota')),
    ...memberGroups['Belum dipilih'].map(member=>h('button',{class:'home-region-member',onclick:()=>openMember(member,'landing')},h('span',{class:'member-avatar-placeholder'},(member.nama||'?').trim().slice(0,1).toUpperCase()),h('span',{},member.nama||'Nama belum diisi'),h('span',{class:'home-region-arrow'},'›')))));
  const shortcuts=[['🧹','Jadwal Piket','piket'],['📝','Absensi','absen'],['💬','Forum','forum'],['🗺️','Peta','peta']];
  const dutyRows=upcomingDuties.flatMap(duty=>{
    const assignments=Array.isArray(duty.assignments)&&duty.assignments.length?duty.assignments:[{nama:duty.nama||'',tugas:duty.tugas||''}];
    return [h('div',{class:'home-duty'},
      h('div',{class:'home-duty-date'},h('b',{},String(new Date(duty.tanggal+'T00:00:00').getDate()).padStart(2,'0')),h('small',{},new Date(duty.tanggal+'T00:00:00').toLocaleDateString('id-ID',{month:'short'}))),
      h('div',{class:'home-duty-info'},...assignments.map(assignment=>h('p',{},h('b',{},assignment.nama),h('span',{},assignment.tugas))))
    )];
  });
  return [
    h('section',{class:'home-welcome'},
      h('span',{class:'home-welcome-icon'},'👋'),
      h('div',{},h('small',{},today.toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'})),h('h1',{},'Selamat datang'+(S.name?', '+S.name.split(' ')[0]:'')+'!'),h('p',{},'Senang bisa berkumpul bersama keluarga Shikoku.'))
    ),
    h('div',{class:'stats home-stats'},...[['Anggota',S.members.length],['Kegiatan',S.events.length],['Wilayah',Object.keys(wilayah()).length]].map(item=>h('div',{},h('small',{},item[0]),h('b',{},String(item[1]))))),
    h('div',{class:'home-section-heading'},h('h2',{},'Daftar anggota'),S.admin&&h('button',{class:'btn s',onclick:()=>go('members')},'+ Tambah')),
    h('p',{class:'home-member-intro'},'Pilih nama anggota untuk membuka kartu identitas lengkap.'),
    h('div',{class:'home-region-list'},...regionCards),
    h('div',{class:'home-section-heading'},h('h2',{},'Akses cepat'),h('small',{},'Yang sering dibuka')),
    h('div',{class:'home-shortcuts'},...shortcuts.map(([icon,label,view])=>h('button',{class:'home-shortcut',onclick:()=>go(view)},h('span',{},icon),h('b',{},label),h('span',{class:'home-shortcut-arrow'},'›')))),
    h('div',{class:'home-section-heading'},h('h2',{},'Jadwal piket terdekat'),h('button',{class:'btn s',onclick:()=>go('piket')},'Lihat semua')),
    upcomingDuties.length?h('div',{class:'home-agenda'},...dutyRows):h('div',{class:'home-empty'},h('span',{},'🧹'),h('p',{},'Belum ada jadwal piket mendatang.')),
    h('div',{class:'home-section-heading'},h('h2',{},'Kegiatan komunitas'),h('button',{class:'btn s',onclick:()=>go('absen')},'Buka absensi')),
    recentEvents.length?h('div',{class:'home-events'},...recentEvents.map(event=>h('div',{class:'home-event'},h('span',{},'🎉'),h('div',{},h('b',{},event.judul||'Kegiatan komunitas'),h('small',{},(event.hadir||[]).length+' anggota akan hadir'))))):h('div',{class:'home-empty'},h('span',{},'🎉'),h('p',{},'Belum ada kegiatan komunitas.')),
    h('button',{class:'home-admin-link',onclick:askForm},'💬 Butuh bantuan? Hubungi Admin')
  ];
}
function vDash(){
  const c=(e,t,d,n,v)=>h('button',{class:'card',onclick:()=>go(v)},
    h('span',{class:'e',style:'position:relative'},e,v==='pesan'&&h('span',{class:'icon-badge','data-message-badge':'true',style:S.unreadMessages>0?'':'display:none'},String(S.unreadMessages))),
    h('span',{style:'flex:1'},h('b',{},t),h('small',{},d),h('br'),h('b',{style:'font-size:15px'},n)),'›');
  return [h('h1',{},'Selamat datang'+(S.name?', '+S.name.split(' ')[0]:'')+' 👋'),
    h('p',{class:'sub'},new Date().toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'})),
    h('div',{class:'card',style:'display:block'},h('small',{class:'warn'},'User ID'),h('br'),h('b',{},S.email||S.uid||'-')),
    h('div',{class:'stats'},...[['Anggota',S.members.length],['Kegiatan',S.events.length],['Wilayah',Object.keys(wilayah()).length]].map(x=>h('div',{},h('small',{},x[0]),h('b',{},String(x[1]))))),
    c('👥','Daftar Anggota','Kelola data anggota komunitas',S.members.length+' anggota','members'),
    c('📋','Absensi','Kegiatan & kehadiran anggota',S.events.length+' kegiatan','absen'),
    c('🧹','Jadwal Piket','Jadwal kebersihan komunitas',S.cleaningDuties.length+' jadwal','piket'),
    c('💬','Forum','Diskusi & komentar anggota',S.topics.length+' topik','forum'),
    S.admin&&c('📥','Import Database','Tambahkan data anggota','Impor CSV','import'),
    c('📨','Pesan Masuk','Pesan dan balasan admin',S.admin?((S.tanya?.length||0)+' pesan'):'Pesan saya','pesan'),
    c('🗺️','Peta & Wilayah','Sebaran anggota di Jepang',Object.keys(wilayah()).length+' wilayah','peta'),
    h('button',{class:'card',onclick:async()=>{await S.supabase.auth.signOut()}},h('span',{class:'e'},'🚪'),h('span',{style:'flex:1'},h('b',{},'Keluar'),h('small',{},'Akhiri sesi akun')),'›')];
}
const PERAN=['Anggota','Pengurus'],STATUS=['aktif','nonaktif'];
function vMembers(){
  if(S.form)return [memberFormCard()];
  const search=h('input',{type:'search',placeholder:'Cari nama, WhatsApp, kota, wilayah, atau nomor anggota'}),region=h('select',{}),status=h('select',{});
  const regions=WILAYAH.map(([name])=>name);
  if(S.members.some(member=>memberRegion(member)==='Belum dipilih'))regions.push('Belum dipilih');
  region.replaceChildren(h('option',{value:''},'Semua wilayah'),...regions.map(value=>h('option',{value},value)));
  status.replaceChildren(h('option',{value:''},'Semua status'),...STATUS.map(value=>h('option',{value},value)));
  search.value=S.memberQuery||'';region.value=S.memberRegion||'';status.value=S.memberStatus||'';
  const count=h('p',{class:'member-results-count'}),list=h('div',{class:'member-grid'});
  function draw(){
    const query=(S.memberQuery||'').trim().toLowerCase();
    const rows=S.members.filter(member=>
      (!query||[member.nama,member.panggilan,member.wa,member.kota,member.wilayah,member.pref,member.kode].some(value=>String(value||'').toLowerCase().includes(query)))&&
      (!S.memberRegion||memberRegion(member)===S.memberRegion)&&
      (!S.memberStatus||(member.status||'aktif').toLowerCase()===S.memberStatus)
    ).sort((a,b)=>(a.nama||'').localeCompare(b.nama||'','id'));
    count.textContent='Menampilkan '+rows.length+' dari '+S.members.length+' anggota';
    list.replaceChildren(...(rows.length?rows.map((member,index)=>{
      const code=member.kode||'MEM-'+String(index+1).padStart(5,'0'),area=memberRegion(member),location=[member.kota,member.pref].filter(Boolean).join(', ');
      return h('article',{class:'member-card',style:'--region-color:'+regionColor(area)},
        member.foto?h('img',{class:'member-avatar',src:'/_blob/'+member.foto,alt:'Foto '+(member.nama||'anggota')}):h('div',{class:'member-avatar member-avatar-placeholder'},(member.nama||'?').trim().slice(0,1).toUpperCase()),
        h('div',{class:'member-card-info'},h('div',{class:'member-name-line'},h('b',{},(member.nama||'Nama belum diisi').toUpperCase()),h('span',{class:'member-region-tag'},area.toUpperCase()),h('span',{class:'ok'+((member.status||'aktif').toLowerCase()==='aktif'?'':' off')},(member.status||'aktif').toUpperCase())),
          h('small',{},[code,location].filter(Boolean).join(' · ').toUpperCase()),
          h('small',{},member.wa?memberValue('wa',member.wa):member.email||'Kontak belum diisi')),
        h('div',{class:'member-card-actions'},
          h('button',{class:'btn s',onclick:()=>openMember(member,'members')},'Lihat kartu ID'),
          S.admin&&h('button',{class:'btn s',onclick:()=>{S.form={...member};S.detail=null;render()}},'✎ Edit'),
          S.admin&&h('button',{class:'btn s member-delete',onclick:async()=>{
            if(!confirm('Hapus data anggota '+(member.nama||'ini')+'?'))return;
            try{await S.db.collection('members').doc(member.id).delete()}catch(error){console.error(error);alert('Gagal menghapus data anggota: '+(error.message||'periksa koneksi'))}
          }},'Hapus')))
    }):[h('div',{class:'member-empty'},h('span',{},S.members.length?'🔎':'👥'),h('b',{},S.members.length?'Anggota tidak ditemukan':'Belum ada data anggota'),h('p',{},S.members.length?'Coba kata kunci atau filter wilayah yang lain.':'Data anggota yang ditambahkan akan tampil di sini.'))]));
  }
  search.oninput=()=>{S.memberQuery=search.value;draw()};
  region.onchange=()=>{S.memberRegion=region.value;draw()};
  status.onchange=()=>{S.memberStatus=status.value;draw()};
  draw();
  return [
    h('div',{class:'member-page-heading'},h('div',{},h('p',{class:'member-eyebrow'},'KOMUNITAS SHIKOKU FAMILY'),h('h1',{},'Daftar Anggota'),h('p',{class:'sub'},'Temukan dan kelola informasi anggota komunitas.')),
      S.admin&&h('button',{class:'btn',onclick:()=>{S.form={};S.detail=null;render()}},'+ Tambah Anggota')),
    guard(),
    S.detail&&detailCard(),
    h('div',{class:'member-toolbar'},search,h('div',{class:'member-filters'},region,status)),
    count,list
  ];
}
function detailCard(){
  const member=S.detail,area=memberRegion(member),code=member.kode||'MEM-'+String(member.id||'00000').replace(/\D/g,'').slice(-5).padStart(5,'0'),sections=[
    ['Identitas & Keanggotaan',[['Nama lengkap',member.nama],['Nama panggilan',member.panggilan],['Nomor anggota',code],['Jenis kelamin',member.kelamin],['Tanggal lahir',member.lahir],['Umur',member.umur],['Status',member.status||'aktif'],['Peran',member.peran||'Anggota'],['Pernikahan',member.nikah],['MT',member.mt]]],
    ['Kontak & Keluarga',[['WhatsApp',member.wa],['Email',member.email],['Nama pengurus daerah',member.pengurus],['Nomor HP pengurus daerah',member.hp_pengurus],['Nama orang tua',member.ortu],['Nomor HP orang tua',member.hp_ortu],['Instagram',member.instagram],['TikTok',member.tiktok],['Facebook',member.facebook]]],
    ['Alamat Indonesia',[['Kelompok',member.kelompok],['Desa',member.desa],['Daerah',member.daerah],['Provinsi',member.prov],['Kabupaten/Kota',member.kab],['Kecamatan',member.kec],['Alamat',member.alamat_id]]],
    ['Alamat & Pekerjaan di Jepang',[['Wilayah',area],['Prefektur',member.pref],['Kota',member.kota],['Kecamatan',member.kec_jp],['Kode pos',member.kodepos],['Stasiun',member.stasiun],['Alamat',member.alamat_jp],['Mulai tinggal',member.mulai_jp],['Status visa',member.tinggal],['Bidang pekerjaan',member.bidang],['Perusahaan',member.perusahaan]]],
    ['Catatan',[['Catatan',member.catatan]]]
  ];
  const barcodeText=/^IJCCS-\d+$/i.test(code)?code.slice(code.lastIndexOf('-')+1).padStart(10,'0'):String(Math.abs(Array.from(code).reduce((hash,char)=>Math.imul(hash,31)+char.charCodeAt(0)|0,7))).padStart(10,'0').slice(-10);
  const code39={'0':'nnnwwnwnn','1':'wnnwnnnnw','2':'nnwwnnnnw','3':'wnwwnnnnn','4':'nnnwwnnnw','5':'wnnwwnnnn','6':'nnwwwnnnn','7':'nnnwnnwnw','8':'wnnwnnwnn','9':'nnwwnnwnn','*':'nwnnwnwnn'};
  const barcode=h('svg',{class:'member-barcode',viewBox:'0 0 1 54',role:'img','aria-label':'Barcode anggota '+code});
  let x=0;
  for(const char of '*'+barcodeText+'*'){
    code39[char].split('').forEach((width,index)=>{
      const size=width==='w'?5:2;
      if(index%2===0)barcode.append(h('rect',{x,y:0,width:size,height:48}));
      x+=size;
    });
    x+=2;
  }
  barcode.setAttribute('viewBox','0 0 '+x+' 54');
  return h('section',{class:'member-profile-page',style:'--region-color:'+regionColor(area)},
    h('div',{class:'member-profile-toolbar'},h('button',{class:'btn s',onclick:()=>{S.detail=null;const origin=S.detailOrigin;S.detailOrigin=null;S.view=origin==='landing'?'landing':'members';render()}},'← Kembali'),
      S.admin&&h('button',{class:'btn s',onclick:()=>{S.form={...member};S.detail=null;S.detailOrigin=null;render()}},'✎ Edit data')),
    h('article',{class:'member-id-card'},
      h('div',{class:'member-id-banner'},h('span',{},'SHIKOKU FAMILY'),h('span',{class:'member-region-tag'},area)),
      h('div',{class:'member-id-main'},
        member.foto?h('img',{class:'member-id-photo',src:'/_blob/'+member.foto,alt:'Foto '+(member.nama||'anggota')}):h('div',{class:'member-id-photo member-avatar-placeholder'},(member.nama||'?').trim().slice(0,1).toUpperCase()),
        h('div',{class:'member-id-info'},h('small',{},'KARTU ANGGOTA'),h('h1',{},(member.nama||'Nama belum diisi').toUpperCase()),h('b',{},code.toUpperCase()),h('p',{},[member.kota,member.pref].filter(Boolean).join(' · ').toUpperCase()||area.toUpperCase()),h('span',{class:'ok'+((member.status||'aktif').toLowerCase()==='aktif'?'':' off')},(member.status||'aktif').toUpperCase()))),
      h('div',{class:'member-id-barcode'},barcode,h('small',{},code))),
    ...sections.filter(([,rows])=>rows.some(([,value])=>value)).map(([title,rows])=>h('section',{class:'member-detail-section'},h('h3',{},title.toUpperCase()),h('div',{class:'member-detail-grid'},...rows.filter(([,value])=>value).map(([label,value])=>h('div',{class:'member-detail-item'},h('small',{},label.toUpperCase()),h('span',{},memberValue(label==='WhatsApp'?'wa':label==='Nomor HP pengurus daerah'?'hp_pengurus':label==='Nomor HP orang tua'?'hp_ortu':label.toLowerCase(),value))))))),
    (member.surat||[]).length>0&&h('section',{class:'member-detail-section'},h('h3',{},'Foto Surat Sambung'),...(member.surat||[]).map((id,index)=>h('a',{class:'member-file-link',href:'/_blob/'+id,target:'_blank',rel:'noopener'},'📎 Buka lampiran '+(index+1)))),
    S.admin&&h('div',{class:'member-detail-actions'},h('button',{class:'btn',onclick:()=>{S.form={...member};S.detail=null;S.detailOrigin=null;render()}},'✎ Edit data anggota'))
  );
}
const PREF=['Ehime','Kagawa','Kochi','Tokushima','Hokkaido','Aomori','Iwate','Miyagi','Akita','Yamagata','Fukushima','Ibaraki','Tochigi','Gunma','Saitama','Chiba','Tokyo','Kanagawa','Niigata','Toyama','Ishikawa','Fukui','Yamanashi','Nagano','Gifu','Shizuoka','Aichi','Mie','Shiga','Kyoto','Osaka','Hyogo','Nara','Wakayama','Tottori','Shimane','Okayama','Hiroshima','Yamaguchi','Fukuoka','Saga','Nagasaki','Kumamoto','Oita','Miyazaki','Kagoshima','Okinawa'];
const PROV=['Aceh','Sumatera Utara','Sumatera Barat','Riau','Kepulauan Riau','Jambi','Sumatera Selatan','Bangka Belitung','Bengkulu','Lampung','DKI Jakarta','Banten','Jawa Barat','Jawa Tengah','DI Yogyakarta','Jawa Timur','Bali','Nusa Tenggara Barat','Nusa Tenggara Timur','Kalimantan Barat','Kalimantan Tengah','Kalimantan Selatan','Kalimantan Timur','Kalimantan Utara','Sulawesi Utara','Gorontalo','Sulawesi Tengah','Sulawesi Barat','Sulawesi Selatan','Sulawesi Tenggara','Maluku','Maluku Utara','Papua','Papua Barat','Papua Barat Daya','Papua Selatan','Papua Tengah','Papua Pegunungan'];
const BLN=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const TGL=['Technical Intern (Ginou Jisshu)','Specified Skilled Worker (Tokutei Ginou)','Engineer/Specialist','Pelajar','Permanent Resident','Dependent/Keluarga','Lainnya'];
function normalizeImportLabel(value){return value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}
function importDate(value){
  const match=value.trim().match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if(!match)return '';
  const [,day,month,year]=match,iso=year+'-'+month.padStart(2,'0')+'-'+day.padStart(2,'0'),date=new Date(iso+'T00:00:00');
  return date.getFullYear()===Number(year)&&date.getMonth()+1===Number(month)&&date.getDate()===Number(day)?iso:'';
}
function parseMemberPaste(text){
  const aliases=[
    [['nama lengkap'],'nama'],[['jenis kelamin'],'kelamin'],[['tgl bln thn lahir','tanggal lahir'],'lahir'],
    [['umur','usia'],'umur'],[['kelompok desa daerah di indonesia'],'wilayah_indonesia'],
    [['no hp pengurus daerah nama','no hp pengurus daerah'],'pengurus_contact'],
    [['status lajang menikah','status lajang menikah cerai'],'nikah'],[['mt iya bukan','mt'],'mt'],
    [['mulai tinggal di jepang'],'mulai_jp'],[['alamat tinggal di jepang'],'alamat_jp'],
    [['status visa'],'tinggal'],[['no hp wa','nomor hp wa'],'wa'],[['facebook'],'facebook'],
    [['no hp orang tua nama','no hp orang tua'],'ortu_contact']
  ];
  const values={};
  let current='';
  text.split(/\r?\n/).forEach(line=>{
    const match=line.match(/^\s*(?:\d+\s*[.)]\s*)?([^:：]+?)\s*[:：]\s*(.*)$/);
    if(match){current=normalizeImportLabel(match[1]);values[current]=match[2].trim()}
    else if(current&&line.trim())values[current]+=' '+line.trim();
  });
  const data={},recognized=[];
  aliases.forEach(([labels,key])=>{
    const label=Object.keys(values).find(candidate=>labels.includes(candidate));
    if(label&&values[label]){data[key]=values[label];recognized.push(key)}
  });
  if(data.nama)data.nama=data.nama.trim();
  if(data.kelamin){
    const gender=normalizeImportLabel(data.kelamin);
    if(gender.includes('laki laki'))data.kelamin='Laki-laki';
    else if(gender.includes('perempuan'))data.kelamin='Perempuan';
  }
  if(data.lahir){const converted=importDate(data.lahir);if(converted)data.lahir=converted;else delete data.lahir}
  if(data.umur)data.umur=data.umur.match(/\d+/)?.[0]||data.umur;
  if(data.wilayah_indonesia){
    const [kelompok,desa,daerah]=data.wilayah_indonesia.split(',').map(part=>part.trim());
    if(kelompok)data.kelompok=kelompok;
    if(desa)data.desa=desa;
    if(daerah)data.daerah=daerah;
    delete data.wilayah_indonesia;
  }
  const splitContact=(value,nameKey,phoneKey)=>{
    if(!value)return;
    const phone=value.match(/\+?\d[\d\s().-]{6,}\d/);
    if(phone){
      data[phoneKey]=phone[0].trim();
      const name=value.replace(phone[0],'').replace(/^[\s+,:;-]+|[\s+,:;-]+$/g,'').trim();
      if(name)data[nameKey]=name;
    }else data[nameKey]=value.trim();
  };
  splitContact(values[normalizeImportLabel('No. Hp Pengurus Daerah + Nama')], 'pengurus','hp_pengurus');
  if(!data.pengurus&&!data.hp_pengurus)splitContact(data.pengurus_contact,'pengurus','hp_pengurus');
  splitContact(values[normalizeImportLabel('No. HP Orang Tua + Nama')], 'ortu','hp_ortu');
  if(!data.ortu&&!data.hp_ortu)splitContact(data.ortu_contact,'ortu','hp_ortu');
  delete data.pengurus_contact;delete data.ortu_contact;
  if(data.nikah){
    const status=normalizeImportLabel(data.nikah);
    if(status.includes('lajang')||status.includes('belum'))data.nikah='Belum menikah';
    else if(status.includes('menikah'))data.nikah='Menikah';
    else if(status.includes('cerai'))data.nikah='Cerai';
  }
  if(data.mt)data.mt=data.mt.trim();
  if(data.mulai_jp)data.mulai_jp=data.mulai_jp.trim();
  if(data.alamat_jp){
    const address=data.alamat_jp.trim();
    const normalizedAddress=normalizeImportLabel(address);
    const cities=[['zentsuji','Zentsuji / Takuma','Kagawa'],['takuma','Zentsuji / Takuma','Kagawa'],['niihama','Niihama','Ehime'],['nihama','Niihama','Ehime'],['marugame','Marugame','Kagawa'],['takamatsu','Takamatsu','Kagawa'],['matsuyama','Matsuyama','Ehime'],['kochi','Kochi','Kochi'],['tokushima','Tokushima','Tokushima']];
    const city=cities.find(([needle])=>normalizedAddress.includes(needle));
    if(city){data.kota=city[1];data.pref=city[2];data.wilayah=city[1]}
    else if(normalizedAddress.includes('ehime')){data.pref='Ehime';data.wilayah='Ehime'}
    else if(normalizedAddress.includes('kochi')){data.pref='Kochi';data.wilayah='Kochi'}
    else if(normalizedAddress.includes('tokushima')){data.pref='Tokushima';data.wilayah='Tokushima'}
    data.alamat_jp=address;
  }
  if(data.tinggal){
    const visa=normalizeImportLabel(data.tinggal);
    if(visa.includes('tokutei ginou')||visa.includes('tokuteginou'))data.tinggal='Specified Skilled Worker (Tokutei Ginou)';
    else if(visa.includes('ginou jisshu')||visa.includes('technical intern'))data.tinggal='Technical Intern (Ginou Jisshu)';
    else if(!TGL.includes(data.tinggal))data.tinggal=data.tinggal.trim();
  }
  return {data,recognized};
}
function fld(l,k,o){o=o||{};const f=S.form;let e;
  if(o.opts)e=h('select',{},h('option',{value:''},o.ph||'Pilih'),...o.opts.map(x=>h('option',{value:x},x)));
  else if(o.area)e=h('textarea',{rows:3,placeholder:o.ph||''});
  else e=h('input',{placeholder:o.ph||'',type:o.type||'text'});
  if(o.opts){
    const option=o.opts.find(value=>value.toUpperCase()===String(f[k]||'').toUpperCase());
    if(f[k]&&!option)e.append(h('option',{value:String(f[k]).toUpperCase()},String(f[k]).toUpperCase()));
    e.value=option||String(f[k]||'').toUpperCase();
    e.onchange=()=>{f[k]=e.value.toUpperCase()};
  }else{
    e.value=String(f[k]||'').toUpperCase();
    e.oninput=()=>{
      const start=e.selectionStart;
      e.value=e.value.toUpperCase();
      f[k]=e.value;
      if(start!==null&&typeof e.setSelectionRange==='function'&&(['text','search','tel','url','password'].includes(e.type)||e.tagName==='TEXTAREA'))e.setSelectionRange(start,start);
    };
  }
  return h('label',{class:'lb'},l,e)}
const box=(...k)=>h('div',{class:'card',style:'display:block'},...k);
function autoFill(txt){
  if(!S.admin)return;
  if(!txt.trim()){alert('Tempel data diri terlebih dahulu.');return}
  const {data,recognized}=parseMemberPaste(txt);
  if(!recognized.length){alert('Data belum dikenali. Pastikan setiap baris memakai format "Nama Kolom : Isi".');return}
  Object.entries(data).forEach(([key,value])=>{if(value!==null&&value!==undefined&&value!=='')S.form[key]=String(value).toUpperCase()});
  render();
  const invalidDate=recognized.includes('lahir')&&!data.lahir;
  alert('Data berhasil dibaca ('+recognized.length+' kolom). Periksa kembali isian sebelum disimpan.'+
    (invalidDate?' Format tanggal lahir tidak dikenali; isi tanggal lahir secara manual.':'')+
    (!S.form.wilayah?' Pilih Wilayah/prefektur di Jepang sebelum menyimpan.':''));
}
async function up(file,key,multi){
  if(!file)return;if(!S.assets){alert('Unggah foto hanya tersedia untuk admin');return}
  try{const r=await S.assets.upload(file);S.form[key]=multi?[...(S.form[key]||[]),r.id]:r.id;render()}catch(e){console.error(e);alert('Gagal mengunggah file: '+(e.message||'periksa koneksi dan ukuran file'))}}
function pick(label,acc,cap,cb){const i=h('input',{type:'file',accept:acc,style:'display:none'});if(cap)i.setAttribute('capture','environment');i.onchange=()=>cb(i.files[0]);return h('button',{class:'btn s',onclick:()=>i.click()},label)}
async function saveForm(){
  const f=S.form;
  if(!(f.nama||'').trim()){alert('Nama lengkap wajib diisi.');return}
  if(!f.wilayah){alert('Wilayah atau prefektur di Jepang wajib dipilih.');return}
  const d={...f};delete d.id;Object.keys(d).forEach(key=>{if(typeof d[key]==='string'&&!['foto'].includes(key))d[key]=d[key].toUpperCase()});d.peran=d.peran||'ANGGOTA';d.status=d.status||'AKTIF';
  try{if(f.id)await S.db.collection('members').doc(f.id).set(d);else await S.db.collection('members').add({...d,at:Date.now()});S.form=null;render()}catch(e){console.error(e);alert('Tidak bisa menyimpan: '+(e.message||'periksa koneksi dan izin database'))}}
function memberFormCard(){
  const f=S.form;
  if(!f.id&&!f.kode){
    const n=Math.max(S.members.length,...S.members.map(member=>parseInt(String(member.kode||'').split('-').pop())||0))+1;
    f.kode='IJCCS-'+String(n).padStart(4,'0');
  }
  const years=Array.from({length:12},(_,index)=>String(new Date().getFullYear()-index));
  const fieldGrid=(...fields)=>h('div',{class:'member-form-grid'},...fields);
  const auto=()=>{
    const text=h('textarea',{rows:8,placeholder:'1. Nama Lengkap : Nama Anda\n2. Jenis Kelamin : laki-laki\n3. Tgl/bln/thn lahir : 20-04-1987\n4. Umur : 40\n5. Kelompok, Desa, Daerah di Indonesia : kelompok, desa, daerah\n6. No. Hp Pengurus Daerah + Nama : nomor + nama\n7. Status (lajang/menikah) : menikah\n8. MT (iya/bukan) : bukan\n9. Mulai Tinggal di Jepang : 22-09-2026\n10. Alamat Tinggal di Jepang : jotocho marugame\n11. Status Visa : tokuteginou 1\n12. No. HP/WA : nomor WhatsApp\n13. Facebook : nama akun\n14. No. HP Orang Tua + Nama : nomor + nama\n15. Foto Surat Sambung :\n16. Foto Setengah Badan (terbaru) :'});
    return box(h('div',{class:'member-section-heading'},h('div',{},h('b',{},'Isi dari teks salinan'),h('small',{},'Tempel data diri untuk mengisi kolom secara otomatis.')),h('span',{},'✨')),
      text,h('button',{class:'btn s',onclick:()=>autoFill(text.value)},'Isi Otomatis'),
      h('p',{class:'warn'},'Data diproses langsung di perangkat ini. Foto dan Surat Sambung diunggah terpisah. Periksa kembali hasilnya sebelum menyimpan.'));
  };
  const photoBox=()=>box(h('b',{},'Foto Setengah Badan (terbaru)'),
    f.foto&&h('img',{src:'/_blob/'+f.foto,style:'width:88px;height:88px;border-radius:18px;object-fit:cover;display:block;margin:10px 0'}),
    h('div',{class:'fl'},pick('📷 Ambil foto','image/jpeg,image/png,image/webp',1,file=>up(file,'foto')),pick('Pilih foto','image/jpeg,image/png,image/webp',0,file=>up(file,'foto'))));
  const documentBox=()=>box(h('b',{},'Foto Surat Sambung'),
    ...(f.surat||[]).map((id,index)=>h('div',{class:'member-file-row'},h('a',{href:'/_blob/'+id,target:'_blank'},'📎 Lampiran '+(index+1)),h('button',{class:'btn s',onclick:()=>{f.surat=f.surat.filter(value=>value!==id);render()}},'Hapus'))),
    h('div',{class:'fl'},pick('📷 Ambil / foto dokumen','image/*,application/pdf',1,file=>up(file,'surat',1)),pick('Pilih dokumen','image/*,application/pdf',0,file=>up(file,'surat',1))),
    h('small',{class:'member-help'},'Bisa menambahkan lebih dari satu foto atau PDF.'));
  return h('div',{class:'member-editor'},
    h('div',{class:'member-editor-heading'},h('button',{class:'btn s',onclick:()=>{S.form=null;render()}},'← Kembali'),
      h('div',{},h('p',{class:'member-eyebrow'},'DATA KOMUNITAS'),h('h1',{},f.id?'Edit data anggota':'Anggota baru'),h('p',{class:'sub'},'Lengkapi profil dalam satu halaman. Kolom bertanda * wajib diisi.'))),
    S.admin&&auto(),
    box(h('div',{class:'member-section-heading'},h('div',{},h('b',{},'Profil anggota'),h('small',{},'Identitas dan keanggotaan'))),
      fieldGrid(fld('Nama lengkap *','nama'),fld('Nama panggilan','panggilan'),fld('Nomor anggota','kode'),fld('Wilayah anggota *','wilayah',{opts:WILAYAH.map(([name])=>name),ph:'Pilih wilayah'}),fld('Jenis kelamin','kelamin',{opts:['Laki-laki','Perempuan']}),fld('Tanggal lahir','lahir',{type:'date'}),fld('Umur','umur',{type:'number'}),fld('Status anggota','status',{opts:STATUS}),fld('Peran','peran',{opts:PERAN}),fld('Status pernikahan','nikah',{opts:['Belum menikah','Menikah','Cerai']}),fld('MT','mt'),fld('Bulan kedatangan','bln',{opts:BLN}),fld('Tahun kedatangan','thn',{opts:years}),fld('Mulai tinggal di Jepang','mulai_jp',{ph:'Contoh: 22-09-2026'}))),
    box(h('div',{class:'member-section-heading'},h('div',{},h('b',{},'Kontak & keluarga'),h('small',{},'Nomor telepon, orang tua, dan media sosial'))),
      fieldGrid(fld('Nomor HP / WhatsApp','wa',{type:'tel'}),fld('Email','email',{type:'email'}),fld('Nama orang tua','ortu'),fld('Nomor HP orang tua','hp_ortu',{type:'tel'}),fld('Instagram','instagram',{ph:'@username'}),fld('TikTok','tiktok',{ph:'@username'}),fld('Facebook','facebook'))),
    box(h('div',{class:'member-section-heading'},h('div',{},h('b',{},'Asal di Indonesia'),h('small',{},'Wilayah, kelompok, dan alamat asal'))),
      fieldGrid(fld('Kelompok','kelompok'),fld('Desa / Kelurahan','desa'),fld('Daerah','daerah'),fld('Provinsi','prov',{opts:PROV,ph:'Pilih provinsi'}),fld('Kabupaten / Kota','kab'),fld('Kecamatan','kec'),fld('Alamat lengkap Indonesia','alamat_id',{area:1}))),
    box(h('div',{class:'member-section-heading'},h('div',{},h('b',{},'Alamat & pekerjaan di Jepang'),h('small',{},'Informasi tempat tinggal saat ini'))),
      fieldGrid(fld('Prefektur','pref',{opts:PREF,ph:'Pilih prefektur'}),fld('Kota','kota'),fld('Kecamatan (romaji)','kec_jp'),fld('Kode pos','kodepos',{inputmode:'numeric'}),fld('Stasiun terdekat','stasiun'),fld('Alamat jalan / gedung','alamat_jp',{area:1}),fld('Status visa','tinggal',{opts:TGL,ph:'Pilih status visa'}),fld('Bidang pekerjaan','bidang'),fld('Nama perusahaan','perusahaan'),fld('Nama pengurus daerah','pengurus'),fld('Nomor HP pengurus daerah','hp_pengurus',{type:'tel'}))),
    photoBox(),documentBox(),
    box(h('div',{class:'member-section-heading'},h('div',{},h('b',{},'Catatan tambahan'))),fld('Catatan','catatan',{area:1})),
    h('div',{class:'member-editor-actions'},h('button',{class:'btn s',onclick:()=>{S.form=null;render()}},'Batal'),h('button',{class:'btn',onclick:saveForm},f.id?'Simpan perubahan':'Simpan anggota'))
  );
}
function vAbsen(){
  const t=h('input',{placeholder:'Nama kegiatan'});
  const list=S.events.map(e=>{const a=e.hadir||[],ya=a.includes(S.uid);
    return h('div',{class:'card'},h('span',{style:'flex:1'},h('b',{},e.judul),h('small',{},a.length+' hadir')),
      h('button',{class:'btn s',onclick:()=>S.db.collection('events').doc(e.id).update({hadir:ya?a.filter(x=>x!==S.uid):[...a,S.uid]}).catch(()=>alert('Tidak bisa menyimpan'))},ya?'Batal hadir':'Hadir'),
      S.admin&&h('button',{class:'btn s',onclick:()=>{if(confirm('Hapus kegiatan?'))S.db.collection('events').doc(e.id).delete()}},'✕'))});
  return [h('h1',{},'Absensi'),h('p',{class:'sub'},'Kegiatan & kehadiran'),guard(),
    S.admin&&h('div',{class:'card',style:'display:block'},t,h('button',{class:'btn',onclick:async()=>{if(!t.value.trim())return;await S.db.collection('events').add({judul:t.value.trim(),hadir:[],at:Date.now()});t.value=''}},'Buat kegiatan')),
    list.length?list:h('p',{class:'warn'},'Belum ada kegiatan.')];
}
function vPiket(){
  const form=S.dutyForm;
  const edit=form&&form.id;
  const dateLabel=value=>value?new Date(value+'T00:00:00').toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'}):'Tanggal belum diatur';
  const assignmentsFor=duty=>Array.isArray(duty.assignments)&&duty.assignments.length?duty.assignments:[{nama:duty.nama||'',tugas:duty.tugas||''}];
  const cards=[...S.cleaningDuties].sort((a,b)=>(a.tanggal||'').localeCompare(b.tanggal||'')).map(duty=>{
    const date=duty.tanggal?new Date(duty.tanggal+'T00:00:00') : null;
    return h('article',{class:'duty-card'},
      h('div',{class:'duty-date'},date&&h('b',{},String(date.getDate()).padStart(2,'0')),h('small',{},date?date.toLocaleDateString('id-ID',{month:'short'}):'—')),
      h('div',{class:'duty-info'},h('small',{},dateLabel(duty.tanggal)),h('div',{class:'duty-assignments'},...assignmentsFor(duty).map(assignment=>
        h('div',{class:'duty-assignment'},h('b',{},assignment.nama),h('span',{},assignment.tugas))))),
      S.admin&&h('div',{class:'duty-actions'},
        h('button',{class:'btn s',title:'Edit jadwal',onclick:()=>{S.dutyForm={...duty,assignments:assignmentsFor(duty).map(assignment=>({...assignment}))};render()}},'✎ Edit'),
        h('button',{class:'btn s',title:'Hapus jadwal',onclick:async()=>{
          if(!confirm('Hapus jadwal piket tanggal '+dateLabel(duty.tanggal)+'?'))return;
          try{await S.db.collection('cleaning_duties').doc(duty.id).delete()}catch(error){console.error(error);alert('Gagal menghapus jadwal: '+(error.message||'periksa koneksi'))}
        }},'Hapus')));
  });
  let editor=null;
  if(S.admin&&form){
    form.assignments=form.assignments?.length?form.assignments:[{nama:form.nama||'',tugas:form.tugas||''}];
    const date=h('input',{type:'date'});
    date.value=form.tanggal||'';
    date.oninput=()=>{form.tanggal=date.value};
    const rows=h('div',{class:'duty-form-assignments'});
    const drawAssignments=()=>{
      rows.replaceChildren(...form.assignments.map((assignment,index)=>{
        const name=h('input',{placeholder:'Nama yang bertugas',maxlength:'120'}),task=h('input',{placeholder:'Tugas kebersihan',maxlength:'300'});
        name.value=assignment.nama||'';task.value=assignment.tugas||'';
        name.oninput=()=>{assignment.nama=name.value};
        task.oninput=()=>{assignment.tugas=task.value};
        return h('div',{class:'duty-form-assignment'},
          h('span',{class:'duty-assignment-number'},String(index+1)),
          h('div',{class:'duty-form-fields'},
            h('label',{class:'lb'},'Nama *',name),
            h('label',{class:'lb'},'Tugas *',task)),
          form.assignments.length>1&&h('button',{class:'btn s duty-remove',title:'Hapus nama dan tugas ini',onclick:()=>{form.assignments.splice(index,1);drawAssignments()}},'✕'));
      }));
    };
    drawAssignments();
    editor=box(h('b',{},edit?'Edit jadwal piket':'Tambah jadwal piket'),
      h('label',{class:'lb'},'Tanggal *',date),
      h('div',{class:'duty-form-heading'},h('b',{},'Nama dan tugas'),h('small',{},'Tambahkan satu baris untuk setiap orang yang bertugas.')),
      rows,
      h('button',{class:'btn s duty-add-person',onclick:()=>{form.assignments.push({nama:'',tugas:''});drawAssignments()}},'+ Tambah nama dan tugas'),
      h('div',{class:'fl'},
        h('button',{class:'btn',onclick:async()=>{
          const assignments=form.assignments.map(assignment=>({nama:(assignment.nama||'').trim(),tugas:(assignment.tugas||'').trim()}));
          if(!form.tanggal||assignments.some(assignment=>!assignment.nama||!assignment.tugas)){alert('Tanggal, semua nama, dan tugas wajib diisi.');return}
          const data={tanggal:form.tanggal,assignments,nama:assignments[0].nama,tugas:assignments[0].tugas,at:Date.now()};
          try{
            if(form.id)await S.db.collection('cleaning_duties').doc(form.id).update(data);
            else await S.db.collection('cleaning_duties').add(data);
            S.dutyForm=null;render();
          }catch(error){console.error(error);alert('Gagal menyimpan jadwal: '+(error.message||'periksa koneksi'))}
        }},edit?'Simpan perubahan':'Tambah jadwal'),
        h('button',{class:'btn s',onclick:()=>{S.dutyForm=null;render()}},'Batal')));
  }
  return [h('div',{class:'duty-heading'},h('div',{},h('h1',{},'Jadwal Piket'),h('p',{class:'sub'},'Bersama menjaga kebersihan tempat kita berkumpul.')),h('span',{class:'duty-count'},S.cleaningDuties.length+' jadwal')),
    S.admin&&!form&&h('button',{class:'btn duty-add',onclick:()=>{const today=new Date();S.dutyForm={tanggal:[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-'),assignments:[{nama:'',tugas:''}]};render()}},'+ Tambah jadwal'),
    editor,
    cards.length?h('div',{class:'duty-list'},...cards):h('div',{class:'duty-empty'},h('span',{},'🧹'),h('b',{},'Belum ada jadwal piket'),h('p',{},S.admin?'Tambahkan jadwal pertama untuk mulai mengatur tugas kebersihan.':'Jadwal piket yang akan datang akan tampil di sini.'))];
}
function vForum(){
  const t=h('input',{placeholder:'Judul topik'}),b=h('textarea',{placeholder:'Isi diskusi',rows:3});
  const list=S.topics.map(x=>h('div',{class:'card',style:'display:block'},h('b',{},x.judul),h('p',{class:'warn'},x.isi||''),
    S.admin&&h('button',{class:'btn s',onclick:()=>S.db.collection('topics').doc(x.id).delete()},'Hapus')));
  return [h('h1',{},'Forum'),h('p',{class:'sub'},'Diskusi anggota'),guard(),
    h('div',{class:'card',style:'display:block'},t,b,h('button',{class:'btn',onclick:async()=>{if(!t.value.trim()||!S.db)return;await S.db.collection('topics').add({judul:t.value.trim(),isi:b.value.trim(),by:S.uid,at:Date.now()});t.value='';b.value=''}},'Kirim')),
    list.length?list:h('p',{class:'warn'},'Belum ada topik.')];
}
function alamatJp(m,det){return [det?m.alamat_jp:'',m.kec_jp,m.kota,m.pref||m.wilayah,m.kodepos,'Japan'].filter(Boolean).join(', ')}
function mapMid(){const d=(S.pengaturan||[]).find(x=>x.id==='peta');return d&&d.mid}
function mapEmbedUrl(mid){return 'https://www.google.com/maps/d/embed?mid='+encodeURIComponent(mid)}
async function loadMapSettings(){
  if(!S.supabase)return;
  const {data,error}=await S.supabase.from('map_settings').select('map_mid').eq('id','main').maybeSingle();
  if(error){console.error(error);S.mapError=error.message||'Konfigurasi peta tidak dapat dibaca';S.pengaturan=[];return}
  S.mapError='';
  S.pengaturan=data?[{id:'peta',mid:data.map_mid}]:[];
}
function visitTrackingAllowed(){
  if(S.visitConsent===null){
    try{S.visitConsent=localStorage.getItem('shikoku-family:visit-consent')||'accepted'}
    catch(error){console.warn('Pilihan analitik pengunjung tidak dapat dibaca:',error);S.visitConsent='accepted'}
  }
  return S.visitConsent==='accepted';
}
async function trackSiteVisit(){
  if(!S.supabase||!S.uid||S.admin||!visitTrackingAllowed())return;
  const page='/'+String(S.view||'landing').replace(/[^a-z0-9_-]/gi,'').slice(0,80);
  const visitKey=new Date().toISOString().slice(0,10)+'|'+page;
  if(S.lastTrackedVisit===visitKey)return;
  S.lastTrackedVisit=visitKey;
  try{
    if(!S.visitLocation){
      try{S.visitLocation=JSON.parse(sessionStorage.getItem('shikoku-family:visit-location-jp-postal-v1')||'null')}catch(error){console.warn('Cache lokasi kunjungan tidak dapat dibaca:',error)}
    }
    if(!S.visitLocation){
      const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),8000);
      let response;
      try{response=await fetch('https://ipwho.is/',{signal:controller.signal,referrerPolicy:'no-referrer'})}
      finally{clearTimeout(timeout)}
      if(!response.ok)throw new Error('Layanan lokasi mengembalikan HTTP '+response.status);
      const result=await response.json();
      if(result.success===false)throw new Error(result.message||'Lokasi perkiraan tidak tersedia');
      if(String(result.country_code||'').toUpperCase()!=='JP')return;
      const postalDigits=String(result.postal||'').replace(/\D/g,'');
      if(postalDigits.length!==7)throw new Error('Kode pos perkiraan Jepang tidak tersedia');
      if(!result.country||!result.city)throw new Error('Wilayah perkiraan tidak tersedia');
      const latitude=Number(result.latitude),longitude=Number(result.longitude);
      if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||latitude<24||latitude>46.5||longitude<122||longitude>154)throw new Error('Koordinat wilayah Jepang tidak tersedia');
      S.visitLocation={
        country_code:'JP',
        country_name:String(result.country),
        region_name:String(result.region||''),
        city_name:String(result.city),
        postal_code:postalDigits.slice(0,3)+'-'+postalDigits.slice(3),
        latitude:Math.round(latitude*10)/10,
        longitude:Math.round(longitude*10)/10
      };
      try{sessionStorage.setItem('shikoku-family:visit-location-jp-postal-v1',JSON.stringify(S.visitLocation))}catch(error){console.warn('Cache lokasi kunjungan tidak dapat disimpan:',error)}
    }
    let referrer='direct';
    if(document.referrer){try{referrer=new URL(document.referrer).hostname||'direct'}catch(error){console.warn('Domain rujukan tidak dapat dibaca:',error)}}
    const {error}=await S.supabase.rpc('record_site_visit',{
      p_country_code:S.visitLocation.country_code,
      p_country_name:S.visitLocation.country_name,
      p_region_name:S.visitLocation.region_name,
      p_city_name:S.visitLocation.city_name,
      p_postal_code:S.visitLocation.postal_code,
      p_latitude:S.visitLocation.latitude,
      p_longitude:S.visitLocation.longitude,
      p_page_path:page,
      p_referrer_host:referrer
    });
    if(error)throw error;
  }catch(error){
    S.siteTrackingError=error.message||'Kunjungan tidak dapat dicatat';
    console.error('Pencatatan kunjungan gagal:',error);
    showVisitTrackingError();
  }
}
function showVisitTrackingError(){
  if($('#visit-tracking-error'))return;
  document.body.append(h('aside',{id:'visit-tracking-error',role:'status'},
    h('span',{},'Perkiraan lokasi tidak tersedia; kunjungan ini tidak tercatat.'),
    h('button',{class:'btn s',onclick:()=>$('#visit-tracking-error')?.remove()},'Tutup')));
}
function renderVisitorMap(locations){
  const container=$('#visitor-map');
  if(!container)return;
  if(!window.L){container.textContent='Peta tidak dapat dimuat. Periksa koneksi internet lalu perbarui halaman.';return}
  const bounds=L.latLngBounds([[24,122],[46.5,154]]);
  S.visitorMap=L.map(container,{minZoom:4,maxZoom:18,maxBounds:bounds,maxBoundsViscosity:1,scrollWheelZoom:true});
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
    maxZoom:19,
    attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>'
  }).addTo(S.visitorMap);
  S.visitorMap.fitBounds(bounds,{padding:[6,6]});
  locations.forEach(place=>{
    if(place.latitude==null||place.longitude==null)return;
    const latitude=Number(place.latitude),longitude=Number(place.longitude);
    if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||latitude<24||latitude>46.5||longitude<122||longitude>154)return;
    L.circleMarker([latitude,longitude],{
      radius:Math.min(16,6+Math.sqrt(place.visits)),
      color:'#fff',
      weight:2,
      fillColor:'#d9455f',
      fillOpacity:.9
    }).bindTooltip(place.postal_code,{className:'visitor-map-marker-label'}).bindPopup('<b>'+place.postal_code+'</b><br>'+place.visits+' kunjungan').addTo(S.visitorMap);
  });
}
async function loadSiteVisits(){
  if(!S.mainAdmin||!S.supabase){S.siteVisitsError='Halaman ini membutuhkan akun admin utama dan koneksi Supabase.';return}
  S.siteVisitsLoading=true;S.siteVisitsError='';render();
  try{
    const {data,error}=await S.supabase.from('site_visit_summaries').select('*').eq('country_code','JP').like('postal_code','___-____').order('visit_day',{ascending:false}).limit(1000);
    if(error)throw error;
    S.siteVisits=data||[];S.siteVisitsError='';
  }catch(error){S.siteVisitsError=error.message||'Data kunjungan tidak dapat dibaca';console.error('Data kunjungan tidak dapat dibaca:',error)}
  S.siteVisitsLoading=false;
  if(S.view==='visitor-map')render();
}
async function clearSiteVisits(){
  if(!S.mainAdmin||!S.supabase)return;
  if(!confirm('Hapus seluruh ringkasan kunjungan yang tersimpan?'))return;
  try{
    const {error}=await S.supabase.from('site_visit_summaries').delete().neq('country_code','');
    if(error)throw error;
    S.siteVisits=[];S.siteVisitsError='';render();
  }catch(error){S.siteVisitsError=error.message||'Ringkasan kunjungan tidak dapat dihapus';console.error('Ringkasan kunjungan tidak dapat dihapus:',error);render()}
}
function visitorPlaces(rows){
  const locations=new Map();
  rows.filter(row=>row.country_code==='JP'&&/^\d{3}-\d{4}$/.test(row.postal_code||'')).forEach(row=>{
    const item=locations.get(row.postal_code)||{...row,visits:0,latitude:0,longitude:0,coordinates:0};
    const count=Number(row.visits)||0;
    item.visits+=count;
    if(Number.isFinite(Number(row.latitude))&&Number.isFinite(Number(row.longitude))){
      item.latitude+=Number(row.latitude)*count;
      item.longitude+=Number(row.longitude)*count;
      item.coordinates+=count;
    }
    locations.set(row.postal_code,item);
  });
  return [...locations.values()].map(item=>({
    ...item,
    latitude:item.coordinates?Math.round(item.latitude/item.coordinates*10)/10:null,
    longitude:item.coordinates?Math.round(item.longitude/item.coordinates*10)/10:null
  })).sort((a,b)=>b.visits-a.visits);
}
function vVisitorMap(){
  if(!S.mainAdmin)return [h('p',{class:'warn'},'Halaman ini hanya dapat diakses admin utama.')];
  const rows=S.siteVisits.filter(row=>row.country_code==='JP'&&/^\d{3}-\d{4}$/.test(row.postal_code||'')),places=visitorPlaces(rows);
  const total=rows.reduce((sum,row)=>sum+(Number(row.visits)||0),0);
  const table=rows.length?h('div',{class:'visitor-visit-list'},...rows.map(row=>
    h('article',{class:'visitor-visit-row'},
      h('div',{},h('b',{},row.postal_code),h('small',{},[row.city_name,row.region_name].filter(Boolean).join(' · '))),
      h('div',{},h('span',{class:'tag'},row.visits+' kunjungan'),h('small',{},[row.page_path,row.referrer_host,row.visit_day].join(' · ')))))):
    h('div',{class:'member-empty'},h('span',{},'🇯🇵'),h('b',{},'Belum ada data kunjungan'),h('p',{},'Data lokasi Jepang akan tampil setelah pengguna yang masuk mengunjungi situs.'));
  return [
    h('div',{class:'visitor-page-heading'},h('div',{},h('h1',{},'Peta Kunjungan Jepang'),h('p',{class:'sub'},'Pencatatan otomatis untuk pengguna non-admin yang masuk. Lokasi perkiraan Jepang dikelompokkan menurut kode pos; IP tidak disimpan oleh situs, tetapi layanan ipwho.is menerima IP untuk menentukan lokasi.')),
      h('button',{class:'btn s',onclick:loadSiteVisits},'↻ Perbarui')),
    S.siteVisitsError&&h('p',{class:'warn visitor-error'},S.siteVisitsError),
    S.siteTrackingError&&h('p',{class:'warn visitor-error'},'Pencatatan kunjungan terakhir gagal: '+S.siteTrackingError),
    S.siteVisitsLoading&&h('p',{class:'warn'},'Memuat ringkasan kunjungan...'),
    h('div',{class:'stats visitor-stats'},...[
      ['Kunjungan',total],['Wilayah kode pos',places.length]
    ].map(([label,count])=>h('div',{},h('small',{},label),h('b',{},String(count)))),
    ),
    h('div',{class:'card visitor-map-card'},h('div',{id:'visitor-map',class:'visitor-japan-map',role:'application','aria-label':'Peta wilayah kode pos di Jepang'})),
    h('h2',{class:'visitor-section-title'},'WILAYAH KODE POS'),
    places.length?h('div',{class:'visitor-place-list'},...places.map(place=>
      h('article',{class:'visitor-place-row'},h('span',{class:'visitor-place-dot'},'●'),
        h('div',{},h('b',{},place.postal_code),h('small',{},[place.city_name,place.region_name].filter(Boolean).join(' · '))),
        h('strong',{},place.visits+' kunjungan')))):
      h('p',{class:'warn'},'Belum ada wilayah kode pos untuk ditampilkan di peta.'),
    h('div',{class:'visitor-section-heading'},h('h2',{},'RIWAYAT RINGKAS'),h('button',{class:'btn s visitor-clear',onclick:clearSiteVisits},'Hapus data')),
    table
  ];
}
async function loadPendingUsers(){
  if(!S.supabase||!S.mainAdmin){S.pendingUsers=[];return}
  const {data,error}=await S.supabase.from('profiles').select('id,name,email,created_at,approval_status').eq('approval_status','pending').order('created_at',{ascending:true});
  if(error){console.error(error);S.pendingUsers=[];return}
  S.pendingUsers=data||[];
}
function csvEsc(v){v=String(v==null?'':v);return(v.includes(',')||v.includes('"')||v.includes(String.fromCharCode(10)))?'"'+v.split('"').join('""')+'"':v}
async function exportMyMaps(det){
  const dl=await claude.use('downloads');if(!dl){alert('Fitur unduh belum tersedia');return}
  const rows=[['Nama','Wilayah','Alamat','Status','Kode']].concat(S.members.map((m,i)=>[m.panggilan||m.nama,m.wilayah||m.pref||'',alamatJp(m,det),m.status||'aktif',m.kode||'MEM-'+String(i+1).padStart(5,'0')]).filter(r=>r[2]&&r[2]!=='Japan').map(row=>row.map(value=>String(value).toUpperCase())));
  try{await dl.save({filename:'anggota-untuk-my-maps.csv',data:String.fromCharCode(65279)+rows.map(r=>r.map(csvEsc).join(',')).join(String.fromCharCode(10))})}catch(e){alert('Gagal mengunduh: '+(e.message||e.code||''))}}
async function saveMid(inp){
  const u=inp.value.trim(),mm=(u.match(/[?&;]mid=([^&#"'\s<>]+)/i)||[])[1]||(/^[A-Za-z0-9_-]{10,}$/.test(u)?u:'');
  if(!mm){alert('Kode tidak dikenali. Tempel kode embed (iframe) dari Google My Maps yang memuat "mid="');return}
  if(!S.mainAdmin){alert('Hanya admin utama yang dapat mengubah peta');return}
  try{
    if(S.supabase){
      const {error}=await S.supabase.from('map_settings').upsert({id:'main',map_mid:mm,updated_at:new Date().toISOString()},{onConflict:'id'});
      if(error)throw error;
      S.pengaturan=[{id:'peta',mid:mm}];
    }else await S.db.collection('pengaturan').doc('peta').set({mid:mm,at:Date.now()});
    alert('Peta disimpan');render();
  }catch(e){alert('Gagal menyimpan peta: '+(e.message||'periksa izin admin'))}}
async function clearMap(){
  if(!S.mainAdmin){alert('Hanya admin utama yang dapat menghapus peta');return}
  if(!confirm('Hapus peta dari Beranda?'))return;
  try{
    if(S.supabase){
      const {error}=await S.supabase.from('map_settings').delete().eq('id','main');
      if(error)throw error;
    }else await S.db.collection('pengaturan').doc('peta').delete();
    S.pengaturan=[];S.mapError='';alert('Peta dihapus dari Beranda');render();
  }catch(e){alert('Gagal menghapus peta: '+(e.message||'periksa izin admin'))}}
function mapEmbed(){
  const mid=mapMid();
  return mid?h('div',{},h('iframe',{src:mapEmbedUrl(mid),style:'width:100%;height:calc(100vh - 120px);min-height:520px;border:0;border-radius:18px;background:var(--line)',loading:'lazy',allow:'fullscreen',title:'Google My Maps'}),h('a',{class:'btn s',style:'display:inline-block;margin-top:10px;text-decoration:none',href:'https://www.google.com/maps/d/viewer?mid='+encodeURIComponent(mid),target:'_blank'},'🗺️ Buka di Google My Maps')):h('p',{class:'warn'},S.mapError||'Belum ada peta. Admin dapat mengatur Google My Maps melalui menu Pengaturan Peta.');
}
function vPeta(){return [mapEmbed()]}
async function setApproval(id,status){
  if(!S.supabase||!S.mainAdmin)return;
  const {error}=await S.supabase.from('profiles').update({
    approval_status:status,
    approved_at:status==='approved'?new Date().toISOString():null
  }).eq('id',id);
  if(error){alert('Gagal memperbarui persetujuan: '+error.message);return}
  await loadPendingUsers();render();
}
function vApprovals(){
  if(!S.mainAdmin)return [h('p',{class:'warn'},'Halaman ini hanya dapat diakses admin utama.')];
  const rows=S.pendingUsers.map(user=>h('div',{class:'card approval-row'},
    h('div',{style:'flex:1;min-width:0'},h('b',{},user.name||'Nama belum diisi'),h('small',{},user.email||'-'),h('small',{},new Date(user.created_at).toLocaleString('id-ID'))),
    h('div',{class:'fl'},h('button',{class:'btn',onclick:()=>setApproval(user.id,'approved')},'Setujui'),h('button',{class:'btn s',onclick:()=>setApproval(user.id,'rejected')},'Tolak'))));
  return [h('h1',{},'Persetujuan Akun'),h('p',{class:'sub'},'Pendaftar baru menunggu persetujuan admin.'),...(rows.length?rows:[h('p',{class:'warn'},'Tidak ada pendaftar yang menunggu persetujuan.')])];
}
function vPetaSettings(){
  const mid=mapMid(),det=h('input',{type:'checkbox'}),inp=h('textarea',{rows:4,placeholder:'Tempel kode embed (iframe) dari Google My Maps'});
  inp.value=mid?mapEmbedUrl(mid):'';
  const ready=S.members.filter(m=>{const a=alamatJp(m,false);return a&&a!=='Japan'}).length;
  return [h('h1',{},'Peta Wilayah'),h('p',{class:'sub'},ready+' dari '+S.members.length+' anggota punya alamat Jepang untuk dijadikan pin'),
    S.mainAdmin&&box(h('b',{},'Pasang & perbarui peta'),
      h('p',{class:'warn'},'1) Unduh CSV. 2) Buka mymaps.google.com, buat peta baru, pilih Impor, lalu unggah CSV. 3) Pilih kolom Alamat untuk posisi pin dan kolom Nama untuk judul. 4) Atur peta agar bisa dilihat publik. 5) Di My Maps klik menu titik tiga di samping judul peta, pilih "Sematkan di situs saya", salin kode HTML-nya, lalu tempel di kotak di bawah.'),
      h('label',{class:'warn',style:'display:block;margin:8px 0'},det,' Sertakan alamat jalan/gedung (lebih tepat, tetapi lebih sensitif)'),
      h('button',{class:'btn',style:'margin-bottom:10px',onclick:()=>exportMyMaps(det.checked)},'⬇️ Unduh CSV untuk My Maps ('+ready+' pin)'),
      inp,h('div',{class:'fl'},h('button',{class:'btn',onclick:()=>saveMid(inp)},'Simpan peta'),h('button',{class:'btn s',onclick:clearMap},'Hapus peta dari Beranda'))),
    h('b',{style:'display:block;margin:6px 4px 10px'},'Sebaran per wilayah'),...sebaran()];
}
const ISL=['141.9,45.5 142.9,44.7 144.7,44 145.3,44.35 144.9,43.6 145.8,43.35 144.4,42.95 143.25,41.93 141.7,42.6 140.97,42.3 140.6,42.55 140.4,42.1 140.1,41.4 140.3,42.9 140.35,43.35 141,43.2 141.6,43.9 141.7,45.4','140.9,41.5 141.4,41.4 141.5,40.5 142,39.6 141.6,38.9 141.5,38.3 141,38.2 141,37 140.6,36.4 140.87,35.7 140.1,35.5 139.8,35.6 139.65,35.4 139.6,35.15 139.15,35.25 138.85,34.6 138.85,35.1 138.2,34.6 137.7,34.65 137,34.6 136.9,35 136.8,34.5 136.9,34.3 136.2,33.45 135.77,33.43 135.15,33.85 135.4,34.6 134.7,34.75 133.95,34.55 132.4,34.3 131.4,33.95 130.9,33.95 131.4,34.4 132.1,34.9 133,35.5 134.2,35.55 135.3,35.5 136.1,35.65 136.1,36.1 136.6,36.6 137.35,37.5 137.2,36.8 138.2,37.2 139.05,37.95 139.8,38.95 140,39.7 139.7,39.95 140,40.2 139.9,40.8 140.35,41.25','134.65,34.2 134,34.35 133,34.1 132.7,33.85 132.4,33.45 132,33.35 132.5,33.2 132.7,32.95 133,32.72 133.3,33.4 133.55,33.5 134.18,33.25 134.35,33.6 134.6,34.05','130.95,33.95 131.65,33.25 131.9,32.95 131.45,31.9 130.65,31 130.2,31.15 130.2,32 130,32.3 130.5,32.75 129.85,32.75 129.7,33.15 129.9,33.5 130.4,33.6'];
const px=(o,a)=>[(o-128)*31.7,(46-a)*40];
function sv(t,p,...k){const e=document.createElementNS('http://www.w3.org/2000/svg',t);for(const a in p)e.setAttribute(a,p[a]);k.forEach(c=>e.append(c));return e}
async function geo(txt,b,full){
  const sm=await claude.use('sample');if(!sm){alert('Fitur otomatis belum tersedia. Ketuk peta untuk menaruh pin.');return}
  if(!(txt||'').trim())return;b.disabled=true;b.textContent='Memproses...';
  try{const r=await sm.json('Dari teks berikut, tentukan lokasi di Jepang. Balas HANYA JSON: {"nama":"","alamat":"alamat lengkap rapi","lat":angka,"lng":angka}. lat/lng = perkiraan koordinat terbaik (desimal) dari alamat/kode pos/kota. Kosongkan nama jika tidak ada.\n\nTeks:\n'+txt),d=S.dp;
    if(full&&r.nama)d.nama=r.nama;if(full&&r.alamat)d.alamat=r.alamat;
    if(isFinite(r.lat)&&isFinite(r.lng)&&r.lat!==null){d.lat=String(r.lat);d.lng=String(r.lng)}else alert('Posisi tidak ditemukan. Ketuk peta untuk menaruh pin.')}
  catch(e){alert('Gagal memproses')}
  render()}
function vPetaLegacy(){
  const d=S.dp=S.dp||{nama:'',alamat:'',lat:'',lng:''},vb=S.vb=S.vb||[0,0,572,640],pins=S.pins||[];
  const svg=sv('svg',{viewBox:vb.join(' '),style:'width:100%;height:min(70vh,560px);background:#dcecf5;border-radius:18px;touch-action:none;display:block'});
  ISL.forEach(s=>svg.append(sv('path',{d:'M'+s.split(' ').map(q=>px(...q.split(',').map(Number)).join(',')).join('L')+'Z',fill:'#f5f1e6',stroke:'#8fb4c9','stroke-width':1.5,'pointer-events':'none'})));
  const r=7*vb[2]/572,dot=(la,ln,c,id,t)=>{const[x,y]=px(+ln,+la),e=sv('circle',{cx:x,cy:y,r:r,fill:c,stroke:'#fff','stroke-width':r/4});if(id)e.dataset.id=id;if(t)e.append(sv('title',{},t));svg.append(e)};
  pins.forEach(p=>isFinite(p.lat)&&dot(p.lat,p.lng,S.sp===p.id?'#17324d':'#d9455f',p.id,p.nama));
  if(d.lat!==''&&d.lng!==''&&isFinite(d.lat)&&isFinite(d.lng))dot(d.lat,d.lng,'#f59e0b',null,'Posisi baru');
  let dn=null;
  svg.onpointerdown=e=>{dn={x:e.clientX,y:e.clientY,m:false}};
  svg.onpointermove=e=>{if(!dn)return;const dx=e.clientX-dn.x,dy=e.clientY-dn.y;if(!dn.m&&Math.hypot(dx,dy)<6)return;dn.m=true;const k=vb[2]/svg.clientWidth;vb[0]-=dx*k;vb[1]-=dy*k;dn.x=e.clientX;dn.y=e.clientY;svg.setAttribute('viewBox',vb.join(' '))};
  svg.onpointerup=e=>{const m=dn&&dn.m;dn=null;if(m)return;const id=e.target.dataset&&e.target.dataset.id;if(id){S.sp=id;render();return}
    const q=svg.createSVGPoint();q.x=e.clientX;q.y=e.clientY;const z=q.matrixTransform(svg.getScreenCTM().inverse());
    d.lng=(z.x/31.7+128).toFixed(4);d.lat=(46-z.y/40).toFixed(4);render()};
  svg.onpointerleave=()=>{dn=null};
  const zoom=f=>{const cx=vb[0]+vb[2]/2,cy=vb[1]+vb[3]/2;vb[2]*=f;vb[3]*=f;vb[0]=cx-vb[2]/2;vb[1]=cy-vb[3]/2;render()};
  const bind=(k,e)=>{e.value=d[k];e.oninput=()=>{d[k]=e.value};return e};
  const ta=h('textarea',{rows:3,placeholder:'Tempel teks apa saja: alamat Jepang, nama tempat, kode pos...'}),ab=h('button',{class:'btn s',style:'margin-top:8px',onclick:()=>geo(ta.value,ab,true)},'Isi otomatis');
  const cb=h('button',{class:'btn s',onclick:()=>geo(d.alamat,cb,false)},'Cari posisi dari alamat');
  const sp=pins.find(p=>p.id===S.sp);
  return [h('h1',{},'Peta Wilayah'),h('p',{class:'sub'},pins.length+' pin. Geser untuk menggeser peta, ketuk untuk menaruh pin baru.'),guard(),
    h('div',{class:'card',style:'display:block;padding:8px'},svg,
      h('div',{class:'fl'},h('button',{class:'btn s',onclick:()=>zoom(.6)},'+'),h('button',{class:'btn s',onclick:()=>zoom(1/.6)},'\u2212'),h('button',{class:'btn s',onclick:()=>{S.vb=null;render()}},'Seluruh Jepang'),h('button',{class:'btn s',onclick:()=>{S.vb=[190,330,180,200];render()}},'Shikoku')),
      sp&&h('p',{class:'warn'},h('b',{},sp.nama),' \u00b7 ',sp.alamat||'')),
    S.admin&&box(h('b',{},'Alamat otomatis'),ta,ab),
    S.admin&&box(h('b',{},'Tambah pin (manual)'),h('label',{class:'lb'},'Nama',bind('nama',h('input',{}))),h('label',{class:'lb'},'Alamat',bind('alamat',h('textarea',{rows:2}))),
      h('div',{class:'fl'},h('label',{class:'lb',style:'flex:1'},'Lintang',bind('lat',h('input',{inputmode:'decimal'}))),h('label',{class:'lb',style:'flex:1'},'Bujur',bind('lng',h('input',{inputmode:'decimal'})))),
      h('p',{class:'warn'},'Posisi otomatis hanya perkiraan. Ketuk peta untuk menggeser posisi yang tepat.'),
      h('div',{class:'fl'},cb,h('button',{class:'btn',onclick:async()=>{if(!S.db)return alert('Database belum aktif');if(!d.nama.trim())return alert('Nama wajib diisi');if(!isFinite(d.lat)||!isFinite(d.lng)||d.lat===''||d.lng==='')return alert('Posisi belum ada. Ketuk peta atau cari dari alamat');
        try{await S.db.collection('pin').add({nama:d.nama.trim(),alamat:d.alamat.trim(),lat:+d.lat,lng:+d.lng,at:Date.now()});S.dp=null;render()}catch(e){alert('Gagal menyimpan')}}},'Simpan pin'))),
    h('b',{style:'display:block;margin:6px 4px 10px'},'Daftar pin'),
    ...(pins.length?pins.map(p=>h('div',{class:'card'},h('span',{style:'flex:1;min-width:0'},h('b',{},p.nama),h('small',{},p.alamat||'')),h('button',{class:'btn s',onclick:()=>{const[x,y]=px(p.lng,p.lat);S.vb=[x-90,y-100,180,200];S.sp=p.id;render()}},'Lihat'),S.admin&&h('button',{class:'btn s',onclick:()=>{if(confirm('Hapus pin ini?'))S.db.collection('pin').doc(p.id).delete()}},'\u2715'))):[h('p',{class:'warn'},'Belum ada pin.')]),
    h('b',{style:'display:block;margin:6px 4px 10px'},'Sebaran per wilayah'),...sebaran()];
}
function sebaran(){const w=wilayah(),k=Object.keys(w);return k.length?k.map(n=>h('div',{class:'card',style:'display:block'},h('div',{class:'row'},h('b',{},'📍 '+n.toUpperCase()),h('span',{class:'tag'},w[n].length+' anggota')),h('small',{},w[n].map(x=>(x.nama||'').toUpperCase()).join(', ')))):[h('p',{class:'warn'},'Belum ada data wilayah.')]}
function vImport(){
  const ta=h('textarea',{rows:8,placeholder:'Satu baris satu anggota:\nnama,wilayah\nBudi,Ehime\nSiti,Kagawa'});
  return [h('h1',{},'Import Database'),h('p',{class:'sub'},'Tempel data CSV (nama,wilayah)'),
    h('div',{class:'card',style:'display:block'},ta,h('button',{class:'btn',onclick:async()=>{
      const rows=ta.value.split('\n').map(r=>r.split(',').map(x=>x.trim())).filter(r=>r[0]);
      for(const r of rows)await S.db.collection('members').add({nama:r[0].toUpperCase(),wilayah:(r[1]||'').toUpperCase(),at:Date.now()});
      ta.value='';alert(rows.length+' anggota diimpor');go('members')}},'Import'))];
}

const V={landing:vHome,dash:vDash,members:vMembers,absen:vAbsen,piket:vPiket,peta:vPeta,forum:vForum,import:vImport,'map-settings':vPetaSettings,'visitor-map':vVisitorMap,approvals:vApprovals,pesan:vPesan};
function renderDrawer(){
  const d=$('#dr');
  if(S.adminMenuOpen){
    d.replaceChildren(
      h('p',{class:'sub',style:'padding:0 14px'},h('b',{style:'color:var(--ink)'},'PENGATURAN ADMIN'),h('br'),'Pengelolaan situs'),
      ...ADMIN_MENU.map(([view,label])=>h('a',{class:S.view===view?'on':'',onclick:()=>{go(view);if(view==='visitor-map')loadSiteVisits()}},label)),
      h('button',{class:'menu-logout',onclick:()=>go('landing')},'← Kembali ke menu utama')
    );
    return;
  }
  d.replaceChildren(h('p',{class:'sub',style:'padding:0 14px'},h('b',{style:'color:var(--ink)'},'KOMUNITAS ID-JP'),h('br'),'Database Anggota'),
    ...ALL.filter(x=>!x[2]||(x[3]?S.mainAdmin:S.admin)).map(x=>h('a',{class:S.view===x[0]?'on':'',onclick:()=>go(x[0]),...(x[0]==='pesan'?{'data-message-nav':'true'}:{})},
      x[1],x[0]==='pesan'&&S.unreadMessages>0&&h('span',{class:'nav-badge'},String(S.unreadMessages)))),
    h('button',{class:'menu-logout',onclick:async()=>{await S.supabase.auth.signOut()}},'🚪 Keluar'));
}
function render(){
  if(S.visitorMap){S.visitorMap.remove();S.visitorMap=null}
  if(!S.mainAdmin)S.adminMenuOpen=false;
  syncAdminTheme();
  if(S.authLoading){
    $('#dr').replaceChildren();
    $('#app').replaceChildren(h('p',{class:'warn',style:'text-align:center;padding:40px 16px'},'Memeriksa sesi login...'));
    $('#tb').style.display='none';
    $('#pet').style.display='none';
    $('#sw').style.display='none';
    return;
  }
  if(S.supabase&&!S.uid){
    $('#dr').replaceChildren();
    $('#app').replaceChildren(h('div',{class:'landing'},h('section',{class:'hero'},
      h('p',{style:'font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-bottom:10px'},'SHIKOKU FAMILY'),
      h('h1',{},'Selamat datang 👋'),
      h('p',{},'Silakan masuk atau buat akun untuk bergabung dan menerima balasan dari admin.'),
      accountForm()
    )));
    $('#tb').style.display='none';
    $('#pet').style.display='none';
    $('#sw').style.display='none';
    document.body.classList.remove('open');
    return;
  }
  renderDrawer();
  $('#sw').style.display=S.mainAdmin?'flex':'none';
  const approvalBadge=$('#ab');
  if(approvalBadge){
    approvalBadge.textContent=S.pendingUsers.length?String(S.pendingUsers.length):'';
    approvalBadge.style.display=S.pendingUsers.length?'inline-grid':'none';
  }
  const current=ALL.find(x=>x[0]===S.view);
  if(!V[S.view]||['map-settings','visitor-map','approvals'].includes(S.view)&&!S.mainAdmin||current?.[2]&&!S.admin)S.view='landing';
  $('#app').replaceChildren(...[].concat(V[S.view]()).filter(Boolean));
  if(S.view==='visitor-map')renderVisitorMap(visitorPlaces(S.siteVisits));
  trackSiteVisit();
  const tb=$('#tb');tb.style.display=S.form?'none':'flex';$('#pet').style.display=S.form?'none':'block';
  tb.replaceChildren(...[['landing','🏠','Home'],['dash','📊','Ringkasan'],['members','👥','Anggota'],['absen','📝','Absensi'],['piket','🧹','Piket'],['forum','💬','Forum']].map(x=>h('a',{class:S.view===x[0]?'on':'',onclick:()=>go(x[0])},h('span',{},x[1]),x[2])));
}
function sub(name,key){
  S.db.collection(name).onSnapshot(s=>{
    const next=s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.at||0)-(b.at||0));
    const previous=JSON.stringify(S[key]||[]);
    S[key]=next;
    if(JSON.stringify(next)!==previous)render();
  },()=>{})
}
render();
(async()=>{
  try{S.uid=localStorage.getItem('uid');if(!S.uid){S.uid='u'+Math.random().toString(36).slice(2)+Date.now().toString(36);localStorage.setItem('uid',S.uid)}}catch(e){S.uid='u'+Math.random().toString(36).slice(2)}
  try{S.assets=await claude.use('assets')}catch(e){}
  try{S.db=await claude.use('db')}catch(e){}
  if(!S.db)S.db=createLocalDb();
  if(window.supabase&&window.SUPABASE_CONFIG?.url&&window.SUPABASE_CONFIG?.anonKey){
    S.supabase=window.supabase.createClient(window.SUPABASE_CONFIG.url,window.SUPABASE_CONFIG.anonKey);
    const applySession=async session=>{
      if(!session?.user&&S.messageChannel){
        await S.supabase.removeChannel(S.messageChannel);
        S.messageChannel=null;
      }
      S.uid=session?.user?.id||null;S.email=session?.user?.email||'';S.admin=false;S.mainAdmin=false;S.approvalStatus='approved';
      if(session?.user){
        const {data:profile}=await S.supabase.from('profiles').select('name,role,is_main_admin,approval_status').eq('id',session.user.id).maybeSingle();
        S.admin=profile?.role==='admin';S.name=profile?.name||session.user.email||'';
        S.mainAdmin=S.admin&&profile?.is_main_admin===true;
        S.approvalStatus=profile?.approval_status||'pending';
        await loadMessages();
        await subscribeToMessages();
      }
      await loadMapSettings();
      await loadPendingUsers();
      S.authLoading=false;render();
    };
    const {data:{session}}=await S.supabase.auth.getSession();
    await applySession(session);
    S.supabase.auth.onAuthStateChange((_event,next)=>{applySession(next)});
    setInterval(()=>{if(S.uid)loadMessages();if(S.mainAdmin)loadPendingUsers()},30000);
  }else S.authLoading=false;
  sub('members','members');sub('events','events');sub('topics','topics');sub('cleaning_duties','cleaningDuties');if(!S.supabase)sub('pengaturan','pengaturan');sub('pin','pins');
  render();
})();

function vPesan(){
  if(!S.uid)return [h('h1',{},'Pesan Masuk'),accountForm()];
  const groups=conversationGroups();
  if(S.admin&&!S.openConversation){
    const cards=groups.length?groups.map(group=>{
      const unread=conversationUnread(group);
      return h('button',{class:'conversation-row',onclick:()=>{S.openConversation=group.key;markMessagesRead(group)}},
        h('div',{class:'chat-avatar'},(group.name||'?')[0].toUpperCase()),
        h('div',{style:'min-width:0;flex:1;text-align:left'},h('b',{},group.name)),
        unread>0&&h('span',{class:'conversation-badge'},String(unread)));
    }):[h('p',{class:'warn'},'Belum ada percakapan.')];
    return [h('h1',{},'Pesan Masuk'),h('p',{class:'sub'},groups.length+' user'),...cards];
  }
  const group=S.admin?groups.find(item=>item.key===S.openConversation):groups[0];
  if(!group)return [h('h1',{},'Pesan Saya'),h('p',{class:'warn'},'Belum ada percakapan.')];
  const messages=group.messages;
  const entries=[];
  messages.forEach(message=>{
    entries.push({at:message.at||0,incoming:S.admin,message:message.teks||'',attachments:message.attachments||[]});
    (S.replies||[]).filter(reply=>reply.message_id===message.id).forEach(reply=>{
      entries.push({at:reply.at||0,incoming:reply.by!==S.uid,message:reply.teks||'',attachments:reply.attachments||[]});
    });
  });
  entries.sort((a,b)=>a.at-b.at);
  const chatBody=h('div',{class:'chat-body'},...entries.map(entry=>h('div',{class:'chat-line '+(entry.incoming?'incoming':'outgoing')},
    h('div',{class:'chat-bubble'},entry.message,...entry.attachments.map(attachmentView).filter(Boolean)))));
  let swipeStartX=0,swipeStartY=0;
  chatBody.ontouchstart=e=>{swipeStartX=e.changedTouches[0].clientX;swipeStartY=e.changedTouches[0].clientY};
  chatBody.ontouchend=e=>{
    const dx=e.changedTouches[0].clientX-swipeStartX,dy=e.changedTouches[0].clientY-swipeStartY;
    if(dx>80&&Math.abs(dx)>Math.abs(dy)){
      chatBody.classList.add('swipe-back');
      setTimeout(()=>{S.openConversation=null;render()},220);
    }
  };
  requestAnimationFrame(()=>{chatBody.scrollTop=chatBody.scrollHeight});
  const cards=[
    h('div',{class:'conversation-toolbar'},
      h('b',{},group.name)),
    h('section',{class:'chat-card'},
      chatBody,
      replyBox(messages[messages.length-1].id))
  ];
  return cards;
}
/* ===== maskot: gambar diam, bisa digeser, ketuk untuk tanya admin ===== */
const ADMIN_WA=''; /* isi nomor WhatsApp admin, contoh: 6281234567890 */
const pet=$('#pet');let drag=null;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function closeMenu(){const m=$('#pm');if(m)m.remove()}
function askForm(){
  closeMenu();
  if(!S.uid){alert('Silakan daftar atau login terlebih dahulu agar dapat menerima balasan admin.');go('pesan');return}
  const nama=h('input',{placeholder:'Nama lengkap',autocomplete:'name'});
  nama.value=S.name||'';
  const ta=h('textarea',{rows:5,placeholder:'Tulis pertanyaan untuk admin...',autocomplete:'off'});
  const picker=attachmentPicker();
  const askMenu=h('div',{class:'attachment-menu'},picker.buttons);
  const askPlus=h('button',{class:'composer-plus',type:'button',title:'Lampiran',onclick:()=>askMenu.classList.toggle('open')},'+');
  const m=h('div',{id:'qm'},h('div',{class:'card',style:'display:block;max-width:420px'},
    h('b',{},'💬 Tanya Admin'),
    h('p',{class:'warn',style:'margin:4px 0 2px'},'Sampaikan pertanyaan Anda. Admin akan membalasnya.'),
    h('label',{class:'lb'},'Nama lengkap *',nama),
    h('label',{class:'lb'},'Pertanyaan *',ta),
    askMenu,askPlus,picker.label,
    h('div',{class:'row',style:'justify-content:flex-start;margin-top:8px'},
      h('button',{class:'btn',onclick:async()=>{
        if(!nama.value.trim()||(!ta.value.trim()&&!picker.files.length)){alert('Nama dan pertanyaan atau lampiran wajib diisi');return}
        if(!S.supabase){alert('Supabase belum tersedia');return}
        try{
          const namaValue=nama.value.trim();
          const attachments=await uploadMessageFiles(picker.files);
          await submitMessage({nama:namaValue,teks:ta.value.trim(),attachments});
          S.name=namaValue;m.remove();
          await loadMessages();
          alert('Pertanyaan terkirim dan sudah masuk ke Pesan Masuk.');
        }catch(e){
          console.error(e);
          alert('Gagal mengirim: '+(e.message||'periksa koneksi Supabase'));
        }
      }},'Kirim pertanyaan'),
      h('button',{class:'btn s',onclick:()=>m.remove()},'Batal'))));
  document.body.append(m);ta.focus()}
function openMenu(){
  if($('#pm'))return closeMenu();
  document.body.append(h('div',{id:'pm'},h('b',{},'Mau tanya apa? 😊'),
    h('button',{class:'btn',onclick:askForm},'✍️ Tulis pertanyaan ke Admin'),
    ADMIN_WA&&h('a',{class:'btn s',href:'https://wa.me/'+ADMIN_WA+'?text='+encodeURIComponent('Halo Admin, saya mau bertanya...'),target:'_blank'},'📲 Chat WhatsApp Admin'),
    h('button',{class:'btn s',onclick:closeMenu},'Tutup')))}
pet.addEventListener('pointerdown',e=>{const r=pet.getBoundingClientRect();drag={x:e.clientX,y:e.clientY,l:r.left,t:r.top,m:false};try{pet.setPointerCapture(e.pointerId)}catch(_){}});
pet.addEventListener('pointermove',e=>{
  if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
  if(!drag.m){if(Math.hypot(dx,dy)<8)return;drag.m=true;closeMenu();pet.style.right=pet.style.bottom='auto'}
  pet.style.left=clamp(drag.l+dx,0,innerWidth-pet.offsetWidth)+'px';pet.style.top=clamp(drag.t+dy,60,innerHeight-pet.offsetHeight-4)+'px'});
pet.addEventListener('pointerup',()=>{if(!drag)return;const moved=drag.m;drag=null;if(!moved)openMenu()});
pet.addEventListener('pointercancel',()=>{drag=null});
addEventListener('resize',()=>{if(pet.style.left){pet.style.left=clamp(pet.offsetLeft,0,innerWidth-pet.offsetWidth)+'px';pet.style.top=clamp(pet.offsetTop,60,innerHeight-pet.offsetHeight-4)+'px'}});
