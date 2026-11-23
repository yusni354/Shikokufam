/* Perilaku kerangka: menu samping, tombol pengaturan admin, navigasi go() */
function isAdminSettingsView(){return ADMIN_MENU.some(([view])=>view===S.view)}
function syncAdminTheme(){
  document.body.classList.toggle('admin-dark',S.mainAdmin&&(S.adminMenuOpen||isAdminSettingsView()));
  $('#st').setAttribute('aria-expanded',String(S.adminMenuOpen));
}
/* Bawaan arsip Tahun+Bulan halaman Kegiatan: setiap kali halaman
   Kegiatan DIBUKA, pemilihnya menunjuk BULAN & TAHUN BERJALAN (tanggal
   perangkat hari ini) — bukan bulan kegiatan paling baru/terlama.
   Diterapkan di sini, pada saat masuk halaman lewat go() (dan pada
   pemulihan halaman terakhir sesudah muat ulang), BUKAN di dalam
   gambar ulang: selama pengguna masih di halaman itu, pilihan bulan/
   tahunnya lewat pemilih berjalan seperti biasa dan tidak di-reset
   oleh render. Meninggalkan halaman lalu kembali → bawaan bulan
   berjalan lagi. */
function bawaanArsipKegiatan(){const kini=new Date();S.kegiatanTahun=kini.getFullYear();S.kegiatanBulan=kini.getMonth()+1}
/* Bawaan arsip Tahun+Bulan halaman Ringkasan & Laporan: aturan yang
   sama seperti halaman Kegiatan — setiap kali halaman itu DIBUKA,
   pemilih Tahun + Bulan (ruangan Kegiatan dan pemilih tahun di kepala
   halaman) menunjuk BULAN & TAHUN BERJALAN hari ini, bukan bulan
   paling baru yang ada kegiatannya. Diterapkan saat masuk halaman
   lewat go() dan saat pemulihan halaman sesudah muat ulang, bukan di
   dalam gambar ulang: berpindah bulan/tahun/ruangan selama masih di
   halaman tidak di-reset; keluar lalu kembali → bulan berjalan lagi. */
function bawaanArsipRingkasan(){const kini=new Date();S.ringkasanTahun=kini.getFullYear();S.ringkasanBulan=kini.getMonth()+1}
/* ===== Saklar tampil/sembunyi menu drawer (khusus ADMIN UTAMA) =====
   Keadaan tiap menu disimpan sebagai dokumen {id:'menu_aktif'} di
   koleksi 'pengaturan': isinya peta idMenu -> boolean (true = tampil).
   Bawaan semua menu tampil (id yang belum tercatat dianggap menyala).
   Menu 'landing' (Home) tidak pernah bisa dimatikan: ia pintu masuk
   aplikasi. Admin utama selalu melihat semua menu beserta saklarnya
   (menu mati tampil redup bertanda Nonaktif); Pengurus & Anggota tidak
   melihat saklar, tidak melihat menu yang dimatikan, dan halaman menu
   itu pun tidak bisa mereka buka (penjagaan di go() dan render()). */
function menuAktifUntuk(view){
  if(view==='landing')return true;
  if(!S.menuAktif)return true;
  return S.menuAktif[view]!==false;
}
function subscribeMenuAktif(){
  if(!S.db)return ()=>{};
  try{
    return S.db.collection('pengaturan').onSnapshot(snap=>{
      const doc=(snap.docs||[]).find(d=>d.id==='menu_aktif');
      const data=doc&&typeof doc.data==='function'?doc.data():null;
      const next={};
      if(data)Object.keys(data).forEach(k=>{if(typeof data[k]==='boolean')next[k]=data[k]});
      /* Dokumen tetangga 'menu_urutan' dibaca dari potret yang sama:
         urutan menu hasil seretan admin utama (lihat urutkanMenu). */
      const docU=(snap.docs||[]).find(d=>d.id==='menu_urutan');
      const dataU=docU&&typeof docU.data==='function'?docU.data():null;
      const urutanBaru=Array.isArray(dataU&&dataU.urutan)?dataU.urutan.filter(v=>typeof v==='string'):[];
      let berubah=false;
      if(JSON.stringify(next)!==JSON.stringify(S.menuAktif||{})){S.menuAktif=next;berubah=true}
      if(JSON.stringify(urutanBaru)!==JSON.stringify(S.menuUrutan||[])){S.menuUrutan=urutanBaru;berubah=true}
      if(berubah)renderDariData();
    },error=>{console.error('Pengaturan tampil menu gagal dimuat:',error)});
  }catch(error){console.error('Pengaturan tampil menu gagal dimuat:',error);return ()=>{}}
}
async function aturMenuAktif(view,aktif){
  if(!S.mainAdmin||view==='landing')return;
  const sebelum={...(S.menuAktif||{})};
  S.menuAktif={...sebelum,[view]:!!aktif};
  render();
  if(!S.db)return;
  try{
    await S.db.collection('pengaturan').doc('menu_aktif').set({...S.menuAktif,at:Date.now()});
  }catch(e){
    console.error(e);
    S.menuAktif=sebelum;
    alert('Gagal menyimpan pengaturan menu: '+(e.message||'periksa koneksi'));
    render();
  }
}
/* ===== Urutan menu drawer (diatur ADMIN UTAMA dengan tekan lama) =====
   Urutan id menu disimpan sebagai dokumen {id:'menu_urutan', urutan:[...]}
   di koleksi 'pengaturan' yang sama, jadi berlaku untuk SELURUH
   pengguna: Pengurus & Anggota melihat drawer dalam urutan hasil
   pengaturan admin utama, tetapi tidak bisa mengubahnya. Home
   ('landing') selalu menempel di posisi teratas dan tidak ikut
   bergeser. Urutan bawaan adalah urutan ALL di constants.js; id yang
   belum tercatat (menu baru di masa depan) muncul sesudah id yang
   tercatat, mengikuti urutan bawaannya relatif terhadap sesama id baru. */
function urutkanMenu(daftar){
  const urutan=Array.isArray(S.menuUrutan)?S.menuUrutan:[];
  const idxBawaan=new Map(daftar.map((x,i)=>[x[0],i]));
  const kunci=x=>{
    if(x[0]==='landing')return -1;
    const i=urutan.indexOf(x[0]);
    return i>=0?i:urutan.length+(idxBawaan.get(x[0])||0);
  };
  return daftar.slice().sort((a,b)=>kunci(a)-kunci(b));
}
async function simpanMenuUrutan(urutanBaru){
  if(!S.mainAdmin)return;
  const sebelum=Array.isArray(S.menuUrutan)?S.menuUrutan.slice():[];
  S.menuUrutan=urutanBaru.slice();
  render();
  if(!S.db)return;
  try{
    await S.db.collection('pengaturan').doc('menu_urutan').set({urutan:S.menuUrutan.slice(),at:Date.now()});
  }catch(e){
    console.error(e);
    S.menuUrutan=sebelum;
    alert('Gagal menyimpan urutan menu: '+(e.message||'periksa koneksi'));
    render();
  }
}
/* ===== Geser posisi menu drawer: TEKAN LAMA lalu SERET (admin utama) =====
   Pola isyarat yang sama seperti baris Kepengurusan: tekan dan tahan
   item menu (±450 ms tanpa bergerak) sampai item terangkat masuk mode
   seret, lalu geser ke atas/bawah melewati menu lain; melepas
   menjatuhkan item di posisi baru dan urutan tersimpan otomatis.
   Gerakan sebelum tekan lama matang (termasuk gerakan menyamping)
   berarti niat menggulir drawer: seret dibatalkan dan drawer bergulir
   seperti biasa. Sesudah mode seret aktif, gulir dicegah lewat
   pendengar touchmove non-pasif. Tekan lama pada saklar on/off di
   dalam item tidak memicu seret (saklar adalah tombol), dan klik sisa
   yang mengikuti lepasnya seret DITELAN satu kali (penjaga
   menuSeretSelesaiPada di bawah) supaya item tidak ikut membuka
   halamannya. Pengurus & Anggota tidak mendapat pendengar ini sama
   sekali: renderDrawer hanya memasangnya untuk admin utama. */
let menuSeretSelesaiPada=0;
document.addEventListener('click',e=>{
  if(menuSeretSelesaiPada&&Date.now()-menuSeretSelesaiPada<600){
    const dr=document.getElementById('dr');
    if(dr&&dr.contains(e.target)){
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      menuSeretSelesaiPada=0;
    }
  }
},true);
function pasangSeretMenu(el){
  el.addEventListener('pointerdown',ev=>{
    if(!S.mainAdmin)return;
    if(ev.button!=null&&ev.button>0)return;
    if(ev.target&&ev.target.closest&&ev.target.closest('button,input,select,textarea,[contenteditable="true"]'))return;
    const dr=document.getElementById('dr');
    if(!dr)return;
    const items=[...dr.querySelectorAll('a[data-menu-view]')].filter(a=>a.getAttribute('data-menu-view')!=='landing');
    if(items.length<2)return;
    const startIdx=items.indexOf(el);
    if(startIdx<0)return;
    const pid=ev.pointerId;
    const startX=ev.clientX,startY=ev.clientY;
    const rects=items.map(r=>r.getBoundingClientRect());
    const minDy=rects[0].top-rects[startIdx].top;
    const maxDy=rects[rects.length-1].bottom-rects[startIdx].bottom;
    let aktif=false,targetIdx=startIdx,selesai=false,timer=null;
    const bersih=()=>{
      el.classList.remove('menu-dragging');
      el.style.transform='';
      items.forEach(r=>r.classList.remove('menu-drop-above','menu-drop-below'));
    };
    const cegahGulir=e=>{if(aktif)e.preventDefault()};
    const lepas=()=>{
      if(timer){clearTimeout(timer);timer=null}
      document.removeEventListener('pointermove',onMove);
      document.removeEventListener('pointerup',onUp);
      document.removeEventListener('pointercancel',onUp);
      document.removeEventListener('touchmove',cegahGulir);
    };
    const onMove=e=>{
      if(e.pointerId!==pid||selesai)return;
      if(!aktif){
        /* Bergerak sebelum tekan lama matang = niat menggulir:
           batalkan seret, biarkan drawer bergulir seperti biasa. */
        if(Math.hypot(e.clientX-startX,e.clientY-startY)>10){selesai=true;lepas()}
        return;
      }
      e.preventDefault();
      const dy=Math.max(minDy,Math.min(maxDy,e.clientY-startY));
      el.style.transform='translateY('+dy+'px)';
      /* Indeks tujuan: item pertama yang titik tengahnya dilewati oleh
         titik tengah item yang diseret. */
      const tengah=rects[startIdx].top+rects[startIdx].height/2+dy;
      let t=items.length-1;
      for(let i=0;i<items.length;i++){
        if(tengah<rects[i].top+rects[i].height/2){t=i;break}
      }
      targetIdx=t;
      items.forEach((r,i)=>{
        r.classList.toggle('menu-drop-above',i===targetIdx&&targetIdx<startIdx);
        r.classList.toggle('menu-drop-below',i===targetIdx&&targetIdx>startIdx);
      });
    };
    const onUp=e=>{
      if(e.pointerId!==pid||selesai)return;
      selesai=true;
      lepas();
      const t=targetIdx,pernahAktif=aktif;
      bersih();
      if(!pernahAktif)return;
      /* Klik sisa sesudah seret tidak boleh membuka halaman item ini. */
      menuSeretSelesaiPada=Date.now();
      /* Batal: sentuhan dibatalkan sistem, atau dilepas jauh di luar
         deretan menu — urutan tidak berubah. */
      const batal=e.type==='pointercancel'||e.clientY<rects[0].top-24||e.clientY>rects[rects.length-1].bottom+24;
      if(batal){render();return}
      if(t===startIdx)return;
      /* Susun ulang id yang tampil, lalu gabungkan ke urutan penuh
         saat ini (posisi id yang tidak tampil tidak berubah). */
      const idsTampil=items.map(a=>a.getAttribute('data-menu-view'));
      const pindah=idsTampil.splice(startIdx,1)[0];
      idsTampil.splice(t,0,pindah);
      const urutanPenuh=urutkanMenu(ALL).map(x=>x[0]).filter(id=>id!=='landing');
      let j=0;
      const gabungan=urutanPenuh.map(id=>idsTampil.includes(id)?idsTampil[j++]:id);
      simpanMenuUrutan(gabungan);
    };
    timer=setTimeout(()=>{
      timer=null;
      if(selesai)return;
      aktif=true;
      el.classList.add('menu-dragging');
      if(navigator.vibrate){try{navigator.vibrate(15)}catch(_){}}
    },450);
    document.addEventListener('pointermove',onMove);
    document.addEventListener('pointerup',onUp);
    document.addEventListener('pointercancel',onUp);
    document.addEventListener('touchmove',cegahGulir,{passive:false});
  });
}
function go(v){/* Halaman Pengaturan khusus ADMIN UTAMA: admin biasa yang somehow memanggilnya diarahkan ke Home, bukan sekadar menunya disembunyikan. */if(v==='pengaturan'&&!S.mainAdmin)v='landing';/* Menu yang dimatikan admin utama tidak bisa dibuka pengguna lain: navigasi langsung ke halamannya terpental ke Home. */if(v!=='landing'&&!S.mainAdmin&&!menuAktifUntuk(v))v='landing';if(v==='kegiatan'){bawaanArsipKegiatan();/* Masuk halaman Kegiatan dari menu selalu menuju DAFTAR: detail kegiatan adalah sub-tampilan yang hanya dibuka dari kartu dan ditutup lewat tombol Kembali di dalamnya, jadi keadaan detail & absensi dibersihkan di sini (bukan saat kembali dari detail). */S.activityDetail=null;S.absensiEvent=null;S.absensiRegion=null;S.absensiDraft=null;try{sessionStorage.removeItem('shikoku-family:kegiatan-detail')}catch(e){/* storage terblokir: abaikan */}}if(v==='ringkasan')bawaanArsipRingkasan();S.view=v;simpanViewTerakhir(v);S.adminMenuOpen=false;S.chatDialog=null;S.inboxDialog=null;S.form=S.detail=S.dutyForm=null;S.financeForm=null;S.financePhoto=null;S.inventarisForm=null;S.inventarisPhoto=null;S.inventarisDetail=null;S.inventarisConfirm=null;S.inventarisPinjam=null;S.idPhoto=null;S.detailOrigin=null;S.detailReturnView=null;if(v==='pesan'){/* Masuk menu Pesan selalu menuju KOTAK MASUK (daftar percakapan pribadi pengguna yang masuk) untuk semua peran; percakapan hanya ditandai terbaca saat dibuka, bukan saat daftar ditampilkan. Direktori pengguna dimuat untuk nama/foto lawan bicara dan pemilih Pesan Baru. */S.openConversation=null;S.newChat=null;if(S.uid&&typeof loadUserDirectory==='function')loadUserDirectory().then(()=>{if(S.view==='pesan')renderDariData()})}document.body.classList.remove('open');syncAdminTheme();render()}
$('#mn').onclick=()=>document.body.classList.add('open');
$('#mn').replaceChildren(icon('menu',21));
$('#st').replaceChildren(icon('settings',19));
document.querySelector('.logo')?.replaceChildren(icon('check',19));
$('#ov').onclick=()=>{
  document.body.classList.remove('open');
  if(S.adminMenuOpen){S.adminMenuOpen=false;render()}else syncAdminTheme();
};
$('#st').onclick=()=>{
  /* Drawer kanan hanya boleh dibuka ADMIN UTAMA; selain itu klik
     tidak membuka apa pun dan keadaan terbuka apa pun ditutup. */
  if(!S.mainAdmin){S.adminMenuOpen=false;document.body.classList.remove('open');syncAdminTheme();return}
  S.adminMenuOpen=!S.adminMenuOpen;
  document.body.classList.toggle('open',S.adminMenuOpen);
  $('#st').setAttribute('aria-expanded',String(S.adminMenuOpen));
  syncAdminTheme();
  render();
};
/* ===== Halaman terakhir: muat ulang tetap di halaman yang sama =====
   Setiap perpindahan halaman lewat go() disimpan ke sessionStorage —
   pola penjagaan yang sama seperti penyimpanan lain di aplikasi
   (try/catch penuh; lingkungan yang memblokir storage tidak menimbulkan
   error, halaman terakhir cukup tidak diingat). sessionStorage berarti
   ingatan ini hanya berlaku selama tab/sesi peramban terbuka, sama
   seperti pilihan gaya peta. Sesudah muat ulang, halaman terakhir
   dipulihkan SATU KALI oleh render() (views.js) begitu sesi masuk
   terpulihkan & disetujui; alur sebelum masuk tidak berubah. Halaman
   tersimpan yang tidak dikenal atau tidak boleh dibuka pengguna ini
   diabaikan dan aplikasi tetap di Home. */
const LAST_VIEW_KEY='shikoku-family:last-view';
function simpanViewTerakhir(v){try{sessionStorage.setItem(LAST_VIEW_KEY,String(v||''))}catch(e){/* storage terblokir: abaikan */}}
function bacaViewTerakhir(){try{return sessionStorage.getItem(LAST_VIEW_KEY)||''}catch(e){return ''}}
let viewSudahDipulihkan=false;
function pulihkanViewTerakhir(){
  if(viewSudahDipulihkan)return;
  viewSudahDipulihkan=true;
  const v=bacaViewTerakhir();
  if(!v||v===S.view)return;
  if(typeof V==='undefined'||!V[v])return;
  if(v==='approvals'&&!S.admin)return;
  if(v==='pengaturan'&&!S.mainAdmin)return;
  S.view=v;
  /* Memulihkan halaman Kegiatan sesudah muat ulang: bila halaman
     terakhir adalah DETAIL kegiatan (tersimpan di sessionStorage oleh
     activities.js), pulihkan detail itu beserta arsip bulan/tahun saat
     detail dibuka — bukan bawaan bulan berjalan. Bila kegiatannya
     sudah terhapus, vKegiatan membawanya kembali ke daftar. Tanpa
     detail tersimpan, bawaan arsip bulan berjalan berlaku seperti
     biasa. */
  if(v==='kegiatan'){
    let detailTersimpan=null;
    try{detailTersimpan=JSON.parse(sessionStorage.getItem('shikoku-family:kegiatan-detail')||'null')}catch(e){detailTersimpan=null}
    if(detailTersimpan&&detailTersimpan.id){
      S.activityDetail=String(detailTersimpan.id);
      S._activityDetailAnimate=true;
      if(detailTersimpan.tahun)S.kegiatanTahun=detailTersimpan.tahun;
      if(detailTersimpan.bulan)S.kegiatanBulan=detailTersimpan.bulan;
      if(!detailTersimpan.tahun||!detailTersimpan.bulan)bawaanArsipKegiatan();
    }else bawaanArsipKegiatan();
  }
  /* Halaman Ringkasan & Laporan yang dipulihkan sesudah muat ulang
     diperlakukan sama: bawaan arsipnya bulan berjalan lagi. */
  if(v==='ringkasan')bawaanArsipRingkasan();
}
/* Klik tulisan merek 'SHIKOKU FAMILY' di header -> kembali ke Home;
   go('landing') sekaligus menjadikan Home halaman tersimpan. Kursor
   penunjuknya sudah diatur CSS #brand-title. Ketuk 3x rahasia pada
   elemen yang sama mendengar 'pointerdown' (auth.js), jadi klik ini
   tidak mengganggunya. */
const brandTitleEl=$('#brand-title');
if(brandTitleEl){
  brandTitleEl.setAttribute('title','Kembali ke Home');
  brandTitleEl.addEventListener('click',()=>go('landing'));
}

/* ===== Geser mendatar tabel lebar: seret mouse & Shift + roda =====
   Aturan umum untuk wadah gulir mendatar tabel laporan (.rekap-wrap
   pada tabel rekap absensi, .laporan-wrap pada tabel laporan lain,
   dan .inv-wrap pada tabel Inventari Benda SB):
   1) SERET: menekan tombol kiri mouse lalu menyeret kanan/kiri
      menggeser guliran mendatar wadah mengikuti seretan, seperti
      menggeser kertas. Hanya penunjuk mouse — di layar sentuh usapan
      bawaan peramban sudah menggeser dan tidak diubah.
   2) SHIFT + RODA: menahan Shift sambil menggulir roda di atas wadah
      menggesernya kanan/kiri (roda turun = ke kanan, naik = ke kiri)
      dan menggantikan gulir tegak halaman selama kursor di atasnya.
   Penjagaan klik: seretan yang melewati ambang 5px dianggap seret,
   bukan klik — klik yang mengikuti akhir seretan ditelan satu kali
   (pola yang sama seperti penjaga klik seret-isi absensi), jadi klik
   biasa tanpa seret pada kepala kolom kegiatan (panel hapus admin)
   dan pada pembatas wilayah (lipat/buka) tetap bekerja persis
   seperti sebelumnya. Semua pendengar didelegasikan ke document
   supaya tetap berlaku sesudah halaman digambar ulang. */
(function(){
  const SELEKTOR_WADAH='.rekap-wrap,.laporan-wrap,.inv-wrap';
  const cariWadah=target=>(target&&target.closest)?target.closest(SELEKTOR_WADAH):null;
  const bisaGeser=w=>w.scrollWidth>w.clientWidth+1;
  let suppressClickUntil=0,suppressWrap=null;
  /* Kursor tangan hanya saat wadah memang meluber (bisa digeser);
     diperiksa saat penunjuk melintas supaya selalu mengikuti isi. */
  document.addEventListener('pointerover',e=>{
    const w=cariWadah(e.target);
    if(w)w.classList.toggle('bisa-seret',bisaGeser(w));
  });
  document.addEventListener('pointerdown',e=>{
    if(e.pointerType!=='mouse'||!e.isPrimary||e.button!==0)return;
    const w=cariWadah(e.target);
    if(!w||!bisaGeser(w))return;
    /* Seretan tidak dimulai dari unsur interaktif di dalam tabel */
    if(e.target.closest('a,button,input,select,textarea,label,[contenteditable="true"]'))return;
    const pointerId=e.pointerId,startX=e.clientX,startScroll=w.scrollLeft;
    let aktif=false;
    const onMove=ev=>{
      if(ev.pointerId!==pointerId)return;
      const dx=ev.clientX-startX;
      if(!aktif){
        if(Math.abs(dx)<=5)return;
        aktif=true;
        w.classList.add('menyeret');
      }
      if(ev.cancelable)ev.preventDefault();
      w.scrollLeft=startScroll-dx;
    };
    const onUp=ev=>{
      if(ev.pointerId!==pointerId)return;
      window.removeEventListener('pointermove',onMove);
      window.removeEventListener('pointerup',onUp);
      window.removeEventListener('pointercancel',onUp);
      if(aktif){
        w.classList.remove('menyeret');
        suppressWrap=w;
        suppressClickUntil=Date.now()+400;
      }
    };
    window.addEventListener('pointermove',onMove,{passive:false});
    window.addEventListener('pointerup',onUp);
    window.addEventListener('pointercancel',onUp);
  });
  /* Telan klik pertama sesudah seretan di dalam wadah yang sama */
  document.addEventListener('click',e=>{
    if(suppressWrap&&Date.now()<suppressClickUntil&&suppressWrap.contains(e.target)){
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      suppressWrap=null;
      suppressClickUntil=0;
    }
  },true);
  document.addEventListener('wheel',e=>{
    if(!e.shiftKey)return;
    const w=cariWadah(e.target);
    if(!w||!bisaGeser(w))return;
    let d=Math.abs(e.deltaY)>=Math.abs(e.deltaX)?e.deltaY:e.deltaX;
    if(!d)return;
    if(e.deltaMode===1)d*=16;
    else if(e.deltaMode===2)d*=w.clientWidth;
    e.preventDefault();
    w.scrollLeft+=d;
  },{passive:false});
})();

