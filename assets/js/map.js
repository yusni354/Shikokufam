/* Peta anggota (Leaflet), persetujuan akun, sebaran wilayah */
/* Leaflet dimuat MALAS: berkasnya (JS ±147 KB + CSS ±15 KB) tidak lagi
   ikut dimuat saat aplikasi pertama dibuka, melainkan disuntikkan di
   sini saat halaman Peta pertama dibuka atau panel pin formulir anggota
   pertama dipakai — halaman lain tidak membutuhkannya. Suntikan gagal
   (berkas tak terjangkau) → kedua pemakai jatuh ke tampilan tanpa peta
   yang sudah ada, dan percobaan berikutnya boleh mengulang. */
let petaLeafletJanji=null;
function petaMuatLeaflet(){
  if(typeof L!=='undefined')return Promise.resolve(true);
  if(petaLeafletJanji)return petaLeafletJanji;
  petaLeafletJanji=new Promise(resolve=>{
    const css=document.createElement('link');
    css.rel='stylesheet';css.href='assets/leaflet.css';
    document.head.appendChild(css);
    const s=document.createElement('script');
    s.src='assets/js/leaflet.js';
    s.onload=()=>resolve(typeof L!=='undefined');
    s.onerror=()=>{petaLeafletJanji=null;resolve(false)};
    document.head.appendChild(s);
  });
  return petaLeafletJanji;
}
function alamatJp(m,det){return [det?m.alamat_jp:'',m.kec_jp,m.kota,m.pref||m.wilayah,m.kodepos,'Japan'].filter(Boolean).join(', ')}
async function loadPendingUsers(){
  if(!S.supabase){
    if(!S.admin){S.pendingUsers=[];S.approvedUsers=[];S.rejectedUsers=[]}
    else{
      const ringkas=user=>({id:user.id,name:user.name,email:user.email,created_at:user.created_at,approval_status:user.approval_status,approved_at:user.approved_at||null,approved_by:user.approved_by||'',role:user.role,is_main_admin:user.is_main_admin===true,avatar_url:user.avatar_url||''});
      S.pendingUsers=localUsers().filter(user=>user.approval_status==='pending').map(ringkas);
      S.approvedUsers=localUsers().filter(user=>user.approval_status==='approved').map(ringkas);
      /* Akun ditolak yang masih ber-email = penolakan sungguhan; akun
         terhapus (email dikosongkan oleh hapusAkun) tidak dihitung. */
      S.rejectedUsers=localUsers().filter(user=>user.approval_status==='rejected'&&user.email).map(ringkas);
    }
    /* Lencana navigasi Persetujuan mengikuti daftar terbaru ini juga */
    if(typeof updateApprovalBadges==='function')updateApprovalBadges();
    return;
  }
  if(!S.admin){S.pendingUsers=[];S.approvedUsers=[];S.rejectedUsers=[];if(typeof updateApprovalBadges==='function')updateApprovalBadges();return}
  const {data,error}=await S.supabase.from('profiles').select('id,name,email,created_at,approval_status').eq('approval_status','pending').order('created_at',{ascending:true});
  if(error){console.error(error);S.pendingUsers=[]}else S.pendingUsers=data||[];
  /* Akun ditolak untuk halaman Laporan Keamanan: hanya penolakan
     sungguhan (masih ber-email); catatan akun yang dihapus admin
     (status rejected + email dikosongkan) tidak dihitung. */
  const ditolak=await S.supabase.from('profiles').select('id,name,email,created_at,approval_status').eq('approval_status','rejected').not('email','is',null).order('created_at',{ascending:false});
  if(ditolak.error){console.error(ditolak.error);S.rejectedUsers=[]}else S.rejectedUsers=ditolak.data||[];
  /* Catatan akun yang sudah disetujui untuk tab 'Sudah Disetujui'.
     select('*') supaya kolom tambahan (approved_at, approved_by, avatar_url,
     region warisan) ikut terbaca bila ada, tanpa gagal bila belum ada. */
  const disetujui=await S.supabase.from('profiles').select('*').eq('approval_status','approved');
  if(disetujui.error){console.error(disetujui.error);S.approvedUsers=[]}else S.approvedUsers=disetujui.data||[];
  if(typeof updateApprovalBadges==='function')updateApprovalBadges();
}
/* Peran hasil persetujuan -> kolom role & is_main_admin yang sudah ada.
   'utama' = admin + is_main_admin, 'admin' = admin biasa, 'member' =
   anggota. Peran bawaan persetujuan adalah anggota ('member'). */
function peranDariPilihan(peran){
  if(peran==='utama')return {role:'admin',is_main_admin:true};
  if(peran==='admin')return {role:'admin',is_main_admin:false};
  return {role:'member',is_main_admin:false};
}
async function setApproval(id,status,peran){
  if(!S.admin)return;
  /* Peran 'Admin Utama' hanya boleh diberikan admin utama yang masuk. */
  if(status==='approved'&&peran==='utama'&&!S.mainAdmin)peran='member';
  /* Setiap persetujuan baru mencatat waktu persetujuan (approved_at) dan
     nama admin penyetuju dari sesi (approved_by) ke data akun. */
  const oleh=S.name||S.email||'';
  const kolomPeran=status==='approved'?peranDariPilihan(peran):null;
  if(!S.supabase){
    const users=localUsers(),user=users.find(item=>item.id===id);
    if(!user){alert('Pendaftar tidak ditemukan.');return}
    user.approval_status=status;
    user.approved_at=status==='approved'?new Date().toISOString():null;
    user.approved_by=status==='approved'?(oleh||null):null;
    if(kolomPeran){
      if(kolomPeran.is_main_admin){
        /* Admin utama lama (bisa jadi sesi yang sedang masuk) turun
           menjadi admin biasa, sama seperti alur Jadikan Admin Utama. */
        users.forEach(item=>{if(item.is_main_admin&&item.id!==id){item.is_main_admin=false;item.role='admin'}});
      }
      user.role=kolomPeran.role;user.is_main_admin=kolomPeran.is_main_admin;
    }
    try{saveLocalUsers(users)}catch(e){alert('Gagal memperbarui persetujuan: '+e.message);return}
    if(kolomPeran&&kolomPeran.is_main_admin&&S.mainAdmin){S.mainAdmin=false;S.admin=true}
    await loadPendingUsers();render();
    return;
  }
  const dasar={approval_status:status,approved_at:status==='approved'?new Date().toISOString():null};
  const lengkap={...dasar,approved_by:status==='approved'?(oleh||null):null,...(kolomPeran||{})};
  let {error}=await S.supabase.from('profiles').update(lengkap).eq('id',id);
  if(error&&/approved_by/.test(error.message||'')){
    /* Kolom approved_by belum ada di database lama: ulangi tanpa kolom itu
       supaya persetujuan tidak gagal hanya karena catatan nama penyetuju. */
    const tanpaBy={...lengkap};delete tanpaBy.approved_by;
    ({error}=await S.supabase.from('profiles').update(tanpaBy).eq('id',id));
  }
  if(error){alert('Gagal memperbarui persetujuan: '+error.message);return}
  if(kolomPeran&&kolomPeran.is_main_admin){
    /* Akun baru sudah menjadi admin utama: turunkan admin utama lama
       menjadi admin biasa (peran admin dipertahankan), persis alur
       Jadikan Admin Utama yang sudah ada. */
    const lama=S.approvedUsers.filter(user=>user.is_main_admin&&user.id!==id);
    if(S.uid&&S.uid!==id&&!lama.some(user=>user.id===S.uid))lama.push({id:S.uid});
    for(const user of lama){
      const turun=await S.supabase.from('profiles').update({is_main_admin:false}).eq('id',user.id);
      if(turun.error){alert('Gagal menurunkan admin utama lama: '+turun.error.message);return}
    }
    if(S.mainAdmin){S.mainAdmin=false;S.admin=true}
  }
  await loadPendingUsers();render();
}
/* Hapus akun dari data aplikasi (khusus admin utama): catatan akun
   dihapus dari daftar pengguna lokal / tabel profiles Supabase, sehingga
   akun hilang dari daftar persetujuan dan tidak bisa masuk lagi (alur
   masuk selalu memeriksa catatan profil). Bila penghapusan keras dari
   tabel profiles terblokir kebijakan database, fungsi ini beralih ke
   penghapusan lewat UPDATE (status 'rejected' + data dikosongkan) —
   hasil akhirnya sama: akun hilang dari daftar dan tidak bisa masuk.
   Akun sendiri tidak bisa dihapus. */
async function hapusAkun(id){
  if(!S.mainAdmin)return;
  if(id===S.uid){alert('Akun Anda sendiri tidak dapat dihapus.');return}
  if(!S.supabase){
    const users=localUsers();
    if(!users.some(user=>user.id===id)){alert('Akun tidak ditemukan.');return}
    try{saveLocalUsers(users.filter(user=>user.id!==id))}catch(e){alert('Gagal menghapus akun: '+e.message);return}
    await loadPendingUsers();render();
    return;
  }
  /* .select('id') wajib ada: tanpa itu PostgREST melaporkan sukses walau
     RLS memblokir penghapusan dan 0 baris terhapus — akun tampak tidak
     bisa dihapus tanpa pesan apa pun. Baris yang benar-benar terhapus
     kini diperiksa. */
  const {data,error}=await S.supabase.from('profiles').delete().eq('id',id).select('id');
  if(!error&&data&&data.length){
    await loadPendingUsers();render();
    return;
  }
  /* Penghapusan keras terblokir (kebijakan DELETE untuk admin utama
     belum aktif di database produksi) atau gagal: JANGAN berhenti di
     pesan kesalahan seperti sebelumnya — akun harus benar-benar hilang
     dari daftar. Beralih ke jalur UPDATE, izin yang sama dengan yang
     dipakai Setujui/Tolak dan sudah terbukti bekerja di database:
     status diubah menjadi 'rejected' (nilai sah menurut batas kolom
     approval_status), peran diturunkan, dan nama/email/foto dikosongkan.
     Hasilnya sama bagi aplikasi: akun hilang dari tab Menunggu maupun
     Sudah Disetujui, dan alur masuk menolak status 'rejected', jadi
     akun itu tidak bisa masuk lagi. Bila nanti kebijakan DELETE di
     schema.sql terbaru dijalankan, penghapusan keras di atas yang
     lebih dulu bekerja. */
  const kosong={approval_status:'rejected',role:'member',is_main_admin:false,approved_at:null,approved_by:null,name:null,email:null,avatar_url:null};
  let gagal=await S.supabase.from('profiles').update(kosong).eq('id',id);
  if(gagal.error&&/approved_by/.test(gagal.error.message||'')){
    /* Database lama belum punya kolom approved_by: ulangi tanpa kolom itu */
    const tanpaBy={...kosong};delete tanpaBy.approved_by;
    gagal=await S.supabase.from('profiles').update(tanpaBy).eq('id',id);
  }
  if(gagal.error){
    alert('Gagal menghapus akun: '+(error?error.message:gagal.error.message));
    return;
  }
  /* Periksa hasil sebenarnya: baca ulang barisnya. Akun dianggap
     terhapus hanya bila barisnya sudah tidak ada, atau statusnya sudah
     'rejected' dan datanya sudah dikosongkan. */
  const cek=await S.supabase.from('profiles').select('id,approval_status,email').eq('id',id).maybeSingle();
  const hilang=!cek.data||(cek.data.approval_status==='rejected'&&!cek.data.email);
  if(!hilang){
    alert('Akun belum terhapus dari database. Periksa koneksi, lalu coba lagi.');
    return;
  }
  /* Keluarkan dari daftar di ingatan lebih dulu supaya akun langsung
     hilang dari layar, baru muat ulang daftar dari database. */
  S.pendingUsers=S.pendingUsers.filter(user=>user.id!==id);
  S.approvedUsers=S.approvedUsers.filter(user=>user.id!==id);
  if(typeof updateApprovalBadges==='function')updateApprovalBadges();
  await loadPendingUsers();render();
}
/* Jadikan akun terpilih sebagai admin utama (khusus admin utama yang
   sedang masuk): akun itu naik menjadi admin utama (peran admin +
   is_main_admin), admin utama lama turun menjadi admin biasa. Sesudah
   berhasil, sesi ini bukan lagi admin utama sehingga halaman
   Persetujuan tertutup dan pengguna mendarat di Home sebagai admin. */
async function jadikanAdminUtama(target){
  if(!S.mainAdmin||!target||target.is_main_admin)return;
  if(!S.supabase){
    const users=localUsers();
    const akun=users.find(user=>user.id===target.id);
    if(!akun){alert('Akun tidak ditemukan.');return}
    users.forEach(user=>{if(user.is_main_admin){user.is_main_admin=false;user.role='admin'}});
    akun.role='admin';akun.is_main_admin=true;
    try{saveLocalUsers(users)}catch(e){alert('Gagal mengubah admin utama: '+e.message);return}
    S.mainAdmin=false;S.admin=true;
    await loadPendingUsers();render();
    return;
  }
  let {error}=await S.supabase.from('profiles').update({role:'admin',is_main_admin:true}).eq('id',target.id);
  if(error){alert('Gagal mengubah admin utama: '+error.message);return}
  const lama=S.approvedUsers.filter(user=>user.is_main_admin&&user.id!==target.id);
  if(S.uid&&S.uid!==target.id&&!lama.some(user=>user.id===S.uid))lama.push({id:S.uid});
  for(const user of lama){
    const turun=await S.supabase.from('profiles').update({is_main_admin:false}).eq('id',user.id);
    if(turun.error){alert('Gagal menurunkan admin utama lama: '+turun.error.message);return}
  }
  S.mainAdmin=false;S.admin=true;
  await loadPendingUsers();render();
}
/* Dialog untuk aksi akun: pilihan peran saat menyetujui, konfirmasi
   persetujuan sebagai admin utama, konfirmasi hapus / jadikan admin
   utama. Pola aplikasi — tanpa tombol X; mengetuk bidang di luar kotak
   atau tombol Batal menutupnya, isi kotak tidak ikut menutup. */
function dialogKonfirmasiAkun(){
  const d=S.approvalDialog;
  if(!d||!d.user)return null;
  const tutup=()=>{S.approvalDialog=null;render()};
  const nama=d.user.name||'Nama belum diisi';
  if(d.jenis==='peran'){
    /* Pilihan peran untuk pendaftar yang disetujui. Bawaan yang disorot
       adalah 'Anggota' (kasus terbanyak). Pilihan 'Admin Utama' hanya
       tampil bagi admin utama yang sedang masuk; pengurus hanya
       melihat 'Pengurus' dan 'Anggota'. */
    const terpilih=d.peran||'member';
    const opsi=[];
    if(S.mainAdmin)opsi.push({key:'utama',label:'Admin Utama',ket:'Kendali penuh atas aplikasi, termasuk persetujuan akun dan penunjukan admin.'});
    opsi.push({key:'admin',label:'Pengurus',ket:'Dapat mengelola data, kegiatan, dan menyetujui akun baru.'});
    opsi.push({key:'member',label:'Anggota',ket:'Akses biasa sebagai anggota komunitas.'});
    const tombolOpsi=opsi.map(o=>h('button',{type:'button',class:'role-opt'+(terpilih===o.key?' on':''),'aria-pressed':terpilih===o.key?'true':'false',onclick:()=>{S.approvalDialog={...d,peran:o.key};render()}},
      h('b',{},o.label),h('small',{},o.ket)));
    const lanjut=()=>{
      if(terpilih==='utama'){
        /* Persetujuan sebagai admin utama butuh konfirmasi perpindahan
           lebih dulu (dialog jenis 'utama-baru' di bawah). */
        S.approvalDialog={jenis:'utama-baru',user:d.user,peran:'utama'};render();return;
      }
      S.approvalDialog=null;setApproval(d.user.id,'approved',terpilih);
    };
    return h('div',{class:'confirm-overlay',onclick:tutup},
      h('div',{class:'card confirm-card',onclick:ev=>ev.stopPropagation()},
        h('b',{class:'confirm-title'},'Setujui sebagai…'),
        h('p',{class:'confirm-text'},'Pilih peran untuk '+nama+' ('+(d.user.email||'-')+').'),
        h('div',{class:'role-opts'},...tombolOpsi),
        h('div',{class:'fl confirm-actions'},
          h('button',{class:'btn s',onclick:tutup},'Batal'),
          h('button',{class:'btn',onclick:lanjut},'Setujui'))));
  }
  let judul,isi,label,aksi;
  if(d.jenis==='hapus'){
    judul='Hapus Akun';
    isi='Hapus akun '+nama+' ('+(d.user.email||'-')+')? Akun ini akan hilang dari daftar persetujuan dan tidak bisa masuk lagi. Tindakan ini tidak bisa dibatalkan.';
    label='Hapus';
    aksi=async()=>{S.approvalDialog=null;await hapusAkun(d.user.id)};
  }else if(d.jenis==='utama-baru'){
    /* Konfirmasi persetujuan sebagai admin utama: admin utama sebelumnya
       (termasuk yang sedang masuk, bila itu dia) turun menjadi admin
       biasa — semakna konfirmasi 'Jadikan Admin Utama' yang sudah ada. */
    const lama=S.approvedUsers.find(user=>user.is_main_admin);
    const namaLama=lama?(lama.name||lama.email||''):((S.mainAdmin&&(S.name||S.email))||'');
    judul='Setujui sebagai Admin Utama';
    isi=nama+' akan disetujui sebagai admin utama. '+(namaLama?namaLama+' yang saat ini menjadi admin utama':'Admin utama saat ini')+' akan turun menjadi Pengurus. Lanjutkan?';
    label='Setujui sebagai Admin Utama';
    aksi=async()=>{S.approvalDialog=null;await setApproval(d.user.id,'approved','utama')};
  }else{
    judul='Jadikan Admin Utama';
    isi=nama+' akan menjadi admin utama. Admin utama saat ini akan turun menjadi Pengurus. Lanjutkan?';
    label='Jadikan Admin Utama';
    aksi=async()=>{S.approvalDialog=null;await jadikanAdminUtama(d.user)};
  }
  return h('div',{class:'confirm-overlay',onclick:tutup},
    h('div',{class:'card confirm-card',onclick:ev=>ev.stopPropagation()},
      h('b',{class:'confirm-title'},judul),
      h('p',{class:'confirm-text'},isi),
      h('div',{class:'fl confirm-actions'},
        h('button',{class:'btn s',onclick:tutup},'Batal'),
        h('button',{class:'btn',onclick:aksi},label))));
}
function peranAkun(user){
  if(user.is_main_admin)return 'Admin Utama';
  if(user.role==='admin')return 'Pengurus';
  return 'Anggota';
}
function tanggalAkun(value){
  if(!value)return '';
  const d=new Date(value);
  return Number.isNaN(d.getTime())?'':d.toLocaleString('id-ID');
}
/* Wilayah akun: dari kolom profil bila ada, selain itu dicocokkan dari
   daftar anggota lewat email yang sama. Kosong bila tidak ditemukan. */
function wilayahAkun(user){
  if(user.region)return String(user.region);
  if(user.email){
    const member=(S.members||[]).find(m=>(m.email||'').toLowerCase()===String(user.email).toLowerCase());
    if(member)return memberRegion(member);
  }
  return '';
}
function vApprovals(){
  if(!S.admin)return [h('p',{class:'warn'},'Halaman ini hanya dapat diakses admin.')];
  const tab=S.approvalsTab==='disetujui'?'disetujui':'menunggu';
  const toggle=h('div',{class:'org-toggle'},
    h('button',{class:'org-toggle-btn'+(tab==='menunggu'?' on':''),onclick:()=>{S.approvalsTab='menunggu';render()}},'Menunggu ('+S.pendingUsers.length+')'),
    h('button',{class:'org-toggle-btn'+(tab==='disetujui'?' on':''),onclick:()=>{S.approvalsTab='disetujui';render()}},'Sudah Disetujui ('+S.approvedUsers.length+')'));
  if(tab==='menunggu'){
    const rows=S.pendingUsers.map(user=>h('div',{class:'card approval-row'},
      h('div',{style:'flex:1;min-width:0'},h('b',{},user.name||'Nama belum diisi'),h('small',{},user.email||'-'),h('small',{},new Date(user.created_at).toLocaleString('id-ID'))),
      h('div',{class:'fl'},h('button',{class:'btn',onclick:()=>{S.approvalDialog={jenis:'peran',user:{id:user.id,name:user.name,email:user.email},peran:'member'};render()}},'Setujui'),h('button',{class:'btn s',onclick:()=>setApproval(user.id,'rejected')},'Tolak'),
        (S.mainAdmin&&user.id!==S.uid)?h('button',{class:'btn s btn-eh',onclick:()=>{S.approvalDialog={jenis:'hapus',user:{id:user.id,name:user.name,email:user.email}};render()}},'Hapus'):null)));
    return [h('h1',{},'Persetujuan Akun'),toggle,...(rows.length?rows:[h('p',{class:'warn'},'Tidak ada pendaftar yang menunggu persetujuan.')]),dialogKonfirmasiAkun()];
  }
  /* Tab catatan: akun yang sudah disetujui, persetujuan terbaru di atas.
     Tanggal persetujuan diambil dari approved_at bila tersimpan; akun lama
     tanpa catatan itu ditampilkan jujur dengan label tanggal daftarnya. */
  const urut=[...S.approvedUsers].sort((a,b)=>{
    const ta=new Date(a.approved_at||a.created_at||0).getTime()||0;
    const tb=new Date(b.approved_at||b.created_at||0).getTime()||0;
    return tb-ta;
  });
  const rows=urut.map(user=>{
    const wilayah=wilayahAkun(user);
    const tglSetuju=tanggalAkun(user.approved_at);
    const tglDaftar=tanggalAkun(user.created_at);
    const barisTanggal=tglSetuju
      ?'Disetujui '+tglSetuju+(user.approved_by?' oleh '+user.approved_by:'')
      :(tglDaftar?'Terdaftar '+tglDaftar:'—');
    /* Aksi khusus admin utama: jadikan admin utama (tidak tampil pada
       admin utama saat ini — padanya hanya lencana peran) dan hapus
       akun (tidak tampil pada akun sendiri). */
    const aksi=[];
    if(S.mainAdmin&&!user.is_main_admin)aksi.push(h('button',{class:'btn s btn-eh',onclick:()=>{S.approvalDialog={jenis:'utama',user:{id:user.id,name:user.name,email:user.email,is_main_admin:user.is_main_admin}};render()}},'Jadikan Admin Utama'));
    if(S.mainAdmin&&user.id!==S.uid)aksi.push(h('button',{class:'btn s btn-eh',onclick:()=>{S.approvalDialog={jenis:'hapus',user:{id:user.id,name:user.name,email:user.email}};render()}},'Hapus'));
    return h('div',{class:'card approval-row'},
      user.avatar_url?h('img',{class:'av',src:user.avatar_url,alt:'Foto '+(user.name||'akun'),style:'object-fit:cover'}):h('div',{class:'av'},(user.name||user.email||'?').trim().slice(0,1).toUpperCase()),
      h('div',{style:'flex:1;min-width:0'},
        h('b',{},user.name||'Nama belum diisi',h('span',{class:'tag'},peranAkun(user))),
        h('small',{},user.email||'-'),
        wilayah?h('small',{},'Wilayah: '+wilayah):null,
        h('small',{},barisTanggal)),
      aksi.length?h('div',{class:'approval-actions'},...aksi):null);
  });
  /* Kata sandi akun tersimpan sebagai hash satu arah di Supabase Auth:
     tidak bisa ditampilkan oleh siapa pun, jadi yang ditampilkan hanya
     keterangan jujur ini, bukan kolom kata sandi. */
  const catatanKataSandi=h('p',{class:'approval-note'},'Kata sandi tidak dapat ditampilkan karena tersimpan terenkripsi; anggota yang lupa kata sandi dapat mengatur ulang lewat tautan lupa kata sandi di halaman masuk.');
  return [h('h1',{},'Persetujuan Akun'),toggle,catatanKataSandi,...(rows.length?rows:[h('p',{class:'warn'},'Belum ada akun yang disetujui.')]),dialogKonfirmasiAkun()];
}

/* ===== Peta Anggota (Leaflet) — menggantikan embed Google My Maps =====
   Pin dibuat langsung dari daftar anggota asli aplikasi (S.members) dan
   ikut berubah setiap data berubah / halaman digambar ulang. Warna pin =
   warna wilayah aplikasi (wilayahEfektif) — warna saja, BUKAN acuan
   posisi. Posisi pin v3 murni berbasis ALAMAT + KODE POS anggota:
   titik acuan tiap anggota adalah titik kawasan KODE POS-nya sendiri,
   hasil pencarian alamat hanya diterima bila dekat (≤3 km) dengan
   titik kode pos itu atau kode pos hasilnya sama. Tidak ada lagi pin
   cadangan di pusat kota/wilayah: anggota yang alamatnya gagal
   ter-geocode TIDAK diberi pin dan masuk hitungan 'belum terpetakan'.
   Pin beralamat sama berimpit persis di titik yang sama (tanpa jitter /
   penyebaran permanen); tumpukan pin MEKAR sementara (spiderfy) saat
   kursor diarahkan ke atasnya atau tumpukan diketuk, supaya tiap pin
   bisa di-hover dan diklik, lalu kembali bertumpuk.
   Peta dasar dicoba berurutan dari beberapa penyedia ubin gratis; bila
   satu gagal, otomatis pindah ke berikutnya. Bila semuanya gagal, tampil
   peta dasar cadangan lokal (assets/japan-basemap.svg). Seluruh modul
   dijaga: bila Leaflet gagal dimuat, halaman tetap tampil. */
function petaNormKey(v){return String(v||'').toLowerCase().replace(/[^a-z0-9]/g,'')}
/* ===== Pin manual (pinManual {lat,lng} pada data anggota) =====
   ATURAN DIDAHULUKAN: pin manual SELALU menang atas hasil geocoding
   v3. Anggota ber-pin manual tidak dicari koordinatnya lagi oleh mesin
   geocoding. Menghapus pin manual mengembalikan anggota ke penempatan
   otomatis dari alamat + kode pos. Hanya admin yang menetapkan pin
   manual (formulir anggota & mode Perbaiki Posisi Pin di halaman peta). */
function pinManualCoords(m){
  const p=m&&m.pinManual;
  if(!p||typeof p!=='object')return null;
  const lat=Number(p.lat),lng=Number(p.lng);
  if(!isFinite(lat)||!isFinite(lng))return null;
  if(lat<20||lat>50||lng<120||lng>155)return null;
  return [lat,lng];
}
function pinManualObj(coords){return {lat:Number(Number(coords[0]).toFixed(6)),lng:Number(Number(coords[1]).toFixed(6))}}
/* Posisi pin seorang anggota saat ini, dari sumber mana pun yang sudah
   tersedia: pin manual didahulukan, selain itu hasil geocoding
   alamat/kode pos yang tersimpan di cache v3 (sumber yang sama dengan
   petaEntries). Mengembalikan {coords:[lat,lng], manual} atau null
   bila anggota belum punya posisi apa pun. Dipakai formulir anggota
   dan halaman detail untuk menampilkan link 'Lihat Posisi di Peta'
   hanya bagi anggota yang memang sudah berposisi. */
function posisiPinAnggota(m){
  if(!m)return null;
  const manual=pinManualCoords(m);
  if(manual)return {coords:manual,manual:true};
  try{
    const cache=petaGeoCacheLoad();
    const tersimpan=cache[petaGeoKey(m)];
    if(tersimpan&&tersimpan.c)return {coords:[tersimpan.c[0],tersimpan.c[1]],manual:false,lvl:tersimpan.l};
  }catch(e){}
  return null;
}
/* Buka halaman Peta & Wilayah terpusat pada pin anggota ini dengan
   popup-nya terbuka (dari link 'Lihat Posisi di Peta' di halaman
   detail/profil anggota). Saringan & pencarian peta dibersihkan dulu
   supaya pin anggota pasti tampil; pilihan anggota dipasang sebelum
   pindah halaman, lalu sesudah peta terbangun pin dipilih lewat
   petaSelect yang sama seperti ketukan pada daftar anggota peta. */
function bukaPosisiPinDiPeta(member){
  if(!member||!member.id)return;
  S.petaFilter=null;S.petaSearch='';
  S.petaSelected=String(member.id);
  go('peta');
  setTimeout(()=>{
    try{
      const en=PM.entries.find(x=>x.key===String(member.id));
      if(en&&typeof petaSelect==='function')petaSelect(en,{fly:true,popup:true});
    }catch(e){console.error('Gagal memusatkan peta ke pin anggota:',e)}
  },150);
}
/* Simpan / hapus pin manual lewat jalur data anggota yang sudah ada
   (Supabase app_data & lokal memakai doc.set yang sama seperti simpan
   profil). pin=null berarti hapus pin manual (kembali otomatis).
   alamatHasil (opsional, dari geocoding terbalik titik pin baru):
   alamat_jp & kodepos anggota ikut diperbarui dalam simpan yang sama,
   sehingga field alamat anggota berisi TEKS ALAMAT titik pin itu —
   bukan angka koordinatnya. Tanpa alamatHasil, alamat lama utuh. */
async function simpanPinManualAnggota(member,pin,alamatHasil){
  if(!S.admin)throw new Error('Hanya admin yang dapat mengubah posisi pin.');
  if(!member||!member.id||!S.db)throw new Error('Data anggota tidak ditemukan.');
  const idx=(S.members||[]).findIndex(x=>x.id===member.id);
  const sumber=idx>=0?S.members[idx]:member;
  const salin={...sumber};delete salin.id;
  if(pin)salin.pinManual=pinManualObj([pin.lat!=null?pin.lat:pin[0],pin.lng!=null?pin.lng:pin[1]]);
  else delete salin.pinManual;
  const alamatBaru=(pin&&alamatHasil&&alamatHasil.alamat)?String(alamatHasil.alamat).trim():'';
  if(alamatBaru){
    salin.alamat_jp=alamatBaru;
    if(alamatHasil.kodepos)salin.kodepos=String(alamatHasil.kodepos);
  }
  /* Perbarui ingatan lebih dulu supaya peta langsung memakai posisi baru
     walau langganan data tiba sesudahnya. */
  if(idx>=0){
    if(pin)S.members[idx].pinManual=salin.pinManual;else delete S.members[idx].pinManual;
    if(alamatBaru){S.members[idx].alamat_jp=salin.alamat_jp;if(alamatHasil.kodepos)S.members[idx].kodepos=salin.kodepos}
  }
  await S.db.collection('members').doc(member.id).set(salin);
  return salin.pinManual||null;
}
/* ===== Geocoding TERBALIK untuk pin manual: titik pin -> TEKS ALAMAT =====
   Peletakan pin manual mencatat ALAMAT titik itu, bukan angka lintang/
   bujurnya — dan alamatnya ditulis dalam ROMAJI (huruf Latin), bukan
   huruf Jepang. Sumbernya Nominatim reverse berbahasa Inggris (tanpa
   kunci API): untuk alamat Jepang layanan ini mengembalikan
   transliterasi romaji (prefektur, kota, distrik, blok, jalan, nomor,
   dan kode pos). Komponen yang tetap berhuruf Jepang (nama yang belum
   punya nama Latin di peta, mis. sebagian nama jalan / blok 字) dibuang
   dari susunan; bila rincian di bawah tingkat kota TIDAK ada yang
   tersedia dalam romaji, hasilnya dianggap tidak tersedia.
   GSI reverse tidak lagi dipakai di jalur ini: hasilnya selalu nama
   distrik berhuruf Jepang, jadi tidak bisa ditulis ke field alamat.
   Mengembalikan {alamat, kodepos} atau null bila titik itu memang
   tidak beralamat (mis. tengah laut) atau alamat romaji tidak
   tersedia: pemanggil lalu TIDAK menimpa alamat lama anggota. */
function petaKodeposFormat(v){const d=String(v||'').replace(/\D/g,'');return d.length===7?d.slice(0,3)+'-'+d.slice(3):''}
/* Huruf Jepang (hiragana, katakana, kanji, kana setengah lebar):
   komponen alamat yang masih mengandung huruf ini tidak ditulis. */
const PETA_HURUF_JP=/[぀-ヿ㐀-䶿一-鿿豈-﫿ｦ-ﾝ]/;
async function petaNomReverse(coords){
  const jeda=1100-(Date.now()-PETA_GEO.lastNom);
  if(PETA_GEO.lastNom&&jeda>0)await petaTunggu(jeda);
  PETA_GEO.lastNom=Date.now();
  /* accept-language=en: Nominatim mengembalikan nama tempat Jepang
     dalam transliterasi romaji (huruf Latin). */
  const res=await fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat='+coords[0]+'&lon='+coords[1]+'&zoom=18&addressdetails=1&accept-language=en',{headers:{'Accept':'application/json'}});
  if(!res.ok)throw new Error('Nominatim reverse HTTP '+res.status);
  const j=await res.json();
  if(!j||j.error||!j.address)return null;
  const a=j.address;
  if(a.country_code&&a.country_code!=='jp')return null;
  const ambil=(...ks)=>{for(const k of ks){if(a[k])return String(a[k])}return ''};
  const romaji=v=>{const s=String(v||'').trim();return s&&!PETA_HURUF_JP.test(s)?s:''};
  const pref=romaji(ambil('province','state'));
  const kota=romaji(ambil('city','town','village')||ambil('county'));
  /* Detail di bawah tingkat kota (distrik/blok/jalan/nomor) adalah bukti
     titik ini benar-benar beralamat; hasil yang hanya setingkat kota
     (mis. titik di perairan yang menempel batas administrasi kota)
     tidak dianggap alamat. Rincian hanya dihitung bila tersedia dalam
     ROMAJI: rincian yang seluruhnya berhuruf Jepang berarti alamat
     romaji tidak tersedia dari layanan. */
  const kunciRinci=['city_block','quarter','neighbourhood','suburb','city_district','road','house_number'];
  const rinci=kunciRinci.some(k=>romaji(a[k]));
  /* Susun urutan alamat romaji: nomor/jalan → blok → distrik → kawasan →
     kota → prefektur, dipisah koma; komponen berhuruf Jepang dibuang
     dan bagian yang sama tidak diulang. */
  const jalan=[romaji(a.house_number),romaji(a.road)].filter(Boolean).join(' ');
  const urutan=[jalan,romaji(a.city_block),romaji(a.neighbourhood),romaji(a.quarter),romaji(a.suburb),romaji(a.city_district),kota,pref];
  const bagian=[];
  urutan.forEach(bag=>{if(bag&&!bagian.some(x=>x.toLowerCase()===bag.toLowerCase()))bagian.push(bag)});
  const alamat=bagian.join(', ');
  return {alamat,kodepos:petaKodeposFormat(a.postcode),rinci:rinci&&!!alamat,pref,kota};
}
async function petaReverseGeocode(coords){
  let nom=null;
  try{nom=await petaNomReverse(coords)}catch(e){nom=null}
  if(nom&&nom.rinci&&nom.alamat)return {alamat:nom.alamat,kodepos:nom.kodepos};
  /* Alamat romaji tidak tersedia (titik tidak beralamat, atau rincian
     alamatnya hanya ada dalam huruf Jepang): kembalikan null supaya
     pemanggil tidak menimpa alamat lama dengan teks Jepang. */
  return null;
}
/* Bagi anggota menjadi yang terpetakan dan yang belum. Di v3, pin
   HANYA berasal dari hasil geocoding alamat/kode pos yang tersimpan di
   cache v3 — tidak ada koordinat perkiraan kota/wilayah. Anggota tanpa
   hasil geocode (belum dicoba / gagal) masuk daftar 'belum' dan tidak
   diberi pin sampai geocoding latar berhasil menempatkannya.
   Pengecualian satu-satunya: pin manual admin (lihat di atas). */
function petaBuatEntry(m,i,coords,lvl,manual){
  return {m,region:memberRegion(m),coords:[coords[0],coords[1]],lvl:manual?'Posisi manual':(lvl||'Kode pos'),manual:!!manual,key:String(m.id||('idx'+i))};
}
function petaEntries(){
  const entries=[],belum=[];
  const cache=petaGeoCacheLoad();
  (S.members||[]).forEach((m,i)=>{
    const manual=pinManualCoords(m);
    if(manual){entries.push(petaBuatEntry(m,i,manual,'Posisi manual',true));return}
    const tersimpan=cache[petaGeoKey(m)];
    if(tersimpan&&tersimpan.c)entries.push(petaBuatEntry(m,i,tersimpan.c,tersimpan.l));
    else belum.push(m);
  });
  return {entries,belum};
}
function petaSumberLabel(en){
  return en&&en.manual?'Posisi manual':'Otomatis dari alamat';
}
/* ===== Mesin geocoding alamat Jepang v3 — acuan ALAMAT + KODE POS =====
   Perubahan besar dari v2: posisi TIDAK lagi mengacu wilayah/kota.
   1) TITIK ACUAN tiap anggota = titik kawasan KODE POS-nya sendiri
      (geocoder kode pos: Nominatim postalcode-only, cadangan HeartRails
      searchByPostal). Kode pos Jepang wilayahnya kecil, jadi titik ini
      memang dekat alamat anggota.
   2) URUTAN PENCARIAN: alamat lengkap (GSI → Nominatim terstruktur
      dengan postalcode sebagai penyaring utama) → alamat tanpa gedung
      → titik kawasan kode pos sebagai hasil terakhir yang jujur.
   3) UJI KEWARASAN BARU (ketat): hasil alamat diterima HANYA bila
      jaraknya ≤3 km dari titik kode pos anggota itu sendiri, ATAU
      kode pos pada hasil sama dengan kode pos anggota. Hasil tingkat
      kota tetap ditolak seperti sebelumnya. Bila semua jenjang gagal:
      anggota TIDAK diberi pin (tidak ada pin pusat kota/wilayah).
   4) Cache 'sf_peta_geo_v3'; cache v1 & v2 dihapus saat muat supaya
      koordinat lama yang tidak presisi tidak terpakai lagi.
   Antrean sekuensial dengan jeda sopan (GSI ±0,4 dtk, Nominatim
   ±1,1 dtk) dan penjaga generasi; kegagalan jaringan tidak di-cache
   (dicoba lagi lain kali) dan antrean berhenti sesudah 3 kegagalan
   jaringan beruntun. */
const PETA_GEO={cache:null,running:false,lastNom:0,anchor:{}};
const PETA_PREF_JP={Tokushima:'徳島県',Kagawa:'香川県',Ehime:'愛媛県',Kochi:'高知県',Okayama:'岡山県'};
function petaGeoCacheLoad(){
  if(PETA_GEO.cache)return PETA_GEO.cache;
  PETA_GEO.cache={};
  try{localStorage.removeItem('sf_peta_geo_v1')}catch(e){}
  try{localStorage.removeItem('sf_peta_geo_v2')}catch(e){}
  try{const raw=localStorage.getItem('sf_peta_geo_v3');if(raw){const j=JSON.parse(raw);if(j&&typeof j==='object')PETA_GEO.cache=j}}catch(e){}
  return PETA_GEO.cache;
}
function petaGeoCacheSave(){try{localStorage.setItem('sf_peta_geo_v3',JSON.stringify(PETA_GEO.cache))}catch(e){}}
function petaGeoKey(m){return alamatJp(m,true)}
const petaTunggu=ms=>new Promise(r=>setTimeout(r,ms));
/* Angka lebar penuh → ASCII, tanda minus Jepang → '-' */
function petaNormAngka(s){return String(s||'').replace(/[０-９]/g,ch=>String.fromCharCode(ch.charCodeAt(0)-0xFEE0)).replace(/[−ー－―]/g,'-')}
/* Buang nama gedung/apartemen & nomor kamar dari kueri utama: potong di
   kata penanda gedung, atau sesudah pola blok bila sisa teks bukan angka. */
function petaBuangGedung(teks){
  let t=String(teks||'').trim();
  if(!t)return '';
  const potong=t.search(/(マンション|アパート|ハイツ|コーポ|ビル|レジデンス|タワー|荘|号室|階|apartment|apartments|building|room|suite|#)/i);
  if(potong>0)t=t.slice(0,potong).trim();
  const n=petaNormAngka(t);
  const bm=n.match(/(\d+\s*丁目\s*\d+\s*番(?:地)?\s*\d+\s*号?|\d+\s*-\s*\d+\s*-\s*\d+|\d+\s*-\s*\d+)/);
  if(bm){
    const end=bm.index+bm[0].length;
    const sisa=n.slice(end).trim();
    /* Potong sisa sesudah pola blok HANYA bila sisa itu teks Jepang
       (nama gedung tanpa kata penanda). Sisa romaji pada alamat romaji
       adalah nama jalan ("1-20 Hamanomachi") — wajib dipertahankan. */
    if(sisa&&!/^[0-9\-\s]*$/.test(sisa)&&/[぀-ヿ一-鿯]/.test(sisa))t=t.slice(0,end).trim();
  }
  return t.replace(/[,、，]+\s*$/,'').trim();
}
/* Nama Jepang sebuah kota dari kamus alias aplikasi (untuk kueri GSI). */
function petaNamaJpKota(kota){
  if(!kota)return '';
  const baris=LOCALITY_ALIASES.find(a=>a[2]===kota);
  if(!baris)return '';
  return baris[3].find(a=>/[^\x00-\x7f]/.test(a)&&/市|町/.test(a))||baris[3].find(a=>/[^\x00-\x7f]/.test(a))||'';
}
/* Urai alamat anggota menjadi bagian-bagian yang dipakai rencana kueri. */
function petaParseAlamat(m){
  const gabung=[m.kodepos,m.alamat_jp,m.kec_jp,m.kota,m.pref].filter(Boolean).join(' ');
  const posCocok=gabung.match(/\d{3}[- ]?\d{4}/);
  const kodepos=posCocok?posCocok[0].replace(/\D/g,'').replace(/(\d{3})(\d{4})/,'$1-$2'):'';
  const loc=inferJapanLocation(m.alamat_jp,m.kota,m.kec_jp,m.kodepos,m.pref,m.wilayah);
  const pref=(loc&&loc.pref)||m.pref||'';
  const kota=(loc&&loc.kota)||m.kota||'';
  const alamatMentah=String(m.alamat_jp||'').replace(/〒?\s*\d{3}[- ]?\d{4}/g,'').trim();
  const alamat=petaBuangGedung(alamatMentah);
  const n=petaNormAngka(alamat);
  const blok=/(\d+\s*丁目\s*\d+\s*番|\d+\s*-\s*\d+\s*-\s*\d+|\d+\s*-\s*\d+)/.test(n);
  return {kodepos,pref,kota,alamat,alamatMentah,blok,prefJp:PETA_PREF_JP[pref]||'',kotaJp:petaNamaJpKota(kota),adaJepang:/[぀-ヿ一-鿯]/.test(alamat+(m.kota||''))};
}
function petaJarakKm(a,b){
  const R=6371,toRad=d=>d*Math.PI/180;
  const dLat=toRad(b[0]-a[0]),dLon=toRad(b[1]-a[1]);
  const s=Math.sin(dLat/2)**2+Math.cos(toRad(a[0]))*Math.cos(toRad(b[0]))*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(s));
}
function petaKodeposNorm(s){return String(s||'').replace(/\D/g,'')}
/* Uji kewarasan v3: hasil diterima bila kode pos hasil == kode pos
   anggota, ATAU jarak hasil ≤3 km dari titik kode pos anggota. Tanpa
   titik kode pos dan tanpa kode pos hasil yang cocok = ditolak. */
function petaLolosUjiV3(coords,p,anchor,posHasil){
  const kp=petaKodeposNorm(p.kodepos);
  if(posHasil&&kp&&petaKodeposNorm(posHasil)===kp)return true;
  if(anchor)return petaJarakKm(coords,anchor)<=3;
  return false;
}
/* --- Geocoder 1: GSI (resmi, Jepang) --- */
async function petaGsiCoba(q){
  const res=await fetch('https://msearch.gsi.go.jp/address-search/AddressSearch?q='+encodeURIComponent(q),{headers:{'Accept':'application/json'}});
  if(!res.ok)throw new Error('GSI HTTP '+res.status);
  const j=await res.json();
  const f=Array.isArray(j)?j[0]:null;
  if(!f||!f.geometry||!Array.isArray(f.geometry.coordinates))return null;
  const lon=+f.geometry.coordinates[0],lat=+f.geometry.coordinates[1];
  if(!isFinite(lat)||!isFinite(lon))return null;
  return {coords:[lat,lon],title:String((f.properties&&f.properties.title)||'')};
}
/* Nilai hasil GSI dari judulnya: judul memuat 番…号/番地 = tingkat blok
   ('Alamat'); hanya sampai 丁目/distrik = tingkat kawasan ('Kode pos');
   hanya kota/prefektur = terlalu kasar, ditolak (null). */
function petaNilaiGsi(hasil,p){
  const t=petaNormAngka(hasil.title);
  if(/番/.test(t))return 'Alamat';
  if(/丁目|町|字/.test(t)&&t.length>(p.prefJp?p.prefJp.length:0)+2)return 'Kode pos';
  return null;
}
/* --- Geocoder 2 & 3: Nominatim terstruktur / freeform --- */
async function petaNomCoba(params){
  const jeda=1100-(Date.now()-PETA_GEO.lastNom);
  if(PETA_GEO.lastNom&&jeda>0)await petaTunggu(jeda);
  PETA_GEO.lastNom=Date.now();
  const qs=Object.keys(params).filter(k=>params[k]).map(k=>k+'='+encodeURIComponent(params[k])).join('&');
  const res=await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=jp&addressdetails=1&'+qs,{headers:{'Accept':'application/json'}});
  if(!res.ok)throw new Error('Nominatim HTTP '+res.status);
  const j=await res.json();
  const r=Array.isArray(j)?j[0]:null;
  if(!r||!isFinite(+r.lat)||!isFinite(+r.lon))return null;
  return {coords:[+r.lat,+r.lon],addresstype:String(r.addresstype||''),kategori:String(r.category||''),tipe:String(r.type||''),provinsi:String((r.address&&(r.address.province||r.address.state))||''),kodeposHasil:String((r.address&&r.address.postcode)||'')};
}
/* Nilai hasil Nominatim dari jenis tempatnya: gedung/jalan = 'Alamat';
   distrik/kode pos = 'Kode pos'; kota/kabupaten/prefektur = ditolak. */
function petaNilaiNom(hasil){
  const t=(hasil.addresstype||hasil.tipe||'').toLowerCase(),k=(hasil.kategori||'').toLowerCase();
  if(k==='building'||['building','house','apartments','detached_house','residential','hotel','station'].includes(t)||hasil.tipe==='station')return 'Alamat';
  if(k==='highway'||t==='road')return 'Alamat';
  if(['neighbourhood','suburb','quarter','postcode'].includes(t)||k==='postcode')return 'Kode pos';
  return null;
}
/* Titik kawasan KODE POS anggota — acuan kewarasan sekaligus hasil
   terakhir. Dicoba dari Nominatim (postalcode saja), lalu HeartRails
   searchByPostal. Hasil (termasuk kegagalan pasti) diingat per kode pos
   selama sesi supaya anggota sekodepos tidak mengulang pencarian. */
async function petaTitikKodePos(p){
  const kp=petaKodeposNorm(p.kodepos);
  if(!kp)return {titik:null,jaringan:false};
  if(kp in PETA_GEO.anchor)return {titik:PETA_GEO.anchor[kp],jaringan:false};
  let jaringan=true,titik=null;
  try{
    const r=await petaNomCoba({postalcode:p.kodepos});
    jaringan=false;
    if(r)titik=r.coords;
  }catch(e){/* lanjut ke HeartRails */}
  if(!titik){
    try{
      const res=await fetch('https://geoapi.heartrails.com/api/json?method=searchByPostal&postal='+encodeURIComponent(kp),{headers:{'Accept':'application/json'}});
      if(!res.ok)throw new Error('HeartRails HTTP '+res.status);
      const j=await res.json();
      jaringan=false;
      const loc=j&&j.response&&Array.isArray(j.response.location)?j.response.location[0]:null;
      if(loc&&isFinite(+loc.y)&&isFinite(+loc.x))titik=[+loc.y,+loc.x];
    }catch(e){/* kedua sumber gagal: titik tetap null */}
  }
  PETA_GEO.anchor[kp]=titik;
  return {titik,jaringan:titik?false:jaringan};
}
/* Rencana kueri berjenjang untuk satu anggota (urutan = prioritas):
   alamat lengkap dulu (GSI, lalu Nominatim terstruktur berpenyaring
   kode pos), kemudian varian freeform alamat yang sama. Titik kode pos
   tidak masuk rencana — ia acuan uji & hasil terakhir di luar rencana. */
function petaRencana(m,p){
  const rencana=[];
  const alamatBeda=p.alamat&&p.alamat!==p.alamatMentah;
  if(p.adaJepang&&p.alamat){
    const awalan=[p.prefJp,p.kotaJp].filter(x=>x&&!p.alamat.includes(x)).join('');
    rencana.push({via:'gsi',q:awalan+p.alamat});
    if(awalan)rencana.push({via:'gsi',q:p.alamat});
  }
  if(p.alamat||p.kodepos){
    rencana.push({via:'nom',params:{postalcode:p.kodepos||undefined,city:p.kota||undefined,street:p.alamat||undefined,state:p.pref||undefined}});
  }
  const bebas=(alamat,kodepos)=>[alamat,m.kec_jp,m.kota,m.pref,kodepos,'Japan'].filter(Boolean).join(', ');
  if(p.alamat)rencana.push({via:'nom',params:{q:bebas(p.alamat,p.kodepos)}});
  if(alamatBeda)rencana.push({via:'nom',params:{q:bebas(p.alamatMentah,p.kodepos)}});
  return rencana;
}
/* Jalankan pencarian satu anggota: titik kode pos diambil lebih dulu
   (acuan uji). Hasil tingkat 'Alamat' pertama yang lolos uji v3
   langsung menang; hasil tingkat kawasan yang lolos menjadi cadangan;
   bila rencana habis, titik kode pos sendiri adalah hasilnya
   ('Kode pos'). Tanpa titik kode pos & tanpa hasil yang lolos: null —
   anggota tidak diberi pin. {jaringan:true} bila percobaan gagal
   jaringan sehingga hasil tidak boleh di-cache. */
async function petaGeocodeAnggota(m,gen){
  const p=petaParseAlamat(m);
  if(!p.alamat&&!p.kodepos)return {hasil:null,jaringan:false};
  const anc=await petaTitikKodePos(p);
  let jaringan=anc.jaringan;
  let cadanganArea=anc.titik?{c:anc.titik,l:'Kode pos'}:null;
  for(const langkah of petaRencana(m,p)){
    if(gen!==PM.gen)return {hasil:null,jaringan:false,berhenti:true};
    try{
      if(langkah.via==='gsi'){
        const r=await petaGsiCoba(langkah.q);
        jaringan=false;
        if(r){
          const lvl=petaNilaiGsi(r,p);
          if(lvl&&petaLolosUjiV3(r.coords,p,anc.titik,'')){
            if(lvl==='Alamat')return {hasil:{c:r.coords,l:'Alamat'},jaringan:false};
            if(!cadanganArea||cadanganArea.c===anc.titik)cadanganArea={c:r.coords,l:'Kode pos'};
          }
        }
      }else{
        const r=await petaNomCoba(langkah.params);
        jaringan=false;
        if(r){
          const lvl=petaNilaiNom(r);
          if(lvl&&petaLolosUjiV3(r.coords,p,anc.titik,r.kodeposHasil)){
            if(lvl==='Alamat')return {hasil:{c:r.coords,l:'Alamat'},jaringan:false};
            if(!cadanganArea||cadanganArea.c===anc.titik)cadanganArea={c:r.coords,l:'Kode pos'};
          }
        }
      }
    }catch(e){/* kegagalan jaringan satu langkah: lanjut ke jenjang berikut */}
    if(langkah.via==='gsi')await petaTunggu(400);
  }
  return {hasil:cadanganArea,jaringan:cadanganArea?false:jaringan};
}
function petaSetGeoStatus(txt){
  const el=document.getElementById('peta-geo-status');if(!el)return;
  if(txt){el.textContent=txt;el.style.display='block'}else{el.style.display='none';el.textContent=''}
}
/* Tempatkan pin anggota satu per satu dari alamat + kode posnya.
   Berjalan di latar sesudah peta tampil; anggota yang berhasil langsung
   MUNCUL sebagai pin baru beserta tingkat ketepatannya (progresif) dan
   statistik/daftar diperbarui. gen = penanda sesi peta; bila halaman
   diganti / peta dibangun ulang, antrean berhenti. */
async function petaGeocodeEntries(gen){
  if(PETA_GEO.running){
    setTimeout(()=>{if(gen===PM.gen)petaGeocodeEntries(gen)},1600);
    return;
  }
  const cache=petaGeoCacheLoad();
  const todo=[];
  (S.members||[]).forEach((m,i)=>{
    if(pinManualCoords(m))return; /* pin manual didahulukan: tidak dicari lagi */
    if(!(m.alamat_jp||m.kodepos))return;
    const gkey=petaGeoKey(m);
    if(gkey in cache)return;
    todo.push({m,i,gkey});
  });
  if(!todo.length)return;
  PETA_GEO.running=true;
  let selesai=0,gagalJaringan=0;
  try{
    for(const item of todo){
      if(gen!==PM.gen)break;
      petaSetGeoStatus('Menempatkan pin dari alamat… ('+selesai+'/'+todo.length+')');
      const {hasil,jaringan,berhenti}=await petaGeocodeAnggota(item.m,gen);
      if(berhenti)break;
      if(jaringan){gagalJaringan++;if(gagalJaringan>=3)break}
      else{
        gagalJaringan=0;
        cache[item.gkey]=hasil||{c:null};petaGeoCacheSave();
        if(hasil&&gen===PM.gen&&!pinManualCoords(item.m)){
          const idkey=String(item.m.id||('idx'+item.i));
          const ada=PM.entries.find(en=>en.key===idkey);
          if(ada&&!ada.manual){ada.coords=[hasil.c[0],hasil.c[1]];ada.lvl=hasil.l;const mk=PM.markers[idkey];if(mk)mk.setLatLng(ada.coords)}
          else if(!ada)PM.entries.push(petaBuatEntry(item.m,item.i,hasil.c,hasil.l));
          if(PM.belumList)PM.belumList=PM.belumList.filter(x=>x!==item.m);
          petaRefresh();
          const en2=PM.entries.find(en=>en.key===idkey);
          if(en2&&String(S.petaSelected)===idkey)petaShowDetail(en2);
        }
      }
      selesai++;
      if(gen!==PM.gen)break;
      await petaTunggu(300);
    }
  }catch(e){console.error('Geocoding pin berhenti:',e)}
  PETA_GEO.running=false;
  if(gen===PM.gen)petaSetGeoStatus('');
}
function petaEsc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function petaInisial(nama){const p=String(nama||'?').trim().split(/\s+/);return ((p[0]||'?')[0]+((p[1]||'')[0]||'')).toUpperCase()}
/* Keadaan peta yang sedang hidup (satu instance Leaflet dalam satu waktu).
   gen bertambah setiap peta dibangun ulang — antrean geocoding sesi lama
   berhenti sendiri. style = pilihan tampilan peta sesi ini. */
/* Pilihan tampilan peta dasar — TUJUH gaya, semua gratis TANPA kunci
   API, dan setiap alamat ubinnya diverifikasi benar-benar merespons
   (uji muat ubin nyata di sekitar Takamatsu pada beberapa tingkat
   zoom). CARTO SENGAJA tidak dipakai: sejak 2026 servernya
   mengembalikan ubin placeholder bertuliskan "API KEY REQUIRED"
   dengan status HTTP sukses, jadi ubin watermark itu lolos deteksi
   tileerror/timeout dan peta tampil coretan.
   SEMUA LABEL ROMAJI: atas permintaan pengguna, tidak ada gaya yang
   menampilkan aksara Jepang (kanji/kana) pada label tempatnya —
   jadi sumber yang hanya berlabel Jepang diganti padanan Latin
   terdekat: 'Terang' yang dulu OpenStreetMap standar (label bahasa
   setempat = Jepang di Jepang) kini Esri Light Gray Canvas;
   'Jepang Detail' memakai GSI edisi Inggris (english) yang resmi —
   terverifikasi memuat label romaji ("Takamatsu", "Megijima Is."),
   dengan batas jujur ubin aslinya hanya sampai zoom 11
   (maxNativeZoom 11; zoom lebih besar memperbesar ubin zoom 11);
   'Topografi' yang dulu OpenTopoMap (label setempat) kini Esri
   World Topo Map; 'Kereta' yang dulu GSI Pale + OpenRailwayMap
   (keduanya berlabel Jepang) kini dasar pucat Esri Light Gray +
   lapisan referensi transportasi & tempat Esri yang romaji.
   url+opts = lapisan dasar gaya itu (dipakai juga oleh peta kecil
   formulir pin); overlays = lapisan transparan tambahan di atasnya
   (label satelit / jalur kereta). Catatan jujur: lapisan referensi
   Esri untuk wilayah Jepang hanya berisi sampai zoom ±12, jadi pada
   'Satelit + Label' dan 'Kereta' lapisannya dipasang maxNativeZoom
   12 — label tetap tampil saat peta diperbesar, digambar dari ubin
   zoom 12. */
/* Atribusi resmi Mapbox untuk ubin Mapbox: teks + tautan Mapbox &
   OpenStreetMap + tautan perbaikan peta. Atribusi ini WAJIB tampil
   saat gaya Mapbox aktif (aturan Mapbox) — kontrol atribusi Leaflet
   hanya dinyalakan untuk gaya Mapbox (lihat petaSyncAtribusi). */
const PETA_MAPBOX_ATTRIBUTION='&copy; <a href="https://www.mapbox.com/about/maps/" target="_blank" rel="noopener">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> <strong><a href="https://apps.mapbox.com/feedback/" target="_blank" rel="noopener">Improve this map</a></strong>';
const PETA_STYLES={
  jalan:{label:'Jalan',desc:'Peta jalan umum',name:'Esri World Street Map',url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',opts:{maxZoom:19,attribution:'Tiles &copy; Esri'},overlays:[]},
  terang:{label:'Terang',desc:'Peta terang minimalis — label huruf romaji',name:'Esri Light Gray Canvas',url:'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',opts:{maxZoom:19,attribution:'Tiles &copy; Esri'},overlays:[
    {url:'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}',opts:{maxZoom:19,attribution:'Tiles &copy; Esri'}}
  ]},
  jepang:{label:'Jepang Detail',desc:'GSI Jepang edisi Inggris — nama tempat rinci huruf romaji',name:'GSI English (Jepang edisi Inggris)',url:'https://cyberjapandata.gsi.go.jp/xyz/english/{z}/{x}/{y}.png',opts:{maxZoom:19,maxNativeZoom:11,attribution:'&copy; GSI — Geospatial Information Authority of Japan'},overlays:[]},
  satelit:{label:'Satelit',desc:'Citra satelit / foto udara',name:'Esri World Imagery',url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',opts:{maxZoom:19,attribution:'Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics'},overlays:[]},
  satelitlabel:{label:'Satelit + Label',desc:'Satelit dengan nama tempat, jalan & jalur kereta',name:'Esri World Imagery + Label',url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',opts:{maxZoom:19,attribution:'Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics'},overlays:[
    {url:'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}',opts:{maxZoom:19,maxNativeZoom:12,attribution:'Tiles &copy; Esri'}},
    {url:'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',opts:{maxZoom:19,maxNativeZoom:12,attribution:'Tiles &copy; Esri'}}
  ]},
  topo:{label:'Topografi',desc:'Kontur, jalur kereta & stasiun — label romaji',name:'Esri World Topo Map',url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',opts:{maxZoom:19,attribution:'Tiles &copy; Esri'},overlays:[]},
  kereta:{label:'Kereta',desc:'Jalur kereta & stasiun menonjol di atas peta pucat — label romaji',name:'Esri Light Gray + Transportasi',url:'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',opts:{maxZoom:19,attribution:'Tiles &copy; Esri'},overlays:[
    {url:'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}',opts:{maxZoom:19,maxNativeZoom:12,attribution:'Tiles &copy; Esri'}},
    {url:'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',opts:{maxZoom:19,maxNativeZoom:12,attribution:'Tiles &copy; Esri'}}
  ]},
  /* Gaya Mapbox (Styles API, ubin raster 512 retina: tileSize 512 +
     zoomOffset -1). Alamat ubinnya TIDAK statis — dibangun saat peta
     dimuat dari token publik Mapbox milik admin (lihat
     petaStyleResolved), jadi entri ini url-nya kosong. Gaya Mapbox
     hanya DITAWARKAN (Pengaturan & dropdown peta) bila token terisi,
     dan tidak pernah menjadi gaya tampil tanpa token. */
  mapboxjalan:{label:'Mapbox Jalan',desc:'Peta jalan Mapbox',name:'Mapbox Streets',mapbox:true,mapboxStyle:'streets-v12',url:'',opts:{tileSize:512,zoomOffset:-1,maxZoom:19,attribution:PETA_MAPBOX_ATTRIBUTION},overlays:[]},
  mapboxsatelit:{label:'Mapbox Satelit',desc:'Satelit Mapbox dengan nama jalan & tempat',name:'Mapbox Satellite Streets',mapbox:true,mapboxStyle:'satellite-streets-v12',url:'',opts:{tileSize:512,zoomOffset:-1,maxZoom:19,attribution:PETA_MAPBOX_ATTRIBUTION},overlays:[]}
};
/* Urutan tampil di menu dropdown: dari yang umum ke yang khusus. */
const PETA_STYLE_ORDER=['jalan','terang','jepang','satelit','satelitlabel','topo','kereta'];
const PETA_STYLE_ORDER_MAPBOX=['mapboxjalan','mapboxsatelit'];
const PM={map:null,layer:null,markers:{},entries:[],tileLayer:null,tileLayers:[],tileOk:0,tileErr:0,tileTimer:null,basemapIdx:0,fallback:false,fallbackLayer:null,gen:0,style:'jalan',chain:null,spiderLayer:null,spider:null,spiderTimer:null,clusters:[],clusterOf:{},menuDocBound:false,sementara:false,attribControl:null};
/* Gaya awal peta TIDAK lagi dibaca dari pilihan sesi lama
   (sessionStorage 'sf_peta_style' dibersihkan di sini): gaya awal
   selalu pilihan admin utama di Pengaturan (dokumen 'sumber_peta').
   Pilihan dari dropdown peta hanya berlaku SEMENTARA selama
   kunjungan itu (PM.sementara) dan kembali ke bawaan admin saat
   halaman Peta dibuka lagi / aplikasi dimuat ulang. */
try{sessionStorage.removeItem('sf_peta_style')}catch(e){}
/* ===== Sumber Peta: pilihan admin utama (Pengaturan) =====
   Tersimpan sebagai dokumen {id:'sumber_peta', gaya, mapboxToken} di
   koleksi 'pengaturan' — pola yang sama seperti pesan sambutan —
   jadi berlaku untuk SELURUH pengguna dan tetap sesudah muat ulang.
   mapboxToken adalah token PUBLIK Mapbox (pk.…): memang dirancang
   tampil di klien (terlihat juga di alamat ubin), bukan kunci rahasia
   server. */
function petaMapboxToken(){return String((S.sumberPeta&&S.sumberPeta.mapboxToken)||'').trim()}
/* Gaya bawaan yang BENAR-BENAR dipakai: pilihan admin, dengan
   penjagaan — gaya tak dikenal, atau gaya Mapbox tanpa token, jatuh
   ke 'jalan' (Esri) yang pasti bekerja. Peta tidak pernah kosong
   hanya karena bawaan admin tidak bisa dipakai. */
function petaGayaEfektif(){
  let g=(S.sumberPeta&&S.sumberPeta.gaya)||'jalan';
  if(!PETA_STYLES[g])g='jalan';
  if(PETA_STYLES[g].mapbox&&!petaMapboxToken())g='jalan';
  return g;
}
/* Definisi gaya siap pakai Leaflet: untuk gaya Mapbox, alamat ubin
   dibangun dari token tersimpan (Styles API, ubin 512 @2x). */
function petaStyleResolved(key){
  const st=PETA_STYLES[key];
  if(!st)return null;
  if(!st.mapbox)return Object.assign({key},st);
  return Object.assign({key},st,{url:'https://api.mapbox.com/styles/v1/mapbox/'+st.mapboxStyle+'/tiles/512/{z}/{x}/{y}@2x?access_token='+encodeURIComponent(petaMapboxToken())});
}
/* Daftar gaya yang DITAWARKAN: tujuh gaya bebas selalu ada; gaya
   Mapbox hanya muncul bila token terisi. tokenLangsung dipakai
   halaman Pengaturan supaya daftar mengikuti isi kolom token yang
   sedang diketik, sebelum disimpan. */
function petaDaftarGayaTersedia(tokenLangsung){
  const token=typeof tokenLangsung==='string'?tokenLangsung.trim():petaMapboxToken();
  const daftar=PETA_STYLE_ORDER.slice();
  if(token)PETA_STYLE_ORDER_MAPBOX.forEach(k=>daftar.push(k));
  return daftar;
}
/* Masuk halaman Peta = kembali ke bawaan admin: pilihan sementara
   dari kunjungan sebelumnya dibuang (dipanggil go() di shell.js). */
function petaResetKeBawaanAdmin(){
  PM.sementara=false;
  PM.style=petaGayaEfektif();
  try{sessionStorage.removeItem('sf_peta_style')}catch(e){}
}
function subscribeSumberPeta(){
  if(!S.db)return ()=>{};
  try{
    return S.db.collection('pengaturan').onSnapshot(snap=>{
      const doc=(snap.docs||[]).find(d=>d.id==='sumber_peta');
      const data=doc&&typeof doc.data==='function'?doc.data():null;
      const next={
        gaya:(data&&typeof data.gaya==='string'&&PETA_STYLES[data.gaya])?data.gaya:'jalan',
        mapboxToken:(data&&typeof data.mapboxToken==='string')?data.mapboxToken:''
      };
      const prev=S.sumberPeta||{gaya:'jalan',mapboxToken:''};
      if(next.gaya===prev.gaya&&next.mapboxToken===prev.mapboxToken)return;
      S.sumberPeta=next;
      /* Bawaan berubah dari admin / perangkat lain: terapkan sebagai
         gaya awal, kecuali pengguna sedang memakai pilihan sementara
         pada kunjungan ini. */
      if(!PM.sementara)PM.style=petaGayaEfektif();
      if(S.view==='peta'||S.view==='pengaturan')renderDariData();
    },error=>{console.error('Sumber peta gagal dimuat:',error)});
  }catch(error){console.error('Sumber peta gagal dimuat:',error);return ()=>{}}
}
async function saveSumberPeta(gaya,token){
  const bersih={gaya:PETA_STYLES[gaya]?gaya:'jalan',mapboxToken:String(token||'').trim()};
  if(S.db)await S.db.collection('pengaturan').doc('sumber_peta').set({gaya:bersih.gaya,mapboxToken:bersih.mapboxToken,at:Date.now()});
  S.sumberPeta=bersih;
  /* Pilihan yang baru disimpan langsung menjadi gaya awal peta. */
  PM.sementara=false;
  PM.style=petaGayaEfektif();
}
/* Atribusi Mapbox: class 'peta-mapbox-on' pada wadah peta menyalakan
   tampilan kontrol atribusi Leaflet (CSS) — HANYA saat lapisan yang
   benar-benar tampil adalah gaya Mapbox. Gaya lain (termasuk gaya
   cadangan Esri sesudah Mapbox gagal) tetap tanpa atribusi, persis
   seperti sebelumnya. */
function petaSyncAtribusi(bp){
  const el=document.getElementById('peta-map');
  if(!el)return;
  el.classList.toggle('peta-mapbox-on',!!(bp&&PETA_STYLES[bp.key]&&PETA_STYLES[bp.key].mapbox));
}
/* Rantai untuk gaya terpilih: gaya itu dulu; bila gagal, kembali ke Jalan
   (Esri Street); bila itu pun gagal, peta dasar cadangan lokal (SVG). */
function petaChain(){
  let pertama=PM.style||'jalan';
  if(!PETA_STYLES[pertama]||(PETA_STYLES[pertama].mapbox&&!petaMapboxToken()))pertama='jalan';
  const urutan=[pertama];
  if(pertama!=='jalan')urutan.push('jalan');
  return urutan.map(k=>petaStyleResolved(k)).filter(Boolean);
}
/* Buang semua lapisan ubin gaya yang sedang tampil (dasar + overlay). */
function petaClearTiles(){
  if(PM.tileLayers&&PM.map)PM.tileLayers.forEach(l=>{try{PM.map.removeLayer(l)}catch(e){}});
  PM.tileLayers=[];PM.tileLayer=null;
}
/* Samakan tampilan pemilih dropdown dengan gaya yang aktif: label pada
   tombol pemilih dan tanda centang pada butir menu. */
function petaSyncStyleUI(){
  const cur=document.getElementById('peta-style-current');
  if(cur)cur.textContent=(PETA_STYLES[PM.style]||PETA_STYLES.jalan).label;
  document.querySelectorAll('.peta-style-item').forEach(b=>{
    const on=b.getAttribute('data-style')===PM.style;
    b.classList.toggle('on',on);
    b.setAttribute('aria-checked',on?'true':'false');
  });
}
/* Tutup menu dropdown gaya peta (dipakai saat gaya dipilih, saat bidang
   di luar menu diketuk, atau tombol Escape ditekan — tanpa tombol X). */
function petaTutupMenuStyle(){
  const menu=document.getElementById('peta-style-menu');
  if(menu)menu.hidden=true;
  const tgl=document.getElementById('peta-style-toggle');
  if(tgl)tgl.setAttribute('aria-expanded','false');
}
/* Ganti tampilan peta: hanya lapisan dasar yang diganti — pin, pilihan
   anggota, dan posisi peta tidak berubah. Pilihan ini SEMENTARA untuk
   kunjungan ini saja: membuka lagi halaman Peta / memuat ulang
   aplikasi mengembalikan peta ke bawaan admin (petaResetKeBawaanAdmin). */
function petaSetStyle(key){
  if(!PETA_STYLES[key])return;
  if(PETA_STYLES[key].mapbox&&!petaMapboxToken())return;
  PM.style=key;
  PM.sementara=true;
  petaSyncStyleUI();
  petaTutupMenuStyle();
  if(!PM.map||typeof L==='undefined')return;
  if(PM.fallback){
    PM.fallback=false;
    if(PM.fallbackLayer){try{PM.map.removeLayer(PM.fallbackLayer)}catch(e){}PM.fallbackLayer=null}
    const el=document.getElementById('peta-map');if(el)el.style.background='';
    const nt=document.getElementById('peta-notice');if(nt)nt.style.display='none';
  }
  PM.chain=petaChain();
  petaTryBasemap(0);
}
function petaSetAttrib(txt){const el=document.getElementById('peta-attrib');if(el)el.textContent=txt}
function petaActivateFallback(){
  if(PM.fallback)return;PM.fallback=true;
  petaSyncAtribusi(null);
  if(PM.tileTimer){clearTimeout(PM.tileTimer);PM.tileTimer=null}
  petaClearTiles();
  if(PM.map&&!PM.fallbackLayer&&typeof L!=='undefined'){
    PM.fallbackLayer=L.imageOverlay('assets/japan-basemap.svg',[[31,129],[45.5,145.5]],{opacity:1,interactive:false}).addTo(PM.map);
    if(PM.layer)PM.layer.eachLayer(l=>{if(l.bringToFront)l.bringToFront()});
  }
  const el=document.getElementById('peta-map');if(el)el.style.background='#cfe0ee';
  const nt=document.getElementById('peta-notice');if(nt)nt.style.display='block';
  petaSetAttrib('Peta dasar cadangan lokal • Leaflet');
}
function petaNextBasemap(){if(PM.fallback)return;if(PM.tileTimer){clearTimeout(PM.tileTimer);PM.tileTimer=null}petaTryBasemap(PM.basemapIdx+1)}
function petaCheckTiles(){
  if(PM.fallback||(PM.tileOk>0&&PM.tileErr===0))return;
  const total=PM.tileOk+PM.tileErr;
  if(PM.tileOk===0&&PM.tileErr>=5)petaNextBasemap();
  else if(total>=8&&PM.tileOk>0&&(PM.tileErr/total)>0.65)petaNextBasemap();
  else if(total>=8&&PM.tileOk===0)petaNextBasemap();
}
function petaTryBasemap(idx){
  if(!PM.map||typeof L==='undefined')return;
  PM.basemapIdx=idx;PM.tileOk=0;PM.tileErr=0;
  if(PM.tileTimer){clearTimeout(PM.tileTimer);PM.tileTimer=null}
  petaClearTiles();
  const chain=PM.chain||petaChain();PM.chain=chain;
  if(idx>=chain.length){petaActivateFallback();return}
  const bp=chain[idx];
  petaSyncAtribusi(bp);
  petaSetAttrib('Memuat peta dasar: '+bp.name+' …');
  /* Lapisan dasar gaya ini: keberhasilan/kegagalan rantai cadangan
     dinilai dari lapisan ini saja. */
  const utama=L.tileLayer(bp.url,bp.opts);
  utama.on('tileload',()=>{PM.tileOk++;if(PM.tileOk===1){if(PM.tileTimer){clearTimeout(PM.tileTimer);PM.tileTimer=null}petaSetAttrib(idx>0?('Tampilan pilihan tidak terjangkau — memakai '+bp.name+' • Leaflet'):('Peta dasar: '+bp.name+' • Leaflet'))}});
  utama.on('tileerror',()=>{PM.tileErr++;petaCheckTiles()});
  utama.addTo(PM.map);
  PM.tileLayer=utama;PM.tileLayers=[utama];
  /* Lapisan overlay transparan gaya ini (label satelit / jalur
     kereta) menumpuk di atas lapisan dasar; kesalahannya tidak
     menggagalkan gaya — dasar yang tampil tetap utuh. */
  (bp.overlays||[]).forEach(ov=>{
    const l=L.tileLayer(ov.url,ov.opts);
    l.addTo(PM.map);
    PM.tileLayers.push(l);
  });
  PM.tileTimer=setTimeout(()=>{if(PM.tileOk===0)petaNextBasemap()},6000);
}
function petaFiltered(){
  const q=String(S.petaSearch||'').toLowerCase();
  return PM.entries.filter(en=>{
    if(S.petaFilter&&en.region!==S.petaFilter)return false;
    if(q){const hay=(String(en.m.nama||'')+' '+en.region+' '+String(en.m.kota||'')+' '+String(en.m.pref||'')+' '+String(en.m.alamat_jp||'')).toLowerCase();if(!hay.includes(q))return false}
    return true;
  });
}
function petaIcon(en,selected){
  const c=regionColor(en.region);
  return L.divIcon({className:'peta-pin-wrap'+(selected?' peta-pin-selected':''),html:'<div class="peta-pin"><div class="peta-pin-body" style="background:'+c+'"></div></div>',iconSize:[30,38],iconAnchor:[15,36],popupAnchor:[0,-34]});
}
/* Isi popup pin: KARTU ANGGOTA RINGKAS yang melayang tepat di atas
   pin — popup Leaflet terikat pada penanda, jadi kartu tetap
   menempel di atas pinnya saat peta digeser/di-zoom — sama di HP
   dan desktop (menggantikan popup keterangan lama). Isinya: foto
   anggota, nama, lencana wilayah berwarna, dan kota/alamat
   ringkas. Mengetuk kartu (atau Enter/Spasi saat kartunya
   terfokus) membuka detail/Kartu ID anggota itu, sama seperti
   membuka anggota dari daftar. Tanpa tombol X: kartu tertutup
   saat pin lain diketuk (kartu berpindah ke pin itu), saat area
   peta kosong diketuk, atau saat detail anggota dibuka. Tombol
   admin lama di popup (Perbaiki Posisi / Kembalikan Otomatis)
   tidak lagi di sini: mode Perbaiki Posisi Pin tetap masuk dari
   tombol di bilah bawah, dan selama mode itu aktif kartu ini
   tidak dibuka sama sekali (lihat petaShowDetail). */
function petaPopupContent(en){
  const m=en.m;
  const foto=m.foto
    ?h('img',{class:'peta-card-foto',alt:'Foto '+(m.nama||'anggota'),...memberMediaAttributes(m.foto,'src')})
    :h('span',{class:'peta-card-foto peta-card-inisial','aria-hidden':'true',style:'background:'+regionColor(en.region)},petaInisial(m.nama));
  const kartu=h('div',{class:'peta-pin-card',role:'button',tabindex:'0',title:'Lihat kartu anggota '+(m.nama||''),'aria-label':'Lihat kartu anggota '+(m.nama||'anggota')},
    foto,
    h('div',{class:'peta-card-isi'},
      h('div',{class:'peta-card-nama'},m.nama||'Tanpa nama'),
      h('span',{class:'peta-pop-badge',style:'background:'+regionColor(en.region)},en.region),
      h('div',{class:'peta-card-alamat'},alamatJp(m,false))));
  const bukaDetail=()=>{
    if(PM.map&&PM.map.closePopup)PM.map.closePopup();
    if(typeof openMember==='function')openMember(m);
  };
  kartu.addEventListener('click',bukaDetail);
  kartu.addEventListener('keydown',ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();bukaDetail()}});
  return kartu;
}
/* Aktifkan mode Perbaiki Posisi Pin dan arahkan ke pin anggota ini. */
function petaMulaiPerbaiki(en){
  if(!S.admin)return;
  S.petaFixMode=true;S.petaFixNotice='';
  S.petaSelected=en.key;
  render();
  setTimeout(()=>{
    const target=PM.entries.find(x=>x.key===en.key);
    if(target&&PM.map){PM.map.flyTo(target.coords,Math.max(PM.map.getZoom(),13),{duration:.6})}
    petaSetFixNotice('Mode Perbaiki aktif — geser pin '+(en.m.nama||'anggota')+' ke posisi yang benar, lalu lepaskan. Posisi baru langsung tersimpan.');
  },80);
}
/* Hapus pin manual anggota: pin kembali ke hasil geocoding otomatis. */
async function petaKembalikanOtomatis(en){
  if(!S.admin)return;
  try{
    await simpanPinManualAnggota(en.m,null);
    S.petaFixNotice='Pin '+(en.m.nama||'anggota')+' dikembalikan ke posisi otomatis dari alamat.';
    render();
  }catch(error){console.error(error);alert('Gagal mengembalikan pin ke otomatis: '+(error.message||'periksa koneksi'))}
}
function petaSetFixNotice(txt){
  S.petaFixNotice=txt||'';
  const el=document.getElementById('peta-fix-notice');
  if(el){el.textContent=S.petaFixNotice;el.style.display=S.petaFixNotice?'block':'none'}
}
function petaRenderChips(){
  const el=document.getElementById('peta-chips');if(!el)return;
  const buat=(label,color,count,aktif,aksi)=>{
    const b=h('button',{type:'button',class:'peta-chip'+(aktif?' on':''),onclick:aksi},
      h('span',{class:'peta-dot',style:'background:'+color}),h('span',{class:'peta-chip-name'},label),h('span',{class:'peta-count'},String(count)));
    return b;
  };
  const kids=[buat('Semua','#2b7a8c',PM.entries.length,!S.petaFilter,()=>{S.petaFilter=null;petaRefresh();petaFrameFiltered()})];
  const ada=new Set();
  wilayahEfektif().forEach(([name,color])=>{
    ada.add(name);
    const n=PM.entries.filter(en=>en.region===name).length;
    kids.push(buat(name,color,n,S.petaFilter===name,()=>{S.petaFilter=S.petaFilter===name?null:name;petaRefresh();petaFrameFiltered()}));
  });
  /* Wilayah di luar daftar efektif (mis. 'Belum dipilih') tetap bisa disaring */
  [...new Set(PM.entries.map(en=>en.region))].filter(r=>!ada.has(r)).forEach(r=>{
    const n=PM.entries.filter(en=>en.region===r).length;
    kids.push(buat(r,regionColor(r),n,S.petaFilter===r,()=>{S.petaFilter=S.petaFilter===r?null:r;petaRefresh();petaFrameFiltered()}));
  });
  el.replaceChildren(...kids);
}
function petaRenderMarkers(){
  const list=petaFiltered();
  const cnt=document.getElementById('peta-count');if(cnt)cnt.textContent=list.length+' pin tampil';
  const hint=document.getElementById('peta-hint');if(hint)hint.textContent=S.petaFixMode?'Mode Perbaiki Posisi Pin aktif — geser pin untuk memindahkannya':(S.petaFilter?('Menyaring: '+S.petaFilter):'Menampilkan semua wilayah');
  if(!PM.map||!PM.layer||typeof L==='undefined')return;
  petaSpiderCollapse();
  PM.layer.clearLayers();PM.markers={};
  const bisaGeser=!!(S.admin&&S.petaFixMode);
  list.forEach(en=>{
    const mk=L.marker(en.coords,{icon:petaIcon(en,String(S.petaSelected)===en.key),draggable:bisaGeser});
    const m=en.m;
    mk.bindPopup(petaPopupContent(en),{closeButton:false,maxWidth:280,className:'peta-popup'});
    /* Tooltip hover: nama anggota melayang di atas pin saat kursor diarahkan.
       interactive:false + sticky:false → murni label, hilang saat kursor
       menjauh dan tidak menangkap ketukan di layar sentuh. */
    const tip='<div class="pin-tip-name">'+petaEsc(m.nama||'Tanpa nama')+'</div>'
      +'<div class="pin-tip-sub"><i style="background:'+regionColor(en.region)+'"></i>'+petaEsc(en.region)+(m.kota?' • '+petaEsc(m.kota):'')+(en.manual?' • Posisi manual':'')+'</div>';
    mk.bindTooltip(tip,{direction:'top',offset:[0,-34],className:'pin-tip',sticky:false,interactive:false,opacity:1});
    if(bisaGeser){
      /* Mode Perbaiki: spiderfy MATI, pin langsung bisa digeser. Sesudah
         digeser & dilepas, koordinat baru langsung tersimpan ke data
         anggota sebagai pin manual. */
      mk.on('dragstart',()=>{if(mk.closeTooltip)mk.closeTooltip();if(mk.closePopup)mk.closePopup()});
      mk.on('dragend',async()=>{
        const ll=mk.getLatLng();
        const baru=[ll.lat,ll.lng];
        /* Titik baru dicarikan ALAMATNYA (geocoding terbalik): yang
           disimpan ke field alamat anggota adalah teks alamat titik
           itu, bukan angka koordinatnya. Bila alamat tidak ditemukan
           (mis. titik di perairan), pin tetap disimpan dan alamat lama
           anggota tidak berubah. */
        petaSetFixNotice('Mencari alamat dari titik…');
        let hasil=null;
        try{hasil=await petaReverseGeocode(baru)}catch(e){hasil=null}
        try{
          await simpanPinManualAnggota(m,{lat:baru[0],lng:baru[1]},hasil);
          en.coords=baru;en.manual=true;en.lvl='Posisi manual';
          if(m&&typeof m==='object'){
            m.pinManual=pinManualObj(baru);
            if(hasil){m.alamat_jp=hasil.alamat;if(hasil.kodepos)m.kodepos=hasil.kodepos}
          }
          mk.setIcon(petaIcon(en,String(S.petaSelected)===en.key));
          mk.setPopupContent(petaPopupContent(en));
          petaSetFixNotice(hasil
            ?('Posisi pin '+(m.nama||'anggota')+' disimpan — '+hasil.alamat)
            :('Posisi pin '+(m.nama||'anggota')+' disimpan — alamat tidak ditemukan dari titik ini, alamat lama tidak berubah.'));
          if(String(S.petaSelected)===en.key)petaShowDetail(en);
          petaRenderList();
        }catch(error){
          console.error(error);
          mk.setLatLng(en.coords);
          petaSetFixNotice('');
          alert('Gagal menyimpan posisi pin: '+(error.message||'periksa koneksi'));
        }
      });
    }else{
      /* Hover di atas pin yang bertumpuk: tumpukan MEKAR (spiderfy).
         Ketuk pada tumpukan (layar sentuh) juga memekarkannya dulu —
         pin aslinya dipilih sesudah pin mekarnya diketuk. */
      mk.on('mouseover',()=>petaSpiderHover(en.key));
      mk.on('mouseout',()=>petaSpiderSchedule());
    }
    mk.on('click',()=>{
      if(bisaGeser){S.petaSelected=en.key;petaShowDetail(en);petaRenderList();return}
      const cl=PM.clusterOf[en.key];
      if(cl&&!PM.spider){if(mk.closeTooltip)mk.closeTooltip();petaSpiderExpand(cl);return}
      if(mk.closeTooltip)mk.closeTooltip();petaSelect(en,{popup:true});
    });
    mk.addTo(PM.layer);PM.markers[en.key]=mk;
  });
  /* Pin TIDAK disebar/digeser secara permanen oleh sistem: posisinya
     persis di koordinatnya pada semua zoom, walau pin lain berimpit.
     Yang mekar saat hover hanyalah salinan visual sementara — dan
     mekar itu dimatikan selama mode Perbaiki Posisi Pin aktif. */
  if(bisaGeser){PM.clusters=[];PM.clusterOf={}}
  else petaComputeClusters();
}
/* ===== Spiderfy: tumpukan pin mekar sementara saat hover/ketuk =====
   Pin yang berimpit (jarak ≤42px di layar pada zoom saat itu) dihitung
   sebagai satu tumpukan dari koordinat ASLI mereka — data tidak pernah
   digeser. Saat kursor diarahkan ke salah satu pin tumpukan (atau
   tumpukan diketuk di layar sentuh), salinan pin-pinnya mekar
   melingkar mengelilingi titik asal dengan garis penghubung tipis;
   tiap pin mekar bisa di-hover (tooltip nama) dan diklik (popup/detail
   anggota itu). Kursor menjauh dari seluruh kelompok → salinan hilang
   dan pin kembali bertumpuk. Zoom/geser peta juga melipat mekar. */
function petaComputeClusters(){
  PM.clusters=[];PM.clusterOf={};
  if(S.petaFixMode)return; /* spiderfy nonaktif selama mode Perbaiki */
  if(!PM.map||typeof L==='undefined')return;
  const pts=petaFiltered().map(en=>({en,pt:PM.map.latLngToContainerPoint(en.coords)}));
  const used=new Set();
  pts.forEach(a=>{
    if(used.has(a.en.key))return;
    const grup=[a];used.add(a.en.key);
    pts.forEach(b=>{
      if(b===a||used.has(b.en.key))return;
      if(a.pt.distanceTo(b.pt)<=42){grup.push(b);used.add(b.en.key)}
    });
    if(grup.length>=2){
      const cl={anchor:a.en.coords,keys:grup.map(g=>g.en.key),entries:grup.map(g=>g.en)};
      PM.clusters.push(cl);
      cl.keys.forEach(k=>{PM.clusterOf[k]=cl});
    }
  });
}
function petaSpiderCollapse(){
  if(PM.spiderTimer){clearTimeout(PM.spiderTimer);PM.spiderTimer=null}
  if(PM.spiderLayer)PM.spiderLayer.clearLayers();
  PM.spider=null;
}
function petaSpiderKeep(){
  if(PM.spiderTimer){clearTimeout(PM.spiderTimer);PM.spiderTimer=null}
}
function petaSpiderSchedule(){
  if(!PM.spider)return;
  petaSpiderKeep();
  PM.spiderTimer=setTimeout(()=>petaSpiderCollapse(),280);
}
function petaSpiderHover(key){
  if(S.petaFixMode)return;
  const cl=PM.clusterOf[key];
  if(!cl)return;
  if(PM.spider&&PM.spider.cluster===cl){petaSpiderKeep();return}
  petaSpiderExpand(cl);
}
function petaSpiderExpand(cl){
  if(!PM.map||!PM.spiderLayer||typeof L==='undefined')return;
  petaSpiderCollapse();
  PM.spider={cluster:cl};
  const center=PM.map.latLngToContainerPoint(cl.anchor);
  const n=cl.entries.length;
  const radius=n<=2?32:Math.min(66,26+n*7);
  cl.entries.forEach((en,i)=>{
    const ang=(Math.PI*2*i/n)-Math.PI/2;
    const px=L.point(center.x+Math.cos(ang)*radius,center.y+Math.sin(ang)*radius);
    const ll=PM.map.containerPointToLatLng(px);
    L.polyline([cl.anchor,ll],{color:'#527f9f',weight:1.5,opacity:.75,interactive:false}).addTo(PM.spiderLayer);
    const mk=L.marker(ll,{icon:petaIcon(en,String(S.petaSelected)===en.key),zIndexOffset:1200});
    const m=en.m;
    const tip='<div class="pin-tip-name">'+petaEsc(m.nama||'Tanpa nama')+'</div>'
      +'<div class="pin-tip-sub"><i style="background:'+regionColor(en.region)+'"></i>'+petaEsc(en.region)+(m.kota?' • '+petaEsc(m.kota):'')+'</div>';
    mk.bindTooltip(tip,{direction:'top',offset:[0,-34],className:'pin-tip',sticky:false,interactive:false,opacity:1});
    mk.on('mouseover',petaSpiderKeep);
    mk.on('mouseout',petaSpiderSchedule);
    mk.on('click',()=>{if(mk.closeTooltip)mk.closeTooltip();petaSpiderCollapse();petaSelect(en,{popup:true})});
    mk.addTo(PM.spiderLayer);
  });
}
/* Daftar nama di halaman peta: BERKELOMPOK PER WILAYAH seperti
   Daftar Anggota utama. Tiap kelompok berkepala nama wilayah
   (titik warna wilayahnya + TOTAL seluruh anggota wilayah itu
   dari data anggota + jumlah yang tampil di peta), di bawahnya nama-nama anggota kelompok itu —
   tetap NAMA SAJA + titik warna dalam chip rapat banyak-kolom
   supaya muat banyak dalam ruang kecil. Urutan kelompok mengikuti
   daftar wilayah aplikasi; wilayah di luar daftar itu sesudahnya
   menurut abjad, 'Belum dipilih' paling akhir. Ketuk nama tetap
   menerbangkan kamera ke pin & membuka kartu di atas pinnya.
   Anggota yang BELUM terpetakan (tanpa pin) tampil di bagian
   AKHIR kelompok wilayahnya dengan penanda titik berongga + kelas
   'unmapped'; ketuk namanya membuka keterangan belum terpetakan
   (tanpa memindahkan peta, karena belum ada pin). Pencarian
   menyaring nama lintas kelompok; kelompok yang tidak punya nama
   tampil tidak digambar sama sekali. */
function petaRenderList(){
  const ul=document.getElementById('peta-list');if(!ul)return;
  const list=petaFiltered().slice().sort((a,b)=>String(a.m.nama||'').localeCompare(String(b.m.nama||'')));
  const q=String(S.petaSearch||'').toLowerCase();
  const belumList=(PM.belumList||[]).filter(m=>{
    if(S.petaFilter&&memberRegion(m)!==S.petaFilter)return false;
    if(q&&!String(m.nama||'').toLowerCase().includes(q))return false;
    return true;
  }).slice().sort((a,b)=>String(a.nama||'').localeCompare(String(b.nama||'')));
  const empty=document.getElementById('peta-empty');if(empty)empty.style.display=(list.length||belumList.length)?'none':'block';
  /* Ember per wilayah: yang terpetakan menurut en.region, yang
     belum terpetakan menurut wilayah anggotanya (kuncinya disimpan
     apa adanya supaya pilihan 'belum-…' tetap cocok dengan
     S.petaSelected seperti sebelumnya). */
  const ember=new Map(),emberBelum=new Map();
  list.forEach(en=>{if(!ember.has(en.region))ember.set(en.region,[]);ember.get(en.region).push(en)});
  belumList.forEach((m,i)=>{const r=memberRegion(m);if(!emberBelum.has(r))emberBelum.set(r,[]);emberBelum.get(r).push({m,key:'belum-'+String(m.id||('idx'+i))})});
  const dikenal=wilayahEfektif().map(x=>x[0]);
  const semuaNama=[...new Set([...ember.keys(),...emberBelum.keys()])];
  const urutan=[...dikenal.filter(n=>semuaNama.includes(n)),...semuaNama.filter(n=>n!=='Belum dipilih'&&!dikenal.includes(n)).sort((a,b)=>a.localeCompare(b,'id'))];
  if(semuaNama.includes('Belum dipilih'))urutan.push('Belum dipilih');
  const anak=[];
  urutan.forEach(region=>{
    const grupMap=ember.get(region)||[];
    const grupBelum=emberBelum.get(region)||[];
    if(!grupMap.length&&!grupBelum.length)return;
    const c=regionColor(region);
    /* Total anggota wilayah ini: dihitung dari SELURUH data anggota
       (S.members) menurut wilayahnya — BUKAN dari daftar yang sedang
       tampil — jadi angka ini tetap sama walau pencarian menyaring
       nama atau sebagian anggota belum terpetakan. Yang mengikuti
       saringan hanyalah daftar nama dan hitungan 'di peta'. */
    const totalWilayah=(S.members||[]).filter(m=>memberRegion(m)===region).length;
    anak.push(h('li',{class:'peta-group-head',style:'--region-color:'+c},
      h('span',{class:'peta-group-dot','aria-hidden':'true'}),
      h('span',{class:'peta-group-name'},region),
      h('span',{class:'peta-group-count'},h('b',{class:'peta-group-total'},totalWilayah+' anggota'),' · '+grupMap.length+' di peta')));
    grupMap.forEach(en=>{
      const m=en.m;
      anak.push(h('li',{},h('button',{type:'button',class:'peta-name-item'+(String(S.petaSelected)===en.key?' on':''),title:(m.nama||'Tanpa nama')+' — '+en.region,onclick:()=>petaSelect(en,{fly:true,popup:true})},
        h('span',{class:'peta-name-dot',style:'background:'+c}),
        h('span',{class:'peta-name-text'},m.nama||'Tanpa nama'))));
    });
    grupBelum.forEach(({m,key})=>{
      anak.push(h('li',{},h('button',{type:'button',class:'peta-name-item unmapped'+(String(S.petaSelected)===key?' on':''),title:(m.nama||'Tanpa nama')+' — belum terpetakan',onclick:()=>{
          S.petaSelected=key;
          petaShowDetail({m,region:memberRegion(m),coords:null,manual:false,belum:true,key,lvl:''});
          petaRenderList();
        }},
        h('span',{class:'peta-name-dot peta-name-dot-empty'}),
        h('span',{class:'peta-name-text'},m.nama||'Tanpa nama'))));
    });
  });
  ul.replaceChildren(...anak);
}
function petaRenderStats(){
  const total=document.getElementById('peta-stat-total');if(total)total.textContent=String((S.members||[]).length);
  const pin=document.getElementById('peta-stat-pin');if(pin)pin.textContent=String(PM.entries.length);
  const wil=document.getElementById('peta-stat-wilayah');if(wil)wil.textContent=String(new Set((S.members||[]).map(m=>memberRegion(m))).size);
}
function petaRefresh(){petaRenderChips();petaRenderMarkers();petaRenderList();petaRenderStats()}
/* Pandangan peta mengikuti saringan: sesudah pengguna memilih /
   melepas saringan wilayah (atau menekan 'Semua wilayah'), kamera
   terbang halus membingkai pin yang sedang tampil — satu pin
   dibesarkan ke titiknya, banyak pin dibingkai seluruhnya, dan tanpa
   saringan kamera kembali membingkai semua pin (Shikoku penuh).
   SENGAJA hanya dipanggil dari aksi pengguna itu, bukan dari
   petaRefresh: penyegaran latar geocoding tidak boleh menggerakkan
   kamera. Tanpa pin tampil, pandangan dibiarkan apa adanya. */
function petaFrameFiltered(){
  if(!PM.map||typeof L==='undefined')return;
  const list=petaFiltered();
  if(!list.length)return;
  if(list.length===1){PM.map.flyTo(list[0].coords,Math.max(PM.map.getZoom(),12),{duration:.7});return}
  PM.map.flyToBounds(L.latLngBounds(list.map(en=>en.coords)),{padding:[36,36],maxZoom:13,duration:.7});
}
function petaLayarDesktop(){return typeof window!=='undefined'&&window.innerWidth>=1024}
/* ===== Kartu anggota melayang DI ATAS PIN (semua ukuran layar) =====
   Mengetuk pin anggota (atau namanya di daftar) membuka kartu
   ringkasnya TEPAT di atas pin itu — popup Leaflet dari
   petaPopupContent, terikat pada penanda sehingga tetap menempel
   mengikuti pin saat peta digeser/di-zoom — sama di HP dan
   desktop, menggantikan lembar bawah khusus HP dan keadaan tanpa
   kartu di desktop sebelumnya. Dua pengecualian:
   - Mode Perbaiki Posisi Pin aktif: menekan pin adalah untuk
     MENYERET, jadi kartu tidak dibuka sama sekali.
   - Anggota BELUM terpetakan tidak punya pin untuk ditempeli
     kartu: keterangannya tetap tampil seperti sebelumnya (lembar
     bawah di bawah ini untuk HP, tanpa kartu di desktop). */
function petaShowDetail(en){
  if(!en.belum){
    if(S.admin&&S.petaFixMode){petaHideDetail();return}
    petaHideDetail();
    const mk=PM.markers&&PM.markers[en.key];
    if(mk&&PM.map){
      mk.openPopup();
      /* Foto privat anggota mungkin belum terurai URL bertandanya
         saat isi kartu dibuat; jalankan hidrasi media sekali lagi
         supaya foto pada kartu yang sedang terbuka ikut terisi. */
      setTimeout(()=>{if(typeof hydrateMemberMedia==='function')hydrateMemberMedia()},0);
    }
    return;
  }
  if(petaLayarDesktop()){petaHideDetail();return}
  const card=document.getElementById('peta-detail');if(!card)return;
  const m=en.m,c=regionColor(en.region);
  const boxInfo=(label,value)=>h('div',{class:'peta-detail-box'},h('label',{},label),h('p',{},value||'—'));
  const sumber=en.belum
    ?'Belum terpetakan — alamat/kode pos Jepangnya belum berhasil dipetakan persis, jadi anggota ini belum punya pin di peta. Lengkapi alamatnya lewat menu Data Anggota supaya pinnya muncul.'
    :(en.manual
    ?'Posisi manual — ditetapkan admin pada '+en.coords[0].toFixed(5)+', '+en.coords[1].toFixed(5)+'. Pin ini tidak digeser geocoding otomatis.'
    :('Otomatis dari alamat — ketepatan '+(en.lvl||'Kode pos')+(en.lvl==='Alamat'?' (titik hasil geocoding alamat lengkap, dekat titik kode pos alamat ini)':' (titik kawasan kode pos alamat ini)')));
  const anak=[
    h('div',{class:'peta-detail-top'},
      h('div',{style:'flex:1;min-width:0'},
        h('div',{class:'peta-detail-label'},'Anggota terpilih'),
        h('h3',{},m.nama||'Tanpa nama'),
        h('div',{class:'peta-detail-meta'},
          h('span',{class:'peta-badge',style:'background:'+c},en.region),
          h('span',{class:'peta-detail-kota'},[m.kota,m.pref].filter(Boolean).join(' • ')||'—'))),
      h('button',{type:'button',class:'btn s',onclick:()=>{S.petaSelected=null;petaHideDetail();petaRenderMarkers();petaRenderList()}},'Kembali ke daftar')),
    h('div',{class:'peta-detail-grid'},
      boxInfo('Alamat di Jepang',alamatJp(m,false)),
      boxInfo('Stasiun terdekat • Kode pos',[m.stasiun,m.kodepos?('〒'+m.kodepos):''].filter(Boolean).join('  •  ')),
      boxInfo('Sumber posisi pin',sumber))
  ];
  if(S.admin&&!en.belum){
    const tombol=[h('button',{type:'button',class:'btn s',onclick:()=>petaMulaiPerbaiki(en)},S.petaFixMode?'Geser pin ini di peta':'Perbaiki Posisi')];
    if(en.manual)tombol.push(h('button',{type:'button',class:'btn s',onclick:()=>petaKembalikanOtomatis(en)},'Kembalikan Otomatis'));
    anak.push(h('div',{class:'fl',style:'margin-top:12px'},...tombol));
  }
  anak.push(h('p',{class:'peta-detail-note'},'Ketuk area peta di luar pin untuk menutup detail ini.'));
  card.replaceChildren(...anak);
  card.style.display='block';
}
/* Sembunyikan lembar keterangan lama (anggota belum terpetakan)
   DAN tutup kartu melayang di atas pin bila sedang terbuka. */
function petaHideDetail(){const card=document.getElementById('peta-detail');if(card){card.style.display='none';card.replaceChildren()}if(PM.map&&PM.map.closePopup)PM.map.closePopup()}
function petaSelect(en,opts){
  opts=opts||{};S.petaSelected=en.key;
  /* Anggota belum terpetakan: tanpa pin & tanpa gerak kamera —
     keterangannya tampil seperti sebelumnya. */
  if(en.belum){petaShowDetail(en);petaRenderList();return}
  petaRenderMarkers();petaRenderList();
  /* Ketuk nama di daftar menerbangkan kamera ke pin (opts.fly);
     di desktop klik pin pun memusatkan peta seperti sebelumnya.
     Ketuk pin di HP cukup membuka kartunya — popup Leaflet menata
     pandangan seperlunya supaya kartu terlihat. */
  const terbang=!!(en.coords&&PM.map&&(opts.fly||petaLayarDesktop()));
  if(terbang)PM.map.flyTo(en.coords,Math.max(PM.map.getZoom(),11),{duration:.7});
  /* Kartu dibuka di atas pin yang BARU digambar ulang, sesudah
     kamera selesai terbang bila ada penerbangan — di HP maupun
     desktop. Pilihan yang sudah berganti selama jeda ini berjalan
     membatalkan pembukaan, jadi kartu tidak melompat ke pin lama. */
  setTimeout(()=>{if(String(S.petaSelected)===String(en.key))petaShowDetail(en)},terbang?750:60);
  if(petaLayarDesktop()){
    /* Nama terpilih digulir terlihat di dalam panel daftarnya sendiri
       (panel memang bisa digulir di dalam areanya; halaman tidak). */
    try{const on=document.querySelector('.peta-name-item.on');if(on)on.scrollIntoView({block:'nearest'})}catch(e){}
  }
}
/* Halaman Peta: di DESKTOP seluruh isi muat dalam satu tinggi layar
   TANPA halaman bisa digulir ke bawah — body diberi kelas 'peta-view'
   oleh render() (views.js) dan CSS mengunci tingginya di layar
   ≥900px. Susunannya: judul ringkas saja di atas, lalu peta + daftar
   nama mengisi seluruh ruang utama sampai ke DASAR halaman. TIDAK
   ada lagi bilah kontrol di bagian bawah: tombol Semua wilayah /
   Ke Shikoku / Perbaiki Posisi Pin dan pil statistik (Total /
   Di peta / Wilayah) sudah DIHAPUS atas permintaan pengguna —
   keterangan wilayah terbaca dari kelompok-kelompok di daftar nama,
   dan jumlah pin tampil pada pil melayang di atas peta.
   Di HP berlaku aturan tersendiri: halaman BOLEH
   digulir alami, peta bertinggi tetap di atas, daftar nama mengalir
   di bawahnya sampai dasar halaman.
   Daftar berkelompok per wilayah dan hanya menampilkan NAMA +
   titik warna wilayah (tanpa alamat) supaya muat banyak. */
function vPeta(){
  /* Mode Perbaiki Posisi Pin tidak lagi punya pintu masuk (tombolnya
     ikut terhapus bersama bilah bawah): keadaan lamanya yang mungkin
     masih tersisa dari sesi yang sama dimatikan di sini, supaya pin
     tidak tertinggal bisa digeser tanpa jalan keluar dan penempatan
     pin latar tidak terjeda. */
  if(S.petaFixMode){S.petaFixMode=false;S.petaFixNotice=''}
  /* Gaya awal halaman ini = bawaan admin (Pengaturan), kecuali ada
     pilihan sementara yang dibuat selama kunjungan ini. */
  if(!PM.sementara||!PETA_STYLES[PM.style]||(PETA_STYLES[PM.style].mapbox&&!petaMapboxToken()))PM.style=petaGayaEfektif();
  const {entries,belum}=petaEntries();
  PM.belumList=belum;
  const topBar=h('div',{class:'peta-top'},
    h('h1',{class:'peta-title'},'Peta & Wilayah'));
  /* Kartu peta = petanya sendiri: permukaan Leaflet memenuhi seluruh
     kartu dari tepi ke tepi (tanpa baris judul/keterangan di atas dan
     tanpa baris kaki di bawah). Pemilih gaya peta (satu tombol yang
     membuka menu DROPDOWN berisi gaya yang tersedia) & pil jumlah pin
     MELAYANG di sudut kanan atas peta; pemberitahuan sesaat (mode
     Perbaiki, progres geocoding, peta cadangan) melayang di sudut
     kiri bawah peta — tidak ada baris teks yang menyisakan celah.
     Kontrol atribusi Leaflet disembunyikan (attributionControl:false +
     CSS) atas permintaan pengguna, jadi pojok peta bersih — KECUALI
     saat gaya Mapbox tampil: atribusinya wajib tampil menurut aturan
     Mapbox dan dinyalakan khusus untuk gaya itu (petaSyncAtribusi). */
  const styleItem=key=>{const st=PETA_STYLES[key];return h('button',{type:'button',class:'peta-style-item'+(PM.style===key?' on':''),'data-style':key,role:'menuitemradio','aria-checked':PM.style===key?'true':'false'},
    h('span',{class:'peta-style-item-main'},h('b',{},st.label),h('small',{},st.desc)),
    h('span',{class:'peta-style-check','aria-hidden':'true'},icon('check',14)))};
  const mapCard=h('section',{class:'peta-map-card'},
    h('div',{id:'peta-map',role:'application','aria-label':'Peta anggota Shikoku Family'}),
    h('div',{class:'peta-map-overlay'},
      h('div',{class:'peta-style-picker'},
        h('button',{type:'button',class:'peta-style-toggle',id:'peta-style-toggle','aria-haspopup':'true','aria-expanded':'false','aria-controls':'peta-style-menu','aria-label':'Pilih gaya peta'},
          icon('map',15),h('span',{id:'peta-style-current'},(PETA_STYLES[PM.style]||PETA_STYLES.jalan).label),icon('chevD',15)),
        h('div',{class:'peta-style-menu',id:'peta-style-menu',role:'menu','aria-label':'Pilihan gaya peta',hidden:'hidden'},...petaDaftarGayaTersedia().map(styleItem))),
      h('span',{class:'peta-count-badge',id:'peta-count'},entries.length+' pin tampil')),
    h('div',{class:'peta-map-notes'},
      h('div',{id:'peta-fix-notice',class:'peta-fix-notice',style:S.petaFixNotice?'display:block':'display:none'},S.petaFixNotice||''),
      h('div',{id:'peta-geo-status',class:'peta-geo-status',style:'display:none'}),
      h('div',{id:'peta-notice',class:'peta-notice',style:'display:none'},'Server peta luar sedang tidak terjangkau, jadi yang tampil adalah ',h('b',{},'peta dasar cadangan lokal'),'. Pencarian, saringan wilayah, dan detail anggota tetap bekerja.')));
  const listPanel=h('section',{class:'peta-list-panel'},
    h('div',{class:'peta-list-head'},
      h('h2',{class:'peta-h2'},'Daftar Anggota')),
    h('label',{class:'peta-search'},icon('search',16),h('input',{id:'peta-search',type:'search',placeholder:'Cari nama anggota…',autocomplete:'off'})),
    h('ul',{class:'peta-member-list',id:'peta-list'}),
    h('div',{class:'peta-empty',id:'peta-empty',style:'display:none'},'Tidak ada anggota yang cocok. Coba kata pencarian lain atau tampilkan semua wilayah.'));
  const detail=h('section',{id:'peta-detail',class:'peta-detail',style:'display:none'});
  const split=h('div',{class:'peta-split'},mapCard,listPanel,detail);
  return [h('div',{class:'peta-fit'},topBar,split)];
}
/* Dipanggil render() sesudah halaman Peta terpasang di DOM: bangun (ulang)
   peta Leaflet dari data terbaru dan pasang semua pengendali halaman.
   Kegagalan di sini tidak boleh menghentikan aplikasi — semua dijaga. */
function initPetaMap(){
  if(S.view!=='peta')return;
  const el=document.getElementById('peta-map');
  if(!el)return;
  try{
    if(PM.tileTimer){clearTimeout(PM.tileTimer);PM.tileTimer=null}
    if(PM.map){try{PM.map.remove()}catch(e){}PM.map=null;PM.layer=null;PM.markers={};PM.tileLayer=null;PM.tileLayers=[];PM.fallbackLayer=null;PM.fallback=false;PM.spiderLayer=null;PM.spider=null;PM.clusters=[];PM.clusterOf={};PM.attribControl=null}
    PM.gen=(PM.gen||0)+1;
    /* Gaya awal = bawaan admin, kecuali pilihan sementara kunjungan ini. */
    if(!PM.sementara||!PETA_STYLES[PM.style]||(PETA_STYLES[PM.style].mapbox&&!petaMapboxToken()))PM.style=petaGayaEfektif();
    const hasilAwal=petaEntries();
    PM.entries=hasilAwal.entries;
    PM.belumList=hasilAwal.belum;
    /* Pemilih gaya peta: satu tombol membuka menu dropdown berisi
       tujuh gaya; memilih butir langsung mengganti gaya dan menutup
       menu. Mengetuk bidang di luar menu (atau Escape) menutupnya —
       tanpa tombol X, sesuai pola aplikasi. Penangan dokumen dipasang
       sekali saja untuk seluruh sesi. */
    petaSyncStyleUI();
    const styleToggle=document.getElementById('peta-style-toggle');
    const styleMenu=document.getElementById('peta-style-menu');
    if(styleToggle&&styleMenu){
      styleToggle.onclick=ev=>{ev.stopPropagation();const buka=!!styleMenu.hidden;styleMenu.hidden=!buka;styleToggle.setAttribute('aria-expanded',buka?'true':'false')};
      styleMenu.onclick=ev=>ev.stopPropagation();
      styleMenu.querySelectorAll('.peta-style-item').forEach(b=>{b.onclick=ev=>{ev.stopPropagation();petaSetStyle(b.getAttribute('data-style'))}});
    }
    if(!PM.menuDocBound){
      PM.menuDocBound=true;
      document.addEventListener('click',()=>petaTutupMenuStyle());
      document.addEventListener('keydown',ev=>{if(ev.key==='Escape')petaTutupMenuStyle()});
    }
    const search=document.getElementById('peta-search');
    if(search){search.value=S.petaSearch||'';search.oninput=()=>{S.petaSearch=search.value.trim();petaRenderMarkers();petaRenderList();petaRenderStats()}}
    /* Tombol bilah bawah (Semua wilayah / Ke Shikoku / Perbaiki
       Posisi Pin) sudah dihapus dari halaman, jadi tidak ada lagi
       pengendali yang dipasang untuk mereka; mode Perbaiki pun
       dimatikan tuntas di vPeta() dan ditegaskan lagi di sini. */
    if(S.petaFixMode)S.petaFixMode=false;
    if(typeof L==='undefined'){
      /* Leaflet dimuat malas: selama berkasnya masih dalam perjalanan,
         wadah peta dibiarkan kosong dengan warna dasar kartunya —
         pesan tidak tampil hanya muncul bila pemuatan benar-benar
         gagal, bukan sebagai keadaan normal kunjungan pertama. */
      petaRefresh();
      petaMuatLeaflet().then(ok=>{
        const el2=document.getElementById('peta-map');
        if(!el2||S.view!=='peta')return;
        if(ok){el2.replaceChildren();initPetaMap()}
        else el2.replaceChildren(h('div',{class:'peta-nomap'},h('b',{},'Peta sedang tidak tampil'),h('span',{},'Daftar anggota, legenda, dan saringan wilayah di bawah tetap bisa dipakai.')));
      });
      return;
    }
    PM.map=L.map(el,{scrollWheelZoom:true,attributionControl:false}).setView([33.9,133.7],window.innerWidth<640?7:8);
    /* Kontrol atribusi ditambahkan manual (tanpa awalan 'Leaflet'):
       isinya mengikuti atribusi lapisan ubin yang sedang tampil, dan
       CSS hanya MENAMPILKANNYA saat gaya Mapbox aktif (class
       'peta-mapbox-on' dari petaSyncAtribusi) — gaya lain tetap
       bersih tanpa atribusi seperti sebelumnya. */
    PM.attribControl=L.control.attribution({prefix:false});
    PM.attribControl.addTo(PM.map);
    PM.layer=L.layerGroup().addTo(PM.map);
    PM.spiderLayer=L.layerGroup().addTo(PM.map);
    PM.map.on('zoomstart',()=>petaSpiderCollapse());
    PM.map.on('movestart',()=>petaSpiderCollapse());
    PM.map.on('zoomend moveend',()=>petaComputeClusters());
    PM.map.on('click',()=>{petaSpiderCollapse();S.petaSelected=null;petaHideDetail();petaRenderMarkers();petaRenderList()});
    PM.chain=petaChain();
    petaTryBasemap(0);
    petaRefresh();
    /* Tata letak satu jendela: tinggi peta lentur mengikuti sisa ruang
       layar, jadi Leaflet perlu diberi tahu ukuran akhirnya sesudah
       tata letak selesai (dan setiap ukuran jendela berubah). */
    setTimeout(()=>{if(PM.map)PM.map.invalidateSize()},90);
    if(!PM.resizeBound){
      PM.resizeBound=true;
      window.addEventListener('resize',()=>{if(PM.map&&S.view==='peta'){try{PM.map.invalidateSize()}catch(e){}}});
    }
    /* Penempatan pin presisi dari alamat lengkap berjalan di latar —
       dijeda selama mode Perbaiki Posisi Pin aktif supaya pin yang
       sedang digeser tidak berpindah sendiri. */
    if(!S.petaFixMode)petaGeocodeEntries(PM.gen);
    if(S.petaSelected){const en=PM.entries.find(x=>x.key===String(S.petaSelected));if(en)petaShowDetail(en)}
  }catch(e){
    console.error('Peta anggota gagal dimulai (halaman lain tidak terpengaruh):',e);
    PM.map=null;
    try{petaRefresh()}catch(e2){console.error(e2)}
  }
}

/* ===== Panel 'Letakkan Pin di Peta' pada formulir anggota =====
   Peta kecil Leaflet di dalam formulir (bagian alamat di Jepang).
   Rantai peta dasar sama seperti halaman peta: Esri Jalan → OSM →
   cadangan lokal SVG. Admin mengetuk peta atau menggeser penanda;
   titik terpilih disimpan sementara di FP.temp / S.formPinTemp dan
   baru masuk ke data formulir lewat tombol 'Pakai Posisi Ini' di
   formulir (tersimpan ke data anggota saat formulir disimpan). */
const FP={map:null,marker:null,temp:null,tileLayer:null,tileOk:0,tileErr:0,tileTimer:null,idx:0,fallbackLayer:null};
function formPinCleanup(){
  if(FP.tileTimer){clearTimeout(FP.tileTimer);FP.tileTimer=null}
  if(FP.map){try{FP.map.remove()}catch(e){}FP.map=null;FP.marker=null;FP.tileLayer=null;FP.fallbackLayer=null;FP.temp=null}
}
function formPinSetCoordsText(){
  const el=document.getElementById('form-pin-coords');if(!el)return;
  if(FP.temp)el.textContent='Pin terpilih di titik ini — tekan "Pakai Posisi Ini" dan alamat dari titik itu terisi otomatis ke field Alamat di Jepang.';
  else el.textContent='Belum ada titik dipilih — ketuk peta untuk meletakkan pin.';
}
function formPinSetMarker(coords){
  if(!FP.map||typeof L==='undefined')return;
  FP.temp=[coords[0],coords[1]];
  S.formPinTemp=FP.temp;
  const icon=L.divIcon({className:'peta-pin-wrap',html:'<div class="peta-pin"><div class="peta-pin-body" style="background:#2b7a8c"></div></div>',iconSize:[30,38],iconAnchor:[15,36]});
  if(FP.marker){FP.marker.setLatLng(FP.temp);FP.marker.setIcon(icon)}
  else{
    FP.marker=L.marker(FP.temp,{icon,draggable:true}).addTo(FP.map);
    FP.marker.on('dragend',()=>{const ll=FP.marker.getLatLng();FP.temp=[ll.lat,ll.lng];S.formPinTemp=FP.temp;formPinSetCoordsText()});
  }
  formPinSetCoordsText();
}
function formPinTryBasemap(idx){
  if(!FP.map||typeof L==='undefined')return;
  FP.idx=idx;FP.tileOk=0;FP.tileErr=0;
  if(FP.tileTimer){clearTimeout(FP.tileTimer);FP.tileTimer=null}
  if(FP.tileLayer){try{FP.map.removeLayer(FP.tileLayer)}catch(e){}FP.tileLayer=null}
  const urutan=[PETA_STYLES.jalan,PETA_STYLES.terang];
  if(idx>=urutan.length){
    if(!FP.fallbackLayer)FP.fallbackLayer=L.imageOverlay('assets/japan-basemap.svg',[[31,129],[45.5,145.5]],{opacity:1,interactive:false}).addTo(FP.map);
    if(FP.marker)FP.marker.bringToFront();
    return;
  }
  const bp=urutan[idx];
  FP.tileLayer=L.tileLayer(bp.url,bp.opts);
  FP.tileLayer.on('tileload',()=>{FP.tileOk++;if(FP.tileTimer){clearTimeout(FP.tileTimer);FP.tileTimer=null}});
  FP.tileLayer.on('tileerror',()=>{FP.tileErr++;const total=FP.tileOk+FP.tileErr;if((FP.tileOk===0&&FP.tileErr>=5)||(total>=8&&FP.tileOk===0))formPinTryBasemap(idx+1)});
  FP.tileLayer.addTo(FP.map);
  FP.tileTimer=setTimeout(()=>{if(FP.tileOk===0)formPinTryBasemap(idx+1)},6000);
}
/* Posisi awal panel formulir: pin manual yang sudah ada → hasil
   geocoding alamat saat ini / kawasan kode pos (cache v3) → Shikoku. */
function formPinTitikAwal(f){
  const manual=pinManualCoords(f);
  if(manual)return {coords:manual,zoom:16};
  try{
    const cache=petaGeoCacheLoad();
    const tersimpan=cache[petaGeoKey(f)];
    if(tersimpan&&tersimpan.c)return {coords:tersimpan.c,zoom:tersimpan.l==='Alamat'?16:13};
  }catch(e){}
  return {coords:[33.9,133.7],zoom:8};
}
function initFormPinMap(){
  const el=document.getElementById('form-pin-map');
  if(!el||!S.form||!S.formPinOpen){
    if(!el)formPinCleanup();
    return;
  }
  try{
    formPinCleanup();
    if(typeof L==='undefined'){
      /* Sama seperti peta utama: wadah dibiarkan kosong selama Leaflet
         dimuat malas; pesan tidak tampil hanya bila pemuatan gagal. */
      petaMuatLeaflet().then(ok=>{
        const el2=document.getElementById('form-pin-map');
        if(!el2||!S.formPinOpen)return;
        if(ok){el2.replaceChildren();initFormPinMap()}
        else el2.replaceChildren(h('div',{class:'peta-nomap'},h('b',{},'Peta sedang tidak tampil'),h('span',{},'Periksa koneksi lalu coba lagi. Posisi pin otomatis dari alamat tetap bekerja.')));
      });
      return;
    }
    const f=S.form;
    const awal=formPinTitikAwal(f);
    /* Titik mulai panel: pilihan sementara sesi ini (bila panel dibuka
       lagi tanpa menyimpan) didahulukan, lalu titik awal terbaik. */
    const mulai=(Array.isArray(S.formPinTemp)&&S.formPinTemp.length===2)?S.formPinTemp:(pinManualCoords(f)||awal.coords);
    FP.map=L.map(el,{scrollWheelZoom:true,attributionControl:false}).setView(awal.coords,awal.zoom);
    formPinTryBasemap(0);
    FP.map.on('click',ev=>{formPinSetMarker([ev.latlng.lat,ev.latlng.lng])});
    const punyaTitik=!!(pinManualCoords(f)||(Array.isArray(S.formPinTemp)&&S.formPinTemp.length===2)||formPinTitikAwal(f).zoom>8);
    if(punyaTitik){formPinSetMarker(mulai);FP.map.setView(mulai,Math.max(awal.zoom,13))}
    else formPinSetCoordsText();
    setTimeout(()=>{if(FP.map)FP.map.invalidateSize()},60);
  }catch(e){
    console.error('Panel letakkan pin gagal dimulai:',e);
  }
}

function sebaran(){const w=wilayah(),k=Object.keys(w);return k.length?k.map(n=>h('div',{class:'card',style:'display:block'},h('div',{class:'row'},h('b',{},icon('pin',16),h('span',{},n.toUpperCase())),h('span',{class:'tag'},w[n].length+' anggota')),h('small',{},w[n].map(x=>(x.nama||'').toUpperCase()).join(', ')))):[h('p',{class:'warn'},'Belum ada data wilayah.')]}
