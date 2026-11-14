/* Pesan ke admin: muat, kirim, balas, lampiran, tampilan percakapan */
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
// Hanya izinkan tautan https dari server Supabase milik aplikasi (cegah tautan berbahaya seperti javascript:)
function safeAttachmentUrl(value){
  try{
    const url=new URL(String(value||''));
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
