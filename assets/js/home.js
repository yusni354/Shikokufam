/* Pesan sambutan Home: bisa diganti admin lewat halaman Pengaturan.
   Tersimpan sebagai dokumen {id:'sambutan'} di koleksi 'pengaturan'
   lewat lapisan data yang sama (Supabase app_data / lokal). */
const SAMBUTAN_DEFAULT='Senang bisa berkumpul bersama keluarga Shikoku.';
function welcomeMessage(){
  const pesan=(S.sambutan||'').trim();
  return pesan||SAMBUTAN_DEFAULT;
}
function subscribeSambutan(){
  if(!S.db)return ()=>{};
  try{
    return S.db.collection('pengaturan').onSnapshot(snap=>{
      const doc=(snap.docs||[]).find(d=>d.id==='sambutan');
      const data=doc&&typeof doc.data==='function'?doc.data():null;
      const next=data&&typeof data.pesan==='string'?data.pesan:'';
      if(next!==S.sambutan){S.sambutan=next;if(S.view==='landing'&&S.uid)renderDariData()}
    },error=>{console.error('Pesan sambutan gagal dimuat:',error)});
  }catch(error){console.error('Pesan sambutan gagal dimuat:',error);return ()=>{}}
}
async function saveSambutanPesan(teks){
  await S.db.collection('pengaturan').doc('sambutan').set({pesan:teks,at:Date.now()});
  S.sambutan=teks;
}
/* Halaman Pengaturan: khusus ADMIN UTAMA saja (admin biasa tidak bisa membukanya) */
function vPengaturan(){
  if(!S.mainAdmin)return [h('p',{class:'warn'},'Halaman ini hanya dapat diakses admin utama.')];
  const inp=h('textarea',{rows:3,maxlength:200,placeholder:SAMBUTAN_DEFAULT});
  inp.value=S.sambutan||'';
  /* ===== Sumber Peta: gaya peta bawaan untuk SELURUH pengguna =====
     Pilihan gaya tersimpan lewat saveSumberPeta (map.js) sebagai
     dokumen 'sumber_peta' di koleksi 'pengaturan'. Semua gaya gratis
     tanpa kunci API — termasuk tiga gaya vektor OpenFreeMap. */
  const tersimpanPeta=(S.sumberPeta&&typeof S.sumberPeta==='object')?S.sumberPeta:{gaya:'jalan'};
  const gayaSel=h('select',{'aria-label':'Gaya peta bawaan'});
  gayaSel.replaceChildren(...petaDaftarGayaTersedia().map(k=>{
    const st=PETA_STYLES[k];
    return h('option',{value:k},st.label+' — '+st.desc);
  }));
  gayaSel.value=PETA_STYLES[tersimpanPeta.gaya]?tersimpanPeta.gaya:'jalan';
  return [h('h1',{},'Pengaturan'),
    box(h('b',{},'Pesan sambutan di Home'),
      inp,
      h('div',{class:'fl'},h('button',{class:'btn',onclick:async()=>{
        try{await saveSambutanPesan(inp.value.trim());alert('Pesan sambutan disimpan.');render()}
        catch(e){alert('Gagal menyimpan pesan: '+(e.message||'periksa koneksi'))}
      }},'Simpan'))),
    box(h('b',{},'Sumber Peta'),
      h('p',{class:'sub'},'Gaya peta bawaan untuk halaman Peta & Wilayah, berlaku untuk semua pengguna. Di halaman peta, pengguna tetap bisa mengganti gaya untuk sementara lewat menu gaya di peta — pilihannya kembali ke bawaan ini saat halaman dimuat ulang.'),
      h('label',{class:'lb'},'Gaya peta bawaan',gayaSel),
      h('p',{class:'sub'},'Semua gaya gratis tanpa kunci API. Gaya OpenFreeMap adalah peta vektor modern yang tajam di semua tingkat zoom — Liberty berwarna lengkap, Bright terang bersih, Positron abu terang minimal. Bila gaya yang dipilih tidak terjangkau, peta otomatis memakai gaya Jalan. Panel pin pada formulir anggota selalu memakai gaya Jalan.'),
      h('div',{class:'fl'},h('button',{class:'btn',onclick:async()=>{
        try{await saveSumberPeta(gayaSel.value);alert('Sumber peta disimpan.');render()}
        catch(e){alert('Gagal menyimpan sumber peta: '+(e.message||'periksa koneksi'))}
      }},'Simpan')))];
}
/* Maskot Home: VIDEO transparan pilihan pengguna — karakter dari
   video yang dipilihnya, latarnya sudah dipisahkan dengan AI menjadi
   kanal alfa (VP9 WebM 400x626, 15 fps, 10 detik) sehingga menyatu
   langsung dengan kartu sambutan: tanpa bingkai, tanpa kotak latar.
   Berkas video + poster diamnya TIDAK dimuat di index.html; keduanya
   tersimpan sebagai data URI base64 di assets/js/maskot-video-alpha.js
   (dibuat dari berkas sumbernya, ±749 KB) dan berkas itu DIMUAT MALAS
   hanya di sini, saat Home dibuka — halaman lain tidak menanggung
   bebannya sama sekali. Salinan berkas aslinya juga ada di
   assets/maskot-alpha-c42.webm dan assets/maskot-poster.png.
   Gerakannya dibuat terasa hidup, ACAK, dan PELAN mengikuti
   permintaan pengguna: kecepatan putar 0.85, penjadwal memberi JEDA
   DIAM acak (berhenti 2-6 detik setiap sela acak 8-20 detik, lalu
   lanjut lagi) supaya tidak terasa seperti putaran video. Maskot
   DIAM di posisinya di sisi kanan kartu sambutan — perilaku
   jalan-jalan sudah dihapus atas permintaan pengguna.
   Penjadwal berhenti sendiri begitu elemen maskot lepas dari
   halaman (pindah menu) dan mulai lagi saat Home dibuka kembali.
   Cadangan jujur: bila peramban tidak bisa memutar WebM VP9
   (canPlayType kosong) yang tampil gambar POSTER DIAM transparan
   dari karakter yang sama — bukan video berlatar buram. Mode
   prefers-reduced-motion juga hanya menampilkan poster diam. */
let maskotVideoDataPromise=null;
function muatDataMaskotVideo(){
  if(window.MASKOT_VIDEO_WEBM&&window.MASKOT_POSTER_PNG)return Promise.resolve(true);
  if(maskotVideoDataPromise)return maskotVideoDataPromise;
  maskotVideoDataPromise=new Promise(resolve=>{
    const s=document.createElement('script');
    s.src='assets/js/maskot-video-alpha.js?v=20270206';
    s.async=true;
    s.onload=()=>resolve(!!(window.MASKOT_VIDEO_WEBM&&window.MASKOT_POSTER_PNG));
    s.onerror=()=>{maskotVideoDataPromise=null;resolve(false)};
    document.head.appendChild(s);
  });
  return maskotVideoDataPromise;
}
function homeMascot(){
  const stage=h('div',{class:'home-welcome-mascot mascot-video-stage',role:'img','aria-label':'Maskot Shikoku Family'});
  muatDataMaskotVideo().then(ok=>{
    if(!stage.isConnected)return;
    if(!ok||!window.MASKOT_POSTER_PNG){
      /* Data video gagal dimuat (mis. berkas belum ada): tampilkan
         gambar transparan lama supaya Home tidak kosong/rusak. */
      stage.replaceChildren(h('img',{class:'mascot-poster-img',src:'assets/mascot.webp',alt:'Maskot Shikoku Family',draggable:'false'}));
      return;
    }
    pasangMaskotVideo(stage);
  });
  return stage;
}
function pasangMaskotVideo(stage){
  const posterSrc=window.MASKOT_POSTER_PNG;
  const tampilPosterDiam=()=>{
    stage.replaceChildren(h('img',{class:'mascot-poster-img',src:posterSrc,alt:'Maskot Shikoku Family',draggable:'false'}));
  };
  const kurangiGerak=!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  if(kurangiGerak){tampilPosterDiam();return}
  let dukung='';
  try{
    const uji=document.createElement('video');
    dukung=uji.canPlayType('video/webm; codecs="vp9"')||uji.canPlayType('video/webm')||'';
  }catch(e){dukung=''}
  if(!dukung||!window.MASKOT_VIDEO_WEBM){tampilPosterDiam();return}
  const video=h('video',{class:'mascot-video-el',poster:posterSrc,'aria-label':'Maskot Shikoku Family'});
  video.muted=true;
  video.loop=true;
  video.autoplay=true;
  video.playsInline=true;
  video.setAttribute('muted','');
  video.setAttribute('playsinline','');
  video.setAttribute('webkit-playsinline','');
  video.preload='auto';
  video.src=window.MASKOT_VIDEO_WEBM;
  const setRate=()=>{try{video.playbackRate=0.85}catch(e){}};
  video.addEventListener('loadedmetadata',setRate);
  video.addEventListener('canplay',()=>{
    setRate();
    try{const pr=video.play();if(pr&&pr.catch)pr.catch(()=>{})}catch(e){}
  });
  stage.replaceChildren(video);
  mulaiHidupMaskotVideo(stage,video);
}
function mulaiHidupMaskotVideo(stage,video){
  const acak=(a,b)=>a+Math.random()*(b-a);
  const hidup=()=>stage.isConnected&&video.isConnected;
  const nanti=(fn,ms)=>setTimeout(()=>{if(hidup())fn()},ms);
  /* Jeda diam acak: video berhenti 2-6 detik pada sela acak
     8-20 detik, lalu lanjut lagi — ritmenya tidak berpola putaran. */
  const jadwalJeda=()=>{
    if(!hidup())return;
    nanti(()=>{
      try{video.pause()}catch(e){}
      nanti(()=>{
        try{video.playbackRate=0.85;const pr=video.play();if(pr&&pr.catch)pr.catch(()=>{})}catch(e){}
        jadwalJeda();
      },acak(2000,6000));
    },acak(8000,20000));
  };
  jadwalJeda();
  /* Maskot diam di posisinya: tidak ada penjadwal jalan-jalan lagi. */
}
/* Halaman Home dan Ringkasan */
function vHome(){
  /* Spanduk satu kali 'Selamat, akun Anda telah disetujui.' bagi akun yang
     pernah terlihat menunggu persetujuan di perangkat ini (authOnSignedIn
     di auth.js yang memutuskan & menandainya sudah tampil). */
  const approvedBanner=(typeof authOnSignedIn==='function'&&authOnSignedIn())?h('p',{class:'warn approved-banner'},'Selamat, akun Anda telah disetujui.'):null;
  const today=new Date(),todayKey=[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-');
  const upcomingDuties=[...S.cleaningDuties].filter(duty=>duty.tanggal&&duty.tanggal>=todayKey).sort((a,b)=>a.tanggal.localeCompare(b.tanggal)).slice(0,2);
  const recentEvents=[...S.events].sort((a,b)=>(b.at||0)-(a.at||0)).slice(0,2);
  const memberGroups=wilayah();
  const regionCards=wilayahEfektif().map(([name,color])=>{
    const members=[...(memberGroups[name]||[])].sort((a,b)=>(a.nama||'').localeCompare(b.nama||'','id'));
    return h('section',{class:'home-region-card',style:'--region-color:'+color,onclick:()=>{S.memberRegion=name;S.memberQuery='';S.memberStatus='';go('members')}},
      h('div',{class:'home-region-heading'},h('b',{},name),h('span',{},members.length+' anggota'))
    );
  });
  if(memberGroups['Belum dipilih']?.length)regionCards.push(h('section',{class:'home-region-card home-region-unknown',onclick:()=>{S.memberRegion='Belum dipilih';S.memberQuery='';S.memberStatus='';go('members')}},
    h('div',{class:'home-region-heading'},h('b',{},'Wilayah belum dipilih'),h('span',{},memberGroups['Belum dipilih'].length+' anggota'))
  ));
  const shortcuts=[['brush','Jadwal Piket','piket'],['calendar','Kegiatan','kegiatan'],['messages','Forum','forum'],['map','Peta','peta']];
  const dutyRows=upcomingDuties.flatMap(duty=>{
    const assignments=Array.isArray(duty.assignments)&&duty.assignments.length?duty.assignments:[{nama:duty.nama||'',tugas:duty.tugas||''}];
    return [h('div',{class:'home-duty'},
      h('div',{class:'home-duty-date'},h('b',{},String(new Date(duty.tanggal+'T00:00:00').getDate()).padStart(2,'0')),h('small',{},new Date(duty.tanggal+'T00:00:00').toLocaleDateString('id-ID',{month:'short'}))),
      h('div',{class:'home-duty-info'},...assignments.map(assignment=>h('p',{},h('b',{},assignment.nama),h('span',{},assignment.tugas))))
    )];
  });
  return [
    approvedBanner,
    h('section',{class:'home-welcome'},
      h('div',{class:'home-welcome-text'},h('small',{},today.toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'})),h('h1',{},'Selamat datang'+(S.name?', '+S.name.split(' ')[0]:'')+'!'),h('p',{},welcomeMessage()),h('button',{class:'btn home-welcome-cta',onclick:()=>go('kegiatan')},'Lihat Kegiatan')),
      homeMascot()
    ),
    h('div',{class:'stats home-stats'},...[['Anggota',S.members.length],['Kegiatan',S.events.length],['Wilayah',Object.keys(wilayah()).length],['Jadwal Piket',S.cleaningDuties.length]].map(item=>h('div',{},h('small',{},item[0]),h('b',{},String(item[1]))))),
    h('div',{class:'home-section-heading'},h('h2',{},'Daftar anggota'),S.admin&&h('button',{class:'btn s',onclick:()=>go('members')},'+ Tambah')),
    h('div',{class:'home-region-list'},...regionCards),
    h('div',{class:'home-section-heading'},h('h2',{},'Akses cepat')),
    h('div',{class:'home-shortcuts'},...shortcuts.map(([glyph,label,view])=>h('button',{class:'home-shortcut',onclick:()=>go(view)},h('span',{class:'home-shortcut-icon'},icon(glyph,22)),h('b',{},label),h('span',{class:'home-shortcut-arrow'},'›')))),
    h('div',{class:'home-section-heading'},h('h2',{},'Jadwal piket terdekat'),h('button',{class:'btn s',onclick:()=>go('piket')},'Lihat semua')),
    upcomingDuties.length?h('div',{class:'home-agenda'},...dutyRows):h('div',{class:'home-empty'},icon('brush',23),h('p',{},'Belum ada jadwal piket mendatang.')),
    h('div',{class:'home-section-heading'},h('h2',{},'Kegiatan komunitas'),h('button',{class:'btn s',onclick:()=>go('kegiatan')},'Lihat kegiatan')),
    recentEvents.length?h('div',{class:'home-events'},...recentEvents.map(event=>h('div',{class:'home-event'},icon('calendar',19),h('div',{},h('b',{},event.judul||'Kegiatan komunitas'),h('small',{},eventParticipantCount(event)+' peserta · '+eventAttendanceCount(event)+' hadir'))))):h('div',{class:'home-empty'},icon('calendar',23),h('p',{},'Belum ada kegiatan komunitas.')),
    homeAttendanceChart(),
    h('button',{class:'home-admin-link',onclick:askForm},icon('messages',17),' Butuh bantuan? Hubungi Admin')
  ];
}
/* Grafik kehadiran: batang SVG + donat, dihitung murni dari daftar hadir
   kegiatan yang tampil (peserta & hadir per kegiatan). Skala mulai dari nol. */
function homeAttendanceChart(){
  const evs=[...S.events].filter(e=>eventParticipantCount(e)>0).sort((a,b)=>(b.at||0)-(a.at||0)).slice(0,6);
  if(!evs.length)return null;
  const NS='http://www.w3.org/2000/svg';
  const rows=evs.map(e=>({judul:e.judul||'Kegiatan komunitas',tanggal:e.tanggal||'',peserta:eventParticipantCount(e),hadir:eventAttendanceCount(e)}));
  const totalPeserta=rows.reduce((s,r)=>s+r.peserta,0);
  const totalHadir=rows.reduce((s,r)=>s+r.hadir,0);
  const belum=totalPeserta-totalHadir;
  const pct=totalPeserta?Math.round(totalHadir/totalPeserta*100):0;
  const maxV=Math.max(...rows.map(r=>r.peserta),1);
  const W=340,H=176,base=140,top=18,plotH=base-top;
  const slot=W/rows.length,barW=Math.min(30,slot*0.42);
  const svg=document.createElementNS(NS,'svg');
  svg.setAttribute('viewBox','0 0 '+W+' '+H);
  svg.setAttribute('class','home-chart-svg');
  svg.setAttribute('role','img');
  svg.setAttribute('aria-label','Grafik batang kehadiran per kegiatan');
  const mk=(tag,attrs,text)=>{const n=document.createElementNS(NS,tag);for(const k in attrs)n.setAttribute(k,attrs[k]);if(text!=null)n.textContent=text;svg.append(n);return n};
  mk('line',{x1:8,y1:base,x2:W-8,y2:base,stroke:'#8fa6b5','stroke-width':1.5});
  const barCols=['#57a891','#6d9ec4','#9a90cf','#7fb0c9'];
  rows.forEach((r,i)=>{
    const cx=slot*i+slot/2;
    const hp=r.peserta/maxV*plotH,hh=r.hadir/maxV*plotH;
    mk('rect',{x:cx-barW/2,y:base-hp,width:barW,height:hp,rx:Math.min(9,barW/2),fill:'#c9d8e2'});
    if(r.hadir>0)mk('rect',{x:cx-barW/2,y:base-hh,width:barW,height:hh,rx:Math.min(9,barW/2),fill:barCols[i%barCols.length]});
    mk('text',{x:cx,y:base-hp-5,'text-anchor':'middle','font-size':11,'font-weight':700,fill:'#22303c'},String(r.hadir)+'/'+String(r.peserta));
    const dl=r.tanggal?new Date(r.tanggal+'T00:00:00'):null;
    const lab=dl&&!isNaN(dl)?dl.toLocaleDateString('id-ID',{day:'numeric',month:'short'}):'Keg. '+(i+1);
    mk('text',{x:cx,y:base+16,'text-anchor':'middle','font-size':10.5,fill:'#43586a'},lab);
  });
  const C=2*Math.PI*34;
  const hadirLen=totalPeserta?totalHadir/totalPeserta*C:0;
  const donut=document.createElementNS(NS,'svg');
  donut.setAttribute('viewBox','0 0 100 100');
  donut.setAttribute('class','home-donut-svg');
  donut.setAttribute('role','img');
  donut.setAttribute('aria-label','Donat kehadiran: '+totalHadir+' dari '+totalPeserta+' peserta hadir');
  const dk=(tag,attrs,text)=>{const n=document.createElementNS(NS,tag);for(const k in attrs)n.setAttribute(k,attrs[k]);if(text!=null)n.textContent=text;donut.append(n);return n};
  dk('circle',{cx:50,cy:50,r:34,fill:'none',stroke:'#b9b3d9','stroke-width':15});
  if(totalHadir>0)dk('circle',{cx:50,cy:50,r:34,fill:'none',stroke:'#2a8f7d','stroke-width':15,'stroke-dasharray':hadirLen+' '+C,transform:'rotate(-90 50 50)','stroke-linecap':'butt'});
  dk('text',{x:50,y:48,'text-anchor':'middle','font-size':17,'font-weight':700,fill:'#22303c'},pct+'%');
  dk('text',{x:50,y:63,'text-anchor':'middle','font-size':9.5,fill:'#43586a'},'hadir');
  const barsWrap=h('div',{class:'home-chart-bars'},svg,
    h('div',{class:'home-chart-legend'},
      h('span',{},h('i',{class:'home-chart-sw',style:'background:#57a891'}),'Hadir (batang berwarna)'),
      h('span',{},h('i',{class:'home-chart-sw',style:'background:#c9d8e2'}),'Peserta (batang latar)')));
  const donutWrap=h('div',{class:'home-chart-donut'},donut,
    h('div',{class:'home-chart-legend home-chart-legend-col'},
      h('span',{},h('i',{class:'home-chart-sw',style:'background:#2a8f7d'}),'Hadir · '+totalHadir),
      h('span',{},h('i',{class:'home-chart-sw',style:'background:#b9b3d9'}),'Belum hadir · '+belum),
      h('span',{},'Total peserta · '+totalPeserta)));
  return h('section',{class:'home-chart'},
    h('div',{class:'home-section-heading'},h('h2',{},'Kehadiran kegiatan')),
    h('div',{class:'home-chart-grid'},barsWrap,donutWrap),
    h('ul',{class:'home-chart-list'},...rows.map(r=>h('li',{},h('span',{},r.judul),h('b',{},r.hadir+'/'+r.peserta+' hadir')))));
}
function vDash(){
  const c=(glyph,t,n,v)=>h('button',{class:'card',onclick:()=>go(v)},
    h('span',{class:'e',style:'position:relative'},icon(glyph,23),v==='pesan'&&h('span',{class:'icon-badge','data-message-badge':'true',style:S.unreadMessages>0?'':'display:none'},String(S.unreadMessages))),
    h('span',{style:'flex:1'},h('b',{},t),h('b',{style:'font-size:15px'},n)),'›');
  return [h('h1',{},'Selamat datang'+(S.name?', '+S.name.split(' ')[0]:'')+'!'),
    h('p',{class:'sub'},new Date().toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'})),
    h('div',{class:'card',style:'display:block'},h('small',{class:'warn'},'User ID'),h('br'),h('b',{},S.email||S.uid||'-')),
    h('div',{class:'stats'},...[['Anggota',S.members.length],['Kegiatan',S.events.length],['Wilayah',Object.keys(wilayah()).length]].map(x=>h('div',{},h('small',{},x[0]),h('b',{},String(x[1]))))),
    c('users','Daftar Anggota',S.members.length+' anggota','members'),
    c('calendar','Kegiatan',S.events.length+' kegiatan','kegiatan'),
    c('brush','Jadwal Piket',S.cleaningDuties.length+' jadwal','piket'),
    c('messages','Forum',S.topics.length+' topik','forum'),
    c('inbox','Pesan Masuk',S.admin?((S.tanya?.length||0)+' pesan'):'Pesan saya','pesan'),
    c('map','Peta & Wilayah',Object.keys(wilayah()).length+' wilayah','peta'),
    h('button',{class:'card',onclick:()=>signOut()},h('span',{class:'e'},icon('logout',22)),h('span',{style:'flex:1'},h('b',{},'Keluar')),'›')];
}
