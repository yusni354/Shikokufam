/* Halaman Laporan Keamanan Aplikasi: khusus ADMIN UTAMA (penjagaan
   sama seperti halaman Pengaturan — menu hanya di navigasi kanan
   admin utama, go()/render()/pemulihan halaman menolak peran lain,
   dan fungsi gambar di bawah ini bergerbang admin utama sendiri).
   Semua angka & pemberitahuan dihitung dari data profil akun yang
   sudah dimuat aplikasi (loadPendingUsers di map.js memuat akun
   menunggu, disetujui, dan ditolak). Uji akses anonim melakukan
   permintaan SUNGGUHAN ke server Supabase produksi memakai HANYA
   kunci publishable — tanpa token sesi pengguna yang sedang masuk —
   persis sudut pandang orang asing tanpa akun. Hasil uji hanya
   hidup di ingatan selama halaman dipakai (S.keamananUji). */

/* Daftar periksa pengerasan yang diketahui: dipakai halaman ini dan
   berkas laporan unduhan, supaya isinya selalu sama. 'catatan' adalah
   hal yang sudah diketahui & diterima pemilik — bukan peringatan
   mendesak dan bukan tombol perbaikan. */
const KEAMANAN_PERIKSA=[
  {status:'aman',judul:'Pintu masuk lokal ketuk-3× terhapus',ket:'Tidak ada lagi jalan masuk darurat lokal. Masuk hanya lewat akun Supabase yang disetujui admin.'},
  {status:'aman',judul:'Tempat lampiran pesan & foto anggota privat',ket:'Berkas hanya dapat dibuka akun yang masuk lewat tautan bertanda tangan yang berlaku 1 jam.'},
  {status:'aman',judul:'Akses anonim tertutup',ket:'Pengunjung tanpa akun tidak dapat membaca data aplikasi, pesan, profil akun, maupun isi tempat berkas.'},
  {status:'aman',judul:'Skrip luar terkunci (SRI) + aturan CSP aktif',ket:'Peramban menolak skrip CDN yang isinya berubah, dan aplikasi hanya berbicara dengan asal resmi yang benar-benar dipakai.'},
  {status:'aman',judul:'Tidak ada kunci rahasia server di aplikasi',ket:'Aplikasi hanya membawa kunci publishable yang memang diperuntukkan bagi publik.'},
  {status:'catatan',judul:'Unggah lampiran oleh akun belum disetujui',ket:'Aturan unggah lampiran belum memeriksa status persetujuan akun, dan tempat berkas belum mempunyai batas ukuran & jenis berkas.'},
  {status:'catatan',judul:'Akses pesan akun yang dicabut',ket:'Akun yang statusnya berubah menjadi ditolak masih tercatat sebagai peserta pada percakapan lamanya.'},
  {status:'catatan',judul:'Setelan peta terbaca akun yang masuk',ket:'Setelan peta dapat dibaca semua akun yang masuk, termasuk yang belum disetujui.'},
  {status:'catatan',judul:'Alamat anggota ke layanan geocoding',ket:'Saat halaman Peta dibuka, alamat anggota dikirim ke Nominatim, GSI, dan HeartRails untuk menghitung posisi pin.'},
  {status:'catatan',judul:'Perlindungan dibingkai situs lain',ket:'Pencegahan clickjacking memerlukan header keamanan di lapisan hosting dan belum terpasang di sana.'}
];
function keamananSemuaAkun(){
  return [...(S.pendingUsers||[]),...(S.approvedUsers||[]),...(S.rejectedUsers||[])];
}
function keamananBaru7Hari(){
  const batas=Date.now()-7*24*60*60*1000;
  return keamananSemuaAkun().filter(user=>{
    const t=new Date(user.created_at||0).getTime();
    return Number.isFinite(t)&&t>0&&t>=batas;
  }).sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0));
}
function keamananPersetujuanTerakhir(){
  const berCatatan=(S.approvedUsers||[]).filter(user=>user.approved_at);
  if(!berCatatan.length)return null;
  return berCatatan.sort((a,b)=>new Date(b.approved_at)-new Date(a.approved_at))[0];
}
function keamananUjiRingkasan(){
  const uji=S.keamananUji;
  if(!uji)return 'Belum diuji';
  if(uji.items.some(item=>item.status==='terbuka'))return 'Ada yang terbuka';
  if(uji.items.some(item=>item.status==='gagal'))return 'Belum tuntas';
  return 'Aman';
}
function keamananLencana(status){
  if(status==='aman')return h('span',{class:'sec-badge sec-badge-ok'},'Aman');
  if(status==='terbuka')return h('span',{class:'sec-badge sec-badge-bad'},'TERBUKA');
  if(status==='catatan')return h('span',{class:'sec-badge sec-badge-note'},'Catatan');
  return h('span',{class:'sec-badge sec-badge-mut'},'Tidak teruji');
}
function keamananBaris(judul,ket,lencana){
  return h('div',{class:'sec-row'},
    h('div',{class:'sec-row-main'},h('b',{},judul),ket?h('small',{style:'display:block'},ket):null),
    lencana||null);
}
/* ===== Uji akses anonim (permintaan sungguhan, kunci publishable saja) ===== */
async function ujiAnonimKirim(url,opsi){
  const cfg=window.SUPABASE_CONFIG||{};
  const headers={apikey:cfg.anonKey,Authorization:'Bearer '+cfg.anonKey};
  const init={method:(opsi&&opsi.method)||'GET',headers};
  if(opsi&&opsi.body){headers['Content-Type']='application/json';init.body=JSON.stringify(opsi.body)}
  const res=await fetch(url,init);
  let data=null;
  try{data=await res.json()}catch(e){/* jawaban tanpa isi JSON: cukup statusnya */}
  return {res,data};
}
async function ujiAnonimBaca(label,url){
  try{
    const {res,data}=await ujiAnonimKirim(url);
    if(res.ok&&Array.isArray(data)){
      if(data.length)return {label,status:'terbuka',ket:data.length+' baris data terlihat tanpa masuk.'};
      return {label,status:'aman',ket:'Tidak ada data yang terlihat tanpa masuk.'};
    }
    return {label,status:'aman',ket:'Server menolak permintaan tanpa akun (HTTP '+res.status+').'};
  }catch(e){
    return {label,status:'gagal',ket:'Tidak dapat menghubungi server — periksa koneksi, lalu coba lagi.'};
  }
}
async function ujiAnonimBucket(label,namaBucket){
  const base=(window.SUPABASE_CONFIG||{}).url||'';
  try{
    const {res}=await ujiAnonimKirim(base+'/storage/v1/bucket/'+namaBucket);
    if(res.ok)return {label,status:'terbuka',ket:'Info tempat penyimpanan ini terlihat tanpa masuk.'};
    return {label,status:'aman',ket:'Tempat penyimpanan tidak terlihat dari luar (HTTP '+res.status+').'};
  }catch(e){
    return {label,status:'gagal',ket:'Tidak dapat menghubungi server — periksa koneksi, lalu coba lagi.'};
  }
}
async function ujiAnonimDaftarLampiran(){
  const label='Daftar berkas lampiran pesan';
  const base=(window.SUPABASE_CONFIG||{}).url||'';
  try{
    const {res,data}=await ujiAnonimKirim(base+'/storage/v1/object/list/message-attachments',{method:'POST',body:{prefix:'',limit:5}});
    if(res.ok&&Array.isArray(data)){
      if(data.length)return {label,status:'terbuka',ket:data.length+' berkas terlihat tanpa masuk.'};
      return {label,status:'aman',ket:'Tidak ada berkas yang terlihat tanpa masuk.'};
    }
    return {label,status:'aman',ket:'Server menolak permintaan tanpa akun (HTTP '+res.status+').'};
  }catch(e){
    return {label,status:'gagal',ket:'Tidak dapat menghubungi server — periksa koneksi, lalu coba lagi.'};
  }
}
async function jalankanUjiAnonim(){
  if(S.keamananUjiBerjalan||!S.supabase)return;
  S.keamananUjiBerjalan=true;
  render();
  const base=(window.SUPABASE_CONFIG||{}).url||'';
  const items=[];
  items.push(await ujiAnonimBaca('Data aplikasi (anggota, keuangan, inventaris, dll.)',base+'/rest/v1/app_data?select=id&limit=5'));
  items.push(await ujiAnonimBaca('Pesan antar anggota',base+'/rest/v1/messages?select=id&limit=5'));
  items.push(await ujiAnonimBaca('Profil akun pengguna',base+'/rest/v1/profiles?select=id&limit=5'));
  items.push(await ujiAnonimBucket('Info tempat lampiran pesan','message-attachments'));
  items.push(await ujiAnonimBucket('Info tempat foto anggota','member-files'));
  items.push(await ujiAnonimDaftarLampiran());
  S.keamananUji={at:Date.now(),items};
  S.keamananUjiBerjalan=false;
  render();
}
/* ===== Berkas laporan unduhan (dibuat dari data halaman saat itu) ===== */
function susunLaporanKeamananTeks(){
  const garis=[];
  const uji=S.keamananUji;
  const baru7=keamananBaru7Hari().length;
  garis.push('# Laporan Keamanan Aplikasi — Shikoku Family');
  garis.push('');
  garis.push('Tanggal: '+new Date().toLocaleString('id-ID'));
  garis.push('');
  garis.push('## Ringkasan');
  garis.push('- Akun menunggu persetujuan: '+(S.pendingUsers||[]).length);
  garis.push('- Pendaftar baru (7 hari terakhir): '+baru7);
  garis.push('- Total akun disetujui: '+(S.approvedUsers||[]).length);
  garis.push('- Akun ditolak: '+(S.rejectedUsers||[]).length);
  garis.push('- Hasil uji akses anonim terakhir: '+keamananUjiRingkasan()+(uji?' ('+new Date(uji.at).toLocaleString('id-ID')+')':''));
  garis.push('');
  garis.push('## Hasil Uji Akses Anonim');
  if(uji){
    uji.items.forEach(item=>{
      const label=item.status==='aman'?'Aman':item.status==='terbuka'?'TERBUKA':'Tidak teruji';
      garis.push('- '+item.label+': '+label+' — '+item.ket);
    });
  }else garis.push('Belum dijalankan.');
  garis.push('');
  garis.push('## Daftar Periksa Keamanan');
  KEAMANAN_PERIKSA.forEach(item=>{
    garis.push('- ['+(item.status==='aman'?'Sudah aman':'Catatan')+'] '+item.judul+' — '+item.ket);
  });
  garis.push('');
  garis.push('## Akun & Peran');
  const disetujui=S.approvedUsers||[];
  garis.push('- Total akun: '+keamananSemuaAkun().length);
  garis.push('- Admin Utama: '+disetujui.filter(user=>user.is_main_admin).length);
  garis.push('- Pengurus: '+disetujui.filter(user=>!user.is_main_admin&&user.role==='admin').length);
  garis.push('- Anggota: '+disetujui.filter(user=>!user.is_main_admin&&user.role!=='admin').length);
  garis.push('- Status disetujui: '+disetujui.length);
  garis.push('- Status menunggu: '+(S.pendingUsers||[]).length);
  garis.push('- Status ditolak: '+(S.rejectedUsers||[]).length);
  garis.push('');
  return garis.join('\n');
}
function unduhLaporanKeamanan(){
  const sekarang=new Date();
  const pad=n=>String(n).padStart(2,'0');
  const nama='laporan-keamanan-'+sekarang.getFullYear()+pad(sekarang.getMonth()+1)+pad(sekarang.getDate())+'-'+pad(sekarang.getHours())+pad(sekarang.getMinutes())+'.md';
  const blob=new Blob([susunLaporanKeamananTeks()],{type:'text/markdown;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const tautan=h('a',{href:url,download:nama});
  document.body.append(tautan);
  tautan.click();
  tautan.remove();
  setTimeout(()=>{try{URL.revokeObjectURL(url)}catch(e){}},4000);
}
/* ===== Halaman ===== */
function vKeamanan(){
  if(!S.mainAdmin)return [h('p',{class:'warn'},'Halaman ini hanya dapat diakses admin utama.')];
  const menunggu=S.pendingUsers||[];
  const disetujui=S.approvedUsers||[];
  const ditolak=S.rejectedUsers||[];
  const baru7=keamananBaru7Hari();
  const terakhir=keamananPersetujuanTerakhir();
  const uji=S.keamananUji;
  /* --- Pemberitahuan keamanan, dihitung dari data profil --- */
  const pemberitahuan=[];
  if(menunggu.length)pemberitahuan.push(h('div',{class:'sec-row'},
    h('div',{class:'sec-row-main'},
      h('b',{},menunggu.length+' akun menunggu persetujuan'),
      h('small',{style:'display:block'},'Pendaftar terbaru: '+(menunggu[menunggu.length-1].name||menunggu[menunggu.length-1].email||'—')+'. Akun yang belum disetujui tidak dapat membaca data aplikasi.')),
    h('button',{class:'btn s',onclick:()=>go('approvals')},'Buka Persetujuan')));
  if(baru7.length)pemberitahuan.push(keamananBaris(
    baru7.length+' pendaftar baru dalam 7 hari terakhir',
    baru7.slice(0,5).map(user=>(user.name||user.email||'—')+' ('+new Date(user.created_at).toLocaleDateString('id-ID')+')').join(' · ')+(baru7.length>5?' · dan '+(baru7.length-5)+' lainnya':''),
    null));
  if(ditolak.length)pemberitahuan.push(keamananBaris(
    ditolak.length+' akun ditolak',
    'Terbaru: '+(ditolak[0].name||ditolak[0].email||'—')+'. Akun ditolak tidak dapat masuk ke aplikasi.',
    null));
  if(terakhir)pemberitahuan.push(keamananBaris(
    'Persetujuan terakhir',
    (terakhir.name||terakhir.email||'—')+' disetujui'+(terakhir.approved_by?' oleh '+terakhir.approved_by:'')+' pada '+tanggalAkun(terakhir.approved_at)+'.',
    null));
  /* --- Akun & peran --- */
  const peranBaris=[
    ['Total akun',keamananSemuaAkun().length],
    ['Admin Utama',disetujui.filter(user=>user.is_main_admin).length],
    ['Pengurus',disetujui.filter(user=>!user.is_main_admin&&user.role==='admin').length],
    ['Anggota',disetujui.filter(user=>!user.is_main_admin&&user.role!=='admin').length],
    ['Status disetujui',disetujui.length],
    ['Status menunggu',menunggu.length],
    ['Status ditolak',ditolak.length]
  ];
  return [h('h1',{},'Laporan Keamanan Aplikasi'),
    h('p',{class:'sub'},'Keadaan keamanan aplikasi dari sudut pandang pihak luar: siapa yang menunggu persetujuan, dan apakah orang tanpa akun bisa melihat apa pun.'),
    /* 1) Ringkasan status */
    h('div',{class:'stats'},
      h('div',{},h('small',{},'Menunggu Persetujuan'),h('b',{},String(menunggu.length))),
      h('div',{},h('small',{},'Pendaftar Baru 7 Hari'),h('b',{},String(baru7.length))),
      h('div',{},h('small',{},'Akun Disetujui'),h('b',{},String(disetujui.length))),
      h('div',{},h('small',{},'Uji Anonim Terakhir'),h('b',{style:'font-size:19px'},keamananUjiRingkasan()))),
    /* 2) Pemberitahuan keamanan */
    box(h('b',{},'Pemberitahuan Keamanan'),
      ...(pemberitahuan.length?pemberitahuan:[h('p',{class:'warn',style:'margin:10px 0 2px'},'Tidak ada pemberitahuan keamanan saat ini.')])),
    /* 3) Uji keamanan langsung */
    box(h('b',{},'Uji Keamanan Langsung'),
      h('p',{class:'warn',style:'margin:8px 0 2px'},'Uji ini meniru orang asing tanpa akun: permintaan dikirim ke server hanya dengan kunci publik aplikasi, tanpa memakai sesi masuk Anda.'),
      S.supabase
        ?h('div',{class:'fl'},h('button',S.keamananUjiBerjalan?{class:'btn',disabled:''}:{class:'btn',onclick:()=>jalankanUjiAnonim()},S.keamananUjiBerjalan?'Menjalankan uji…':'Jalankan Uji Akses Anonim'))
        :h('p',{class:'warn',style:'margin:8px 0 2px'},'Uji ini hanya tersedia pada mode online (Supabase).'),
      ...(uji?[
        h('p',{class:'warn',style:'margin:12px 0 2px'},'Hasil terakhir: '+new Date(uji.at).toLocaleString('id-ID')+' — keseluruhan: '+keamananUjiRingkasan()+'.'),
        ...uji.items.map(item=>keamananBaris(item.label,item.ket,keamananLencana(item.status)))
      ]:[])),
    /* 4) Daftar periksa keamanan */
    box(h('b',{},'Daftar Periksa Keamanan'),
      ...KEAMANAN_PERIKSA.map(item=>keamananBaris(item.judul,item.ket,
        item.status==='aman'?h('span',{class:'sec-badge sec-badge-ok'},'Sudah aman'):keamananLencana('catatan')))),
    /* 5) Akun & peran */
    box(h('b',{},'Akun & Peran'),
      ...peranBaris.map(([label,nilai])=>h('div',{class:'sec-row'},
        h('div',{class:'sec-row-main'},h('span',{},label)),
        h('b',{},String(nilai))))),
    /* 6) Unduh laporan */
    box(h('b',{},'Unduh Laporan'),
      h('p',{class:'warn',style:'margin:8px 0 2px'},'Berkas teks berisi ringkasan angka, hasil uji anonim terakhir (bila sudah dijalankan), dan daftar periksa di atas.'),
      h('div',{class:'fl'},h('button',{class:'btn',onclick:()=>unduhLaporanKeamanan()},'Unduh Laporan (.md)')))];
}
