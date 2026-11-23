/* Inventari Benda SB: inventaris barang milik bersama komunitas yang
   dibeli untuk keperluan bersama. Data tersimpan di koleksi 'inventaris'
   lewat lapisan data yang sama (Supabase app_data / lokal). Semua
   pengguna yang masuk bisa MELIHAT daftar; menambah, mengubah,
   menghapus, dan mengatur peminjaman hanya Pengurus & Admin Utama
   (S.admin). Kategori memakai dropdown terkelola bersama (pilihan.js):
   daftar kelola tersimpan di koleksi 'pengaturan' dokumen
   'pilihan_kategori_barang' ({tambah,hapus}). Foto barang mengikuti
   pola unggah foto nota keuangan (media privat anggota, dengan
   cadangan salinan tertanam). */
const KATEGORI_BARANG_AWAL=['Elektronik','Perabot','Dapur','Kendaraan','Alat Kegiatan','Lainnya'];
const KONDISI_BARANG=['Baik','Rusak ringan','Rusak'];
function kategoriBarang(){return pilihanEfektif('kategori_barang',KATEGORI_BARANG_AWAL)}
function invBolehKelola(){return !!S.admin}
function invStatus(item){return item&&item.status==='dipinjam'?'dipinjam':'tersedia'}
function invKondisi(item){return KONDISI_BARANG.includes(item&&item.kondisi)?item.kondisi:'Baik'}
function invJumlah(item){return Math.max(0,Number(item&&item.jumlah)||0)}
function invNilai(item){return (Number(item&&item.harga)||0)*invJumlah(item)}
function invTanggalLabel(tanggal){
  const date=tanggal?new Date(tanggal+'T00:00:00'):null;
  return date&&!Number.isNaN(date.getTime())?date.toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'}):'—';
}
/* Anggota yang bisa dipilih sebagai peminjam: hanya yang aktif, A–Z. */
function invAnggotaAktif(){
  return [...(S.members||[])]
    .filter(m=>String(m.status||'aktif').toLowerCase()!=='nonaktif')
    .sort((a,b)=>(a.nama||'').localeCompare(b.nama||'','id'));
}
function invBadgeKondisi(item){
  const k=invKondisi(item);
  return h('span',{class:'inv-badge '+(k==='Baik'?'inv-badge-ok':k==='Rusak'?'inv-badge-bad':'inv-badge-warn')},k);
}
function invBadgeStatus(item){
  return invStatus(item)==='dipinjam'
    ?h('span',{class:'inv-badge inv-badge-warn'},'Dipinjam')
    :h('span',{class:'inv-badge inv-badge-ok'},'Tersedia');
}
/* Pemilih peminjam dari daftar anggota. Peminjam tersimpan yang sudah
   tidak aktif tetap ditampilkan sebagai pilihan bertanda, supaya nama
   pada catatan peminjaman tidak hilang dari formulir. */
function invPeminjamSelect(uidTersimpan,namaTersimpan){
  const select=h('select',{'aria-label':'Peminjam'});
  const opsi=[h('option',{value:''},'Pilih anggota')];
  invAnggotaAktif().forEach(m=>{
    const wilayah=memberRegion(m);
    opsi.push(h('option',{value:String(m.id)},(m.nama||'Anggota')+(wilayah?' — '+wilayah:'')));
  });
  select.replaceChildren(...opsi);
  select.value=String(uidTersimpan||'');
  if(uidTersimpan&&select.value!==String(uidTersimpan)){
    select.append(h('option',{value:String(uidTersimpan)},(namaTersimpan||'Anggota')+' (tidak aktif)'));
    select.value=String(uidTersimpan);
  }
  return select;
}
async function upFotoInventaris(file){
  if(!file||!S.inventarisForm)return;
  const targetForm=S.inventarisForm;
  S.inventarisPhotoState={form:targetForm,status:'uploading',message:'Mengunggah foto barang...'};
  render();
  try{
    let id;
    if(S.supabase){
      try{
        id=await uploadPrivateMemberMedia(file);
      }catch(uploadError){
        /* Sama seperti foto nota keuangan: bucket bersama menolak ->
           pakai salinan tertanam yang diperkecil pada catatan ini. */
        console.error('Unggah foto barang ke penyimpanan bersama gagal, memakai salinan tertanam:',uploadError);
        id=await readLocalImageDataUrl(file);
      }
    }else{
      id=await readLocalImageDataUrl(file);
    }
    targetForm.foto=id;
    S.inventarisPhotoState={form:targetForm,status:'success',message:'Foto barang terlampir. Simpan barang untuk menyimpan perubahan.'};
    render();
  }catch(error){
    console.error('Unggah foto barang gagal:',error);
    S.inventarisPhotoState={form:targetForm,status:'error',message:'Gagal mengunggah foto barang: '+(error.message||'coba lagi')};
    render();
  }
}
function inventarisEditor(){
  const form=S.inventarisForm;
  const catSelect=managedSelect({key:'kategori_barang',bawaan:KATEGORI_BARANG_AWAL,value:String(form.kategori||''),placeholder:'Pilih kategori',
    countUsage:value=>(S.inventaris||[]).filter(item=>String(item.kategori||'').trim().toLowerCase()===String(value).trim().toLowerCase()).length});
  const nama=h('input',{placeholder:'Contoh: Speaker aktif portable',maxlength:'120'});
  nama.value=form.nama||'';
  const jumlah=h('input',{type:'number',inputmode:'numeric',min:'1',step:'1',placeholder:'Contoh: 2'});
  jumlah.value=form.jumlah||'';
  const satuan=h('input',{placeholder:'unit / pcs / set',maxlength:'20'});
  satuan.value=form.satuan||'';
  const kondisi=h('select',{},...KONDISI_BARANG.map(k=>h('option',{value:k},k)));
  kondisi.value=invKondisi(form);
  const lokasi=h('input',{placeholder:'Contoh: Gudang sekretariat',maxlength:'120'});
  lokasi.value=form.lokasi||'';
  const tanggalBeli=h('input',{type:'date'});
  tanggalBeli.value=form.tanggal_beli||'';
  const harga=h('input',{type:'number',inputmode:'numeric',min:'0',step:'1',placeholder:'Contoh: 15000'});
  harga.value=form.harga||'';
  const keterangan=h('input',{placeholder:'Keterangan (boleh kosong)',maxlength:'300'});
  keterangan.value=form.keterangan||'';
  /* Status peminjaman ikut diatur dari formulir: memilih 'Dipinjam'
     membuka isian peminjam + tanggal pinjam di bawahnya. */
  const status=h('select',{},h('option',{value:'tersedia'},'Tersedia'),h('option',{value:'dipinjam'},'Dipinjam'));
  status.value=invStatus(form);
  const peminjam=invPeminjamSelect(form.peminjam_uid,form.peminjam_nama);
  const tanggalPinjam=h('input',{type:'date'});
  tanggalPinjam.value=form.tanggal_pinjam||'';
  const pinjamWrap=h('div',{class:'inv-pinjam-fields'},
    h('label',{class:'lb'},'Dipinjam oleh *',peminjam),
    h('label',{class:'lb'},'Tanggal pinjam',tanggalPinjam));
  pinjamWrap.style.display=status.value==='dipinjam'?'':'none';
  status.onchange=()=>{pinjamWrap.style.display=status.value==='dipinjam'?'':'none'};
  const photoState=S.inventarisPhotoState&&S.inventarisPhotoState.form===form?S.inventarisPhotoState:null;
  return box(h('b',{},form.id?'Ubah barang':'Tambah barang'),
    h('label',{class:'lb'},'Nama barang *',nama),
    h('label',{class:'lb'},'Kategori *',catSelect),
    h('div',{class:'inv-form-2col'},
      h('label',{class:'lb'},'Jumlah *',jumlah),
      h('label',{class:'lb'},'Satuan',satuan)),
    h('div',{class:'inv-form-2col'},
      h('label',{class:'lb'},'Kondisi',kondisi),
      h('label',{class:'lb'},'Harga beli (¥)',harga)),
    h('label',{class:'lb'},'Lokasi penyimpanan',lokasi),
    h('label',{class:'lb'},'Tanggal beli',tanggalBeli),
    h('label',{class:'lb'},'Foto barang'),
    form.foto&&h('img',{class:'fin-nota-preview',...memberMediaAttributes(form.foto,'src'),alt:'Foto barang'}),
    photoState&&h('p',{class:'warn '+(photoState.status==='error'?'storage-warning':'')},photoState.message),
    h('div',{class:'fl'},
      pick('Ambil foto','image/*',1,file=>upFotoInventaris(file)),
      pick('Pilih foto','image/*',0,file=>upFotoInventaris(file)),
      form.foto&&h('button',{class:'btn s btn-eh',onclick:()=>{form.foto='';render()}},'Hapus foto')),
    h('label',{class:'lb'},'Status',status),
    pinjamWrap,
    h('label',{class:'lb'},'Keterangan',keterangan),
    h('div',{class:'fl'},
      h('button',{class:'btn',onclick:async()=>{
        const namaBarang=nama.value.trim();
        const kategori=catSelect.getValue().trim();
        const total=parseInt(String(jumlah.value||'').replace(/[^\d]/g,''),10);
        if(!namaBarang){alert('Isi nama barang terlebih dahulu.');return}
        if(!kategori){alert('Pilih atau isi kategori barang terlebih dahulu.');return}
        if(!total||total<=0){alert('Isi jumlah barang (minimal 1).');return}
        if(photoState&&photoState.status==='uploading'){alert('Tunggu sampai unggah foto barang selesai.');return}
        const hargaBeli=parseInt(String(harga.value||'').replace(/[^\d]/g,''),10)||0;
        const statusPinjam=status.value==='dipinjam'?'dipinjam':'tersedia';
        let peminjamUid='',peminjamNama='';
        if(statusPinjam==='dipinjam'){
          peminjamUid=String(peminjam.value||'');
          const anggota=invAnggotaAktif().find(m=>String(m.id)===peminjamUid);
          peminjamNama=anggota?String(anggota.nama||''):String(form.peminjam_nama||'');
          if(!peminjamUid){alert('Pilih anggota peminjam terlebih dahulu.');return}
        }
        const data={
          nama:namaBarang,
          kategori,
          jumlah:total,
          satuan:satuan.value.trim()||'unit',
          kondisi:kondisi.value,
          lokasi:lokasi.value.trim(),
          tanggal_beli:tanggalBeli.value||'',
          harga:hargaBeli,
          foto:form.foto||'',
          keterangan:keterangan.value.trim(),
          status:statusPinjam,
          peminjam_uid:peminjamUid,
          peminjam_nama:peminjamNama,
          tanggal_pinjam:statusPinjam==='dipinjam'?(tanggalPinjam.value||''):'',
          diubah_oleh:S.name||S.email||'Pengurus'
        };
        try{
          if(form.id)await S.db.collection('inventaris').doc(form.id).update(data);
          else await S.db.collection('inventaris').add({...data,at:Date.now(),dicatat_oleh:S.name||S.email||'Pengurus'});
          try{await tambahPilihan('kategori_barang',KATEGORI_BARANG_AWAL,kategori)}catch(error){console.error('Kategori barang gagal disimpan:',error)}
          S.inventarisForm=null;
          S.inventarisPhotoState=null;
          render();
        }catch(error){console.error(error);alert('Gagal menyimpan barang: '+(error.message||'periksa koneksi'))}
      }},form.id?'Simpan perubahan':'Simpan barang'),
      h('button',{class:'btn s',onclick:()=>{S.inventarisForm=null;S.inventarisPhotoState=null;render()}},'Batal')));
}
/* Panel detail barang: dibuka dengan mengetuk kartu barang. Menutup
   dengan mengetuk bidang di luar panel (tanpa tombol X), mengikuti
   aturan aplikasi. Tombol kelola hanya untuk Pengurus & Admin Utama. */
function invDetailOverlay(item){
  const kelola=invBolehKelola();
  const tutup=()=>{S.inventarisDetail=null;S.inventarisPinjam=null;render()};
  const baris=(label,nilai)=>h('div',{class:'inv-detail-row'},h('span',{},label),h('b',{},nilai));
  const anak=[
    item.foto&&h('img',{class:'inv-detail-photo',...memberMediaAttributes(item.foto,'src'),alt:'Foto '+(item.nama||'barang'),onclick:()=>{S.inventarisPhoto=item.foto;render()}}),
    h('b',{class:'inv-detail-name'},item.nama||'Barang'),
    h('div',{class:'inv-badges'},invBadgeStatus(item),invBadgeKondisi(item),h('span',{class:'inv-badge inv-badge-cat'},item.kategori||'Lainnya')),
    baris('Jumlah',invJumlah(item)+' '+(item.satuan||'unit')),
    baris('Lokasi penyimpanan',item.lokasi||'—'),
    baris('Tanggal beli',invTanggalLabel(item.tanggal_beli)),
    baris('Harga beli',formatYen(item.harga)),
    baris('Total nilai beli',formatYen(invNilai(item)))
  ];
  if(invStatus(item)==='dipinjam'){
    anak.push(baris('Dipinjam oleh',item.peminjam_nama||'—'));
    anak.push(baris('Tanggal pinjam',invTanggalLabel(item.tanggal_pinjam)));
  }
  if(item.keterangan)anak.push(baris('Keterangan',item.keterangan));
  if(kelola){
    const aksi=[h('button',{class:'btn s btn-eh',onclick:()=>{S.inventarisForm={...item};S.inventarisPhotoState=null;S.inventarisDetail=null;S.inventarisPinjam=null;render()}},icon('edit',14),h('span',{},'Ubah')),
      h('button',{class:'btn s fin-delete btn-eh',onclick:()=>{S.inventarisConfirm=item;S.inventarisDetail=null;S.inventarisPinjam=null;render()}},'Hapus')];
    if(invStatus(item)==='dipinjam'){
      aksi.push(h('button',{class:'btn s',onclick:async()=>{
        try{
          await S.db.collection('inventaris').doc(item.id).update({status:'tersedia',peminjam_uid:'',peminjam_nama:'',tanggal_pinjam:'',diubah_oleh:S.name||S.email||'Pengurus'});
          S.inventarisDetail=null;
          render();
        }catch(error){console.error(error);alert('Gagal mengembalikan barang: '+(error.message||'periksa koneksi'))}
      }},'Kembalikan'));
    }else if(S.inventarisPinjam===item.id){
      const hariIni=new Date();
      const todayKey=[hariIni.getFullYear(),String(hariIni.getMonth()+1).padStart(2,'0'),String(hariIni.getDate()).padStart(2,'0')].join('-');
      const peminjam=invPeminjamSelect('','');
      const tanggalPinjam=h('input',{type:'date'});
      tanggalPinjam.value=todayKey;
      anak.push(h('div',{class:'inv-pinjam-box'},
        h('label',{class:'lb'},'Dipinjam oleh *',peminjam),
        h('label',{class:'lb'},'Tanggal pinjam',tanggalPinjam),
        h('div',{class:'fl'},
          h('button',{class:'btn',onclick:async()=>{
            const uid=String(peminjam.value||'');
            if(!uid){alert('Pilih anggota peminjam terlebih dahulu.');return}
            const anggota=invAnggotaAktif().find(m=>String(m.id)===uid);
            try{
              await S.db.collection('inventaris').doc(item.id).update({status:'dipinjam',peminjam_uid:uid,peminjam_nama:anggota?String(anggota.nama||''):'',tanggal_pinjam:tanggalPinjam.value||todayKey,diubah_oleh:S.name||S.email||'Pengurus'});
              S.inventarisDetail=null;S.inventarisPinjam=null;
              render();
            }catch(error){console.error(error);alert('Gagal mencatat peminjaman: '+(error.message||'periksa koneksi'))}
          }},'Simpan peminjaman'),
          h('button',{class:'btn s',onclick:()=>{S.inventarisPinjam=null;render()}},'Batal'))));
    }else{
      aksi.push(h('button',{class:'btn s',onclick:()=>{S.inventarisPinjam=item.id;render()}},'Pinjamkan'));
    }
    anak.push(h('div',{class:'fl inv-detail-actions'},...aksi));
  }
  return h('div',{class:'confirm-overlay',onclick:tutup},
    h('div',{class:'card confirm-card inv-detail-card',onclick:ev=>ev.stopPropagation()},...anak));
}
/* Konfirmasi hapus barang: pola dialog aplikasi (confirm-overlay,
   tanpa tombol X — mengetuk bidang di luar kotak atau Batal
   menutupnya), menyebut nama barang yang akan dihapus. */
function invConfirmOverlay(item){
  const tutup=()=>{S.inventarisConfirm=null;render()};
  return h('div',{class:'confirm-overlay',onclick:tutup},
    h('div',{class:'card confirm-card',onclick:ev=>ev.stopPropagation()},
      h('b',{class:'confirm-title'},'Hapus Barang'),
      h('p',{class:'confirm-text'},'Hapus barang "'+(item.nama||'ini')+'" dari Inventari Benda SB? Catatan barang ini hilang dan tidak bisa dikembalikan.'),
      h('div',{class:'fl confirm-actions'},
        h('button',{class:'btn s',onclick:tutup},'Batal'),
        h('button',{class:'btn',onclick:async()=>{
          try{
            await S.db.collection('inventaris').doc(item.id).delete();
            S.inventarisConfirm=null;
            render();
          }catch(error){console.error(error);S.inventarisConfirm=null;alert('Gagal menghapus barang: '+(error.message||'periksa koneksi'))}
        }},'Hapus barang'))));
}
function vInventaris(){
  const kelola=invBolehKelola();
  const all=[...(S.inventaris||[])].sort((a,b)=>(a.nama||'').localeCompare(b.nama||'','id'));
  const totalUnit=all.reduce((n,item)=>n+invJumlah(item),0);
  const totalNilai=all.reduce((n,item)=>n+invNilai(item),0);
  const sedangDipinjam=all.filter(item=>invStatus(item)==='dipinjam').length;
  /* Saringan: pencarian nama mengikuti pola halaman Daftar Anggota —
     hanya daftar di bawahnya yang digambar ulang (draw), bukan seluruh
     halaman, supaya field pencarian tidak kehilangan fokus saat
     mengetik. Saringan dropdown menggambar ulang halaman seperti
     saringan bulan Laporan Keuangan. */
  /* Nilai saringan dibaca dari state pada SETIAP pemanggilan, bukan
     ditangkap sekali: pencarian menggambar ulang daftar lewat
     gambarDaftar() tanpa render penuh, jadi nilai terbaru dari field
     pencarian harus yang dipakai. */
  const cocok=item=>{
    const q=String(S.inventarisSearch||'').trim().toLowerCase();
    const fKat=String(S.inventarisFilterKategori||'');
    const fKon=String(S.inventarisFilterKondisi||'');
    const fStatus=String(S.inventarisFilterStatus||'');
    return (!q||String(item.nama||'').toLowerCase().includes(q)||String(item.lokasi||'').toLowerCase().includes(q))
      &&(!fKat||String(item.kategori||'')===fKat)
      &&(!fKon||invKondisi(item)===fKon)
      &&(!fStatus||invStatus(item)===fStatus);
  };
  const kartu=item=>h('article',{class:'inv-row',onclick:()=>{S.inventarisDetail=item.id;S.inventarisPinjam=null;render()}},
    item.foto
      ?h('img',{class:'inv-thumb',...memberMediaAttributes(item.foto,'src'),alt:'Foto '+(item.nama||'barang')})
      :h('div',{class:'inv-thumb inv-thumb-empty'},icon('box',26)),
    h('div',{class:'inv-info'},
      h('b',{},item.nama||'Barang'),
      h('small',{},(item.kategori||'Lainnya')+' · '+invJumlah(item)+' '+(item.satuan||'unit')+(item.lokasi?' · '+item.lokasi:'')),
      h('div',{class:'inv-badges'},invBadgeKondisi(item),invBadgeStatus(item),
        invStatus(item)==='dipinjam'&&item.peminjam_nama?h('small',{class:'inv-borrower'},'oleh '+item.peminjam_nama):null)),
    h('div',{class:'inv-side'},
      h('b',{class:'inv-amount'},formatYen(invNilai(item))),
      h('small',{},'nilai beli')));
  const listWrap=h('div',{});
  const gambarDaftar=()=>{
    const filtered=all.filter(cocok);
    listWrap.replaceChildren(...(filtered.length
      ?[h('div',{class:'inv-list'},...filtered.map(kartu))]
      :[h('div',{class:'duty-empty'},icon('search',24),h('b',{},'Tidak ada barang yang cocok'),h('p',{},'Coba kata kunci atau saringan yang lain.'))]));
    if(typeof hydrateMemberMedia==='function')hydrateMemberMedia();
  };
  const cari=h('input',{type:'search',placeholder:'Cari nama barang atau lokasi…','aria-label':'Cari barang'});
  cari.value=S.inventarisSearch||'';
  cari.oninput=()=>{S.inventarisSearch=cari.value;gambarDaftar()};
  const kategoriTersedia=[...new Set([...kategoriBarang(),...all.map(item=>String(item.kategori||'').trim()).filter(Boolean)])];
  const selKat=h('select',{'aria-label':'Saring kategori'},h('option',{value:''},'Semua kategori'),...kategoriTersedia.map(k=>h('option',{value:k},k)));
  selKat.value=String(S.inventarisFilterKategori||'');
  selKat.onchange=()=>{S.inventarisFilterKategori=selKat.value;render()};
  const selKon=h('select',{'aria-label':'Saring kondisi'},h('option',{value:''},'Semua kondisi'),...KONDISI_BARANG.map(k=>h('option',{value:k},k)));
  selKon.value=String(S.inventarisFilterKondisi||'');
  selKon.onchange=()=>{S.inventarisFilterKondisi=selKon.value;render()};
  const selStatus=h('select',{'aria-label':'Saring status'},h('option',{value:''},'Semua status'),h('option',{value:'tersedia'},'Tersedia'),h('option',{value:'dipinjam'},'Dipinjam'));
  selStatus.value=String(S.inventarisFilterStatus||'');
  selStatus.onchange=()=>{S.inventarisFilterStatus=selStatus.value;render()};
  gambarDaftar();
  const hasil=[
    h('div',{class:'duty-heading'},h('div',{},h('h1',{},'Inventari Benda SB')),h('span',{class:'duty-count'},all.length+' jenis barang')),
    guard(),
    h('div',{class:'inv-stats'},
      h('div',{class:'inv-stat'},h('small',{},'Jenis Barang'),h('b',{},String(all.length))),
      h('div',{class:'inv-stat'},h('small',{},'Total Unit'),h('b',{},String(totalUnit))),
      h('div',{class:'inv-stat'},h('small',{},'Total Nilai Beli'),h('b',{},formatYen(totalNilai))),
      h('div',{class:'inv-stat'},h('small',{},'Sedang Dipinjam'),h('b',{},String(sedangDipinjam)))),
    h('div',{class:'inv-toolbar'},
      h('div',{class:'inv-search'},icon('search',17),cari),
      kelola&&!S.inventarisForm&&h('button',{class:'btn',onclick:()=>{S.inventarisForm={jumlah:1,satuan:'unit',kondisi:'Baik',status:'tersedia'};S.inventarisPhotoState=null;render()}},'+ Tambah Barang')),
    h('div',{class:'inv-filters'},selKat,selKon,selStatus),
    S.inventarisForm&&kelola&&inventarisEditor(),
    all.length?listWrap:h('div',{class:'duty-empty'},icon('box',24),h('b',{},'Belum ada barang tercatat'),h('p',{},kelola?'Barang milik bersama yang dibeli untuk keperluan komunitas akan tercatat di sini. Tambahkan barang pertama lewat tombol Tambah Barang.':'Barang milik bersama komunitas akan tampil di sini setelah dicatat pengurus.'))
  ];
  const detailItem=S.inventarisDetail?(S.inventaris||[]).find(item=>item.id===S.inventarisDetail):null;
  if(detailItem)hasil.push(invDetailOverlay(detailItem));
  if(S.inventarisConfirm)hasil.push(invConfirmOverlay(S.inventarisConfirm));
  if(S.inventarisPhoto)hasil.push(h('div',{class:'fin-lightbox',onclick:()=>{S.inventarisPhoto=null;render()}},h('img',{...memberMediaAttributes(S.inventarisPhoto,'src'),alt:'Foto barang ukuran besar'})));
  return hasil;
}
