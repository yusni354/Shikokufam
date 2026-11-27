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
/* ===== Penyimpanan & Berkas (kotak di halaman Pengaturan) =====
   Semua angka DIHITUNG dari data sungguhan saat halaman dibuka atau
   tombol Hitung Ulang ditekan — tidak ada angka tebakan:
   1) Basis data: dokumen tiap koleksi dibaca dari tabel app_data
      Supabase (atau lapisan data lokal bila Supabase tidak aktif),
      ukurannya = besar JSON dokumen itu.
   2) Berkas unggahan: isi bucket Supabase Storage didaftar rekursif
      lewat klien yang sama; bila izin membaca daftar tidak ada,
      bucket ditandai jujur tidak terbaca (tanpa angka karangan).
   3) Perangkat ini: navigator.storage.estimate() + localStorage asal
      situs ini di peramban yang sedang membuka — BUKAN total server.
   Daftar koleksi mengikuti APP_DATA_COLLECTIONS di db.js persis. */
const PENYIMPANAN_KOLEKSI=[
  ['members','Data Anggota'],
  ['events','Kegiatan'],
  ['keuangan','Keuangan'],
  ['inventaris','Inventari Benda'],
  ['musyawarah','Musyawarah'],
  ['topics','Forum'],
  ['cleaning_duties','Jadwal Piket'],
  ['pengaturan','Pengaturan & Pilihan'],
  ['pin','Pin Peta'],
  ['meeting','Rapat (arsip lama)']
];
const PENYIMPANAN_BUCKET=[
  ['member-files','Foto & berkas anggota'],
  ['message-attachments','Lampiran pesan']
];
function formatUkuranBerkas(bytes){
  const n=Number(bytes);
  if(!Number.isFinite(n)||n<0)return '—';
  if(n<1024)return n+' B';
  if(n<1024*1024)return (n/1024).toFixed(n<10*1024?1:0).replace('.',',')+' KB';
  if(n<1024*1024*1024)return (n/(1024*1024)).toFixed(2).replace('.',',')+' MB';
  return (n/(1024*1024*1024)).toFixed(2).replace('.',',')+' GB';
}
function ukuranJsonBytes(nilai){
  try{return new TextEncoder().encode(JSON.stringify(nilai==null?{}:nilai)).length}
  catch(e){try{return String(JSON.stringify(nilai==null?{}:nilai)).length}catch(e2){return 0}}
}
async function penyimpananAmbilKoleksi(nama){
  if(S.supabase){
    const {data,error}=await S.supabase.from('app_data').select('id,data').eq('collection',nama);
    if(error)throw error;
    return (data||[]).map(row=>({id:row.id,...(row.data&&typeof row.data==='object'?row.data:{value:row.data})}));
  }
  if(S.db){
    return await new Promise((resolve,reject)=>{
      let selesai=false,unsub=null;
      const timer=setTimeout(()=>{if(!selesai){selesai=true;try{unsub&&unsub()}catch(e){}reject(new Error('Waktu membaca habis'))}},15000);
      const gagal=err=>{if(selesai)return;selesai=true;clearTimeout(timer);reject(err||new Error('Gagal membaca koleksi'))};
      try{
        unsub=S.db.collection(nama).onSnapshot(snap=>{
          if(selesai)return;selesai=true;clearTimeout(timer);try{unsub&&unsub()}catch(e){}
          resolve((snap.docs||[]).map(d=>{try{return {id:d.id,...(typeof d.data==='function'?d.data():{})}}catch(e){return {id:d.id}}}));
        },gagal);
      }catch(e){gagal(e)}
    });
  }
  const peta={members:S.members,events:S.events,topics:S.topics,cleaning_duties:S.cleaningDuties,pin:S.pins,musyawarah:S.musyawarah,pengaturan:S.pengaturan,keuangan:S.keuangan,inventaris:S.inventaris,meeting:[]};
  return (peta[nama]||[]).map(d=>({...d}));
}
async function penyimpananHitungBucket(namaBucket){
  if(!S.supabase)throw new Error('Mode online (Supabase) tidak aktif di perangkat ini');
  const BATAS=1000,LIMIT=100;
  let count=0,total=0,truncated=false;
  const jenis={};
  const antre=[''];
  while(antre.length&&!truncated){
    const prefix=antre.shift();
    let offset=0;
    while(true){
      const {data,error}=await S.supabase.storage.from(namaBucket).list(prefix,{limit:LIMIT,offset,sortBy:{column:'name',order:'asc'}});
      if(error)throw error;
      const entries=data||[];
      for(const entri of entries){
        if(!entri.id){antre.push(prefix?prefix+'/'+entri.name:entri.name);continue}
        if(count>=BATAS){truncated=true;break}
        count++;
        total+=(entri.metadata&&typeof entri.metadata.size==='number')?entri.metadata.size:0;
        let tipe='';
        const namaFile=String(entri.name||''),titik=namaFile.lastIndexOf('.');
        if(titik>0&&titik<namaFile.length-1)tipe=namaFile.slice(titik+1).toLowerCase();
        if(!tipe&&entri.metadata&&entri.metadata.mimetype)tipe=String(entri.metadata.mimetype).split('/').pop().toLowerCase();
        if(!tipe)tipe='tanpa ekstensi';
        jenis[tipe]=(jenis[tipe]||0)+1;
        if(count>=BATAS)truncated=true;
      }
      if(truncated||entries.length<LIMIT)break;
      offset+=LIMIT;
    }
  }
  return {count,bytes:total,jenis,truncated};
}
async function penyimpananHitungPerangkat(){
  const hasil={localBytes:0,localKeys:0,localError:'',usage:null,quota:null};
  try{
    const enc=new TextEncoder();
    let total=0,keys=0;
    for(let i=0;i<localStorage.length;i++){
      const k=localStorage.key(i);
      if(k==null)continue;
      total+=enc.encode(k).length+enc.encode(localStorage.getItem(k)||'').length;
      keys++;
    }
    hasil.localBytes=total;hasil.localKeys=keys;
  }catch(e){hasil.localError='Tidak bisa dibaca di peramban ini'}
  try{
    if(navigator.storage&&typeof navigator.storage.estimate==='function'){
      const est=await navigator.storage.estimate();
      if(est&&typeof est.usage==='number')hasil.usage=est.usage;
      if(est&&typeof est.quota==='number')hasil.quota=est.quota;
    }
  }catch(e){/* perkiraan tidak tersedia: dibiarkan kosong, ditandai di tampilan */}
  return hasil;
}
async function hitungPenyimpanan(){
  if(S.penyimpananLoading)return;
  S.penyimpananLoading=true;
  if(S.view==='pengaturan')render();
  const koleksi=await Promise.all(PENYIMPANAN_KOLEKSI.map(async([key,label])=>{
    try{
      const docs=await penyimpananAmbilKoleksi(key);
      return {key,label,count:docs.length,bytes:docs.reduce((s,d)=>s+ukuranJsonBytes(d),0),error:''};
    }catch(e){
      return {key,label,count:null,bytes:null,error:(e&&e.message)||'Gagal membaca'};
    }
  }));
  const buckets=await Promise.all(PENYIMPANAN_BUCKET.map(async([name,label])=>{
    try{
      const r=await penyimpananHitungBucket(name);
      return {name,label,...r,error:''};
    }catch(e){
      return {name,label,count:null,bytes:null,jenis:{},truncated:false,error:(e&&e.message)||'Gagal membaca'};
    }
  }));
  const perangkat=await penyimpananHitungPerangkat();
  S.penyimpanan={at:Date.now(),koleksi,buckets,perangkat};
  S.penyimpananLoading=false;
  if(S.view==='pengaturan')render();
}
let penyimpananAutoDiminta=false;
function kotakPenyimpanan(){
  if(!S.penyimpanan&&!S.penyimpananLoading&&!penyimpananAutoDiminta){
    penyimpananAutoDiminta=true;
    setTimeout(()=>{void hitungPenyimpanan()},60);
  }
  const data=S.penyimpanan,loading=S.penyimpananLoading;
  const hostProyek=(()=>{try{return new URL((window.SUPABASE_CONFIG||{}).url||'').host}catch(e){return 'Supabase'}})();
  const anak=[h('b',{},'Penyimpanan & Berkas'),
    h('p',{class:'sub',style:'margin-top:8px'},'Di mana saja data aplikasi ini tersimpan, macam berkasnya, dan seberapa besar. Angka dihitung dari data yang benar-benar terbaca saat halaman dibuka — bagian yang tidak bisa dibaca ditandai apa adanya, bukan ditebak.')];
  if(loading&&!data)anak.push(h('p',{class:'warn',style:'margin:10px 0 2px'},'Menghitung penyimpanan…'));
  if(data){
    /* --- 1) Basis data --- */
    anak.push(h('p',{class:'penyimpanan-sub'},'Basis Data — Supabase'));
    anak.push(h('p',{class:'warn',style:'margin:0 0 2px'},'Lokasi: tabel app_data · proyek '+hostProyek+'. Ukuran = besar data JSON tiap dokumen.'));
    let totalDok=0,totalBytes=0,adaGagalKoleksi=false;
    data.koleksi.forEach(k=>{
      if(k.error){adaGagalKoleksi=true;anak.push(h('div',{class:'sec-row'},h('div',{class:'sec-row-main'},h('b',{},k.label),h('small',{style:'display:block'},'Koleksi ‘'+k.key+'’ · tidak bisa dibaca: '+k.error)),h('span',{class:'sec-badge sec-badge-bad'},'Tidak terbaca')));return}
      totalDok+=k.count;totalBytes+=k.bytes;
      anak.push(h('div',{class:'sec-row'},h('div',{class:'sec-row-main'},h('b',{},k.label),h('small',{style:'display:block'},'Koleksi ‘'+k.key+'’ · '+k.count+' dokumen')),h('span',{class:'penyimpanan-ukuran'},formatUkuranBerkas(k.bytes))));
    });
    anak.push(h('div',{class:'penyimpanan-total'},h('span',{},'Total basis data'+(adaGagalKoleksi?' (dari yang terbaca)':'')),h('span',{},totalDok+' dokumen · '+formatUkuranBerkas(totalBytes))));
    /* --- 2) Berkas unggahan --- */
    anak.push(h('p',{class:'penyimpanan-sub'},'Berkas Unggahan — Supabase Storage'));
    anak.push(h('p',{class:'warn',style:'margin:0 0 2px'},'Lokasi: Supabase Storage, di dalam bucket di bawah ini. Didaftar lewat aplikasi, maksimal 1.000 berkas per bucket.'));
    data.buckets.forEach(b=>{
      if(b.error){
        anak.push(h('div',{class:'sec-row'},h('div',{class:'sec-row-main'},h('b',{},b.label),h('small',{style:'display:block'},'Bucket ‘'+b.name+'’ · Tidak bisa dibaca dari aplikasi — lihat di panel Supabase.')),h('span',{class:'sec-badge sec-badge-mut'},'Tidak terbaca')));
        return;
      }
      const jenisList=Object.entries(b.jenis||{}).sort((a,c)=>c[1]-a[1]);
      const jenisTeks=b.count===0?'Belum ada berkas.':('Macam berkas: '+jenisList.map(([t,n])=>t+' · '+n).join('  ·  '));
      anak.push(h('div',{class:'sec-row'},h('div',{class:'sec-row-main'},h('b',{},b.label),h('small',{style:'display:block'},'Bucket ‘'+b.name+'’ · '+b.count+' berkas'+(b.truncated?' (dibatasi 1.000 berkas pertama — total sebenarnya bisa lebih besar)':'')),h('small',{style:'display:block'},jenisTeks)),h('span',{class:'penyimpanan-ukuran'},formatUkuranBerkas(b.bytes))));
    });
    /* --- 3) Perangkat ini --- */
    const per=data.perangkat||{};
    anak.push(h('p',{class:'penyimpanan-sub'},'Penyimpanan di Perangkat Ini'));
    anak.push(h('p',{class:'warn',style:'margin:0 0 2px'},'Khusus perangkat & peramban yang sedang Anda pakai saat ini — bukan total di server. Isinya berubah dari satu perangkat ke perangkat lain.'));
    anak.push(h('div',{class:'sec-row'},h('div',{class:'sec-row-main'},h('b',{},'Perkiraan pemakaian situs ini'),h('small',{style:'display:block'},per.usage==null?'Peramban ini tidak menyediakan perkiraan pemakaian.':('Terpakai '+formatUkuranBerkas(per.usage)+(per.quota!=null?' dari kuota sekitar '+formatUkuranBerkas(per.quota):''))+' — termasuk cache aplikasi & berkas offline.')),h('span',{class:'penyimpanan-ukuran'},per.usage==null?'—':formatUkuranBerkas(per.usage))));
    anak.push(h('div',{class:'sec-row'},h('div',{class:'sec-row-main'},h('b',{},'Penyimpanan lokal (localStorage)'),h('small',{style:'display:block'},per.localError?per.localError:(per.localKeys+' kunci tersimpan di asal situs ini.'))),h('span',{class:'penyimpanan-ukuran'},per.localError?'—':formatUkuranBerkas(per.localBytes))));
    anak.push(h('p',{class:'warn',style:'margin:12px 0 2px'},'Terakhir dihitung: '+new Date(data.at).toLocaleString('id-ID')+'.'));
  }
  anak.push(h('div',{class:'fl'},h('button',loading?{class:'btn',disabled:''}:{class:'btn',onclick:()=>{void hitungPenyimpanan()}},loading?'Menghitung…':(data?'Hitung Ulang':'Hitung Penyimpanan'))));
  return box(...anak);
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
      }},'Simpan'))),
    kotakPenyimpanan()];
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
/* Sapaan mengikuti jam perangkat: pagi / siang / sore / malam */
function homeSapaan(){
  const jam=new Date().getHours();
  if(jam>=4&&jam<11)return 'Selamat pagi';
  if(jam>=11&&jam<15)return 'Selamat siang';
  if(jam>=15&&jam<19)return 'Selamat sore';
  return 'Selamat malam';
}
/* Label jarak hari untuk agenda: 'Hari ini', 'Besok', atau 'x hari lagi' */
function homeLabelHari(tanggalKey,todayKey){
  const a=new Date(todayKey+'T00:00:00'),b=new Date(tanggalKey+'T00:00:00');
  const selisih=Math.round((b-a)/86400000);
  if(selisih<=0)return 'Hari ini';
  if(selisih===1)return 'Besok';
  return selisih+' hari lagi';
}
/* Halaman Home dan Ringkasan */
function vHome(){
  /* Spanduk satu kali 'Selamat, akun Anda telah disetujui.' bagi akun yang
     pernah terlihat menunggu persetujuan di perangkat ini (authOnSignedIn
     di auth.js yang memutuskan & menandainya sudah tampil). */
  const approvedBanner=(typeof authOnSignedIn==='function'&&authOnSignedIn())?h('p',{class:'warn approved-banner'},'Selamat, akun Anda telah disetujui.'):null;
  const today=new Date(),todayKey=[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-');
  const monthKey=todayKey.slice(0,7);
  const aktifMembers=S.members.filter(m=>String(m.status||'aktif').toLowerCase()!=='nonaktif');
  const nonaktifCount=S.members.length-aktifMembers.length;
  /* ===== Agenda gabungan terdekat: kegiatan & piket yang akan datang,
     diurutkan menurut tanggalnya (yang paling dekat di atas) ===== */
  const upcomingEvents=[...S.events].filter(e=>e.tanggal&&e.tanggal>=todayKey).sort((a,b)=>(a.tanggal||'').localeCompare(b.tanggal||'')||(a.waktu||'').localeCompare(b.waktu||''));
  const upcomingDuties=[...S.cleaningDuties].filter(d=>d.tanggal&&d.tanggal>=todayKey).sort((a,b)=>(a.tanggal||'').localeCompare(b.tanggal||''));
  const agendaItems=[
    ...upcomingEvents.map(e=>({jenis:'kegiatan',tanggal:e.tanggal,waktu:e.waktu||'',judul:e.judul||'Kegiatan komunitas',meta:(e.waktu?e.waktu+' · ':'')+(e.lokasi||'')+' · '+eventParticipantCount(e)+' peserta',event:e})),
    ...upcomingDuties.map(d=>{
      const asg=Array.isArray(d.assignments)&&d.assignments.length?d.assignments:[{nama:d.nama||'',tugas:d.tugas||''}];
      return {jenis:'piket',tanggal:d.tanggal,waktu:'',judul:'Jadwal Piket',meta:asg.map(a=>[a.nama,a.tugas].filter(Boolean).join(' — ')).filter(Boolean).join(' · ')};
    })
  ].sort((a,b)=>a.tanggal.localeCompare(b.tanggal)||a.waktu.localeCompare(b.waktu)).slice(0,4);
  const agendaRows=agendaItems.map(item=>{
    const d=new Date(item.tanggal+'T00:00:00');
    return h('button',{class:'home-agenda-row',onclick:()=>{
        if(item.jenis==='kegiatan'){go('kegiatan');openActivityDetail(item.event.id)}
        else go('piket');
      }},
      h('div',{class:'home-duty-date'},h('b',{},String(d.getDate()).padStart(2,'0')),h('small',{},d.toLocaleDateString('id-ID',{month:'short'}))),
      h('div',{class:'home-agenda-info'},h('b',{},item.judul),h('small',{},d.toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long'})+(item.meta?' · '+item.meta:''))),
      h('span',{class:'home-agenda-tags'},h('span',{class:'home-agenda-rel'},homeLabelHari(item.tanggal,todayKey)),h('span',{class:'home-agenda-type'},item.jenis==='kegiatan'?'Kegiatan':'Piket')));
  });
  /* ===== Info hari ini untuk kartu sambutan ===== */
  const infoHariIni=[];
  upcomingEvents.filter(e=>e.tanggal===todayKey).slice(0,1).forEach(e=>infoHariIni.push('Kegiatan hari ini: '+(e.judul||'Kegiatan komunitas')+(e.waktu?' · '+e.waktu:'')));
  upcomingDuties.filter(d=>d.tanggal===todayKey).slice(0,1).forEach(d=>{
    const asg=Array.isArray(d.assignments)&&d.assignments.length?d.assignments:[{nama:d.nama||'',tugas:d.tugas||''}];
    const nama=asg.map(a=>a.nama).filter(Boolean).join(', ');
    infoHariIni.push('Piket hari ini'+(nama?': '+nama:''));
  });
  /* ===== Statistik: ubin bisa diketuk menuju halamannya, lengkap
     dengan keterangan kecil dari data yang sama ===== */
  const memberGroups=wilayah();
  const regionNames=Object.keys(memberGroups);
  const topRegion=regionNames.filter(n=>n!=='Belum dipilih').sort((a,b)=>(memberGroups[b]||[]).length-(memberGroups[a]||[]).length)[0];
  const eventsBulanIni=S.events.filter(e=>String(e.tanggal||'').slice(0,7)===monthKey).length;
  const statTiles=[
    ['Anggota',S.members.length,(nonaktifCount>0?(aktifMembers.length+' aktif · '+nonaktifCount+' nonaktif'):'Semua anggota aktif'),'members'],
    ['Kegiatan',S.events.length,eventsBulanIni+' kegiatan bulan ini','kegiatan'],
    ['Wilayah',regionNames.length,(topRegion?(topRegion+' terbanyak ('+(memberGroups[topRegion]||[]).length+')'):'Belum ada anggota'),'peta'],
    ['Jadwal Piket',S.cleaningDuties.length,(upcomingDuties.length?(upcomingDuties.length+' jadwal mendatang'):'Belum ada yang mendatang'),'piket']
  ];
  /* ===== Kartu wilayah: nama, jumlah, batang bagian & persen ===== */
  const totalMembers=S.members.length||1;
  const regionCard=(name,color,members)=>{
    const pct=Math.round(members.length/totalMembers*100);
    return h('section',{class:'home-region-card',style:'--region-color:'+color,onclick:()=>{S.memberRegion=name;S.memberQuery='';S.memberStatus='';go('members')}},
      h('div',{class:'home-region-heading'},h('b',{},name==='Belum dipilih'?'Wilayah belum dipilih':name),h('span',{},members.length+' anggota')),
      h('div',{class:'home-region-bar'},h('span',{style:'width:'+pct+'%'})),
      h('p',{class:'home-region-pct'},pct+'% dari seluruh anggota')
    );
  };
  const regionCards=wilayahEfektif().map(([name,color])=>regionCard(name,color,memberGroups[name]||[]));
  if(memberGroups['Belum dipilih']?.length)regionCards.push(regionCard('Belum dipilih','#718096',memberGroups['Belum dipilih']));
  /* ===== Akses cepat: delapan pintasan, mengikuti menu yang aktif ===== */
  const shortcuts=[['users','Anggota','members'],['calendar','Kegiatan','kegiatan'],['brush','Jadwal Piket','piket'],['messages','Forum','forum'],['map','Peta','peta'],['wallet','Keuangan','keuangan'],['box','Inventaris','inventaris'],['notebook','Musyawarah','musyawarah']]
    .filter(([, ,view])=>S.mainAdmin||menuAktifUntuk(view));
  /* ===== Ringkasan bulan ini: keuangan, inventaris, pesan, persetujuan ===== */
  const finBulanIni=(S.keuangan||[]).filter(item=>financeMonthKey(item.tanggal)===monthKey);
  const finTotalBulanIni=finBulanIni.reduce((s,item)=>s+(Number(item.jumlah)||0),0);
  const invDipinjam=(S.inventaris||[]).filter(item=>typeof invStatus==='function'&&invStatus(item)==='dipinjam').length;
  const summaryRows=[
    {glyph:'wallet',judul:'Keuangan · '+today.toLocaleDateString('id-ID',{month:'long',year:'numeric'}),isi:formatYen(finTotalBulanIni)+' dari '+finBulanIni.length+' catatan belanja',view:'keuangan'},
    {glyph:'box',judul:'Inventari Benda SB',isi:(S.inventaris||[]).length+' benda tercatat'+(invDipinjam?' · '+invDipinjam+' sedang dipinjam':' · semua tersedia'),view:'inventaris'},
    {glyph:'inbox',judul:'Pesan Masuk',isi:S.unreadMessages>0?S.unreadMessages+' pesan belum dibaca':'Tidak ada pesan yang belum dibaca',view:'pesan',badge:S.unreadMessages>0?String(S.unreadMessages):''}
  ].filter(row=>S.mainAdmin||menuAktifUntuk(row.view));
  if(S.admin&&(S.pendingUsers||[]).length>0)summaryRows.push({glyph:'users',judul:'Persetujuan Akun',isi:(S.pendingUsers||[]).length+' akun menunggu persetujuan',view:'approvals',badge:String((S.pendingUsers||[]).length)});
  return [
    approvedBanner,
    h('section',{class:'home-welcome'},
      h('div',{class:'home-welcome-text'},
        h('small',{},today.toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'})),
        h('h1',{},homeSapaan()+(S.name?', '+S.name.split(' ')[0]:'')+'!'),
        h('p',{},welcomeMessage()),
        infoHariIni.length?h('p',{class:'home-today-info'},icon('calendar',14),h('span',{},infoHariIni.join('  ·  '))):null,
        h('div',{class:'home-welcome-actions'},
          h('button',{class:'btn home-welcome-cta',onclick:()=>go('kegiatan')},'Lihat Kegiatan'),
          h('button',{class:'btn home-welcome-cta2',onclick:()=>go('piket')},'Jadwal Piket'))),
      homeMascot()
    ),
    h('div',{class:'stats home-stats'},...statTiles.map(([label,value,detail,view])=>h('div',{class:'home-stat',title:'Buka '+label,onclick:()=>go(view)},h('small',{},label),h('b',{},String(value)),h('span',{class:'home-stat-detail'},detail)))),
    h('div',{class:'home-section-heading'},h('h2',{},'Agenda terdekat'),h('button',{class:'btn s',onclick:()=>go('ringkasan')},'Ringkasan')),
    agendaRows.length?h('div',{class:'home-agenda'},...agendaRows):h('div',{class:'home-empty'},icon('calendar',23),h('p',{},'Belum ada agenda mendatang. Kegiatan dan jadwal piket terdekat akan tampil di sini.')),
    h('div',{class:'home-section-heading'},h('h2',{},'Daftar anggota'),S.admin&&h('button',{class:'btn s',onclick:()=>go('members')},'+ Tambah')),
    h('div',{class:'home-region-list'},...regionCards),
    h('div',{class:'home-section-heading'},h('h2',{},'Akses cepat')),
    h('div',{class:'home-shortcuts'},...shortcuts.map(([glyph,label,view])=>h('button',{class:'home-shortcut',onclick:()=>go(view)},h('span',{class:'home-shortcut-icon'},icon(glyph,22)),h('b',{},label),h('span',{class:'home-shortcut-arrow'},'›')))),
    h('div',{class:'home-section-heading'},h('h2',{},'Ringkasan bulan ini')),
    h('div',{class:'home-summary'},...summaryRows.map(row=>h('button',{class:'home-summary-row',onclick:()=>go(row.view)},
      h('span',{class:'home-summary-icon'},icon(row.glyph,19)),
      h('span',{class:'home-summary-main'},h('b',{},row.judul),h('small',{},row.isi)),
      row.badge?h('span',{class:'nav-badge'},row.badge):null,
      h('span',{class:'home-summary-arrow'},'›')))),
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
