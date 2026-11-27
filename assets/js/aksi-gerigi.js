/* ===== Tombol GERIGI + panel aksi bersama =====
   Semua aksi sekunder per baris/per item (Ubah, Hapus, Pinjamkan,
   Kembalikan, Simpan per tugas, dan sejenisnya) diringkas menjadi
   SATU tombol ikon gerigi kecil (30px, gaya sama dengan gerigi
   Kepengurusan & kartu Kegiatan) supaya baris/kolom hemat tempat.
   Mengetuk gerigi membuka panel kecil berisi aksi-aksi baris itu
   dengan LABEL TEKS yang jelas (bukan ikon tanpa nama). Panel
   memakai pola aplikasi: lapisan confirm-overlay — mengetuk bidang
   di luar kotak menutupnya, TANPA tombol X. Izin peran tidak berubah:
   gerigi hanya dirender untuk peran yang sebelumnya melihat
   tombol-tombol aksinya.
   Keadaan panel: S.aksiMenu = {jenis, id, dari} — 'jenis' menentukan
   daftar aksinya ('inventaris' | 'keuangan' | 'piket' | 'forum' |
   'akun'), 'id' id baris/itemnya, 'dari' asal panel untuk Inventari
   ('tabel' | 'detail') karena Kembalikan/Pinjamkan dari panel detail
   menutup/menahan panel detail seperti perilaku sebelumnya. */
function aksiGearBtn(label,menu){
  return h('button',{type:'button',class:'aksi-gear-btn',title:'Pengaturan: '+label,'aria-label':'Pengaturan: '+label,'aria-haspopup':'true',
    onclick:ev=>{ev.stopPropagation();S.aksiMenu=menu;render()}},icon('gear',16));
}
function aksiMenuTutup(){S.aksiMenu=null;render()}
/* Bangun lapisan panel dari judul + subjudul + daftar aksi berlabel.
   Mengetuk satu aksi menutup panel lebih dulu (gambar ulang bersih),
   lalu menjalankan aksi aslinya — aksi itu menggambar ulang lagi
   dengan keadaannya sendiri (formulir, dialog konfirmasi, dsb.). */
function aksiMenuLapisan(judul,sub,items){
  if(!items.length)return null;
  return h('div',{class:'confirm-overlay',onclick:aksiMenuTutup},
    h('div',{class:'card confirm-card aksi-menu-card',onclick:ev=>ev.stopPropagation()},
      h('b',{class:'confirm-title'},judul),
      sub?h('p',{class:'confirm-text'},sub):null,
      h('div',{class:'aksi-menu-list'},...items.map(item=>
        h('button',{type:'button',class:'aksi-menu-item'+(item.danger?' aksi-menu-item-danger':''),onclick:ev=>{ev.stopPropagation();S.aksiMenu=null;render();item.aksi()}},icon(item.icon||'gear',16),h('span',{},item.label))))));
}
/* Panel aksi yang sedang terbuka (atau null). Dipanggil di akhir
   tiap halaman yang memakai gerigi bersama ini. */
function aksiMenuAktif(){
  const m=S.aksiMenu;
  if(!m)return null;
  if(m.jenis==='inventaris'){
    const item=(S.inventaris||[]).find(x=>String(x.id)===String(m.id));
    if(!item){S.aksiMenu=null;return null}
    const dariDetail=m.dari==='detail';
    const items=[];
    if(invStatus(item)==='dipinjam'){
      items.push({label:'Kembalikan',icon:'check',aksi:async()=>{
        try{
          await S.db.collection('inventaris').doc(item.id).update({status:'tersedia',peminjam_uid:'',peminjam_nama:'',tanggal_pinjam:'',diubah_oleh:S.name||S.email||'Pengurus'});
          if(dariDetail)S.inventarisDetail=null;
          render();
        }catch(error){console.error(error);alert('Gagal mengembalikan barang: '+(error.message||'periksa koneksi'))}
      }});
    }else{
      items.push({label:'Pinjamkan',icon:'box',aksi:()=>{
        if(dariDetail){S.inventarisPinjam=item.id}
        else{S.inventarisDetail=item.id;S.inventarisPinjam=item.id}
        render();
      }});
    }
    items.push({label:'Ubah',icon:'edit',aksi:()=>{S.inventarisForm={...item};S.inventarisPhotoState=null;S.inventarisDetail=null;S.inventarisPinjam=null;render()}});
    items.push({label:'Hapus',icon:'trash',danger:true,aksi:()=>{S.inventarisConfirm=item;S.inventarisDetail=null;S.inventarisPinjam=null;render()}});
    return aksiMenuLapisan('Pengaturan Barang',item.nama||'Barang',items);
  }
  if(m.jenis==='keuangan'){
    const item=(S.keuangan||[]).find(x=>String(x.id)===String(m.id));
    if(!item){S.aksiMenu=null;return null}
    return aksiMenuLapisan('Pengaturan Belanja',(item.nama_pengeluaran||'Belanja')+' · '+formatYen(item.jumlah),[
      {label:'Edit',icon:'edit',aksi:()=>{S.financeForm={...item};S.financePhotoState=null;render()}},
      {label:'Hapus',icon:'trash',danger:true,aksi:async()=>{
        if(!confirm('Hapus catatan belanja "'+(item.nama_pengeluaran||'ini')+'" sebesar '+formatYen(item.jumlah)+'?'))return;
        try{await S.db.collection('keuangan').doc(item.id).delete()}catch(error){console.error(error);alert('Gagal menghapus catatan: '+(error.message||'periksa koneksi'))}
      }}
    ]);
  }
  if(m.jenis==='piket'){
    const duty=(S.cleaningDuties||[]).find(x=>String(x.id)===String(m.id));
    if(!duty){S.aksiMenu=null;return null}
    const tglLabel=duty.tanggal?new Date(duty.tanggal+'T00:00:00').toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'}):'Tanggal belum diatur';
    return aksiMenuLapisan('Pengaturan Jadwal',tglLabel,[
      {label:'Edit',icon:'edit',aksi:()=>{S.dutyForm={id:duty.id,tanggal:duty.tanggal||'',groups:dutyKelompokTugas(duty).map(g=>({tugas:g.tugas,petugas:g.petugas.length?[...g.petugas]:[''],tugasAsli:g.tugas,petugasTersimpan:[...g.petugas]}))};if(!S.dutyForm.groups.length)S.dutyForm.groups=[{tugas:'',petugas:['']}];S.dutyTaskNotice=null;S.dutyTaskConfirm=null;S.piketTugasMenu=null;render()}},
      {label:'Hapus',icon:'trash',danger:true,aksi:async()=>{
        if(!confirm('Hapus jadwal piket tanggal '+tglLabel+'?'))return;
        try{await S.db.collection('cleaning_duties').doc(duty.id).delete()}catch(error){console.error(error);alert('Gagal menghapus jadwal: '+(error.message||'periksa koneksi'))}
      }}
    ]);
  }
  if(m.jenis==='forum'){
    const topik=(S.topics||[]).find(x=>String(x.id)===String(m.id));
    if(!topik){S.aksiMenu=null;return null}
    return aksiMenuLapisan('Pengaturan Topik',topik.judul||'Topik',[
      {label:'Hapus',icon:'trash',danger:true,aksi:async()=>{
        if(!confirm('Hapus topik ini?'))return;
        try{await S.db.collection('topics').doc(topik.id).delete()}catch(error){console.error(error);alert('Gagal menghapus topik: '+(error.message||'periksa koneksi'))}
      }}
    ]);
  }
  if(m.jenis==='akun'){
    const user=(S.approvedUsers||[]).find(x=>String(x.id)===String(m.id));
    if(!user){S.aksiMenu=null;return null}
    const items=[];
    if(S.mainAdmin&&!user.is_main_admin)items.push({label:'Jadikan Admin Utama',icon:'shield',aksi:()=>{S.approvalDialog={jenis:'utama',user:{id:user.id,name:user.name,email:user.email,is_main_admin:user.is_main_admin}};render()}});
    if(S.mainAdmin&&user.id!==S.uid)items.push({label:'Hapus Akun',icon:'trash',danger:true,aksi:()=>{S.approvalDialog={jenis:'hapus',user:{id:user.id,name:user.name,email:user.email}};render()}});
    return aksiMenuLapisan('Pengaturan Akun',(user.name||'Nama belum diisi')+' · '+(user.email||'-'),items);
  }
  S.aksiMenu=null;
  return null;
}
