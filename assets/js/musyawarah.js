/* Halaman Musyawarah — buku catatan rapat gaya OneNote.
   Tampilan dan fitur mengikuti file musyawarah.html dari Putro (tab tahun,
   daftar halaman, editor kaya, tema warna, mode terang/gelap, Fresh, layar
   penuh, tempat sampah). Penyimpanan disambungkan ke lapisan data aplikasi:
   koleksi 'musyawarah' lewat S.db (Supabase bila online, basis data lokal
   aplikasi bila di perangkat ini). Kunci localStorage asli file itu
   ('musyawarah-v1') tetap ditulis sebagai cermin/cadangan. */
const MUSY_KEY='musyawarah-v1';
const MUSY_COL=['#2b7a8c','#3985c6','#2a8f7d','#d98a4a','#8e7cc3','#4f772d'];
const MUSY_TH=[['Teal','#2b7a8c'],['Biru','#3985c6'],['Hijau','#2a8f7d'],['Oranye','#d98a4a'],['Ungu lembut','#8e7cc3'],['Slate','#5c6b7a'],['Merah lembut','#c65b4e'],['Hijau daun','#4f772d']];
const MUSY_MD=[['auto','🌓 Otomatis'],['light','☀ Terang'],['dark','🌙 Gelap']];
const MUSY_G=[['Riwayat',[['undo','↶','Urungkan (Ctrl+Z)'],['redo','↷','Ulangi (Ctrl+Y)']],'a2'],
['Gaya',[['h','H','Judul bagian'],['p','¶','Teks biasa']],'a2'],
['Huruf',[['bold','<b>B</b>','Tebal (Ctrl+B)'],['italic','<i>I</i>','Miring (Ctrl+I)'],['underline','<u>U</u>','Garis bawah (Ctrl+U)'],['strikeThrough','<s>S</s>','Coret','a1'],['hl','🖍','Sorot kuning','a2']]],
['Paragraf',[['insertUnorderedList','•','Daftar poin'],['insertOrderedList','1.','Daftar nomor'],['outdent','⇤','Kurangi indentasi','a1'],['indent','⇥','Tambah indentasi','a1']]],
['Sisipkan',[['todo','☑','Kotak centang (To Do)'],['star','⭐','Tag penting','a2'],['table','▦','Sisipkan tabel','a1'],['hr','―','Garis pemisah','a1'],['now','🕒','Sisipkan tanggal dan jam','a1']]]];
let MUSY=null;
function musyUid(){return 'm'+Math.random().toString(36).slice(2,9)+Date.now().toString(36).slice(-3)}
function musyEsc(s){return String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function musyToday(){return new Date().toISOString().slice(0,10)}
function musyBlank(){return {id:musyUid(),title:'',date:musyToday(),leader:'',scribe:'',html:'',sec:0,run:0,first:0,last:0,_waktu:'',_lokasi:'',_notebook:'umum',_section:'agenda'}}
function musyMd(t){return musyEsc(t).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/^- /gm,'• ').replace(/\n/g,'<br>')}
function musyPlain(html){try{return new DOMParser().parseFromString(String(html||''),'text/html').body.textContent||''}catch(e){const d=document.createElement('div');d.textContent=String(html||'');return d.textContent}}
/* Pembersih HTML catatan: hanya tag/atribut format teks yang diizinkan.
   Catatan bisa ditulis pengguna lain dan dibaca semua anggota, jadi markup
   aktif (event handler, javascript:, iframe, form, skrip) selalu dibuang
   sebelum HTML disimpan maupun ditampilkan. */
const MUSY_ALLOWED_TAGS={H2:1,P:1,UL:1,OL:1,LI:1,B:1,STRONG:1,I:1,EM:1,U:1,S:1,BR:1,HR:1,SPAN:1,DIV:1,TABLE:1,THEAD:1,TBODY:1,TR:1,TD:1,TH:1,BLOCKQUOTE:1};
function musySanitize(html){
  let doc;
  try{doc=new DOMParser().parseFromString(String(html||''),'text/html')}catch(e){return ''}
  const clean=(node)=>{
    [...node.childNodes].forEach(child=>{
      if(child.nodeType===3)return;
      if(child.nodeType!==1){child.remove();return}
      const tag=child.tagName;
      if(tag==='INPUT'){
        if(child.getAttribute('type')!=='checkbox'){child.remove();return}
        const checked=child.hasAttribute('checked');
        [...child.attributes].forEach(a=>child.removeAttribute(a.name));
        child.setAttribute('type','checkbox');
        if(checked)child.setAttribute('checked','');
        return;
      }
      if(!MUSY_ALLOWED_TAGS[tag]){
        if(tag==='SCRIPT'||tag==='STYLE'||tag==='IFRAME'||tag==='OBJECT'||tag==='EMBED'||tag==='FORM'||tag==='LINK'||tag==='META'){child.remove();return}
        clean(child);
        child.replaceWith(...child.childNodes);
        return;
      }
      const keepClass=(tag==='SPAN'&&(child.getAttribute('class')||'').split(/\s+/).includes('todo'))||(tag==='SPAN'&&(child.getAttribute('class')||'').split(/\s+/).includes('musy-todo'));
      let bg='';
      if(tag==='SPAN'){
        const st=child.getAttribute('style')||'';
        const mm=st.match(/background(?:-color)?\s*:\s*(#[0-9a-fA-F]{3,8}|rgba?\([\d\s.,%]+\)|[a-zA-Z]{3,20})/);
        if(mm)bg=mm[1];
      }
      [...child.attributes].forEach(a=>child.removeAttribute(a.name));
      if(keepClass){child.setAttribute('class','musy-todo');child.setAttribute('contenteditable','false')}
      if(bg)child.setAttribute('style','background-color:'+bg);
      clean(child);
    });
  };
  clean(doc.body);
  return doc.body.innerHTML;
}
function musyFd(d){if(!d)return '-';const x=new Date(d+'T00:00:00');return isNaN(x)?d:x.toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})}
function musyHm(t){return new Date(t).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})}
function musyYr(m){return (m.date||'').slice(0,4)||'Tanpa tanggal'}
/* Rekaman aplikasi (judul/tanggal/...) -> halaman buku catatan (title/date/...) */
function musyToMeeting(r){
  const m={id:String(r.id),
    title:r.title!=null?r.title:(r.judul||''),
    date:r.date!=null?r.date:(r.tanggal||''),
    leader:r.leader!=null?r.leader:(r.pemimpin||''),
    scribe:r.scribe!=null?r.scribe:(r.notulis||''),
    html:'',sec:r.sec||0,run:0,first:r.first||r.at||0,last:r.last||r.at||0,
    _waktu:r.waktu||'',_lokasi:r.lokasi||'',_notebook:r.notebook||'umum',_section:r.section||'agenda'};
  if(r.html!==undefined&&r.html!==null)m.html=r.html;
  else if(r.catatanPembahasan)m.html=musyMd(String(r.catatanPembahasan));
  if(r.del)m.del=r.del;
  return m;
}
/* Halaman buku catatan -> rekaman aplikasi (kedua set nama kolom diisi supaya
   catatan lama dan tampilan lain tetap bisa membaca isinya) */
function musyToRecord(m){
  const rec={judul:m.title||'',tanggal:m.date||'',pemimpin:m.leader||'',notulis:m.scribe||'',
    catatanPembahasan:musyPlain(m.html),html:musySanitize(m.html||''),
    title:m.title||'',date:m.date||'',leader:m.leader||'',scribe:m.scribe||'',
    sec:m.sec||0,first:m.first||0,last:m.last||0,del:m.del||0,
    waktu:m._waktu||'',lokasi:m._lokasi||'',notebook:m._notebook||'umum',section:m._section||'agenda',
    at:m.last||m.first||Date.now()};
  return rec;
}
function musyReadLocal(){
  try{
    const raw=localStorage.getItem(MUSY_KEY);
    if(!raw)return {exists:false,data:null};
    const d=JSON.parse(raw);
    if(d&&Array.isArray(d.meetings))return {exists:true,data:d};
  }catch(e){}
  return {exists:false,data:null};
}
function musySaveLocal(){
  if(!MUSY)return;
  try{localStorage.setItem(MUSY_KEY,JSON.stringify({meetings:MUSY.meetings,cur:MUSY.cur}))}catch(e){}
}
/* Tulis satu halaman ke lapisan data aplikasi. S.musyawarah diselaraskan lebih
   dulu supaya pantulan snapshot tidak menggambar ulang editor yang sedang dipakai. */
function musyPersist(m){
  musySaveLocal();
  if(!S.admin)return; /* Anggota biasa hanya membaca: tidak menulis ke lapisan data aplikasi */
  const rec=musyToRecord(m);
  if(!Array.isArray(S.musyawarah))S.musyawarah=[];
  const i=S.musyawarah.findIndex(x=>String(x.id)===String(m.id));
  if(i>=0)S.musyawarah[i]={id:m.id,...rec};else S.musyawarah.push({id:m.id,...rec});
  if(!S.db||!MUSY)return;
  clearTimeout(MUSY.timers[m.id]);
  MUSY.timers[m.id]=setTimeout(()=>{
    try{
      const p=S.db.collection('musyawarah').doc(m.id).set(rec);
      if(p&&p.catch)p.catch(e=>console.error('Catatan musyawarah gagal disimpan:',e));
    }catch(e){console.error('Catatan musyawarah gagal disimpan:',e)}
  },700);
}
function musyPersistDelete(m){
  musySaveLocal();
  S.musyawarah=(S.musyawarah||[]).filter(x=>String(x.id)!==String(m.id));
  if(!S.db)return;
  try{
    const p=S.db.collection('musyawarah').doc(m.id).delete();
    if(p&&p.catch)p.catch(e=>console.error('Catatan musyawarah gagal dihapus:',e));
  }catch(e){console.error('Catatan musyawarah gagal dihapus:',e)}
}
/* Gabungkan data aplikasi ke daftar halaman. Lewati halaman yang sedang
   disunting (dirty) supaya ketikan pengguna tidak tertimpa data pantulan. */
function musyMergeFromApp(skipDirty){
  if(!MUSY)return;
  (S.musyawarah||[]).forEach(r=>{
    const remote=musyToMeeting(r);
    const local=MUSY.meetings.find(x=>String(x.id)===String(remote.id));
    if(!local){MUSY.meetings.push(remote);return}
    if(skipDirty&&MUSY.dirty.has(String(remote.id)))return;
    if((remote.last||0)>=(local.last||0)){
      const keep={_waktu:local._waktu,_lokasi:local._lokasi,_notebook:local._notebook,_section:local._section};
      Object.assign(local,remote,keep._waktu&&!remote._waktu?{_waktu:keep._waktu}:{},keep._lokasi&&!remote._lokasi?{_lokasi:keep._lokasi}:{});
    }
  });
}
function musyActive(){return MUSY.meetings.filter(m=>!m.del)}
function musyCur(){const a=musyActive();return a.find(m=>m.id===MUSY.cur)||a[0]||null}
function musyToast(t){
  if(!MUSY||!MUSY.root)return;
  const e=MUSY.root.querySelector('.musy-toast');
  e.textContent=t;e.classList.add('s');
  clearTimeout(MUSY.toastTimer);
  MUSY.toastTimer=setTimeout(()=>e.classList.remove('s'),1800);
}
function musyTabs(){
  const root=MUSY.root,a=musyActive();
  const ys=[...new Set(a.map(musyYr))].sort().reverse();
  root.querySelector('.musy-tabs').innerHTML=ys.map((y,i)=>'<div class="musy-tab '+(y===MUSY.Y?'on':'')+'" style="--c:'+MUSY_COL[i%MUSY_COL.length]+'" data-y="'+musyEsc(y)+'">'+musyEsc(y)+' <small>'+a.filter(m=>musyYr(m)===y).length+'</small></div>').join('');
}
function musyTrashBtn(){
  const n=MUSY.meetings.filter(m=>m.del).length;
  MUSY.root.querySelector('.musy-trb').textContent=MUSY.TR?'← Kembali ke catatan':'🗑 Tempat sampah'+(n?' ('+n+')':'');
}
function musyList(){
  const root=MUSY.root,q=root.querySelector('.musy-q').value.trim().toLowerCase(),RO=!S.admin;
  musyTrashBtn();
  const listEl=root.querySelector('.musy-list');
  if(MUSY.TR){
    const t=MUSY.meetings.filter(m=>m.del).sort((a,b)=>b.del-a.del);
    listEl.innerHTML=(t.length&&!RO?'<button data-t="empty" style="padding:3px 8px;font-size:13px;margin-bottom:8px;color:#b3402f">Kosongkan sampah</button>':'')+(t.map(m=>'<div class="musy-pg"><b>'+musyEsc(m.title||'(Tanpa judul)')+'</b><span>'+musyEsc(musyFd(m.date))+' · dihapus '+new Date(m.del).toLocaleDateString('id-ID')+'</span>'+(RO?'':'<div class="musy-ta"><button data-t="res" data-i="'+musyEsc(m.id)+'">↩ Pulihkan</button><button class="x" data-t="del" data-i="'+musyEsc(m.id)+'">Hapus permanen</button></div>')+'</div>').join('')||'<div class="musy-empty">Tempat sampah kosong.</div>');
    return;
  }
  const ms=musyActive().filter(m=>q?(m.title+' '+m.leader+' '+m.scribe+' '+musyFd(m.date)+' '+musyPlain(m.html).toLowerCase()).toLowerCase().includes(q):musyYr(m)===MUSY.Y)
    .sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  listEl.innerHTML=ms.map(m=>'<div class="musy-pg '+(m.id===MUSY.cur?'on':'')+'" data-i="'+musyEsc(m.id)+'"><b>'+musyEsc(m.title||'(Tanpa judul)')+'</b><span>'+musyEsc(musyFd(m.date))+'</span></div>').join('')||'<div class="musy-empty">Tidak ada halaman.</div>';
}
function musyStamp(m){
  MUSY.root.querySelector('.musy-stamp').textContent=m&&m.first?('Mulai ditulis '+musyHm(m.first)+' · terakhir diubah '+musyHm(m.last)):'Waktu dicatat otomatis saat Anda menulis';
}
function musyLoad(){
  const root=MUSY.root,m=musyCur(),RO=!S.admin;
  if(!m)return;
  MUSY.cur=m.id;MUSY.Y=musyYr(m);
  root.querySelector('.musy-title').value=m.title||'';
  root.querySelector('.musy-date').value=m.date||'';
  root.querySelector('.musy-leader').value=m.leader||'';
  root.querySelector('.musy-scribe').value=m.scribe||'';
  const ed=root.querySelector('.musy-ed');
  ed.innerHTML=musySanitize(m.html||'');
  ed.contentEditable=RO?'false':'true';
  ['.musy-title','.musy-date','.musy-leader','.musy-scribe'].forEach(sel=>{root.querySelector(sel).disabled=RO});
  musyStamp(m);musyTabs();musyList();
}
function musySetFS(on){
  if(!MUSY)return;
  MUSY.FS=on;
  const root=MUSY.root;
  root.querySelector('.musy-wrap').classList.toggle('fs',on);
  const fsBtn=root.querySelector('.musy-fs');
  fsBtn.textContent=on?'✕':'⛶';
  fsBtn.title=on?'Keluar layar penuh (Esc)':'Layar penuh';
  try{
    if(on&&!document.fullscreenElement)document.documentElement.requestFullscreen().catch(()=>{});
    else if(!on&&document.fullscreenElement)document.exitFullscreen();
  }catch(e){}
}
function musyawarahView(){
  const RO=!S.admin;
  const local=musyReadLocal();
  MUSY={meetings:[],cur:null,Y:'',TR:false,FS:false,root:null,timers:{},dirty:new Set(),toastTimer:null};
  /* Urutan gabung: cadangan file asli -> data aplikasi (yang lebih baru menang) */
  if(local.data){
    local.data.meetings.forEach(raw=>{
      const m=musyToMeeting({id:raw.id,title:raw.title,date:raw.date,leader:raw.leader,scribe:raw.scribe,html:raw.html,sec:raw.sec,first:raw.first,last:raw.last,del:raw.del,waktu:raw._waktu||raw.waktu||'',lokasi:raw._lokasi||raw.lokasi||'',notebook:raw._notebook||raw.notebook||'umum',section:raw._section||raw.section||'agenda'});
      MUSY.meetings.push(m);
    });
    MUSY.cur=local.data.cur||null;
  }
  const localIds=new Set(MUSY.meetings.map(m=>String(m.id)));
  musyMergeFromApp(false);
  const hadAny=MUSY.meetings.length>0;
  if(!hadAny&&!local.exists){
    const m=musyBlank();
    Object.assign(m,{title:'Contoh: Rapat Koordinasi Bulanan',leader:'Budi',scribe:'Sari',
      html:'<h2>Laporan kegiatan bulan lalu</h2><ul><li>Kegiatan berjalan lancar</li><li><b>Kas</b> masih cukup</li></ul><h2>Rencana kegiatan bulan depan</h2><p>Usulan: kerja bakti dan pertemuan rutin.</p><p><span class="musy-todo" contenteditable="false"><input type="checkbox"></span>&nbsp;Sebar undangan kerja bakti</p>'});
    MUSY.meetings.push(m);MUSY.cur=m.id;
  }
  if(!musyActive().length){
    const m=musyBlank();MUSY.meetings.push(m);MUSY.cur=m.id;
  }
  if(!musyCur())MUSY.cur=musyActive()[0].id;
  MUSY.Y=musyYr(musyCur());

  const root=h('div',{class:'musy-root'+(RO?' ro':'')});
  MUSY.root=root;
  root.innerHTML=
    '<div class="musy-top">'
    +'<div class="musy-brand">📓 <span>Musyawarah</span></div>'
    +(RO?'<span class="musy-ro-badge">Hanya baca</span>':'')
    +'<input class="musy-q" type="search" placeholder="Cari di semua halaman…">'
    +'<button class="musy-tpb" title="Tampilan: warna, mode terang/gelap, Fresh">🎨</button>'
    +'<button class="musy-copy" title="Salin teks">📋</button>'
    +'<button class="musy-print" title="Cetak / simpan PDF">🖨</button>'
    +'<div class="musy-tp"><div class="musy-sw" title="Warna tema"></div><button class="musy-mode" title="Mode tampilan">🌓 Otomatis</button><button class="musy-fresh" title="Mode Fresh: tampilan kaca lembut">✨ Fresh</button></div>'
    +'</div>'
    +'<nav class="musy-tabs"></nav>'
    +'<div class="musy-app">'
    +'<section class="musy-wrap">'
    +'<div class="musy-tools"></div>'
    +'<div class="musy-canvas">'
    +'<div class="musy-trow"><input class="musy-title" placeholder="Judul rapat"><input class="musy-date" type="date" title="Tanggal rapat"></div>'
    +'<div class="musy-meta"><span>Pemimpin</span><input class="musy-leader" style="width:120px"><span>Notulis</span><input class="musy-scribe" style="width:120px"><span class="musy-stamp"></span></div>'
    +'<div class="musy-ed" contenteditable="true" data-ph="Tulis agenda dan catatan pembahasan di sini…"></div>'
    +'</div>'
    +'</section>'
    +'<aside class="musy-pages">'
    +'<button class="musy-np">+ Halaman baru</button>'
    +'<button class="musy-trb" style="width:100%;margin-bottom:8px"></button>'
    +'<div class="musy-list"></div>'
    +'</aside>'
    +'</div>'
    +'<div class="musy-toast"></div>';
  const q=s=>root.querySelector(s);
  const ed=q('.musy-ed');
  const X=(c,v)=>document.execCommand(c,false,v);

  /* Bilah alat (sama seperti file asli) */
  const bt=t=>'<button data-c="'+t[0]+'" title="'+musyEsc(t[2])+'" class="'+(t[3]||'')+'">'+t[1]+'</button>';
  q('.musy-tools').innerHTML=MUSY_G.map(g=>'<div class="musy-grp '+(g[2]||'')+'"><div class="musy-gb">'+g[1].map(bt).join('')+'</div></div>').join('')
    +'<div class="musy-grp rt"><div class="musy-gb"><button class="musy-mb noprint" title="Fungsi lainnya">⋯</button><button class="musy-fs noprint" title="Layar penuh">⛶</button>'+(RO?'':'<button class="musy-del noprint" title="Hapus halaman (pindah ke tempat sampah)">🗑</button>')+'</div></div>'
    +'<div class="musy-pop">'+MUSY_G.flatMap(g=>g[1].map(t=>[t[0],t[1],t[2],t[3]||g[2]||''])).filter(t=>t[3]).map(bt).join('')+'</div>';
  q('.musy-mb').addEventListener('click',e=>{e.stopPropagation();q('.musy-pop').classList.toggle('o')});
  q('.musy-tpb').addEventListener('click',e=>{e.stopPropagation();q('.musy-tp').classList.toggle('o')});
  q('.musy-tools').addEventListener('mousedown',e=>{if(e.target.closest('button'))e.preventDefault()});
  q('.musy-tools').addEventListener('click',e=>{
    const b=e.target.closest('button[data-c]');
    if(!b)return;
    if(RO)return;
    if(!ed.contains(document.getSelection().anchorNode))ed.focus();
    const c=b.dataset.c;
    if(c==='h')X('formatBlock','H2');
    else if(c==='p')X('formatBlock','P');
    else if(c==='hl')X('hiliteColor','#fff3a3');
    else if(c==='todo')X('insertHTML','<span class="musy-todo" contenteditable="false"><input type="checkbox"></span>&nbsp;');
    else if(c==='star')X('insertText','⭐ ');
    else if(c==='table')X('insertHTML','<table><tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr><tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr></table><p><br></p>');
    else if(c==='hr')X('insertHorizontalRule');
    else if(c==='now')X('insertText','['+new Date().toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short'})+'] ');
    else X(c);
    ed.dispatchEvent(new Event('input'));
    q('.musy-pop').classList.remove('o');
  });
  ed.addEventListener('input',()=>{
    if(RO)return;
    const m=musyCur();if(!m)return;
    const n=Date.now();
    m.html=ed.innerHTML;if(!m.first)m.first=n;m.last=n;
    MUSY.dirty.add(String(m.id));
    musyStamp(m);musyPersist(m);
  });
  ed.addEventListener('change',e=>{
    if(e.target.type==='checkbox'){
      e.target.toggleAttribute('checked',e.target.checked);
      const m=musyCur();if(m){m.html=ed.innerHTML;if(!RO)musyPersist(m)}
    }
  });
  ed.addEventListener('paste',e=>{e.preventDefault();X('insertText',(e.clipboardData||window.clipboardData).getData('text/plain'))});
  [['.musy-title','title'],['.musy-date','date'],['.musy-leader','leader'],['.musy-scribe','scribe']].forEach(([sel,k])=>{
    q(sel).addEventListener('input',e=>{
      if(RO)return;
      const m=musyCur();if(!m)return;
      m[k]=e.target.value;
      if(!m.first)m.first=Date.now();
      m.last=Date.now();
      MUSY.dirty.add(String(m.id));
      if(k==='date')MUSY.Y=musyYr(m);
      musyPersist(m);musyTabs();musyList();
    });
  });
  q('.musy-q').addEventListener('input',()=>{MUSY.TR=false;musyList()});
  q('.musy-tabs').addEventListener('click',e=>{
    const t=e.target.closest('.musy-tab');if(!t)return;
    MUSY.Y=t.dataset.y;MUSY.TR=false;q('.musy-q').value='';
    musyTabs();musyList();
    const f=musyActive().filter(m=>musyYr(m)===MUSY.Y).sort((a,b)=>(b.date||'').localeCompare(a.date||''))[0];
    if(f&&musyCur()&&musyYr(musyCur())!==MUSY.Y){MUSY.cur=f.id;musyLoad()}
  });
  q('.musy-list').addEventListener('click',e=>{
    const b=e.target.closest('[data-t]');
    if(b){
      const t=b.dataset.t,i=b.dataset.i;
      if(t==='res'){const m=MUSY.meetings.find(x=>x.id===i);if(m&&!RO){delete m.del;m.last=Date.now();MUSY.cur=m.id;MUSY.TR=false;musyPersist(m);musyLoad();musyToast('Halaman dipulihkan')}}
      else if(t==='del'){if(RO)return;if(b.dataset.ok){const m=MUSY.meetings.find(x=>x.id===i);MUSY.meetings=MUSY.meetings.filter(x=>x.id!==i);if(m)musyPersistDelete(m);else musySaveLocal();musyList()}else{b.dataset.ok='1';b.textContent='Yakin? Klik lagi'}}
      else if(t==='empty'){if(RO)return;if(b.dataset.ok){const gone=MUSY.meetings.filter(x=>x.del);MUSY.meetings=MUSY.meetings.filter(x=>!x.del);gone.forEach(m=>{S.musyawarah=(S.musyawarah||[]).filter(x=>String(x.id)!==String(m.id));if(S.db){try{const p=S.db.collection('musyawarah').doc(m.id).delete();if(p&&p.catch)p.catch(()=>{})}catch(_){}}});musySaveLocal();musyList()}else{b.dataset.ok='1';b.textContent='Yakin? Klik lagi'}}
      return;
    }
    const p=e.target.closest('.musy-pg');
    if(!p||!p.dataset.i)return;
    MUSY.cur=p.dataset.i;musySaveLocal();musyLoad();
  });
  q('.musy-trb').addEventListener('click',()=>{MUSY.TR=!MUSY.TR;musyList()});
  q('.musy-np').addEventListener('click',()=>{
    if(RO)return;
    const m=musyBlank();
    MUSY.meetings.push(m);MUSY.cur=m.id;MUSY.TR=false;q('.musy-q').value='';
    musyPersist(m);musyLoad();q('.musy-title').focus();
  });
  if(!RO)q('.musy-del').addEventListener('click',()=>{
    const m=musyCur();if(!m)return;
    m.del=Date.now();m.last=Date.now();
    musyPersist(m);
    if(!musyActive().length){const b=musyBlank();MUSY.meetings.push(b);musyPersist(b)}
    MUSY.cur=musyActive()[0].id;
    musyLoad();musyToast('Dipindahkan ke tempat sampah');
  });
  q('.musy-fs').addEventListener('click',()=>musySetFS(!MUSY.FS));
  q('.musy-copy').addEventListener('click',()=>{
    const m=musyCur();if(!m)return;
    const t=[m.title||'(Tanpa judul)',musyFd(m.date),'Pemimpin: '+(m.leader||'-'),'Notulis: '+(m.scribe||'-'),'',ed.innerText].join('\n');
    const ok=()=>musyToast('Catatan disalin');
    const fb=()=>{try{const x=document.createElement('textarea');x.value=t;document.body.appendChild(x);x.select();document.execCommand('copy');x.remove();ok()}catch(_){musyToast('Gagal menyalin')}};
    try{navigator.clipboard.writeText(t).then(ok,fb)}catch(_){fb()}
  });
  q('.musy-print').addEventListener('click',()=>{try{window.print()}catch(_){musyToast('Cetak tidak tersedia di sini')}});

  /* Warna tema, mode terang/gelap, dan mode Fresh — pilihan tersimpan seperti file asli */
  function setTheme(c,keep){
    root.style.setProperty('--base',c);
    root.querySelectorAll('.musy-dot').forEach(d=>d.classList.toggle('on',d.dataset.c===c));
    if(!keep){try{localStorage.setItem(MUSY_KEY+'-tema',c)}catch(e){}}
  }
  q('.musy-sw').innerHTML=MUSY_TH.map(t=>'<button class="musy-dot" data-c="'+t[1]+'" title="'+t[0]+'" style="background:'+t[1]+'"></button>').join('');
  q('.musy-sw').addEventListener('click',e=>{const d=e.target.closest('.musy-dot');if(d)setTheme(d.dataset.c)});
  /* Warna bawaan = teal tema aplikasi. Warna ungu bawaan lama dari versi
     sebelumnya diperlakukan sebagai bawaan juga, supaya tampilan langsung
     selaras sejak pertama dibuka; pilihan warna lain dari pengguna tetap dipakai. */
  let c0='#2b7a8c';try{c0=localStorage.getItem(MUSY_KEY+'-tema')||c0}catch(e){}
  if(c0==='#7719aa')c0='#2b7a8c';
  setTheme(c0,true);
  function setMode(k,keep){
    if(k==='auto')root.removeAttribute('data-theme');else root.dataset.theme=k;
    q('.musy-mode').textContent=MUSY_MD.find(x=>x[0]===k)[1];
    if(!keep){try{localStorage.setItem(MUSY_KEY+'-mode',k)}catch(e){}}
  }
  let mk='auto';try{mk=localStorage.getItem(MUSY_KEY+'-mode')||mk}catch(e){}
  if(!MUSY_MD.some(x=>x[0]===mk))mk='auto';
  setMode(mk,true);
  q('.musy-mode').addEventListener('click',()=>{mk=MUSY_MD[(MUSY_MD.findIndex(x=>x[0]===mk)+1)%3][0];setMode(mk)});
  function setFresh(on,keep){
    if(on)root.dataset.style='fresh';else root.removeAttribute('data-style');
    q('.musy-fresh').classList.toggle('on',on);
    if(!keep){try{localStorage.setItem(MUSY_KEY+'-fresh',on?'1':'0')}catch(e){}}
  }
  let fr=false;try{fr=localStorage.getItem(MUSY_KEY+'-fresh')==='1'}catch(e){}
  setFresh(fr,true);
  q('.musy-fresh').addEventListener('click',()=>{
    fr=!fr;
    if(fr&&root.style.getPropertyValue('--base').trim()==='#2b7a8c')setTheme('#038387');
    setFresh(fr);
  });
  if(RO){
    q('.musy-np').style.display='none';
    q('.musy-trb').style.display='none';
  }
  window.__musyAlive=true;
  window.__musyOnRemote=function(){
    if(!MUSY||!MUSY.root||!document.contains(MUSY.root))return;
    musyMergeFromApp(true);
    musySaveLocal();musyTabs();musyList();
  };
  musySaveLocal();
  /* Halaman yang hanya ada di cadangan lokal diselaraskan ke lapisan aplikasi */
  MUSY.meetings.filter(m=>!(S.musyawarah||[]).some(x=>String(x.id)===String(m.id))).forEach(m=>musyPersist(m));
  musyLoad();
  return [root];
}
/* Pendengar dokumen untuk buku catatan: dipasang sekali saja */
(function musyGlobalListeners(){
  if(window.__musyGlobalListeners)return;
  window.__musyGlobalListeners=true;
  document.addEventListener('click',e=>{
    if(!MUSY||!MUSY.root)return;
    if(!e.target.closest('.musy-pop,.musy-mb')){const p=MUSY.root.querySelector('.musy-pop');if(p)p.classList.remove('o')}
    if(!e.target.closest('.musy-tp,.musy-tpb')){const t=MUSY.root.querySelector('.musy-tp');if(t)t.classList.remove('o')}
  });
  document.addEventListener('selectionchange',()=>{
    if(!MUSY||!MUSY.root)return;
    const ed=MUSY.root.querySelector('.musy-ed');
    if(!ed||!ed.contains(document.getSelection().anchorNode))return;
    ['bold','italic','underline','strikeThrough','insertUnorderedList','insertOrderedList'].forEach(c=>{
      const b=MUSY.root.querySelector('[data-c="'+c+'"]');
      if(b){try{b.classList.toggle('on',document.queryCommandState(c))}catch(e){}}
    });
  });
  document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement&&MUSY&&MUSY.FS)musySetFS(false)});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&MUSY&&MUSY.FS)musySetFS(false)});
})();
