const S={members:[],events:[],topics:[],cleaningDuties:[],view:'landing',openConversation:null,messageSignature:'',admin:false,mainAdmin:false,uid:null,email:'',name:'',approvalStatus:'approved',pendingUsers:[],mapError:'',db:null,supabase:null,messageChannel:null,authLoading:true,unreadMessages:0};
const $=s=>document.querySelector(s);
function h(t,p,...k){const e=document.createElement(t);for(const a in p||{}){if(a==='onclick')e.onclick=p[a];else if(a==='class')e.className=p[a];else e.setAttribute(a,p[a])}k.flat().forEach(c=>{if(c!=null&&c!==false)e.append(c)});return e}
const ALL=[['landing','🗺️ Beranda'],['dash','🏠 Dashboard'],['members','👥 Data Anggota'],['absen','📝 Absensi'],['piket','🧹 Jadwal Piket'],['forum','💬 Forum'],['import','📥 Import Database',1],['pesan','📨 Pesan Masuk']];
function go(v){S.view=v;S.form=S.detail=S.dutyForm=null;if(v==='pesan'&&S.admin)S.openConversation=null;document.body.classList.remove('open');render();if(v==='pesan'&&!S.admin)markMessagesRead()}
$('#mn').onclick=()=>document.body.classList.add('open');
$('#ov').onclick=()=>document.body.classList.remove('open');
$('#st').onclick=()=>$('#sp').classList.toggle('open');
$('#mp').onclick=()=>{$('#sp').classList.remove('open');go('map-settings')};
$('#ap').onclick=()=>{$('#sp').classList.remove('open');go('approvals')};

function wilayah(){const m={};S.members.forEach(x=>{const w=x.wilayah||'Belum diisi';(m[w]=m[w]||[]).push(x)});return m}
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
    let result;
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
        const {data:profile}=await S.supabase.from('profiles').select('approval_status').eq('id',result.data.user.id).maybeSingle();
        if(profile?.approval_status==='pending'||profile?.approval_status==null){
          await S.supabase.auth.signOut();
          notice.className='warn auth-error';
          notice.textContent='Akun Anda masih menunggu persetujuan admin.';
        }else if(profile.approval_status==='rejected'){
          await S.supabase.auth.signOut();
          notice.className='warn auth-error';
          notice.textContent='Pendaftaran akun Anda ditolak oleh admin.';
        }else notice.textContent='Akun Anda telah disetujui. Login berhasil.';
      }
    }
    if(!result.error&&!signup)await loadMessages();
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

function vLanding(){
  const memberCount=S.members.length, eventCount=S.events.length;
  return [h('div',{class:'landing'},
    h('section',{class:'hero'},
      h('p',{style:'font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-bottom:10px'},'Komunitas Indonesia di Shikoku'),
      h('h1',{},'Tumbuh bersama, jauh dari rumah.'),
      h('p',{},'Shikoku Family menjadi ruang untuk saling terhubung, berbagi informasi, dan membangun kehidupan yang lebih hangat di Jepang.'),
      h('button',{class:'btn',onclick:askForm},'Gabung Komunitas →'),
      h('button',{class:'btn s',onclick:()=>go('dash')},'Jelajahi Komunitas')
    ),
    h('div',{class:'stats'},...[['Anggota',memberCount],['Kegiatan',eventCount],['Wilayah','Shikoku']].map(x=>h('div',{},h('small',{},x[0]),h('b',{style:'font-size:18px'},String(x[1]))))),
    h('h2',{class:'section-title'},'Mengapa bergabung?'),
    h('div',{class:'benefits'},
      h('div',{class:'benefit'},h('strong',{},'🤝'),h('b',{},'Temukan koneksi'),h('small',{},'Kenali teman dan keluarga Indonesia di berbagai wilayah Shikoku.')),
      h('div',{class:'benefit'},h('strong',{},'💡'),h('b',{},'Berbagi informasi'),h('small',{},'Dapatkan informasi praktis tentang kehidupan, kerja, dan adaptasi di Jepang.')),
      h('div',{class:'benefit'},h('strong',{},'🎉'),h('b',{},'Ikuti kegiatan'),h('small',{},'Bergabung dalam kegiatan komunitas dan ciptakan pengalaman baru bersama.'))
    ),
    h('h2',{class:'section-title'},'Kegiatan komunitas'),
    box(h('div',{class:'event-list'},
      eventCount?S.events.slice(-3).reverse().map(e=>h('div',{class:'event-item'},
        h('div',{class:'event-date'},h('small',{},'EVENT'),e.judul?e.judul.slice(0,3).toUpperCase():'—'),
        h('div',{},h('b',{},e.judul),h('small',{class:'warn'},(e.hadir||[]).length+' anggota akan hadir'))
      )):h('p',{class:'warn',style:'margin:0'},'Belum ada kegiatan. Nantikan agenda komunitas berikutnya.'),
      eventCount&&h('button',{class:'btn s',style:'margin-top:12px',onclick:()=>go('absen')},'Lihat semua kegiatan')
    )),
    h('h2',{class:'section-title'},'Pertanyaan umum'),
    box(h('details',{class:'faq'},h('summary',{},'Siapa yang bisa bergabung?'),h('p',{},'Siapa pun yang memiliki hubungan dengan Indonesia dan tinggal, pernah tinggal, atau ingin mengenal wilayah Shikoku dipersilakan bergabung.')),
      h('details',{class:'faq'},h('summary',{},'Apa saja kegiatan komunitas?'),h('p',{},'Kegiatan dapat berupa silaturahmi, berbagi informasi, dukungan pendatang baru, dan agenda sosial lainnya.')),
      h('details',{class:'faq'},h('summary',{},'Bagaimana cara menghubungi admin?'),h('p',{},'Gunakan maskot Tanya Admin di kanan bawah untuk mengirim pesan langsung kepada pengurus komunitas.'))
    ),
    box(h('div',{style:'text-align:center;padding:8px 0'},
      h('h2',{style:'margin:4px 0 8px'},'Mari terhubung bersama'),
      h('p',{class:'sub',style:'margin-bottom:14px'},'Ceritakan sedikit tentang Anda. Admin akan membantu mengenalkan komunitas dan kegiatan yang sesuai.'),
      h('button',{class:'btn',onclick:askForm},'Kirim pesan ke Admin')
    )),
    h('div',{class:'landing-footer'},'© '+new Date().getFullYear()+' Shikoku Family · Komunitas Indonesia di Shikoku')
  )];
}
function vDash(){
  const c=(e,t,d,n,v)=>h('button',{class:'card',onclick:()=>go(v)},
    h('span',{class:'e',style:'position:relative'},e,v==='pesan'&&h('span',{class:'icon-badge','data-message-badge':'true',style:S.unreadMessages>0?'':'display:none'},String(S.unreadMessages))),
    h('span',{style:'flex:1'},h('b',{},t),h('small',{},d),h('br'),h('b',{style:'font-size:15px'},n)),'›');
  return [h('h1',{},'Selamat datang'+(S.name?', '+S.name.split(' ')[0]:'')+' 👋'),
    h('p',{class:'sub'},new Date().toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'})),
    h('div',{class:'card',style:'display:block'},h('small',{class:'warn'},'User ID'),h('br'),h('b',{},S.email||S.uid||'-')),
    h('div',{class:'stats'},...[['Anggota',S.members.length],['Kegiatan',S.events.length],['Wilayah',Object.keys(wilayah()).length]].map(x=>h('div',{},h('small',{},x[0]),h('b',{},String(x[1]))))),
    c('🗄️','Database','Kelola data anggota komunitas',S.members.length+' anggota','members'),
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
  if(S.form)return [formCard()];
  const wl=[...new Set(S.members.map(m=>m.wilayah).filter(Boolean))].sort();
  const sel=(opts,key,all)=>{const s=h('select',{},h('option',{value:''},all),...opts.map(o=>h('option',{value:o},o)));s.value=S[key]||'';s.onchange=()=>{S[key]=s.value;draw()};return s};
  const q=h('input',{placeholder:'Cari nama, nomor WhatsApp, kota, wilayah'});q.value=S.q||'';q.oninput=()=>{S.q=q.value;draw()};
  const cnt=h('p',{class:'sub'}),tbl=h('div',{class:'card',style:'display:block;padding:0;overflow:hidden'}),bar=h('div');
  S.sel=S.sel||new Set();
  function draw(){
    const t=(S.q||'').toLowerCase();
    const rows=S.members.map((m,i)=>({...m,kode:m.kode||'MEM-'+String(i+1).padStart(5,'0')})).filter(m=>(!t||[m.nama,m.wa,m.kota,m.wilayah,m.kode].some(x=>(x||'').toLowerCase().includes(t)))&&(!S.fw||m.wilayah===S.fw)&&(!S.fp||(m.peran||'Anggota')===S.fp)&&(!S.fs||(m.status||'aktif')===S.fs));
    cnt.textContent=rows.length+' anggota ditampilkan';
    const all=h('input',{type:'checkbox'});all.checked=rows.length>0&&rows.every(m=>S.sel.has(m.id));all.onchange=()=>{rows.forEach(m=>all.checked?S.sel.add(m.id):S.sel.delete(m.id));draw()};
    tbl.replaceChildren(h('div',{class:'mrow hd'},S.admin&&all,h('span',{style:'flex:1'},'Anggota'),h('span',{style:'margin-right:84px'},'Status')),
      ...rows.map(m=>{const c=h('input',{type:'checkbox'});c.checked=S.sel.has(m.id);c.onchange=()=>{c.checked?S.sel.add(m.id):S.sel.delete(m.id);draw()};
        return h('div',{class:'mrow'},S.admin&&c,h('div',{class:'av'},(m.nama||'?')[0].toUpperCase()),
          h('div',{style:'flex:1;min-width:0'},h('b',{style:'text-transform:uppercase;overflow-wrap:anywhere'},m.nama),h('br'),h('small',{class:'warn'},m.kode)),
          h('span',{class:'ok'+((m.status||'aktif')==='aktif'?'':' off')},m.status||'aktif'),
          h('button',{class:'btn s',title:'Lihat',onclick:()=>{S.detail=m;S.form=null;render()}},'👁'),
          S.admin&&h('button',{class:'btn s',title:'Ubah',onclick:()=>{S.form=m;S.detail=null;render()}},'✎'))}));
    if(!rows.length)tbl.append(h('p',{class:'warn',style:'padding:16px'},'Belum ada anggota.'));
    bar.replaceChildren(...[S.admin&&S.sel.size>0&&h('button',{class:'btn',style:'margin-bottom:12px',onclick:async()=>{if(!confirm('Hapus '+S.sel.size+' anggota terpilih?'))return;for(const id of S.sel)await S.db.collection('members').doc(id).delete();S.sel.clear()}},'Hapus '+S.sel.size+' terpilih')].filter(Boolean));
  }
  draw();
  return [h('div',{class:'top'},h('div',{},h('h1',{},'Data Anggota'),cnt),S.admin&&h('button',{class:'btn',onclick:()=>{S.form={};S.detail=null;render()}},'+ Tambah Anggota')),guard(),
    S.detail&&detailCard(),
    h('div',{class:'card',style:'display:block'},q,h('div',{class:'fl'},sel(wl,'fw','Semua Wilayah'),sel(PERAN,'fp','Semua'),sel(STATUS,'fs','Semua Status'))),bar,tbl];
}
function detailCard(){const m=S.detail;return h('div',{class:'card',style:'display:block'},m.foto&&h('img',{src:'/_blob/'+m.foto,style:'width:80px;height:80px;border-radius:50%;object-fit:cover;display:block;margin-bottom:8px'}),h('b',{style:'text-transform:uppercase'},m.nama),h('br'),
  ...[['Panggilan',m.panggilan],['Jenis kelamin',m.kelamin],['Tanggal lahir',m.lahir],['WhatsApp',m.wa],['Email',m.email],['Wilayah',m.wilayah],['Kota',m.kota],['Prefektur',m.pref],['Stasiun',m.stasiun],['Alamat Jepang',m.alamat_jp],['Kabupaten/Kota (ID)',m.kab],['Alamat Indonesia',m.alamat_id],['Pekerjaan',m.bidang],['Perusahaan',m.perusahaan],['Status tinggal',m.tinggal],['Instagram',m.instagram],['TikTok',m.tiktok],['Facebook',m.facebook],['Catatan',m.catatan],['Status',m.status||'aktif']].map(r=>h('div',{class:'warn'},r[0]+': '+(r[1]||'-'))),
  h('button',{class:'btn s',style:'margin-top:8px',onclick:()=>{S.detail=null;render()}},'Tutup'))}
const PREF=['Ehime','Kagawa','Kochi','Tokushima','Hokkaido','Aomori','Iwate','Miyagi','Akita','Yamagata','Fukushima','Ibaraki','Tochigi','Gunma','Saitama','Chiba','Tokyo','Kanagawa','Niigata','Toyama','Ishikawa','Fukui','Yamanashi','Nagano','Gifu','Shizuoka','Aichi','Mie','Shiga','Kyoto','Osaka','Hyogo','Nara','Wakayama','Tottori','Shimane','Okayama','Hiroshima','Yamaguchi','Fukuoka','Saga','Nagasaki','Kumamoto','Oita','Miyazaki','Kagoshima','Okinawa'];
const PROV=['Aceh','Sumatera Utara','Sumatera Barat','Riau','Kepulauan Riau','Jambi','Sumatera Selatan','Bangka Belitung','Bengkulu','Lampung','DKI Jakarta','Banten','Jawa Barat','Jawa Tengah','DI Yogyakarta','Jawa Timur','Bali','Nusa Tenggara Barat','Nusa Tenggara Timur','Kalimantan Barat','Kalimantan Tengah','Kalimantan Selatan','Kalimantan Timur','Kalimantan Utara','Sulawesi Utara','Gorontalo','Sulawesi Tengah','Sulawesi Barat','Sulawesi Selatan','Sulawesi Tenggara','Maluku','Maluku Utara','Papua','Papua Barat','Papua Barat Daya','Papua Selatan','Papua Tengah','Papua Pegunungan'];
const BLN=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const TGL=['Technical Intern (Ginou Jisshu)','Specified Skilled Worker (Tokutei Ginou)','Engineer/Specialist','Pelajar','Permanent Resident','Dependent/Keluarga','Lainnya'];
function fld(l,k,o){o=o||{};const f=S.form;let e;
  if(o.opts)e=h('select',{},h('option',{value:''},o.ph||'Pilih'),...o.opts.map(x=>h('option',{value:x},x)));
  else if(o.area)e=h('textarea',{rows:3,placeholder:o.ph||''});
  else e=h('input',{placeholder:o.ph||'',type:o.type||'text'});
  if(o.opts&&f[k]&&!o.opts.includes(f[k]))e.append(h('option',{value:f[k]},f[k]));e.value=f[k]||'';e.oninput=e.onchange=()=>{f[k]=e.value};
  return h('label',{class:'lb'},l,e)}
const box=(...k)=>h('div',{class:'card',style:'display:block'},...k);
async function autoFill(txt,b){
  if(!S.admin)return;const sm=await claude.use('sample');if(!sm){alert('Isi otomatis belum tersedia');return}
  if(!txt.trim())return;b.disabled=true;b.textContent='Memproses...';
  try{const r=await sm.json('Ekstrak data anggota dari teks berikut. Format sumber biasanya berupa daftar bernomor dengan label seperti Nama Lengkap, Jenis Kelamin, Tgl/bln/thn lahir, Umur, Kelompok/Desa/Daerah di Indonesia, No. Hp Pengurus Daerah + Nama, Status (lajang/menikah), MT (iya/bukan), Mulai Tinggal di Jepang, Alamat Tinggal di Jepang, Status Visa, No. HP/WA, Facebook, dan No. HP Orang Tua + Nama. Balas HANYA JSON dengan kunci berikut, kosongkan jika tidak ada: nama,panggilan,kelamin (normalisasi menjadi "Laki-laki" atau "Perempuan"),lahir (YYYY-MM-DD jika lengkap),umur,kelompok,desa,daerah,pengurus,hp_pengurus,nikah (normalisasi menjadi "Belum menikah", "Menikah", atau "Cerai"),mt,mulai_jp,prov,kab,kec,alamat_id,kodepos,pref,kota,kec_jp,stasiun,alamat_jp,tinggal (status visa),wa,facebook,ortu,hp_ortu,email,instagram,tiktok. Jika satu label berisi nama dan nomor telepon, pisahkan ke field nama dan hp yang sesuai. Jangan mengarang data yang kosong. TEKS: '+txt);
    Object.entries(r||{}).forEach(([k,v])=>{if(v!==null&&v!==undefined&&v!=='')S.form[k]=String(v)});render()}
  catch(e){alert('Gagal memproses teks');b.disabled=false;b.textContent='Isi Otomatis'}}
async function up(file,key,multi){
  if(!file)return;if(!S.assets){alert('Unggah foto hanya tersedia untuk admin');return}
  try{const r=await S.assets.upload(file);S.form[key]=multi?[...(S.form[key]||[]),r.id]:r.id;render()}catch(e){alert('Gagal mengunggah')}}
function pick(label,acc,cap,cb){const i=h('input',{type:'file',accept:acc,style:'display:none'});if(cap)i.setAttribute('capture','environment');i.onchange=()=>cb(i.files[0]);return h('button',{class:'btn s',onclick:()=>i.click()},label)}
async function saveForm(){
  const f=S.form;
  if(!f.wilayah){S.step=0;alert('Wilayah wajib diisi');return render()}
  if(!(f.nama||'').trim()){S.step=0;alert('Nama lengkap wajib diisi');return render()}
  const d={...f};delete d.id;d.peran=d.peran||'Anggota';d.status=d.status||'aktif';
  try{if(f.id)await S.db.collection('members').doc(f.id).set(d);else await S.db.collection('members').add({...d,at:Date.now()});S.form=null;render()}catch(e){alert('Tidak bisa menyimpan')}}
function formCard(){
  const f=S.form;
  if(S._fr!==f){S._fr=f;S.step=0;if(!f.id&&!f.kode){const n=Math.max(S.members.length,...S.members.map(m=>parseInt(String(m.kode||'').split('-').pop())||0))+1;f.kode='IJCCS-'+String(n).padStart(4,'0')}}
  const yr=Array.from({length:12},(_,i)=>String(new Date().getFullYear()-i));
  const auto=()=>{const ta=h('textarea',{rows:8,placeholder:'Tempel data dengan format berikut:\n1. Nama Lengkap : Bahroin Idris Tampubolon\n2. Jenis Kelamin : laki-laki\n3. Tgl/bln/thn lahir :\n4. Umur :\n5. Kelompok, Desa, Daerah di Indonesia :\n6. No. Hp Pengurus Daerah + Nama :\n7. Status (lajang/menikah) :\n8. MT (iya/bukan) :\n9. Mulai Tinggal di Jepang :\n10. Alamat Tinggal di Jepang :\n11. Status Visa :\n12. No. HP/WA :\n13. Facebook :\n14. No. HP Orang Tua + Nama :'});const b=h('button',{class:'btn s',onclick:()=>autoFill(ta.value,b)},'Isi Otomatis');return box(h('b',{},'Isi Otomatis'),ta,b,h('p',{class:'warn'},'Tempel data sesuai template. Sistem akan memetakan isinya ke kolom identitas, alamat, visa, kontak, dan keluarga. Tetap periksa hasilnya sebelum menyimpan.'))};
  const fotoBox=()=>box(h('b',{},'Foto Diri'),h('br'),f.foto&&h('img',{src:'/_blob/'+f.foto,style:'width:80px;height:80px;border-radius:50%;object-fit:cover;margin:8px 0;display:block'}),pick('Ambil Foto','image/jpeg,image/png,image/webp',1,x=>up(x,'foto')),' ',pick('Pilih dari Galeri','image/jpeg,image/png,image/webp',0,x=>up(x,'foto')),h('p',{class:'warn'},'Format JPG, JPEG, PNG, WEBP.'));
  const suratBox=()=>box(h('b',{},'Surat Sambung'),h('br'),...(f.surat||[]).map((id,i)=>h('div',{class:'row',style:'margin:6px 0'},h('a',{href:'/_blob/'+id,target:'_blank'},'Lampiran '+(i+1)),h('button',{class:'btn s',onclick:()=>{f.surat=f.surat.filter(x=>x!==id);render()}},'✕'))),pick('Ambil Foto','image/*,application/pdf',1,x=>up(x,'surat',1)),' ',pick('Pilih dari Galeri','image/*,application/pdf',0,x=>up(x,'surat',1)),h('p',{class:'warn'},'Foto, scan, atau PDF. Boleh beberapa file.'));
  const T=[
   ['Identitas',()=>[S.admin&&auto(),box(h('b',{},'Identitas'),fld('Wilayah *','wilayah',{opts:PREF,ph:'Pilih wilayah'}),fld('Nomor Anggota','kode'),fld('Nama Lengkap *','nama'),fld('Nama Panggilan','panggilan'),fld('Jenis Kelamin','kelamin',{opts:['Laki-laki','Perempuan']}),fld('Tanggal Lahir','lahir',{type:'date'}),fld('Umur','umur'),fld('Status','status',{opts:STATUS}),fld('Peran','peran',{opts:PERAN}),fld('Pernikahan','nikah',{opts:['Belum menikah','Menikah','Cerai']}),fld('MT','mt'),fld('Nama Orang Tua','ortu'),fld('No. HP Orang Tua','hp_ortu',{ph:'+62xxxxxxxxxx'}),h('div',{class:'fl'},fld('Bulan Kedatangan','bln',{opts:BLN}),fld('Tahun','thn',{opts:yr})),fld('Mulai Tinggal di Jepang','mulai_jp',{ph:'Contoh: April 2022'}))]],
   ['Alamat Indonesia',()=>[box(h('b',{},'Alamat Indonesia'),fld('Provinsi','prov',{opts:PROV,ph:'Pilih provinsi'}),fld('Kabupaten/Kota','kab'),fld('Kecamatan','kec'),fld('Desa/Kelurahan','desa'),fld('Kelompok','kelompok'),fld('Daerah','daerah'),fld('Alamat Lengkap Indonesia (nama jalan, nomor rumah, gedung, RT/RW)','alamat_id',{area:1,ph:'Contoh: Jl. Kebon Sirih No. 10, RT 3/RW 5'}),fld('Nama Pengurus Daerah','pengurus'),fld('No. HP Pengurus Daerah','hp_pengurus',{ph:'+81xxxxxxxxxx'}))]],
   ['Alamat Jepang',()=>[box(h('b',{},'Alamat Jepang'),fld('Kode Pos','kodepos',{ph:'7 digit, misal 1600022'}),fld('Prefektur','pref',{opts:PREF,ph:'Pilih prefektur'}),fld('Kota','kota'),fld('Kecamatan (romaji)','kec_jp'),fld('Stasiun Terdekat','stasiun'),fld('Alamat Jalan / Gedung Jepang','alamat_jp',{area:1,ph:'Nama jalan, nomor blok, gedung, dsb. (romaji)'}))]],
   ['Pekerjaan & Kontak',()=>[box(h('b',{},'Bidang Pekerjaan'),fld('Bidang Pekerjaan','bidang'),fld('Nama Perusahaan','perusahaan'),fld('Status Tinggal di Jepang','tinggal',{opts:TGL,ph:'Pilih status tinggal'})),box(h('b',{},'Kontak & Media Sosial'),fld('Nomor HP / WA','wa',{ph:'+81xxxxxxxxxx'}),fld('Email','email',{type:'email'}),fld('Instagram','instagram',{ph:'@username'}),fld('TikTok','tiktok',{ph:'@username'}),fld('Facebook','facebook'))]],
   ['Foto, Surat & Catatan',()=>[fotoBox(),suratBox(),box(h('b',{},'Catatan'),fld('','catatan',{area:1,ph:'Catatan tambahan...'}))]]
  ];
  const last=S.step===T.length-1;
  return h('div',{},h('div',{class:'row',style:'justify-content:flex-start;gap:12px;margin:8px 0'},h('button',{class:'ic',onclick:()=>{S.form=null;render()}},'←'),h('h1',{style:'margin:0;font-size:24px'},f.id?'Ubah Anggota':'Tambah Anggota')),
    h('p',{class:'sub',style:'margin-bottom:6px'},'Langkah '+(S.step+1)+' dari '+T.length+': '+T[S.step][0]),
    h('div',{class:'dots'},...T.map((_,i)=>h('span',{class:i<=S.step?'on':''}))),
    ...T[S.step][1](),
    h('div',{class:'nav'},S.step>0&&h('button',{class:'btn s',onclick:()=>{S.step--;render();scrollTo(0,0)}},'Kembali'),
      h('button',{class:'btn',onclick:()=>{if(last)saveForm();else{S.step++;render();scrollTo(0,0)}}},last?'Simpan':'Lanjut')))}
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
        h('div',{class:'duty-assignment'},h('b',{},assignment.nama),h('span',{},assignment.tugas)))),
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
async function loadPendingUsers(){
  if(!S.supabase||!S.mainAdmin){S.pendingUsers=[];return}
  const {data,error}=await S.supabase.from('profiles').select('id,name,email,created_at,approval_status').eq('approval_status','pending').order('created_at',{ascending:true});
  if(error){console.error(error);S.pendingUsers=[];return}
  S.pendingUsers=data||[];
}
function csvEsc(v){v=String(v==null?'':v);return(v.includes(',')||v.includes('"')||v.includes(String.fromCharCode(10)))?'"'+v.split('"').join('""')+'"':v}
async function exportMyMaps(det){
  const dl=await claude.use('downloads');if(!dl){alert('Fitur unduh belum tersedia');return}
  const rows=[['Nama','Wilayah','Alamat','Status','Kode']].concat(S.members.map((m,i)=>[m.panggilan||m.nama,m.wilayah||m.pref||'',alamatJp(m,det),m.status||'aktif',m.kode||'MEM-'+String(i+1).padStart(5,'0')]).filter(r=>r[2]&&r[2]!=='Japan'));
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
function sebaran(){const w=wilayah(),k=Object.keys(w);return k.length?k.map(n=>h('div',{class:'card',style:'display:block'},h('div',{class:'row'},h('b',{},'📍 '+n),h('span',{class:'tag'},w[n].length+' anggota')),h('small',{},w[n].map(x=>x.nama).join(', ')))):[h('p',{class:'warn'},'Belum ada data wilayah.')]}
function vImport(){
  const ta=h('textarea',{rows:8,placeholder:'Satu baris satu anggota:\nnama,wilayah\nBudi,Ehime\nSiti,Kagawa'});
  return [h('h1',{},'Import Database'),h('p',{class:'sub'},'Tempel data CSV (nama,wilayah)'),
    h('div',{class:'card',style:'display:block'},ta,h('button',{class:'btn',onclick:async()=>{
      const rows=ta.value.split('\n').map(r=>r.split(',').map(x=>x.trim())).filter(r=>r[0]);
      for(const r of rows)await S.db.collection('members').add({nama:r[0],wilayah:r[1]||'',at:Date.now()});
      ta.value='';alert(rows.length+' anggota diimpor');go('members')}},'Import'))];
}

const V={landing:vPeta,dash:vDash,members:vMembers,absen:vAbsen,piket:vPiket,forum:vForum,import:vImport,'map-settings':vPetaSettings,approvals:vApprovals,pesan:vPesan};
function render(){
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
  const d=$('#dr');d.replaceChildren(h('p',{class:'sub',style:'padding:0 14px'},h('b',{style:'color:var(--ink)'},'KOMUNITAS ID-JP'),h('br'),'Database Anggota'),
    ...ALL.filter(x=>!x[2]||(x[3]?S.mainAdmin:S.admin)).map(x=>h('a',{class:S.view===x[0]?'on':'',onclick:()=>go(x[0]),...(x[0]==='pesan'?{'data-message-nav':'true'}:{})},
      x[1],x[0]==='pesan'&&S.unreadMessages>0&&h('span',{class:'nav-badge'},String(S.unreadMessages)))),
    h('button',{class:'menu-logout',onclick:async()=>{await S.supabase.auth.signOut()}},'🚪 Keluar'));
  $('#sw').style.display=S.mainAdmin?'flex':'none';
  const approvalBadge=$('#ab');
  approvalBadge.textContent=S.pendingUsers.length?String(S.pendingUsers.length):'';
  approvalBadge.style.display=S.pendingUsers.length?'inline-grid':'none';
  const current=ALL.find(x=>x[0]===S.view);
  if(!V[S.view]||['map-settings','approvals'].includes(S.view)&&!S.mainAdmin||current?.[2]&&!S.admin)S.view='landing';
  $('#app').replaceChildren(...[].concat(V[S.view]()).filter(Boolean));
  const tb=$('#tb');tb.style.display=S.form?'none':'flex';$('#pet').style.display=S.form?'none':'block';
  tb.replaceChildren(...[['landing','🗺️','Beranda'],['dash','🏠','Ringkasan'],['members','👥','Anggota'],['absen','📝','Absensi'],['piket','🧹','Piket'],['forum','💬','Forum']].map(x=>h('a',{class:S.view===x[0]?'on':'',onclick:()=>go(x[0])},h('span',{},x[1]),x[2])));
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
