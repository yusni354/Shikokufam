/* Pesan Grup admin & pengurus: muat, kirim, balas, lampiran, tampilan utas grup.
   Perpesanan di drawer kini SATU pesan grup bersama yang hanya bisa
   dibuka admin dan pengurus (S.admin); untuk anggota tidak ada menu
   Pesan sama sekali (menu disembunyikan di drawer, navigasinya dijaga
   di go()/render()). Pesan grup disimpan sebagai pesan pokok TANPA
   penerima (recipient_id kosong) yang pengirimnya admin/pengurus —
   bentuk yang sama seperti pesan Tanya Admin lama, jadi admin &
   pengurus memang sudah memuatnya di loadMessages; yang membedakan
   pesan grup dari pertanyaan anggota adalah PERAN pengirimnya
   (isGroupSender). Balasan menempel pada pesan pokok grup seperti
   sebelumnya. */
/* hidden_for: daftar uid yang MENYEMBUNYIKAN baris ini dari tampilannya
   sendiri (penghapusan "untuk saya saja" pada pesan kiriman lawan
   bicara). Bentuknya larik uid di kolom jsonb hidden_for pada tabel
   messages/message_replies; baris lama tanpa kolom itu terbaca []. */
function hiddenForFromRow(row){
  const v=row?row.hidden_for:null;
  if(Array.isArray(v))return v.map(String);
  if(typeof v==='string'){try{const p=JSON.parse(v);return Array.isArray(p)?p.map(String):[]}catch(e){return[]}}
  return [];
}
function pesanTersembunyiUntukSaya(item){
  return !!S.uid&&(item.hidden_for||[]).map(String).includes(String(S.uid));
}
function messageFromRow(row){return {id:row.id,nama:row.name,teks:row.message,attachments:row.attachments||[],at:new Date(row.created_at).getTime(),status:row.status,sender_id:row.sender_id,recipient_id:row.recipient_id||null,hidden_for:hiddenForFromRow(row)}}
function replyFromRow(row){return {id:row.id,message_id:row.message_id,by:row.sender_id,teks:row.message,attachments:row.attachments||[],at:new Date(row.created_at).getTime(),hidden_for:hiddenForFromRow(row)}}
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
  /* Angka yang sama juga ditampilkan pada ikon aplikasi terinstal */
  if(typeof updateAppIconBadge==='function')updateAppIconBadge();
}
function userMessageSeen(){
  try{return JSON.parse(localStorage.getItem('shikoku-family:message-seen:'+S.uid)||'{}')}catch(e){return {}}
}
function incomingMessageItems(){
  /* Untuk ADMIN & PENGURUS, "pesan masuk" = isi PESAN GRUP saja:
     pesan pokok grup dari pengirim lain + balasan orang lain pada
     pesan pokok grup. Lencana menu Pesan Grup mengikuti angka ini. */
  if(S.admin){
    const roots=groupMessages().filter(message=>message.sender_id!==S.uid&&!pesanTersembunyiUntukSaya(message));
    const rootIds=new Set(groupMessages().map(message=>String(message.id)));
    const replies=(S.replies||[]).filter(reply=>rootIds.has(String(reply.message_id))&&reply.by!==S.uid&&!pesanTersembunyiUntukSaya(reply));
    return [...roots,...replies];
  }
  /* Pesan masuk bagi saya = pesan pokok yang TIDAK saya kirim (pesan
     langsung yang ditujukan ke saya, atau pesan Tanya Admin bila saya
     admin) + balasan dari orang lain. loadMessages hanya memuat pesan
     yang melibatkan saya, jadi setiap pesan pokok dari orang lain
     memang ditujukan ke saya. */
  const roots=(S.tanya||[]).filter(message=>message.sender_id!==S.uid&&!pesanTersembunyiUntukSaya(message));
  const replies=(S.replies||[]).filter(reply=>reply.by!==S.uid&&!pesanTersembunyiUntukSaya(reply));
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
/* ===== Pesan Grup (admin & pengurus) =====
   Pengirim pesan grup = akun berperan admin/pengurus menurut
   direktori pengguna (role 'admin' atau admin utama); akun saya
   sendiri mengikuti peran sesi saya. Pesan tanpa penerima dari
   ANGGOTA (pertanyaan Tanya Admin) BUKAN pesan grup dan tidak tampil
   di utas grup. */
function isGroupSender(id){
  if(!id)return false;
  if(String(id)===String(S.uid))return !!S.admin;
  const user=directoryUser(id);
  return !!user&&(user.role==='admin'||user.is_main_admin===true);
}
function groupMessages(){
  return (S.tanya||[]).filter(message=>!message.recipient_id&&isGroupSender(message.sender_id));
}
/* Seluruh entri utas grup (pesan pokok grup + balasannya) berurutan
   waktu, dengan pengirim tiap entri untuk label nama di utas. Entri
   yang saya sembunyikan (hapus untuk saya saja) tidak ikut tampil. */
function groupEntries(){
  const entries=[];
  groupMessages().forEach(message=>{
    if(!pesanTersembunyiUntukSaya(message))entries.push({id:message.id,kind:'root',message_id:message.id,at:message.at||0,mine:message.sender_id===S.uid,sender_id:message.sender_id,nama:message.nama||'',teks:message.teks||'',attachments:message.attachments||[]});
    (S.replies||[]).filter(reply=>reply.message_id===message.id&&!pesanTersembunyiUntukSaya(reply)).forEach(reply=>{
      entries.push({id:reply.id,kind:'reply',message_id:message.id,at:reply.at||0,mine:reply.by===S.uid,sender_id:reply.by,nama:'',teks:reply.teks||'',attachments:reply.attachments||[]});
    });
  });
  entries.sort((a,b)=>a.at-b.at);
  return entries;
}
function groupSenderName(entry){
  if(entry.mine)return 'Anda';
  if(entry.nama)return entry.nama;
  const user=directoryUser(entry.sender_id);
  if(user&&user.name)return user.name;
  return 'Pengurus';
}
function groupSenderAvatar(entry){
  const user=directoryUser(entry.sender_id);
  const member=user?memberForUser(user):null;
  const name=groupSenderName(entry);
  if(member&&member.foto)return h('img',{class:'chat-avatar chat-avatar-sm',...memberMediaAttributes(member.foto,'src'),alt:'Foto '+name});
  if(user&&user.avatar_url)return h('img',{class:'chat-avatar chat-avatar-sm',src:user.avatar_url,alt:'Foto '+name});
  return h('div',{class:'chat-avatar chat-avatar-sm'},(name||'?').trim().charAt(0).toUpperCase()||'?');
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
  /* Entri yang tampil di utas HANYA yang terlihat untuk saya: pesan yang
     saya sembunyikan (hapus untuk saya saja) tidak ikut digambar, tidak
     menjadi cuplikan terakhir, dan tidak dihitung belum dibaca. Setiap
     entri membawa id + jenisnya (root = pesan pokok di tabel messages,
     reply = balasan di tabel message_replies) untuk keperluan hapus. */
  const entries=[];
  group.messages.forEach(message=>{
    if(!pesanTersembunyiUntukSaya(message))entries.push({id:message.id,kind:'root',message_id:message.id,at:message.at||0,mine:message.sender_id===S.uid,teks:message.teks||'',attachments:message.attachments||[]});
    (S.replies||[]).filter(reply=>reply.message_id===message.id&&!pesanTersembunyiUntukSaya(reply)).forEach(reply=>{
      entries.push({id:reply.id,kind:'reply',message_id:message.id,at:reply.at||0,mine:reply.by===S.uid,teks:reply.teks||'',attachments:reply.attachments||[]});
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
    if(message.sender_id!==S.uid&&!pesanTersembunyiUntukSaya(message))items.push(message);
    (S.replies||[]).filter(reply=>reply.message_id===message.id&&reply.by!==S.uid&&!pesanTersembunyiUntukSaya(reply)).forEach(reply=>items.push(reply));
  });
  return items.filter(item=>!seen[item.id]).length;
}
function markMessagesRead(group){
  if(!S.uid)return;
  const seen=userMessageSeen();
  const items=group?[
    ...group.messages.filter(message=>message.sender_id!==S.uid&&!pesanTersembunyiUntukSaya(message)),
    ...(S.replies||[]).filter(reply=>group.messages.some(message=>message.id===reply.message_id)&&reply.by!==S.uid&&!pesanTersembunyiUntukSaya(reply))
  ]:incomingMessageItems();
  items.forEach(item=>{if(item.at)seen[item.id]=item.at});
  try{localStorage.setItem('shikoku-family:message-seen:'+S.uid,JSON.stringify(seen))}catch(e){console.error('Status pesan tidak dapat disimpan:',e)}
  /* Status 'read' di penyimpanan hanya untuk pesan pokok yang masuk ke
     saya (saya penerimanya, atau saya admin untuk pesan Tanya Admin).
     Kebijakan RLS pesan mengizinkan para pihak percakapan memperbarui
     status pesan mereka sendiri. */
  const incomingRoots=(group?group.messages:(S.tanya||[])).filter(message=>message.sender_id!==S.uid&&message.status==='unread'&&!pesanTersembunyiUntukSaya(message));
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
/* Lencana & nama pengirim Pesan Grup ditentukan dari peran akun di
   direktori pengguna; admin/pengurus memuat direktori itu sekali
   sesudah pesan dimuat supaya lencana grup benar sejak awal, bukan
   hanya sesudah halaman Pesan Grup dibuka. */
function muatDirektoriUntukGrup(){
  if(!S.admin||S.directoryLoaded||S.directoryLoading)return;
  loadUserDirectory().then(()=>{
    const seen=userMessageSeen();
    S.unreadMessages=incomingMessageItems().filter(item=>!seen[item.id]).length;
    updateMessageBadges();
    if(S.view==='pesan')renderDariData();
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
      messages:nextMessages.map(item=>[item.id,item.status,item.at,item.attachments,item.hidden_for]),
      replies:nextReplies.map(item=>[item.id,item.message_id,item.at,item.attachments,item.hidden_for])
    });
    const changed=signature!==S.messageSignature;
    S.messageSignature=signature;
    S.tanya=nextMessages;
    S.replies=nextReplies;
    const seen=userMessageSeen();
    S.unreadMessages=incomingMessageItems().filter(item=>!seen[item.id]).length;
    updateMessageBadges();
    if(changed&&S.view==='pesan')renderDariData();
    muatDirektoriUntukGrup();
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
    messages:nextMessages.map(item=>[item.id,item.status,item.at,item.attachments,item.hidden_for]),
    replies:nextReplies.map(item=>[item.id,item.message_id,item.at,item.attachments,item.hidden_for])
  });
  const changed=signature!==S.messageSignature;
  S.messageSignature=signature;
  S.tanya=nextMessages;
  S.replies=nextReplies;
  const seen=userMessageSeen();
  S.unreadMessages=incomingMessageItems().filter(item=>!seen[item.id]).length;
  updateMessageBadges();
  if(changed&&S.view==='pesan')renderDariData();
  muatDirektoriUntukGrup();
}
async function submitMessage(data){
  if(!S.uid)throw new Error('Silakan login terlebih dahulu');
  /* recipient_id terisi = pesan langsung ke pengguna itu; kosong =
     pesan Tanya Admin (untuk admin, seperti alur lama dari Home). */
  const recipientId=data.recipient_id||null;
  if(!S.supabase){
    const rows=localMessageRows(LOCAL_MESSAGES_KEY);
    rows.push({id:newLocalRowId('msg'),name:data.nama,message:data.teks,sender_id:S.uid,recipient_id:recipientId,status:'unread',attachments:data.attachments||[],hidden_for:[],created_at:new Date().toISOString()});
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
    replies.push({id:newLocalRowId('rpl'),message_id:messageId,sender_id:S.uid,message:text,attachments,hidden_for:[],created_at:new Date().toISOString()});
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

/* ===== Hapus pesan dari utas (pilihan 'Hapus' pada tekan lama) =====
   Dua aturan yang berbeda mengikuti pemilik pesannya:
   - Pesan kiriman SENDIRI dihapus sungguhan dari tabelnya (messages
     untuk pesan pokok, message_replies untuk balasan): hilang dari
     utas pengirim DAN penerima. Menghapus pesan pokok ikut menghapus
     balasannya (di Supabase lewat cascade skema; di mode lokal baris
     balasannya dibuang bersamaan di sini).
   - Pesan kiriman LAWAN bicara hanya disembunyikan untuk akun saya:
     uid saya ditambahkan ke kolom hidden_for baris itu. Barisnya tetap
     ada, lawan bicara tetap melihatnya, dan aturan privasi percakapan
     yang sudah berlaku tidak berubah — saringan tampil di
     conversationEntries/incomingMessageItems yang menepikan baris
     tersembunyi untuk saya. */
async function hapusEntriPesan(d){
  if(!S.uid||!d||!d.id)throw new Error('Pesan tidak ditemukan');
  const tabel=d.kind==='reply'?'message_replies':'messages';
  if(d.mine){
    if(!S.supabase){
      if(d.kind==='reply'){
        saveLocalMessageRows(LOCAL_REPLIES_KEY,localMessageRows(LOCAL_REPLIES_KEY).filter(row=>row.id!==d.id));
      }else{
        saveLocalMessageRows(LOCAL_MESSAGES_KEY,localMessageRows(LOCAL_MESSAGES_KEY).filter(row=>row.id!==d.id));
        saveLocalMessageRows(LOCAL_REPLIES_KEY,localMessageRows(LOCAL_REPLIES_KEY).filter(row=>row.message_id!==d.id));
      }
    }else{
      const {error}=await S.supabase.from(tabel).delete().eq('id',d.id);
      if(error)throw error;
    }
  }else{
    const sumber=d.kind==='reply'?(S.replies||[]).find(item=>item.id===d.id):(S.tanya||[]).find(item=>item.id===d.id);
    const dasar=sumber&&Array.isArray(sumber.hidden_for)?sumber.hidden_for:[];
    const hidden=[...new Set([...dasar.map(String),String(S.uid)])];
    if(!S.supabase){
      const key=d.kind==='reply'?LOCAL_REPLIES_KEY:LOCAL_MESSAGES_KEY;
      const rows=localMessageRows(key);let changed=false;
      rows.forEach(row=>{if(row.id===d.id){row.hidden_for=hidden;changed=true}});
      if(changed)saveLocalMessageRows(key,rows);
    }else{
      const {error}=await S.supabase.from(tabel).update({hidden_for:hidden}).eq('id',d.id);
      if(error)throw error;
    }
  }
  /* Segarkan dari sumbernya: utas, cuplikan + waktu di daftar
     percakapan, dan hitungan belum dibaca mengikuti keadaan terbaru. */
  S.messageSignature='';
  await loadMessages();
}
/* ===== Tekan lama pada gelembung pesan =====
   Pola yang sama seperti tekan lama Kepengurusan: tahan ±480 ms TANPA
   bergerak untuk membuka panel pilihan; gerakan >10px sebelum batas
   itu tercapai berarti niat menggulir dan tekan lama dibatalkan,
   halaman bergulir seperti biasa. Sesudah aktif, gulir disentuh
   dicegah (touchmove non-pasif) dan teks tidak terseleksi (CSS
   .chat-bubble mematikan user-select & menu sentuh bawaan). Di
   desktop: tahan klik kiri bekerja sama, dan KLIK KANAN pada gelembung
   membuka panel yang sama lewat contextmenu. Ketukan biasa tidak
   berubah; klik yang mengikuti lepasnya tekan lama pada tautan
   lampiran di dalam gelembung ditelan satu kali. */
function pasangTekanLamaPesan(bubble,entry){
  let timer=null,aktif=false,selesai=false,startX=0,startY=0,pid=null;
  const bukaPanel=()=>{
    S.chatDialog={tahap:'menu',kind:entry.kind,id:entry.id,message_id:entry.message_id,mine:entry.mine,teks:entry.teks||'',lampiran:!!(entry.attachments&&entry.attachments.length),dibukaPada:Date.now()};
    render();
  };
  const bersih=()=>{
    if(timer){clearTimeout(timer);timer=null}
    document.removeEventListener('pointermove',onMove);
    document.removeEventListener('pointerup',onUp);
    document.removeEventListener('pointercancel',onUp);
    document.removeEventListener('touchmove',cegahGulir);
  };
  const cegahGulir=e=>{if(aktif)e.preventDefault()};
  const onMove=e=>{
    if(selesai||e.pointerId!==pid)return;
    if(!aktif&&Math.hypot(e.clientX-startX,e.clientY-startY)>10){selesai=true;bersih()}
  };
  const onUp=e=>{
    if(e.pointerId!==pid)return;
    const pernahAktif=aktif;
    selesai=true;bersih();
    if(pernahAktif){
      const telan=ev=>{ev.preventDefault();ev.stopPropagation()};
      bubble.addEventListener('click',telan,{capture:true,once:true});
      setTimeout(()=>bubble.removeEventListener('click',telan,{capture:true}),600);
    }
  };
  bubble.addEventListener('pointerdown',ev=>{
    if(ev.button!=null&&ev.button>0)return;
    if(ev.target&&ev.target.closest&&ev.target.closest('audio,video'))return;
    pid=ev.pointerId;startX=ev.clientX;startY=ev.clientY;aktif=false;selesai=false;
    document.addEventListener('pointermove',onMove);
    document.addEventListener('pointerup',onUp);
    document.addEventListener('pointercancel',onUp);
    document.addEventListener('touchmove',cegahGulir,{passive:false});
    timer=setTimeout(()=>{
      timer=null;
      if(selesai)return;
      aktif=true;
      bubble.classList.add('chat-bubble-pressed');
      if(navigator.vibrate){try{navigator.vibrate(15)}catch(_){}}
      bukaPanel();
    },480);
  });
  bubble.addEventListener('contextmenu',ev=>{
    ev.preventDefault();
    selesai=true;bersih();
    bukaPanel();
  });
}
/* Panel pilihan + konfirmasi hapus pesan, mengikuti pola panel aplikasi
   lain (Pengaturan Kegiatan, Persetujuan): tanpa tombol X — mengetuk
   bidang di luar kartu menutupnya. Tahap 'menu' berisi pratinjau pesan
   dan tepat satu pilihan 'Hapus'; menekannya membuka tahap 'yakin',
   konfirmasi tegas yang bunyinya mengikuti pemilik pesan (terhapus
   untuk kedua pihak vs hilang dari tampilan saya saja). Ketukan di
   luar yang datang <400 ms sesudah panel terbuka diabaikan: itulah
   klik sisa dari lepasnya tekan lama yang membuka panel ini. */
function dialogPesan(){
  const d=S.chatDialog;
  if(!d)return null;
  const batal=()=>{S.chatDialog=null;render()};
  const tutupLuar=()=>{if(Date.now()-(d.dibukaPada||0)<400)return;S.chatDialog=null;render()};
  const cuplikan=(d.teks||'').trim()||(d.lampiran?'Lampiran':'Pesan');
  if(d.tahap==='yakin'){
    return h('div',{class:'confirm-overlay',onclick:tutupLuar},
      h('div',{class:'card confirm-card',onclick:ev=>ev.stopPropagation()},
        h('b',{class:'confirm-title'},'Hapus Pesan'),
        h('p',{class:'confirm-text'},d.mine
          ?'Hapus pesan ini? Pesan akan terhapus dari percakapan untuk Anda dan lawan bicara, dan tidak bisa dibatalkan.'
          :'Hapus pesan ini dari tampilan Anda? Pesan hanya hilang untuk Anda — lawan bicara tetap melihatnya.'),
        h('div',{class:'chat-dialog-preview'},cuplikan),
        h('div',{class:'fl confirm-actions'},
          h('button',{class:'btn s',onclick:batal},'Batal'),
          h('button',{class:'btn',onclick:async()=>{
            const target={...d};S.chatDialog=null;
            try{await hapusEntriPesan(target)}
            catch(error){console.error(error);alert('Gagal menghapus pesan: '+(error.message||'periksa koneksi'))}
            render();
          }},'Hapus'))));
  }
  return h('div',{class:'confirm-overlay',onclick:tutupLuar},
    h('div',{class:'card confirm-card',onclick:ev=>ev.stopPropagation()},
      h('b',{class:'confirm-title'},'Pesan'),
      h('div',{class:'chat-dialog-preview'},cuplikan),
      h('button',{class:'btn chat-delete-option',onclick:()=>{S.chatDialog={...d,tahap:'yakin'};render()}},icon('trash',17),h('span',{},'Hapus'))));
}

/* ===== Hapus PERCAKAPAN dari daftar Pesan Masuk (tekan lama baris) =====
   Berbeda dari hapus pesan kiriman sendiri di dalam utas: menghapus
   percakapan TIDAK menghapus baris data apa pun dan TIDAK memakai
   penghapusan sungguhan — untuk SEMUA pesan percakapan itu (pesan
   pokok + balasannya, kiriman saya maupun kiriman lawan bicara) uid
   saya hanya DITAMBAHKAN ke hidden_for. Akibatnya:
   - percakapan hilang dari daftar Pesan Masuk saya (saringan tampil
     di conversationEntries/incomingMessageItems menepikan baris
     tersembunyi untuk saya, dan daftar hanya menggambar percakapan
     yang masih punya entri terlihat);
   - lencana belum dibaca percakapan itu dan total menu Pesan ikut
     berkurang (keduanya dihitung dari entri yang terlihat saja);
   - lawan bicara tetap melihat percakapannya UTUH di akunnya;
   - pesan BARU sesudah itu (baris baru, hidden_for kosong) terlihat
     lagi untuk saya, jadi percakapan muncul kembali berisi pesan
     baru itu saja — pesan lama tetap tersembunyi untuk saya. */
async function hapusPercakapan(group){
  if(!S.uid||!group||!Array.isArray(group.messages)||!group.messages.length)throw new Error('Percakapan tidak ditemukan');
  const rootSet=new Set(group.messages.map(message=>String(message.id)));
  const hiddenBaru=item=>[...new Set([...(Array.isArray(item.hidden_for)?item.hidden_for:[]).map(String),String(S.uid)])];
  const roots=group.messages.filter(message=>!pesanTersembunyiUntukSaya(message));
  const replies=(S.replies||[]).filter(reply=>rootSet.has(String(reply.message_id))&&!pesanTersembunyiUntukSaya(reply));
  if(!S.supabase){
    const msgRows=localMessageRows(LOCAL_MESSAGES_KEY);let msgChanged=false;
    msgRows.forEach(row=>{
      if(!rootSet.has(String(row.id)))return;
      const dasar=hiddenForFromRow(row);
      if(dasar.map(String).includes(String(S.uid)))return;
      row.hidden_for=[...new Set([...dasar.map(String),String(S.uid)])];msgChanged=true;
    });
    if(msgChanged)saveLocalMessageRows(LOCAL_MESSAGES_KEY,msgRows);
    const rplRows=localMessageRows(LOCAL_REPLIES_KEY);let rplChanged=false;
    rplRows.forEach(row=>{
      if(!rootSet.has(String(row.message_id)))return;
      const dasar=hiddenForFromRow(row);
      if(dasar.map(String).includes(String(S.uid)))return;
      row.hidden_for=[...new Set([...dasar.map(String),String(S.uid)])];rplChanged=true;
    });
    if(rplChanged)saveLocalMessageRows(LOCAL_REPLIES_KEY,rplRows);
  }else{
    for(const message of roots){
      const {error}=await S.supabase.from('messages').update({hidden_for:hiddenBaru(message)}).eq('id',message.id);
      if(error)throw error;
    }
    for(const reply of replies){
      const {error}=await S.supabase.from('message_replies').update({hidden_for:hiddenBaru(reply)}).eq('id',reply.id);
      if(error)throw error;
    }
  }
  /* Segarkan dari sumbernya: daftar percakapan, cuplikan, dan
     hitungan belum dibaca mengikuti keadaan terbaru. */
  S.messageSignature='';
  await loadMessages();
}
/* ===== Tekan lama pada baris percakapan di daftar Pesan Masuk =====
   Pola gestur yang sama persis seperti tekan lama gelembung pesan:
   tahan ±480 ms TANPA bergerak (>10px = niat menggulir, dibatalkan),
   sesudah aktif gulir disentuh dicegah, getar halus di HP, dan di
   desktop tahan klik kiri / KLIK KANAN (contextmenu) membuka panel
   yang sama. Ketukan biasa tetap membuka percakapan; klik yang
   mengikuti lepasnya tekan lama yang matang DITELAN — lewat penelan
   klik pada baris (pola gelembung) DAN lewat cap waktu global di
   bawah yang diperiksa onclick baris, karena render() yang membuka
   panel mengganti elemen baris sebelum klik itu tiba. */
let tekanLamaPercakapanPada=0;
function pasangTekanLamaPercakapan(row,group){
  let timer=null,aktif=false,selesai=false,startX=0,startY=0,pid=null;
  const bukaPanel=()=>{
    tekanLamaPercakapanPada=Date.now();
    S.inboxDialog={tahap:'menu',key:group.key,name:group.name||'Anggota',dibukaPada:Date.now()};
    render();
  };
  const bersih=()=>{
    if(timer){clearTimeout(timer);timer=null}
    document.removeEventListener('pointermove',onMove);
    document.removeEventListener('pointerup',onUp);
    document.removeEventListener('pointercancel',onUp);
    document.removeEventListener('touchmove',cegahGulir);
  };
  const cegahGulir=e=>{if(aktif)e.preventDefault()};
  const onMove=e=>{
    if(selesai||e.pointerId!==pid)return;
    if(!aktif&&Math.hypot(e.clientX-startX,e.clientY-startY)>10){selesai=true;bersih()}
  };
  const onUp=e=>{
    if(e.pointerId!==pid)return;
    const pernahAktif=aktif;
    selesai=true;bersih();
    if(pernahAktif){
      tekanLamaPercakapanPada=Date.now();
      const telan=ev=>{ev.preventDefault();ev.stopPropagation()};
      row.addEventListener('click',telan,{capture:true,once:true});
      setTimeout(()=>row.removeEventListener('click',telan,{capture:true}),600);
    }
  };
  row.addEventListener('pointerdown',ev=>{
    if(ev.button!=null&&ev.button>0)return;
    pid=ev.pointerId;startX=ev.clientX;startY=ev.clientY;aktif=false;selesai=false;
    document.addEventListener('pointermove',onMove);
    document.addEventListener('pointerup',onUp);
    document.addEventListener('pointercancel',onUp);
    document.addEventListener('touchmove',cegahGulir,{passive:false});
    timer=setTimeout(()=>{
      timer=null;
      if(selesai)return;
      aktif=true;
      row.classList.add('conversation-row-pressed');
      if(navigator.vibrate){try{navigator.vibrate(15)}catch(_){}}
      bukaPanel();
    },480);
  });
  row.addEventListener('contextmenu',ev=>{
    ev.preventDefault();
    selesai=true;bersih();
    bukaPanel();
  });
}
/* Panel pilihan + konfirmasi hapus percakapan: pola panel aplikasi
   yang sama (tanpa tombol X, mengetuk bidang di luar kartu menutup;
   ketukan luar <400 ms sesudah panel terbuka diabaikan sebagai sisa
   lepasnya tekan lama). Tahap 'menu' berisi nama lawan bicara dan
   tepat satu pilihan 'Hapus'; menekannya membuka tahap 'yakin',
   konfirmasi tegas yang MENYEBUT NAMA lawan bicara. Berlaku juga
   untuk percakapan 'Admin' (namanya memang 'Admin'). */
function dialogPercakapan(){
  const d=S.inboxDialog;
  if(!d)return null;
  const batal=()=>{S.inboxDialog=null;render()};
  const tutupLuar=()=>{if(Date.now()-(d.dibukaPada||0)<400)return;S.inboxDialog=null;render()};
  if(d.tahap==='yakin'){
    return h('div',{class:'confirm-overlay',onclick:tutupLuar},
      h('div',{class:'card confirm-card',onclick:ev=>ev.stopPropagation()},
        h('b',{class:'confirm-title'},'Hapus Percakapan'),
        h('p',{class:'confirm-text'},'Hapus percakapan dengan '+(d.name||'Anggota')+'? Percakapan ini akan hilang dari daftar Pesan Masuk Anda. Lawan bicara tetap melihat percakapannya, dan percakapan akan muncul lagi bila ada pesan baru.'),
        h('div',{class:'fl confirm-actions'},
          h('button',{class:'btn s',onclick:batal},'Batal'),
          h('button',{class:'btn',onclick:async()=>{
            const target={...d};S.inboxDialog=null;
            if(S.openConversation===target.key){S.openConversation=null;S.newChat=null}
            try{
              const group=conversationGroups().find(item=>item.key===target.key);
              if(group)await hapusPercakapan(group);
            }catch(error){console.error(error);alert('Gagal menghapus percakapan: '+(error.message||'periksa koneksi'))}
            render();
          }},'Hapus'))));
  }
  return h('div',{class:'confirm-overlay',onclick:tutupLuar},
    h('div',{class:'card confirm-card',onclick:ev=>ev.stopPropagation()},
      h('b',{class:'confirm-title'},'Percakapan'),
      h('div',{class:'chat-dialog-preview'},d.name||'Anggota'),
      h('button',{class:'btn chat-delete-option',onclick:()=>{S.inboxDialog={...d,tahap:'yakin'};render()}},icon('trash',17),h('span',{},'Hapus'))));
}

/* ===== Lampiran pesan PRIVAT (Pengerasan Prioritas 1) =====
   Bucket 'message-attachments' kini PRIVAT (lihat supabase/schema.sql):
   lampiran tidak lagi dibuka siapa pun lewat URL publik. Yang disimpan
   pada baris pesan adalah JALUR storage-nya ('<uid>/<uuid>-<nama>');
   saat tampil, jalur itu ditukar menjadi URL bertanda tangan berumur
   1 jam lewat createSignedUrl — pola yang sama seperti foto anggota
   privat di media.js, lengkap dengan cache dan penanda pending/gagal.
   MIGRASI LAMPIRAN LAMA: baris pesan lama menyimpan URL publik lama
   ('.../storage/v1/object/public/message-attachments/<jalur>').
   attachmentStoragePath mengenali URL lama itu (dan URL bertanda
   tangan lama), mengekstrak jalurnya, lalu jalur itu ditandatangani
   dengan cara yang sama — lampiran lama tetap tampil walau bucket-nya
   sudah privat, tanpa mengubah data pesan lama. */
const MSG_ATTACHMENT_BUCKET='message-attachments';
const msgAttachmentSignedUrls=new Map(),msgAttachmentSignedPending=new Set(),msgAttachmentSignedFailed=new Set();
function attachmentStoragePath(value){
  const raw=String(value||'').trim();
  if(!raw)return null;
  if(!/^https?:\/\//i.test(raw)){
    /* Nilai baru: jalur storage polos. Data URL (mode lokal) bukan jalur. */
    if(raw.startsWith('data:'))return null;
    const bersih=raw.replace(/^\/+/,'');
    if(!bersih||bersih.includes('..')||bersih.includes('\\'))return null;
    return bersih;
  }
  try{
    const url=new URL(raw);
    const hostSah=window.SUPABASE_CONFIG&&window.SUPABASE_CONFIG.url?new URL(window.SUPABASE_CONFIG.url).hostname:'';
    if(url.protocol!=='https:'||!hostSah||url.hostname!==hostSah)return null;
    const penanda='/storage/v1/object/';
    const idx=url.pathname.indexOf(penanda);
    if(idx<0)return null;
    const sisa=url.pathname.slice(idx+penanda.length).replace(/^(public|sign|authenticated)\//,'');
    if(!sisa.startsWith(MSG_ATTACHMENT_BUCKET+'/'))return null;
    let jalur=sisa.slice(MSG_ATTACHMENT_BUCKET.length+1);
    try{jalur=decodeURIComponent(jalur)}catch(e){/* jalur apa adanya */}
    return jalur||null;
  }catch(e){return null}
}
function hydrateMessageAttachments(){
  if(!S.supabase)return;
  document.querySelectorAll('[data-msg-attachment]').forEach(el=>{
    const path=el.getAttribute('data-msg-attachment');
    if(!path)return;
    const attr=el.tagName==='A'?'href':'src';
    const cache=msgAttachmentSignedUrls.get(path);
    if(cache&&cache.expiresAt>Date.now()+30000){el.setAttribute(attr,cache.url);return}
    if(el.getAttribute(attr))return;
    if(msgAttachmentSignedPending.has(path)||msgAttachmentSignedFailed.has(path))return;
    msgAttachmentSignedPending.add(path);
    S.supabase.storage.from(MSG_ATTACHMENT_BUCKET).createSignedUrl(path,3600).then(({data,error})=>{
      if(error)throw error;
      if(!data||!data.signedUrl)throw new Error('URL bertanda tangan tidak tersedia');
      msgAttachmentSignedUrls.set(path,{url:data.signedUrl,expiresAt:Date.now()+3600000});
      document.querySelectorAll('[data-msg-attachment]').forEach(current=>{
        if(current.getAttribute('data-msg-attachment')===path)current.setAttribute(current.tagName==='A'?'href':'src',data.signedUrl);
      });
    }).catch(error=>{
      msgAttachmentSignedFailed.add(path);
      console.error('Lampiran pesan privat gagal dimuat:',error);
    }).finally(()=>{msgAttachmentSignedPending.delete(path)});
  });
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
    /* Yang disimpan BUKAN URL publik (bucket kini privat, Prioritas 1):
       cukup JALUR storage-nya di field url. Saat tampil, jalur ini
       ditukar URL bertanda tangan oleh attachmentView +
       hydrateMessageAttachments — konsisten untuk semua pembaca. */
    uploaded.push({url:path,name:file.name,type:file.type||'application/octet-stream'});
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
  if(!attachment)return null;
  const mentah=String(attachment.url||attachment.path||'');
  /* Jalur utama (Prioritas 1): lampiran milik bucket pesan — nilai baru
     berupa jalur polos maupun URL publik lama — ditampilkan lewat URL
     bertanda tangan. Elemen membawa data-msg-attachment=<jalur>; alamat
     siap pakai diisi dari cache bila sudah ada, selain itu diisi oleh
     hydrateMessageAttachments() sesudah elemen terpasang (pola yang
     sama seperti media privat anggota di media.js). */
  const path=S.supabase?attachmentStoragePath(mentah):null;
  if(path){
    const cache=msgAttachmentSignedUrls.get(path);
    const siap=cache&&cache.expiresAt>Date.now()+30000?cache.url:'';
    if(attachment.type&&attachment.type.startsWith('image/')){
      const imgAttrs={'data-msg-attachment':path,alt:attachment.name||'Gambar lampiran',class:'chat-image'};
      const aAttrs={'data-msg-attachment':path,target:'_blank',rel:'noopener noreferrer'};
      if(siap){imgAttrs.src=siap;aAttrs.href=siap}
      return h('a',aAttrs,h('img',imgAttrs));
    }
    if(attachment.type&&attachment.type.startsWith('audio/')){
      const auAttrs={controls:true,'data-msg-attachment':path};
      if(siap)auAttrs.src=siap;
      return h('audio',auAttrs);
    }
    const fAttrs={'data-msg-attachment':path,target:'_blank',rel:'noopener noreferrer',class:'chat-file'};
    if(siap)fAttrs.href=siap;
    return h('a',fAttrs,icon('attachment',16),h('span',{},attachment.name||'Buka lampiran'));
  }
  /* Cadangan: lampiran tertanam mode lokal (data URL) dan nilai lama
     yang bukan jalur bucket ini — tetap lewat penjaga safeAttachmentUrl. */
  const url=safeAttachmentUrl(mentah);
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
  const gallery=h('input',{type:'file',multiple:true,accept:'image/*',style:'display:none'});
  file.onchange=()=>update(file);camera.onchange=()=>update(camera);gallery.onchange=()=>update(gallery);
  /* Menu '+' berisi TEPAT tiga pilihan: 'Gambar' (pilih gambar dari
     galeri, input gambar tanpa capture), 'Kamera' (ambil foto lewat
     kamera, input gambar dengan capture), dan 'File' (pilih berkas,
     input berkas umum yang sudah ada). */
  return {files,label,buttons:h('div',{class:'attachment-tools'},
    h('button',{class:'btn s',onclick:()=>gallery.click()},icon('image',16),h('span',{},'Gambar')),
    h('button',{class:'btn s',onclick:()=>camera.click()},icon('camera',16),h('span',{},'Kamera')),
    h('button',{class:'btn s',onclick:()=>file.click()},icon('attachment',16),h('span',{},'File')))};
}
function replyBox(messageId){
  const input=h('textarea',{rows:2,placeholder:'Tulis balasan...'});
  const picker=attachmentPicker();
  const menu=h('div',{class:'attachment-menu'},picker.buttons);
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
  /* Tombol '+' berada DI DALAM field tulis (pembungkus .composer-field,
     sisi kiri dalam); Kirim tetap di luar field di kanan. Menu '+'
     berisi Gambar/Kamera/File. */
  return h('div',{class:'reply-box'},menu,h('div',{class:'composer-row'},h('div',{class:'composer-field'},input,plus),send),picker.label);
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
  /* Sama seperti kolom balasan utas: '+' di dalam field kiri,
     Kirim di luar field. */
  return h('div',{class:'reply-box'},menu,h('div',{class:'composer-row'},h('div',{class:'composer-field'},input,plus),send),picker.label);
}
/* Kolom tulis PESAN GRUP: mengirimnya membuat pesan pokok baru tanpa
   penerima dengan pengirim saya (admin/pengurus) — pesan grup yang
   dibaca semua admin & pengurus. Tata letak kolomnya sama seperti
   kolom balasan utas: '+' lampiran di dalam field kiri, Kirim di
   luar field. */
function groupMessageBox(){
  const input=h('textarea',{rows:2,placeholder:'Tulis pesan untuk grup...'});
  const picker=attachmentPicker();
  const menu=h('div',{class:'attachment-menu'},picker.buttons);
  const plus=h('button',{class:'composer-plus',type:'button',title:'Lampiran',onclick:()=>menu.classList.toggle('open')},'+');
  const send=h('button',{class:'btn',onclick:async e=>{
    if(!input.value.trim()&&!picker.files.length)return;
    try{
      e.currentTarget.disabled=true;
      const attachments=await uploadMessageFiles(picker.files);
      await submitMessage({nama:S.name||S.email||'Pengurus',teks:input.value.trim(),attachments});
      await loadMessages();
      render();
    }catch(error){e.currentTarget.disabled=false;alert('Gagal mengirim pesan: '+error.message)}
  }},'Kirim');
  return h('div',{class:'reply-box'},menu,h('div',{class:'composer-row'},h('div',{class:'composer-field'},input,plus),send),picker.label);
}
function vPesan(){
  if(!S.uid)return [h('h1',{},'Pesan Grup'),accountForm()];
  /* Penjaga terakhir: halaman ini khusus admin & pengurus. Navigasi
     sudah dijaga di go()/render(); baris ini memastikan tidak ada
     jalur lain yang menggambar utas grup untuk anggota. */
  if(!S.admin)return [h('h1',{},'Pesan Grup'),h('p',{class:'warn'},'Pesan grup hanya untuk admin dan pengurus.')];
  if(!S.directoryLoaded&&!S.directoryLoading)loadUserDirectory().then(()=>{if(S.view==='pesan')renderDariData()});
  const roots=groupMessages();
  const entries=groupEntries();
  /* Membuka grup = membacanya: tandai pesan grup sebagai terbaca
     (ditunda keluar dari gambar ulang yang sedang berjalan, dan hanya
     bila memang ada yang belum dibaca). */
  if(S.unreadMessages>0){
    const grupUntukDibaca={messages:roots};
    setTimeout(()=>{if(S.view==='pesan'&&S.admin)markMessagesRead(grupUntukDibaca)},0);
  }
  /* Setiap gelembung bisa DITEKAN LAMA untuk membuka pilihan Hapus
     (lihat pasangTekanLamaPesan). Pesan dari pengirim lain tampil
     dengan avatar + nama pengirimnya, seperti obrolan grup. */
  const chatBody=h('div',{class:'chat-body'},...(entries.length?entries.map(entry=>{
    const bubble=h('div',{class:'chat-bubble'},entry.teks,...entry.attachments.map(attachmentView).filter(Boolean));
    pasangTekanLamaPesan(bubble,entry);
    const isi=[bubble,h('small',{class:'chat-time'},formatChatTime(entry.at))];
    if(entry.mine)return h('div',{class:'chat-line outgoing'},h('div',{class:'chat-entry'},...isi));
    return h('div',{class:'chat-line incoming'},
      groupSenderAvatar(entry),
      h('div',{class:'chat-entry'},h('small',{class:'chat-sender'},groupSenderName(entry)),...isi));
  }):[h('p',{class:'warn chat-empty'},'Belum ada pesan di grup. Tulis pesan pertama untuk admin dan pengurus lain di bawah.')]));
  /* Penempatan LANGSUNG di pesan terbaru (paling bawah), tanpa animasi
     gulir — pola yang sama seperti utas percakapan sebelumnya. */
  chatBody.style.scrollBehavior='auto';
  requestAnimationFrame(()=>{chatBody.scrollTop=chatBody.scrollHeight});
  return [
    h('div',{class:'inbox-head'},h('h1',{},'Pesan Grup')),
    h('section',{class:'chat-card'},
      h('div',{class:'chat-head'},
        h('div',{class:'chat-avatar'},icon('team',20)),
        h('div',{},h('b',{},'Admin & Pengurus'),h('small',{},'Grup khusus admin dan pengurus'))),
      chatBody,
      groupMessageBox()),
    dialogPesan()
  ];
}
/* ===== maskot: gambar diam, bisa digeser, ketuk untuk tanya admin ===== */
