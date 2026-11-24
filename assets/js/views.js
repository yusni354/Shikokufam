/* Daftar halaman: nama tampilan -> fungsi yang menggambarnya */
const V={
  landing:vHome,
  dash:vDash,
  members:vMembers,
  kegiatan:vKegiatan,
  ringkasan:vRingkasan,
  piket:vPiket,
  peta:vPeta,
  forum:vForum,
  pesan:vPesan,
  musyawarah:musyawarahView,
  keuangan:vKeuangan,
  inventaris:vInventaris,
  susunan:vSusunan,
  pengaturan:vPengaturan,
  approvals:vApprovals
};
function navTo(view){return event=>{event.preventDefault();go(view)}}
/* Menu samping, render() utama, dan langganan data */
/* Lencana persetujuan: sinkronkan lencana pada item menu Persetujuan di
   drawer admin dan pada tombol roda gigi (#st) di header — tombol itulah
   jalan masuk ke menu Persetujuan, jadi admin utama melihat jumlah akun
   yang menunggu tanpa harus membuka menunya dulu. Dipanggil setiap kali
   daftar pengguna menunggu berubah (loadPendingUsers) dan setiap render,
   supaya angka selalu mengikuti data terbaru tanpa muat ulang halaman. */
function updateApprovalBadges(){
  const count=S.admin?(S.pendingUsers||[]).length:0;
  const value=String(count);
  const nav=document.querySelector('[data-approval-nav]');
  if(nav){
    let badge=nav.querySelector('.nav-badge');
    if(count>0&&!badge){badge=h('span',{class:'nav-badge'},value);nav.append(badge)}
    if(badge){badge.textContent=value;badge.style.display=count>0?'':'none'}
  }
  const st=document.querySelector('#st');
  if(st){
    let badge=st.querySelector('#ab');
    if(count>0&&!badge){badge=h('span',{id:'ab',class:'icon-badge'},value);st.append(badge)}
    if(badge){badge.textContent=value;badge.style.display=count>0?'inline-grid':'none'}
  }
}
function renderDrawer(){
  const d=$('#dr');
  if(S.adminMenuOpen&&S.mainAdmin){
    d.replaceChildren(
      h('p',{class:'sub',style:'padding:0 14px'},h('b',{style:'color:var(--ink)'},'PENGATURAN ADMIN')),
      ...ADMIN_MENU.filter(([view])=>view!=='pengaturan'||S.mainAdmin).map(([view,label,glyph])=>h('a',{class:S.view===view?'on':'',href:'#',onclick:navTo(view),...(view==='approvals'?{'data-approval-nav':'true'}:{})},icon(glyph),h('span',{},label),view==='approvals'&&S.admin&&S.pendingUsers.length>0&&h('span',{class:'nav-badge'},String(S.pendingUsers.length)))),
      h('button',{class:'menu-logout',onclick:()=>go('landing')},icon('back',17),h('span',{},'Kembali ke menu utama'))
    );
    return;
  }
  d.replaceChildren(
    /* Urutan tampil mengikuti urutan tersimpan hasil pengaturan admin
       utama (urutkanMenu di shell.js); bawaan = urutan ALL. */
    ...urutkanMenu(ALL).filter(x=>!x[2]||(x[3]?S.mainAdmin:S.admin))
      /* Menu yang dimatikan admin utama disembunyikan dari drawer
         Pengurus & Anggota; admin utama sendiri tetap melihatnya
         (redup, bertanda Nonaktif, lengkap dengan saklarnya). */
      .filter(x=>S.mainAdmin||menuAktifUntuk(x[0]))
      .map(x=>{
        const aktif=menuAktifUntuk(x[0]);
        const anak=[icon(x[4],19),h('span',{},x[1])];
        if(x[0]==='pesan'&&S.unreadMessages>0)anak.push(h('span',{class:'nav-badge'},String(S.unreadMessages)));
        /* Saklar on/off HANYA untuk admin utama, di semua menu selain
           Home; menekan saklar tidak ikut membuka halamannya. */
        if(S.mainAdmin&&x[0]!=='landing'){
          if(!aktif)anak.push(h('span',{class:'menu-off-tag'},'Nonaktif'));
          anak.push(h('button',{type:'button',class:'menu-switch'+(aktif?' on':''),role:'switch','aria-checked':String(aktif),'aria-label':'Tampilkan menu '+x[1],title:aktif?'Sembunyikan menu ini dari semua pengguna':'Tampilkan menu ini untuk semua pengguna',onclick:ev=>{ev.preventDefault();ev.stopPropagation();aturMenuAktif(x[0],!aktif)}},h('span',{class:'menu-switch-knob'})));
        }
        const tautan=h('a',{class:(S.view===x[0]?'on':'')+(S.mainAdmin&&!aktif?' menu-off':''),href:'#',onclick:navTo(x[0]),'data-menu-view':x[0],...(x[0]==='pesan'?{'data-message-nav':'true'}:{}),...(S.mainAdmin&&x[0]!=='landing'?{title:'Tekan lama lalu seret untuk mengubah urutan menu',draggable:'false'}:{})},...anak);
        /* Geser posisi menu dengan tekan lama + seret: HANYA admin
           utama, dan Home tidak ikut bergeser (pasangSeretMenu di
           shell.js; Pengurus & Anggota tidak mendapat pendengar). */
        if(S.mainAdmin&&x[0]!=='landing')pasangSeretMenu(tautan);
        return tautan;
      }),
    h('button',{class:'menu-logout',onclick:()=>signOut()},icon('logout',17),h('span',{},'Keluar')),
    /* Tombol unduh aplikasi (PWA) untuk semua pengguna yang masuk,
       tepat di bawah tombol Keluar; perilakunya di install.js. */
    h('div',{class:'drawer-downloads'},
      h('button',{class:'drawer-download-btn',onclick:()=>unduhAndroid()},icon('android',18),h('span',{},'Download Android')),
      h('button',{class:'drawer-download-btn',onclick:()=>unduhIOS()},icon('apple',18),h('span',{},'Download iOS'))));
}
/* Gerbang awal: kerangka (header, drawer) hanya tampil untuk
   pengguna yang sudah masuk dan disetujui. Selama terkunci, body
   ber-class auth-locked dan CSS menyembunyikan semua kerangka — yang
   terlihat hanya halaman login / menunggu persetujuan di #app. Sesudah
   masuk & disetujui class itu dilepas, sehingga header dan tombol
   navigasi (hamburger → drawer) tampil lagi. Aplikasi tidak punya
   navigasi bawah: semua perpindahan halaman lewat drawer. */
function setAuthLocked(locked){
  document.body.classList.toggle('auth-locked',!!locked);
  /* Kunci satu-jendela halaman Peta tidak berlaku di layar terkunci */
  if(locked)document.body.classList.remove('peta-view','profil-view');
  if(locked){
    document.body.classList.remove('open');
    const qm=document.querySelector('#qm');if(qm)qm.remove();
  }
}
/* ===== Perlindungan field yang sedang diedit (perbaikan "force close"
   saat mengetik) =====
   render() menggambar ulang SELURUH #app (replaceChildren), jadi render
   yang dipicu data latar — snapshot realtime koleksi mana pun, pesan baru
   yang tiba, perubahan susunan/pilihan/sambutan dari pengguna lain,
   kegagalan media, atau pemeriksaan berkala admin — menghancurkan field
   yang sedang difokuskan beserta ketikan yang belum tersimpan. Itulah
   sebabnya mengetik di formulir mana pun kadang tertutup sendiri dan
   harus diulang dari awal. Jalur data latar kini memakai
   renderDariData(): selama ada field (input/textarea/select/
   contenteditable) di dalam #app yang sedang difokuskan, gambar ulang
   DITUNDA dan dijalankan otomatis begitu fokus berpindah dari field.
   Render dari aksi pengguna sendiri (klik tombol, pindah menu) tetap
   langsung seperti biasa. */
let renderTertundaTimer=null;
function fieldSedangDiedit(){
  const aktif=document.activeElement;
  if(!aktif||aktif===document.body)return false;
  const app=document.getElementById('app');
  if(!app||!app.contains(aktif))return false;
  const tag=aktif.tagName;
  return tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT'||aktif.isContentEditable===true;
}
function renderDariData(){
  if(!fieldSedangDiedit()){render();return}
  if(renderTertundaTimer)return;
  const cek=()=>{
    renderTertundaTimer=null;
    if(fieldSedangDiedit()){renderTertundaTimer=setTimeout(cek,700);return}
    render();
  };
  renderTertundaTimer=setTimeout(cek,700);
}
function render(){
  if(renderTertundaTimer){clearTimeout(renderTertundaTimer);renderTertundaTimer=null}
  /* Pemindai QR layar penuh TIDAK dihentikan oleh render: lapisannya
     tinggal di <body> dan harus tetap hidup untuk memindai banyak QR
     berturut-turut; ia berhenti hanya lewat tombol 'Tutup QR'. */
  if(S.activityScannerStop&&!S.qrScannerOpen)S.activityScannerStop();
  if(S.view!=='musyawarah')window.__musyAlive=false;
  /* Drawer kanan khusus admin utama: keadaan terbuka yang tersisa dari
     sesi/peran sebelumnya ditutup paksa untuk selain admin utama. */
  if(!S.mainAdmin)S.adminMenuOpen=false;
  syncAdminTheme();
  if(S.authLoading){
    setAuthLocked(true);
    $('#dr').replaceChildren();
    $('#app').replaceChildren(h('p',{class:'warn',style:'text-align:center;padding:40px 16px'},'Memeriksa sesi login...'));
    $('#sw').style.display='none';
    return;
  }
  if(!S.uid){
    setAuthLocked(true);
    $('#dr').replaceChildren();
    $('#app').replaceChildren(h('div',{class:'landing'},h('section',{class:'hero'},
      h('p',{style:'font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-bottom:10px',onclick:()=>handleBrandTap()},'SHIKOKU FAMILY'),
      h('h1',{},'Selamat datang!'),
      accountForm()
    )));
    $('#sw').style.display='none';
    document.body.classList.remove('open');
    return;
  }
  if(S.uid&&S.approvalStatus!=='approved'&&!S.admin){
    setAuthLocked(true);
    $('#dr').replaceChildren();
    const rejected=S.approvalStatus==='rejected';
    const status=rejected?'Akun ini ditolak admin.':'Akun Anda sedang menunggu persetujuan admin.';
    /* Layar ini salah satu tempat pengguna melihat keterangan menunggu:
       catat penandanya, supaya sesudah disetujui ia mendapat keterangan
       'Selamat, akun Anda telah disetujui.' satu kali (lihat auth.js). */
    if(!rejected&&typeof markPendingSeen==='function')markPendingSeen(S.email||S.uid);
    const detail=rejected?'Data anggota, kegiatan, dan wilayah hanya dimuat setelah akun disetujui. Hubungi admin utama untuk memeriksa status akun.':'Silakan tunggu — Anda bisa masuk setelah akun disetujui. Data anggota, kegiatan, dan wilayah hanya dimuat setelah akun disetujui; hubungi admin utama untuk memeriksa status akun.';
    $('#app').replaceChildren(h('section',{class:'card auth-card'},h('b',{},status),h('p',{class:'sub'},detail),h('button',{class:'btn',onclick:()=>signOut()},'Keluar')));
    $('#sw').style.display='none';
    document.body.classList.remove('open');
    return;
  }
  setAuthLocked(false);
  /* Muat ulang: pulihkan halaman terakhir yang dibuka (satu kali,
     hanya sesudah sesi terpulihkan & disetujui — lihat shell.js). */
  pulihkanViewTerakhir();
  renderDrawer();
  /* Ikon roda gigi (jalan masuk drawer kanan) HANYA untuk admin utama:
     admin biasa dan anggota tidak melihat tombolnya sama sekali. */
  $('#sw').style.display=S.mainAdmin?'flex':'none';
  updateApprovalBadges();
  const current=ALL.find(x=>x[0]===S.view);
  if(!V[S.view]||(S.view==='approvals'&&!S.admin)||(S.view==='pengaturan'&&!S.mainAdmin)||(!S.mainAdmin&&!menuAktifUntuk(S.view)))S.view='landing';
  /* Halaman Peta = SATU JENDELA tanpa gulir halaman: kelas 'peta-view'
     pada body mengunci tinggi halaman setinggi layar (lihat CSS
     .peta-fit di style.css); halaman lain tidak terpengaruh. Dipasang
     di sini — sesudah pemulihan & validasi view — supaya nilainya
     selalu mengikuti view yang benar-benar digambar. */
  document.body.classList.toggle('peta-view',S.view==='peta');
  /* Halaman Profil/Data Diri anggota (detail anggota terbuka) = SATU
     JENDELA di desktop: kelas 'profil-view' mengunci gulir halaman
     (CSS ≥1024px di style.css menata ulang .member-profile-page
     menjadi grid lebar penuh setinggi layar). Di HP kelas ini tidak
     berpengaruh sama sekali. */
  document.body.classList.toggle('profil-view',S.view==='members'&&!!S.detail&&!S.form);
  const content=[];
  const storageErrors=Object.values(S.storageErrors||{});
  if(storageErrors.length)content.push(h('p',{class:'warn storage-warning'},'Database bersama tidak dapat dibaca: '+storageErrors.join(' · ')+' Jalankan pembaruan skema Supabase, lalu muat ulang aplikasi.'));
  if(S.memberMediaError)content.push(h('p',{class:'warn storage-warning'},'Media anggota: '+S.memberMediaError));

  content.push(...[].concat(V[S.view]()).filter(Boolean));
  $('#app').replaceChildren(...content);
  hydrateMemberQrCodes();
  hydrateMemberMedia();
  /* Bingkai wajah otomatis KHUSUS foto Kartu ID: foto lama yang wajahnya
     kecil di dalam bingkai dibingkai ulang ke wajah + leher dari hasil
     deteksi wajah (tersimpan di cache per foto); tanpa dukungan deteksi
     bingkai zoom bawaan CSS tetap dipakai. */
  if(typeof hydrateMemberIdFaceFraming==='function')hydrateMemberIdFaceFraming();
  /* Halaman Peta: bangun peta Leaflet sesudah DOM terpasang (dijaga di
     dalam initPetaMap sendiri supaya kegagalan peta tidak merusak render) */
  if(typeof initPetaMap==='function')initPetaMap();
  /* Panel 'Letakkan Pin di Peta' di formulir anggota: bangun petanya
     sesudah DOM formulir terpasang, bersihkan bila panel ditutup. */
  if(typeof initFormPinMap==='function')initFormPinMap();
}
function sub(name,key){
  return S.db.collection(name).onSnapshot(s=>{
    const hadError=Boolean(S.storageErrors[name]);
    if(hadError)delete S.storageErrors[name];
    const next=s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.at||0)-(b.at||0));
    const previous=JSON.stringify(S[key]||[]);
    S[key]=next;
    /* Migrasi wilayah tidak boleh menghentikan gambar ulang: error di satu
       anggota lama tidak boleh membuat seluruh daftar tampak kosong. */
    if(key==='members'&&typeof migrateMemberRegions==='function'){try{migrateMemberRegions()}catch(error){console.error('Migrasi wilayah anggota gagal (diabaikan):',error)}}
    if(JSON.stringify(next)!==previous||hadError){
      /* Buku catatan Musyawarah mengelola tampilannya sendiri saat terbuka:
         data baru digabungkan tanpa menggambar ulang editor yang sedang dipakai. */
      if(key==='musyawarah'&&window.__musyAlive&&typeof window.__musyOnRemote==='function')window.__musyOnRemote();
      else renderDariData();
    }
  },error=>{
    console.error('Koleksi Supabase '+name+' gagal dimuat:',error);
    S.storageErrors[name]=error.message||'Koneksi gagal';
    renderDariData();
  });
}
let dataUnsubscribers=[];
function stopDataSubscriptions(){
  dataUnsubscribers.forEach(unsubscribe=>{try{unsubscribe?.()}catch(error){console.error('Gagal menghentikan subscription data:',error)}});
  dataUnsubscribers=[];
}
function startDataSubscriptions(){
  stopDataSubscriptions();
  if(!S.db)return;
  /* Setiap langganan dijaga sendiri-sendiri: satu langganan yang gagal
     (mis. koleksi baru yang belum dikenal skema lama) TIDAK boleh memutus
     atau mencegah langganan lain, terutama 'members'. */
  const add=subscribe=>{
    try{
      const unsubscribe=subscribe();
      if(typeof unsubscribe==='function')dataUnsubscribers.push(unsubscribe);
    }catch(error){console.error('Satu langganan data gagal dimulai (langganan lain tetap jalan):',error)}
  };
  add(()=>sub('members','members'));
  add(()=>sub('events','events'));
  add(()=>sub('topics','topics'));
  add(()=>sub('cleaning_duties','cleaningDuties'));
  add(()=>sub('pin','pins'));
  add(()=>sub('musyawarah','musyawarah'));
  add(()=>sub('keuangan','keuangan'));
  add(()=>sub('inventaris','inventaris'));
  add(()=>subscribePilihan());
  if(!S.supabase)add(()=>sub('pengaturan','pengaturan'));
  add(()=>subscribeSambutan());
  add(()=>subscribeMenuAktif());
  add(()=>subscribeSusunan());
}
