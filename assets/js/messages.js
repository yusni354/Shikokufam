/* Pesan ke admin: muat, kirim, balas, lampiran, tampilan percakapan */
function messageFromRow(row){return {id:row.id,nama:row.name,teks:row.message,attachments:row.attachments||[],at:new Date(row.created_at).getTime(),status:row.status,sender_id:row.sender_id,recipient_id:row.recipient_id||null}}
function replyFromRow(row){return {id:row.id,message_id:row.message_id,by:row.sender_id,teks:row.message,attachments:row.attachments||[],at:new Date(row.created_at).getTime()}}
/* Penyimpanan pesan mode lokal (tanpa Supabase): baris berbentuk sama seperti tabel Supabase */
const LOCAL_MESSAGES_KEY='shikoku-family:messages';
const LOCAL_REPLIES_KEY='shikoku-family:message-replies';
/* Cermin baris pesan di ingatan, untuk lingkungan dengan localStorage
   terblokir (pratinjau artefak): pesan lokal tetap bekerja selama sesi. */
const memoryMessageRows={};
function localMessageRows(key){
  try{
    const raw=localStorage.getItem(key);
    if(raw!==null)return JSON.parse(raw)||[];
  }catch(e){}
  return memoryMessageRows[key]||[];
}
function saveLocalMessageRows(key,rows){
  memoryMessageRows[key]=rows;
  try{localStorage.setItem(key,JSON.stringify(rows))}catch(e){/* penyimpanan terblokir: baris tetap tersimpan di ingatan untuk sesi ini */}
}
function newLocalRowId(prefix){return prefix+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8)}
function updateMessageBadges(){
  const value=String(S.unreadMessages||0);
  document.querySelectorAll('[data-message-badge]').forEach(badge=>{
    badge.textContent=value;
    badge.style.display=S.unreadMessages>0?'':'none';
  });
  /* Lencana menu Pesan hidup pada item Pesan di drawer
     (data-message-nav). Ia disinkronkan di sini supaya pesan baru yang
     tiba lewat realtime langsung menaikkan angkanya tanpa menggambar
     ulang halaman. */
  const syncBadge=(anchor,badgeClass)=>{
    if(!anchor)return;
    let badge=anchor.querySelector('.'+badgeClass);
    if(S.unreadMessages>0&&!badge){badge=h('span',{class:badgeClass},value);anchor.append(badge)}
    if(badge){badge.textContent=value;badge.style.display=S.unreadMessages>0?'':'none'}
  };
  syncBadge(document.querySelector('[data-message-nav]'),'nav-badge');
}
function userMessageSeen(){
  try{return JSON.parse(localStorage.getItem('shikoku-family:message-seen:'+S.uid)||'{}')}catch(e){return {}}
}
function incomingMessageItems(){
  /* Pesan masuk bagi saya = pesan pokok yang TIDAK saya kirim (pesan
     langsung yang ditujukan ke saya, atau pesan Tanya Admin bila saya
     admin) + balasan dari orang lain. loadMessages hanya memuat pesan
     yang melibatkan saya, jadi setiap pesan pokok dari orang lain
     memang ditujukan ke saya. */
  const roots=(S.tanya||[]).filter(message=>message.sender_id!==S.uid);
  const replies=(S.replies||[]).filter(reply=>reply.by!==S.uid);
  return [...roots,...replies];
}
/* Kunci lawan bicara sebuah pesan pokok:
   - pesan langsung (recipient_id terisi): akun di seberang saya;
   - pesan tanpa penerima (Tanya Admin dari Home/maskot): bagi admin
     kuncinya pengirim, bagi pengirim kuncinya 'admin' (kotak "Admin"). */
const ADMIN_CHAT_KEY='admin';
function conversationKeyOf(message){
  if(message.recipient_id)return message.sender_id===S.uid?message.recipient_id:message.sender_id;
  if(S.admin)return message.sender_id||'unknown-'+(message.nama||'');
  return ADMIN_CHAT_KEY;
}
function directoryUser(id){return (S.userDirectory||[]).find(user=>user.id===id)||null}
/* Data anggota (foto & wilayah) untuk akun direktori dicocokkan lewat
   email yang sama — hanya memperkaya tampilan daftar, bukan penentu
   penerima pesan (penerima selalu id akun). */
function memberForUser(user){
  if(!user||!user.email)return null;
  const email=String(user.email).toLowerCase();
  return (S.members||[]).find(member=>String(member.email||'').toLowerCase()===email)||null;
}
function conversationGroups(){
  const groups=[],byKey=new Map();
  (S.tanya||[]).forEach(message=>{
    const key=conversationKeyOf(message);
    let group=byKey.get(key);
    if(!group){
      group={key,messages:[],name:'Anggota',photoMember:null,photoUrl:'',region:''};
      if(key===ADMIN_CHAT_KEY)group.name='Admin';
      else{
        const user=directoryUser(key);
        if(user){
          group.name=user.name||'Anggota';
          group.photoUrl=user.avatar_url||'';
          const member=memberForUser(user);
          if(member){if(member.foto)group.photoMember=member;group.region=typeof memberRegion==='function'?memberRegion(member):''}
        }
        if(message.sender_id===key&&message.nama)group.name=message.nama;
      }
      byKey.set(key,group);groups.push(group);
    }
    group.messages.push(message);
  });
  groups.forEach(group=>{group.last=conversationLastEntry(group)});
  groups.sort((a,b)=>((b.last?b.last.at:0)-(a.last?a.last.at:0)));
  return groups;
}
function conversationEntries(group){
  const entries=[];
  group.messages.forEach(message=>{
    entries.push({at:message.at||0,mine:message.sender_id===S.uid,teks:message.teks||'',attachments:message.attachments||[]});
    (S.replies||[]).filter(reply=>reply.message_id===message.id).forEach(reply=>{
      entries.push({at:reply.at||0,mine:reply.by===S.uid,teks:reply.teks||'',attachments:reply.attachments||[]});
    });
  });
  entries.sort((a,b)=>a.at-b.at);
  return entries;
}
function conversationLastEntry(group){
  const entries=conversationEntries(group);
  return entries.length?entries[entries.length-1]:null;
}
function conversationAvatar(group){
  if(group.photoMember)return h('img',{class:'chat-avatar',...memberMediaAttributes(group.photoMember.foto,'src'),alt:'Foto '+(group.name||'lawan bicara')});
  if(group.photoUrl)return h('img',{class:'chat-avatar',src:group.photoUrl,alt:'Foto '+(group.name||'lawan bicara')});
  return h('div',{class:'chat-avatar'},(group.name||'?').trim().charAt(0).toUpperCase()||'?');
}
/* Avatar lawan bicara di kepala utas berfungsi sebagai tombol Kembali
   ke daftar percakapan — menggantikan tombol Kembali tersendiri.
   Tampilan avatar (ukuran/bentuk) tidak berubah; hanya dibungkus
   tombol transparan dengan petunjuk aksesibel 'Kembali'. */
function conversationBackAvatar(group){
  return h('button',{class:'chat-avatar-back',type:'button',title:'Kembali','aria-label':'Kembali',onclick:()=>{S.openConversation=null;S.newChat=null;render()}},conversationAvatar(group));
}
function formatChatTime(ts){
  if(!ts)return '';
  const d=new Date(ts),now=new Date();
  if(d.toDateString()===now.toDateString())return d.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});
  if(now-d<7*86400000)return d.toLocaleDateString('id-ID',{weekday:'short'});
  return d.toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'});
}
function conversationUnread(group){
  const seen=userMessageSeen(),items=[];
  group.messages.forEach(message=>{
    if(message.sender_id!==S.uid)items.push(message);
    (S.replies||[]).filter(reply=>reply.message_id===message.id&&reply.by!==S.uid).forEach(reply=>items.push(reply));
  });
  return items.filter(item=>!seen[item.id]).length;
}
function markMessagesRead(group){
  if(!S.uid)return;
  const seen=userMessageSeen();
  const items=group?[
    ...group.messages.filter(message=>message.sender_id!==S.uid),
    ...(S.replies||[]).filter(reply=>group.messages.some(message=>message.id===reply.message_id)&&reply.by!==S.uid)
  ]:incomingMessageItems();
  items.forEach(item=>{if(item.at)seen[item.id]=item.at});
  try{localStorage.setItem('shikoku-family:message-seen:'+S.uid,JSON.stringify(seen))}catch(e){console.error('Status pesan tidak dapat disimpan:',e)}
  /* Status 'read' di penyimpanan hanya untuk pesan pokok yang masuk ke
     saya (saya penerimanya, atau saya admin untuk pesan Tanya Admin).
     Kebijakan RLS pesan mengizinkan para pihak percakapan memperbarui
     status pesan mereka sendiri. */
  const incomingRoots=(group?group.messages:(S.tanya||[])).filter(message=>message.sender_id!==S.uid&&message.status==='unread');
  if(incomingRoots.length){
    if(S.supabase){
      S.supabase.from('messages').update({status:'read',read_at:new Date().toISOString()}).in('id',incomingRoots.map(message=>message.id))
        .then(({error})=>{if(error)console.error('Status pesan tidak dapat diperbarui:',error)});
    }else{
      const rows=localMessageRows(LOCAL_MESSAGES_KEY);let changed=false;
      const ids=new Set(incomingRoots.map(message=>message.id));
      rows.forEach(row=>{
        if(ids.has(row.id)&&row.status==='unread'){row.status='read';row.read_at=new Date().toISOString();changed=true}
      });
      if(changed)saveLocalMessageRows(LOCAL_MESSAGES_KEY,rows);
    }
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
  if(!S.uid)return;
  if(!S.supabase){
    let rows=localMessageRows(LOCAL_MESSAGES_KEY);
    /* Aturan kotak masuk pribadi: baris hanya dimuat bila saya pengirim
       atau penerimanya; pesan tanpa penerima (Tanya Admin) hanya untuk
       pengirimnya dan para admin. */
    rows=rows.filter(row=>row.sender_id===S.uid||row.recipient_id===S.uid||(!row.recipient_id&&S.admin));
    const nextMessages=rows.map(messageFromRow).sort((a,b)=>a.at-b.at);
    const ids=new Set(nextMessages.map(item=>item.id));
    const nextReplies=localMessageRows(LOCAL_REPLIES_KEY).filter(row=>ids.has(row.message_id)).map(replyFromRow).sort((a,b)=>a.at-b.at);
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
    if(changed&&S.view==='pesan')renderDariData();
    return;
  }
  /* Saringan di lapisan data mengikuti akun yang masuk: hanya pesan
     yang melibatkan saya (saya pengirim atau penerimanya) yang pernah
     dimuat; admin menambahkan pesan tanpa penerima (Tanya Admin).
     Percakapan antar pengguna lain tidak pernah sampai ke perangkat
     ini — bukan sekadar disembunyikan dari tampilan. */
  let query=S.supabase.from('messages').select('*').order('created_at',{ascending:true});
  query=query.or('sender_id.eq.'+S.uid+',recipient_id.eq.'+S.uid+(S.admin?',recipient_id.is.null':''));
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
  if(changed&&S.view==='pesan')renderDariData();
}
async function submitMessage(data){
  if(!S.uid)throw new Error('Silakan login terlebih dahulu');
  /* recipient_id terisi = pesan langsung ke pengguna itu; kosong =
     pesan Tanya Admin (untuk admin, seperti alur lama dari Home). */
  const recipientId=data.recipient_id||null;
  if(!S.supabase){
    const rows=localMessageRows(LOCAL_MESSAGES_KEY);
    rows.push({id:newLocalRowId('msg'),name:data.nama,message:data.teks,sender_id:S.uid,recipient_id:recipientId,status:'unread',attachments:data.attachments||[],created_at:new Date().toISOString()});
    saveLocalMessageRows(LOCAL_MESSAGES_KEY,rows);
    return;
  }
  const {error}=await S.supabase.from('messages').insert({
    name:data.nama,
    message:data.teks,
    sender_id:S.uid,
    recipient_id:recipientId,
    attachments:data.attachments||[]
  });
  if(error)throw error;
}
async function submitReply(messageId,text,attachments=[]){
  if(!S.uid)throw new Error('Silakan login terlebih dahulu');
  if(!S.supabase){
    const replies=localMessageRows(LOCAL_REPLIES_KEY);
    replies.push({id:newLocalRowId('rpl'),message_id:messageId,sender_id:S.uid,message:text,attachments,created_at:new Date().toISOString()});
    saveLocalMessageRows(LOCAL_REPLIES_KEY,replies);
    const rows=localMessageRows(LOCAL_MESSAGES_KEY),row=rows.find(item=>item.id===messageId);
    if(row&&row.sender_id!==S.uid){row.status='replied';row.replied_at=new Date().toISOString();saveLocalMessageRows(LOCAL_MESSAGES_KEY,rows)}
    return;
  }
  const {error}=await S.supabase.from('message_replies').insert({message_id:messageId,sender_id:S.uid,message:text,attachments});
  if(error)throw error;
  /* Balasan dari pihak seberang menandai pesan pokok sebagai terjawab */
  const root=(S.tanya||[]).find(message=>message.id===messageId);
  if(root&&root.sender_id!==S.uid){
    const {error:statusError}=await S.supabase.from('messages').update({
      status:'replied',
      replied_at:new Date().toISOString()
    }).eq('id',messageId);
    if(statusError)throw statusError;
  }
}

async function uploadMessageFiles(files){
  if(!files.length)return [];
  if(!S.supabase){
    /* Mode lokal: lampiran disimpan sebagai data di perangkat ini */
    const uploaded=[];
    for(const file of files){
      const url=file.type&&file.type.startsWith('image/')?await readLocalImageDataUrl(file):await readFileAsDataUrl(file);
      uploaded.push({url,name:file.name,type:file.type||'application/octet-stream'});
    }
    return uploaded;
  }
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
// Hanya izinkan tautan https dari server Supabase milik aplikasi (cegah tautan berbahaya seperti javascript:)
function safeAttachmentUrl(value){
  const raw=String(value||'');
  /* Mode lokal: lampiran berupa data tertanam dari perangkat ini sendiri */
  if(!S.supabase&&/^data:(image\/|audio\/|video\/|application\/pdf)/.test(raw))return raw;
  try{
    const url=new URL(raw);
    const allowedHost=window.SUPABASE_CONFIG?.url?new URL(window.SUPABASE_CONFIG.url).hostname:'';
    return url.protocol==='https:'&&allowedHost&&url.hostname===allowedHost?url.href:'';
  }catch(error){return ''}
}
function attachmentView(attachment){
  const url=safeAttachmentUrl(attachment?.url);
  if(!url)return null;
  if(attachment.type?.startsWith('image/'))return h('a',{href:url,target:'_blank',rel:'noopener noreferrer'},h('img',{src:url,alt:attachment.name||'Gambar lampiran',class:'chat-image'}));
  if(attachment.type?.startsWith('audio/'))return h('audio',{controls:true,src:url});
  return h('a',{href:url,target:'_blank',rel:'noopener noreferrer',class:'chat-file'},icon('attachment',16),h('span',{},attachment.name||'Buka lampiran'));
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
    h('button',{class:'btn s',onclick:()=>file.click()},icon('attachment',16),h('span',{},'File')),
    h('button',{class:'btn s',onclick:()=>camera.click()},icon('camera',16),h('span',{},'Kamera')))};
}
function replyBox(messageId){
  const input=h('textarea',{rows:2,placeholder:'Tulis balasan...'});
  const picker=attachmentPicker(),record=h('button',{class:'btn s'},icon('mic',16),h('span',{},'Rekam'));
  let recorder,recorded=[];
  record.onclick=async()=>{
    if(recorder){recorder.stop();return}
    if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){alert('Perekaman suara tidak didukung browser ini.');return}
    let stream;
    try{stream=await navigator.mediaDevices.getUserMedia({audio:true})}catch(error){alert('Mikrofon tidak dapat dibuka: '+(error.message||'periksa izin mikrofon'));return}
    recorded=[];
    recorder=new MediaRecorder(stream);
    recorder.ondataavailable=e=>{if(e.data.size)recorded.push(e.data)};
    recorder.onstop=()=>{stream.getTracks().forEach(track=>track.stop());picker.files.push(new File(recorded,'voice-note.webm',{type:'audio/webm'}));picker.label.textContent='Voice note siap dikirim';recorder=null;record.replaceChildren(icon('mic',16),h('span',{},'Rekam'))};
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

/* Direktori penerima: daftar akun yang SUDAH DISETUJUI (id, nama,
   foto profil, peran) — sumber pemilih "Pesan Baru" untuk semua
   pengguna, bukan hanya admin. Di Supabase daftar ini dilindungi
   kebijakan baca direktori di schema.sql; di mode lokal sumbernya
   daftar akun lokal perangkat ini. */
async function loadUserDirectory(){
  if(!S.uid||S.directoryLoading)return;
  S.directoryLoading=true;
  try{
    if(!S.supabase){
      S.userDirectory=localUsers().filter(user=>user.approval_status==='approved').map(user=>({id:user.id,name:user.name||user.email||'Anggota',email:user.email||'',avatar_url:user.avatar_url||'',role:user.role||'member',is_main_admin:user.is_main_admin===true}));
    }else{
      const {data,error}=await S.supabase.from('profiles').select('id,name,email,avatar_url,role,is_main_admin').eq('approval_status','approved').order('name',{ascending:true});
      if(error){console.error('Direktori pengguna gagal dimuat:',error);S.userDirectory=[]}
      else S.userDirectory=(data||[]).map(user=>({id:user.id,name:user.name||user.email||'Anggota',email:user.email||'',avatar_url:user.avatar_url||'',role:user.role||'member',is_main_admin:user.is_main_admin===true}));
    }
    S.directoryLoaded=true;
  }catch(error){console.error('Direktori pengguna gagal dimuat:',error)}
  S.directoryLoading=false;
}
/* Panel pemilih penerima pesan baru: cari + daftar pengguna disetujui
   (foto/nama/wilayah mengikuti pola pemilih orang aplikasi). Panel
   menutup dengan mengetuk bidang di luar kartu — tanpa tombol X.
   Memilih orang yang sudah punya percakapan membuka percakapan itu;
   selain itu membuka utas baru yang masih kosong. */
function openNewMessagePicker(){
  if(!S.uid)return;
  const overlay=h('div',{id:'qm'});
  const search=h('input',{type:'text',placeholder:'Cari nama pengguna…',autocomplete:'off'});
  const list=h('div',{class:'picker-list'});
  const drawList=()=>{
    const q=search.value.trim().toLowerCase();
    const users=(S.userDirectory||[]).filter(user=>user.id!==S.uid&&(!q||(user.name||'').toLowerCase().includes(q)));
    if(!S.directoryLoaded){list.replaceChildren(h('p',{class:'warn'},'Memuat daftar pengguna…'));return}
    if(!users.length){list.replaceChildren(h('p',{class:'warn'},q?'Tidak ada pengguna dengan nama itu.':'Belum ada pengguna lain yang disetujui.'));return}
    list.replaceChildren(...users.map(user=>{
      const member=memberForUser(user);
      const avatar=member&&member.foto
        ?h('img',{class:'chat-avatar',...memberMediaAttributes(member.foto,'src'),alt:'Foto '+(user.name||'pengguna')})
        :(user.avatar_url?h('img',{class:'chat-avatar',src:user.avatar_url,alt:'Foto '+(user.name||'pengguna')}):h('div',{class:'chat-avatar'},(user.name||'?').trim().charAt(0).toUpperCase()||'?'));
      const sub=member?(typeof memberRegion==='function'?memberRegion(member):''):(user.is_main_admin?'Admin Utama':(user.role==='admin'?'Pengurus':'Anggota'));
      return h('button',{class:'conversation-row',onclick:()=>{
        overlay.remove();
        const existing=conversationGroups().find(group=>group.key===user.id);
        if(existing){S.newChat=null;S.openConversation=existing.key;markMessagesRead(existing)}
        else{S.newChat={id:user.id,name:user.name||'Anggota'};S.openConversation='__new__';render()}
      }},
        avatar,
        h('div',{class:'conversation-main'},h('b',{},user.name||'Anggota'),h('small',{},sub)));
    }));
    if(typeof hydrateMemberMedia==='function')hydrateMemberMedia();
  };
  search.addEventListener('input',drawList);
  const card=h('div',{class:'card picker-card'},
    h('b',{},icon('messages',18),h('span',{},'Pesan Baru')),
    h('p',{class:'sub'},'Pilih pengguna yang ingin diajak bicara.'),
    search,list);
  overlay.append(card);
  overlay.addEventListener('pointerdown',event=>{if(event.target===overlay)overlay.remove()});
  document.body.append(overlay);
  drawList();
  if(!S.directoryLoaded)loadUserDirectory().then(()=>{if(overlay.isConnected)drawList()});
  search.focus();
}
/* Kolom tulis pesan PERTAMA ke pengguna yang belum punya percakapan:
   mengirimnya membuat pesan pokok baru dengan penerima pengguna itu. */
function firstMessageBox(partner){
  const input=h('textarea',{rows:2,placeholder:'Tulis pesan...'});
  const picker=attachmentPicker();
  const menu=h('div',{class:'attachment-menu'},picker.buttons);
  const plus=h('button',{class:'composer-plus',type:'button',title:'Lampiran',onclick:()=>menu.classList.toggle('open')},'+');
  const send=h('button',{class:'btn',onclick:async e=>{
    if(!input.value.trim()&&!picker.files.length)return;
    try{
      e.currentTarget.disabled=true;
      const attachments=await uploadMessageFiles(picker.files);
      await submitMessage({nama:S.name||S.email||'Anggota',teks:input.value.trim(),attachments,recipient_id:partner.id});
      await loadMessages();
      S.newChat=null;S.openConversation=partner.id;
      render();
    }catch(error){e.currentTarget.disabled=false;alert('Gagal mengirim pesan: '+error.message)}
  }},'Kirim');
  return h('div',{class:'reply-box'},menu,h('div',{class:'composer-row'},input,plus,send),picker.label);
}
function vPesan(){
  if(!S.uid)return [h('h1',{},'Pesan Masuk'),accountForm()];
  if(!S.directoryLoaded&&!S.directoryLoading)loadUserDirectory().then(()=>{if(S.view==='pesan')renderDariData()});
  const groups=conversationGroups();
  const backToInbox=()=>{S.openConversation=null;S.newChat=null;render()};
  /* Percakapan baru (belum ada pesan sama sekali): utas kosong sopan
     + kolom pesan pertama di bawahnya. */
  if(S.openConversation==='__new__'&&S.newChat){
    const partner=S.newChat;
    const user=directoryUser(partner.id);
    const group={key:partner.id,name:partner.name,photoMember:null,photoUrl:user?user.avatar_url||'':'',messages:[]};
    if(user){const member=memberForUser(user);if(member&&member.foto)group.photoMember=member}
    return [
      h('div',{class:'conversation-toolbar'},
        conversationBackAvatar(group),
        h('b',{},group.name)),
      h('section',{class:'chat-card'},
        h('div',{class:'chat-body'},h('p',{class:'warn chat-empty'},'Belum ada pesan. Tulis pesan pertama Anda di bawah.')),
        firstMessageBox(partner))
    ];
  }
  if(S.openConversation){
    const group=groups.find(item=>item.key===S.openConversation);
    if(group){
      const entries=conversationEntries(group);
      const chatBody=h('div',{class:'chat-body'},...entries.map(entry=>h('div',{class:'chat-line '+(entry.mine?'outgoing':'incoming')},
        h('div',{class:'chat-bubble'},entry.teks,...entry.attachments.map(attachmentView).filter(Boolean)))));
      let swipeStartX=0,swipeStartY=0;
      chatBody.ontouchstart=e=>{swipeStartX=e.changedTouches[0].clientX;swipeStartY=e.changedTouches[0].clientY};
      chatBody.ontouchend=e=>{
        const dx=e.changedTouches[0].clientX-swipeStartX,dy=e.changedTouches[0].clientY-swipeStartY;
        if(dx>80&&Math.abs(dx)>Math.abs(dy)){
          chatBody.classList.add('swipe-back');
          setTimeout(()=>{S.openConversation=null;S.newChat=null;render()},220);
        }
      };
      requestAnimationFrame(()=>{chatBody.scrollTop=chatBody.scrollHeight});
      return [
        h('div',{class:'conversation-toolbar'},
          conversationBackAvatar(group),
          h('b',{},group.name)),
        h('section',{class:'chat-card'},
          chatBody,
          replyBox(group.messages[group.messages.length-1].id))
      ];
    }
    /* Percakapan yang terbuka sudah tidak ada (data berubah): kembali
       ke daftar kotak masuk di bawah. */
    S.openConversation=null;
  }
  /* Kotak masuk: daftar percakapan milik pengguna yang masuk saja,
     aktivitas terbaru di atas. */
  const cards=groups.length?groups.map(group=>{
    const unread=conversationUnread(group);
    const last=group.last;
    const snippet=last?((last.mine?'Anda: ':'')+(last.teks||(last.attachments&&last.attachments.length?'Lampiran':''))):'';
    return h('button',{class:'conversation-row',onclick:()=>{S.newChat=null;S.openConversation=group.key;markMessagesRead(group)}},
      conversationAvatar(group),
      h('div',{class:'conversation-main'},
        h('div',{class:'conversation-top'},h('b',{},group.name),last?h('span',{class:'conversation-time'},formatChatTime(last.at)):null),
        h('small',{},snippet)),
      unread>0&&h('span',{class:'conversation-badge'},String(unread)));
  }):[h('p',{class:'warn'},'Belum ada percakapan. Ketuk "Pesan Baru" untuk memulai percakapan dengan pengguna lain.')];
  return [
    h('div',{class:'inbox-head'},
      h('h1',{},'Pesan Masuk'),
      h('button',{class:'btn s',onclick:()=>openNewMessagePicker()},icon('edit',16),h('span',{},'Pesan Baru'))),
    ...cards
  ];
}
/* ===== maskot: gambar diam, bisa digeser, ketuk untuk tanya admin ===== */
