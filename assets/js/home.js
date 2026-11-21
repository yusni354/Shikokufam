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
      if(next!==S.sambutan){S.sambutan=next;if(S.view==='landing'&&S.uid)render()}
    },error=>{console.error('Pesan sambutan gagal dimuat:',error)});
  }catch(error){console.error('Pesan sambutan gagal dimuat:',error);return ()=>{}}
}
async function saveSambutanPesan(teks){
  await S.db.collection('pengaturan').doc('sambutan').set({pesan:teks,at:Date.now()});
  S.sambutan=teks;
}
/* Halaman Pengaturan: khusus admin & admin utama */
function vPengaturan(){
  if(!S.admin)return [h('p',{class:'warn'},'Halaman ini hanya dapat diakses admin.')];
  const inp=h('textarea',{rows:3,maxlength:200,placeholder:SAMBUTAN_DEFAULT});
  inp.value=S.sambutan||'';
  return [h('h1',{},'Pengaturan'),
    box(h('b',{},'Pesan sambutan di Home'),
      inp,
      h('div',{class:'fl'},h('button',{class:'btn',onclick:async()=>{
        try{await saveSambutanPesan(inp.value.trim());alert('Pesan sambutan disimpan.');render()}
        catch(e){alert('Gagal menyimpan pesan: '+(e.message||'periksa koneksi'))}
      }},'Simpan')))];
}
/* Maskot Home: gambar ASLI assets/mascot.webp (latarnya memang
   transparan), dianimasikan sebagai boneka berlapis — BUKAN video
   atau gif, jadi tidak ada latar yang perlu dipotong dan tidak ada
   putaran yang berulang. Beberapa salinan gambar yang sama ditumpuk
   persis sejajar: lapisan dasar utuh DIAM sebagai penopang, lalu di
   atasnya salinan yang dipotong clip-path mengikuti pose gambar —
   kepala+topi (poros di leher ±47%/50%), lengan terangkat (poros di
   bahu ±69%/56%), dan burung kecil (poros di kakinya ±88%/72%).
   Satu-satunya gerak kontinu adalah NAPAS (skala ±0,8% berporos di
   bawah, ±3,4 detik). Gerakan lain dijalankan penjadwal JavaScript
   lewat Web Animations API dengan jeda dan besar ACAK dalam rentang
   manusiawi, sehingga tidak pernah membentuk pola yang bisa ditebak.
   Penjadwal berhenti sendiri begitu elemen maskot lepas dari halaman
   (pindah menu) dan mulai lagi saat Home dibuka kembali. Bila
   pengguna mengaktifkan pengurangan gerak (prefers-reduced-motion),
   yang tampil gambar diam utuh dan penjadwal tidak jalan. */
function homeMascot(){
  const kurangiGerak=!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  if(kurangiGerak)return h('img',{class:'home-welcome-mascot',src:'assets/mascot.webp',alt:'Maskot Shikoku Family'});
  const lapis=kelas=>h('img',{class:'mascot-layer '+kelas,src:'assets/mascot.webp',alt:'','aria-hidden':'true',draggable:'false'});
  const head=lapis('mascot-head'),arm=lapis('mascot-arm'),bird=lapis('mascot-bird');
  const breath=h('div',{class:'mascot-breath'},lapis('mascot-body'),head,arm,bird);
  const sway=h('div',{class:'mascot-sway'},breath);
  const stage=h('div',{class:'home-welcome-mascot mascot-live',role:'img','aria-label':'Maskot Shikoku Family'},
    h('img',{class:'mascot-layer',src:'assets/mascot.webp',alt:'','aria-hidden':'true',draggable:'false'}),sway);
  mulaiGerakMaskot(stage,breath,sway,head,arm,bird);
  return stage;
}
function mulaiGerakMaskot(stage,breath,sway,head,arm,bird){
  const acak=(a,b)=>a+Math.random()*(b-a);
  const hidup=()=>stage.isConnected;
  /* Napas: gerak kontinu satu-satunya, sangat halus. */
  const napas=breath.animate([{transform:'scale(1)'},{transform:'scale(1.008)'}],{duration:1700,iterations:Infinity,direction:'alternate',easing:'ease-in-out'});
  const matikan=()=>{try{napas.cancel()}catch(e){}};
  /* Jalankan satu gerakan; saat selesai hasilnya ditanam sebagai gaya
     tetap supaya animasi lama tidak menumpuk di elemen. */
  const gerak=(el,kf,dur)=>{const an=el.animate(kf,{duration:dur,easing:'ease-in-out',fill:'forwards'});
    an.onfinish=()=>{try{an.commitStyles()}catch(e){}try{an.cancel()}catch(e){}};return an};
  /* Rantai penjadwal per bagian tubuh: tidur selama jeda acak,
     bergerak sekali, lalu menjadwalkan dirinya lagi. Berhenti rapi
     saat maskot sudah tidak tampil di halaman. */
  const rantai=(jedaAwal,jedaMin,jedaMax,aksi)=>{
    const putar=()=>{if(!hidup()){matikan();return}
      setTimeout(()=>{if(!hidup()){matikan();return}aksi();putar()},acak(jedaMin,jedaMax))};
    setTimeout(()=>{if(!hidup()){matikan();return}aksi();putar()},jedaAwal);
  };
  /* Kepala: miring halus ke sudut diam baru (maks ±1,8°), kadang
     angguk kecil. Sudut terakhir diingat supaya gerakan menyambung. */
  let sudutKepala=0;
  rantai(acak(1200,2600),4000,9000,()=>{
    const dari='rotate('+sudutKepala.toFixed(2)+'deg)';
    if(Math.random()<0.3){
      gerak(head,[{transform:dari},{transform:'rotate('+(sudutKepala+acak(1,1.6)).toFixed(2)+'deg)',offset:0.45},{transform:dari}],acak(650,950));
    }else{
      const target=acak(-1.8,1.8);
      const an=gerak(head,[{transform:dari},{transform:'rotate('+target.toFixed(2)+'deg)'}],acak(1100,1900));
      an.onfinish=()=>{sudutKepala=target;try{an.commitStyles()}catch(e){}try{an.cancel()}catch(e){}};
    }
  });
  /* Lengan terangkat: satu-dua ayunan kecil seperti melambai. */
  rantai(acak(3000,6000),6000,13000,()=>{
    const dua=Math.random()<0.4;
    const kf=dua
      ?[{transform:'rotate(0deg)'},{transform:'rotate(-5deg)',offset:0.2},{transform:'rotate(3deg)',offset:0.4},{transform:'rotate(-4deg)',offset:0.6},{transform:'rotate(2deg)',offset:0.8},{transform:'rotate(0deg)'}]
      :[{transform:'rotate(0deg)'},{transform:'rotate(-5deg)',offset:0.3},{transform:'rotate(3.2deg)',offset:0.6},{transform:'rotate(0deg)'}];
    gerak(arm,kf,dua?acak(1400,1700):acak(900,1200));
  });
  /* Burung kecil: lompat mungil, kadang dua kali berturut. */
  rantai(acak(4000,8000),7000,15000,()=>{
    const dua=Math.random()<0.3;
    const kf=[{transform:'translateY(0px) scale(1,1)'},
      {transform:'translateY(1.5px) scale(1.05,0.9)',offset:0.16},
      {transform:'translateY(-7px) scale(0.97,1.04)',offset:0.32},
      {transform:'translateY(0px) scale(1.02,0.96)',offset:0.46},
      {transform:'translateY(0px) scale(1,1)',offset:0.56}];
    if(dua)kf.push({transform:'translateY(1px) scale(1.04,0.92)',offset:0.68},{transform:'translateY(-5px) scale(0.98,1.03)',offset:0.82},{transform:'translateY(0px) scale(1,1)',offset:1});
    else kf.push({transform:'translateY(0px) scale(1,1)',offset:1});
    gerak(bird,kf,dua?acak(950,1150):acak(550,700));
  });
  /* Sesekali seluruh badan menoleh sangat halus lalu kembali. */
  rantai(acak(6000,10000),11000,20000,()=>{
    const besar=((Math.random()<0.5?-1:1)*acak(0.4,0.7)).toFixed(2);
    gerak(sway,[{transform:'rotate(0deg)'},{transform:'rotate('+besar+'deg)',offset:0.5},{transform:'rotate(0deg)'}],acak(2400,3200));
  });
}
/* Halaman Home dan Ringkasan */
function vHome(){
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
