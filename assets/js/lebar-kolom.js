/* ===== Lebar kolom tabel yang bisa diatur (seperti Excel) =====
   Setiap tabel data aplikasi (Inventari, rekap Kegiatan, dan tabel-
   tabel laporan di Ringkasan & Laporan) kolomnya bisa diatur lebarnya
   oleh ADMIN UTAMA saja: TEKAN LAMA (±450 ms, sama seperti gestur
   tekan-lama lain di aplikasi) pada GARIS BATAS antar kolom di kepala
   tabel sampai garis itu aktif (garis menebal berwarna teal), lalu
   SERET menyamping — lebar kolom di kirinya berubah langsung — dan
   LEPAS untuk menyimpan.

   Penyimpanan: satu dokumen {id:'lebar_kolom', peta:{idTabel:[px,…]}}
   di koleksi 'pengaturan' (pola yang sama seperti pesan sambutan,
   sumber peta, dan urutan menu), jadi lebar yang diatur admin utama
   berlaku untuk SEMUA pengguna. Pengguna lain tidak melihat pegangan
   apa pun dan tidak bisa mengubah lebar — tabel mereka hanya memakai
   lebar tersimpan lewat colgroup. Bila dokumen belum ada, semua tabel
   tampil dengan lebar bawaan CSS persis seperti sebelumnya.

   Penerapan: colgroup nyata + table-layout:fixed (kelas 'lk-ada-lebar')
   begitu lebar tersimpan ada, jadi lebar tersimpan menang atas lebar
   bawaan CSS. Lebar minimum 48px supaya kolom tidak bisa dihancurkan
   sampai hilang. Di HP, tabel Inventari yang digeser menyamping
   memakai lebar tersimpan yang sama; posisi lengket kolom No/Foto/
   Nama mengikuti lebar baru lewat variabel CSS --lk-l2/--lk-l3.

   Gestur dibedakan dari ketukan biasa dan dari gulir/seret tabel:
   pegangan adalah jalur sempit (14px) di tepi kanan tiap kepala kolom
   dengan touch-action:none, tekanannya tidak diteruskan ke penangan
   seret-gulir wadah tabel, gerakan >10px sebelum tekan lama matang
   membatalkan mode atur (itu niat menggulir), menu konteks & seleksi
   teks dicegah selama menekan/menyeret, dan klik sisa sesudah seretan
   ditelan satu kali supaya kepala kolom rekap tidak ikut membuka
   panel pengaturannya. */
const LK_MIN=48,LK_MAX=900,LK_TEkan_LAMA=450;
function lkBersihDaftar(v){
  if(!Array.isArray(v)||!v.length)return null;
  const out=v.map(x=>{
    const n=Math.round(Number(x));
    return Number.isFinite(n)?Math.max(LK_MIN,Math.min(LK_MAX,n)):null;
  });
  return out.some(x=>x==null)?null:out;
}
function lkBersihPeta(raw){
  const out={};
  if(raw&&typeof raw==='object'&&!Array.isArray(raw)){
    Object.keys(raw).forEach(k=>{
      const bersih=lkBersihDaftar(raw[k]);
      if(bersih)out[k]=bersih;
    });
  }
  return out;
}
function lebarKolomUntuk(id){
  const v=S.lebarKolom&&S.lebarKolom[id];
  return Array.isArray(v)?v.slice():null;
}
/* Lebar efektif tabel rekap Kegiatan: jumlah kolomnya berubah mengikuti
   jumlah kegiatan pada bulan terpilih (Nama + kolom kegiatan + Hadir/
   Izin/Cuti/Alpha/% Hadir). Bila jumlah kolom sama dengan simpanan,
   simpanan dipakai apa adanya; bila berbeda, kolom Nama dan lima kolom
   ringkasan kanan memakai simpanan, kolom-kolom kegiatan memakai lebar
   kolom kegiatan pertama dari simpanan. */
function lebarRekapEfektif(totalKolom){
  const saved=lebarKolomUntuk('rekap_kegiatan');
  if(!saved)return null;
  if(saved.length===totalKolom)return saved;
  if(saved.length<6||totalKolom<6)return null;
  const jumlahKegiatan=totalKolom-6;
  const lebarKegiatan=saved[1]||64;
  const out=[saved[0]];
  for(let i=0;i<jumlahKegiatan;i++)out.push(lebarKegiatan);
  out.push(...saved.slice(-5));
  return out;
}
function subscribeLebarKolom(){
  if(!S.db)return ()=>{};
  try{
    return S.db.collection('pengaturan').onSnapshot(snap=>{
      const doc=(snap.docs||[]).find(d=>d.id==='lebar_kolom');
      const data=doc&&typeof doc.data==='function'?doc.data():null;
      const next=lkBersihPeta(data&&data.peta);
      if(JSON.stringify(next)!==JSON.stringify(S.lebarKolom||{})){
        S.lebarKolom=next;
        if(S.view==='inventaris'||S.view==='ringkasan')renderDariData();
      }
    },error=>{console.error('Lebar kolom tabel gagal dimuat:',error)});
  }catch(error){console.error('Lebar kolom tabel gagal dimuat:',error);return ()=>{}}
}
async function simpanLebarKolom(id,widths){
  if(!S.mainAdmin)return;
  const bersih=lkBersihDaftar(widths);
  if(!bersih)return;
  const sebelum=S.lebarKolom||{};
  S.lebarKolom={...sebelum,[id]:bersih};
  if(!S.db)return;
  try{
    await S.db.collection('pengaturan').doc('lebar_kolom').set({peta:S.lebarKolom,at:Date.now()});
  }catch(e){
    console.error(e);
    S.lebarKolom=sebelum;
    alert('Gagal menyimpan lebar kolom: '+(e.message||'periksa koneksi'));
    render();
  }
}
function lkJumlahKolom(table){
  if(table.tHead){
    const ths=table.tHead.querySelectorAll('th');
    if(ths.length)return ths.length;
  }
  const row=table.querySelector('tr');
  return row?row.cells.length:0;
}
/* Terapkan lebar tersimpan ke tabel lewat colgroup. lebarEksplisit
   dipakai tabel rekap (lebar efektif hasil penyesuaian jumlah kolom);
   tanpa itu lebar dibaca dari simpanan menurut idTabel. Mengembalikan
   daftar lebar yang diterapkan (atau null bila belum ada simpanan —
   tabel tampil dengan lebar bawaan CSS persis seperti sebelumnya). */
function lkTerapkan(table,id,lebarEksplisit){
  if(!table||!id)return null;
  const widths=lebarEksplisit||lebarKolomUntuk(id);
  if(!widths||!widths.length)return null;
  const n=lkJumlahKolom(table);
  if(!n)return null;
  let cg=table.querySelector('colgroup.lk-cg');
  if(cg&&cg.children.length!==n){cg.remove();cg=null}
  if(!cg){
    cg=document.createElement('colgroup');
    cg.className='lk-cg';
    for(let i=0;i<n;i++)cg.append(document.createElement('col'));
    table.insertBefore(cg,table.firstChild);
  }
  let sum=0,lengkap=true;
  for(let i=0;i<n;i++){
    const w=widths[i];
    if(typeof w==='number'&&Number.isFinite(w)){cg.children[i].style.width=w+'px';sum+=w}
    else lengkap=false;
  }
  table.classList.add('lk-ada-lebar');
  if(lengkap&&sum>0){table.style.width=sum+'px';table.style.minWidth=sum+'px'}
  /* Posisi lengket kolom Foto & Nama pada tabel Inventari di HP
     mengikuti lebar kolom No & Foto yang baru. */
  if(typeof widths[0]==='number')table.style.setProperty('--lk-l2',widths[0]+'px');
  if(typeof widths[0]==='number'&&typeof widths[1]==='number')table.style.setProperty('--lk-l3',(widths[0]+widths[1])+'px');
  table.__lkWidths=widths.slice();
  return widths;
}
function lkLebarSaatIni(table){
  const ths=table.tHead?[...table.tHead.querySelectorAll('th')]:[];
  const applied=table.__lkWidths;
  return ths.map((th,i)=>{
    const a=applied&&applied[i];
    if(typeof a==='number'&&a>=LK_MIN)return a;
    return Math.max(LK_MIN,Math.round(th.offsetWidth||LK_MIN));
  });
}
/* Klik sisa sesudah seretan lebar ditelan satu kali (penjaga bersama,
   pola yang sama seperti penjaga klik seret lain di aplikasi). */
let lkTelanKlikSampai=0,lkTelanKlikTabel=null;
document.addEventListener('click',e=>{
  if(lkTelanKlikTabel&&Date.now()<lkTelanKlikSampai&&lkTelanKlikTabel.contains(e.target)){
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    lkTelanKlikTabel=null;
    lkTelanKlikSampai=0;
  }
},true);
function lkMulaiTekan(ev,table,id,idx,th){
  if(!S.mainAdmin)return;
  if(ev.button!=null&&ev.button>0)return;
  /* Tekanan pada pegangan TIDAK diteruskan: penangan seret-gulir wadah
     tabel (shell.js) tidak boleh ikut berjalan dari jalur pegangan. */
  ev.stopPropagation();
  const pid=ev.pointerId,startX=ev.clientX;
  let aktif=false,selesai=false,timer=null,widths=null,startW=0;
  const bersih=()=>{
    th.classList.remove('lk-aktif');
    table.classList.remove('lk-menyeret');
    document.body.classList.remove('lk-menyeret-body');
  };
  const lepas=()=>{
    if(timer){clearTimeout(timer);timer=null}
    window.removeEventListener('pointermove',onMove);
    window.removeEventListener('pointerup',onUp);
    window.removeEventListener('pointercancel',onUp);
  };
  const onMove=e=>{
    if(e.pointerId!==pid||selesai)return;
    if(!aktif){
      /* Bergerak sebelum tekan lama matang = niat menggulir/menyeret
         tabel seperti biasa: mode atur lebar dibatalkan. */
      if(Math.abs(e.clientX-startX)>10){selesai=true;lepas()}
      return;
    }
    if(e.cancelable)e.preventDefault();
    widths[idx]=Math.max(LK_MIN,Math.min(LK_MAX,Math.round(startW+(e.clientX-startX))));
    lkTerapkan(table,id,widths);
  };
  const onUp=e=>{
    if(e.pointerId!==pid)return;
    const pernahAktif=aktif;
    selesai=true;
    lepas();
    bersih();
    if(!pernahAktif)return;
    /* Klik yang mengikuti akhir seretan tidak boleh memicu kepala
       kolom (mis. membuka panel pengaturan kegiatan di tabel rekap). */
    lkTelanKlikTabel=table;
    lkTelanKlikSampai=Date.now()+500;
    void simpanLebarKolom(id,widths);
  };
  timer=setTimeout(()=>{
    timer=null;
    if(selesai)return;
    aktif=true;
    widths=lkLebarSaatIni(table);
    startW=widths[idx];
    th.classList.add('lk-aktif');
    table.classList.add('lk-menyeret');
    document.body.classList.add('lk-menyeret-body');
    if(navigator.vibrate){try{navigator.vibrate(15)}catch(_){}}
  },LK_TEkan_LAMA);
  window.addEventListener('pointermove',onMove,{passive:false});
  window.addEventListener('pointerup',onUp);
  window.addEventListener('pointercancel',onUp);
}
/* Pasang pegangan atur lebar pada kepala tabel — HANYA untuk admin
   utama. Pengurus & Anggota tidak mendapat pegangan apa pun, jadi
   tidak ada cara bagi mereka mengubah lebar. Pegangan ditaruh di tepi
   kanan tiap kepala kolom kecuali kolom terakhir (garis batas ANTAR
   kolom); menyeretnya mengubah lebar kolom di kirinya. */
function lkPasang(table,id){
  if(!table||!id||!S.mainAdmin)return;
  const thead=table.tHead;
  if(!thead)return;
  const ths=[...thead.querySelectorAll('th')];
  ths.forEach((th,idx)=>{
    if(idx>=ths.length-1)return;
    th.classList.add('lk-th');
    let menekan=false;
    th.addEventListener('contextmenu',e=>{if(menekan)e.preventDefault()});
    const handle=h('span',{class:'lk-handle','aria-hidden':'true',title:'Tekan lama lalu seret untuk mengatur lebar kolom'});
    handle.addEventListener('contextmenu',e=>e.preventDefault());
    handle.addEventListener('pointerdown',ev=>{menekan=true;lkMulaiTekan(ev,table,id,idx,th)});
    handle.addEventListener('pointerup',()=>{menekan=false});
    handle.addEventListener('pointercancel',()=>{menekan=false});
    th.append(handle);
  });
}
