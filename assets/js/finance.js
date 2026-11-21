/* Laporan Keuangan: catatan belanja anggota, foto nota, dan total laporan.
   Data tersimpan di koleksi 'keuangan' lewat lapisan data yang sama
   (Supabase app_data / lokal). Pilihan nama pengeluaran memakai mekanisme
   dropdown terkelola bersama (pilihan.js): daftar kelola tersimpan di
   koleksi 'pengaturan' dokumen 'pilihan_kategori_belanja' ({tambah,hapus}),
   dan dokumen lama 'kategori_belanja' tetap dibaca sebagai daftar tambah. */
const KATEGORI_BELANJA_AWAL=['Sembako','Sayur & Buah','Daging & Ikan','Bumbu Dapur','Minuman','Camilan','Peralatan Dapur','Transportasi','Lainnya'];
function kategoriBelanja(){return pilihanEfektif('kategori_belanja',KATEGORI_BELANJA_AWAL)}
function formatYen(value){return '¥'+(Number(value)||0).toLocaleString('id-ID')}
function financeMonthKey(tanggal){return String(tanggal||'').slice(0,7)}
function financeMonthLabel(key){
  const parts=String(key||'').split('-');
  const date=new Date(Number(parts[0]),Number(parts[1])-1,1);
  return Number.isNaN(date.getTime())?String(key):date.toLocaleDateString('id-ID',{month:'long',year:'numeric'});
}
function financeDateLabel(tanggal){
  const date=tanggal?new Date(tanggal+'T00:00:00'):null;
  return date&&!Number.isNaN(date.getTime())?date.toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'}):'Tanggal belum diatur';
}
function canEditFinance(record){return Boolean(S.admin||String(record.uid||'')===String(S.uid||''))}
async function upNotaFinance(file){
  if(!file||!S.financeForm)return;
  const targetForm=S.financeForm;
  S.financePhotoState={form:targetForm,status:'uploading',message:'Mengunggah foto nota...'};
  render();
  try{
    let id;
    if(S.supabase){
      try{
        id=await uploadPrivateMemberMedia(file);
      }catch(uploadError){
        /* Bucket bersama menolak (mis. akun bukan admin): pakai mekanisme
           lokal yang sama seperti media anggota mode lokal — foto diperkecil
           lalu tertanam pada catatan ini. */
        console.error('Unggah nota ke penyimpanan bersama gagal, memakai salinan tertanam:',uploadError);
        id=await readLocalImageDataUrl(file);
      }
    }else{
      id=await readLocalImageDataUrl(file);
    }
    targetForm.nota=id;
    S.financePhotoState={form:targetForm,status:'success',message:'Foto nota terlampir. Simpan belanja untuk menyimpan perubahan.'};
    render();
  }catch(error){
    console.error('Unggah foto nota gagal:',error);
    S.financePhotoState={form:targetForm,status:'error',message:'Gagal mengunggah foto nota: '+(error.message||'coba lagi')};
    render();
  }
}
function financeEditor(){
  const form=S.financeForm;
  const storedName=String(form.nama_pengeluaran||'');
  const catSelect=managedSelect({key:'kategori_belanja',bawaan:KATEGORI_BELANJA_AWAL,value:storedName,placeholder:'Pilih nama pengeluaran',
    countUsage:value=>(S.keuangan||[]).filter(item=>String(item.nama_pengeluaran||'').trim().toLowerCase()===String(value).trim().toLowerCase()).length});
  const jumlah=h('input',{type:'number',inputmode:'numeric',min:'0',step:'1',placeholder:'Contoh: 3500'});
  jumlah.value=form.jumlah||'';
  const tanggal=h('input',{type:'date'});
  tanggal.value=form.tanggal||'';
  const catatan=h('input',{placeholder:'Catatan (boleh kosong)',maxlength:'200'});
  catatan.value=form.catatan||'';
  const photoState=S.financePhotoState&&S.financePhotoState.form===form?S.financePhotoState:null;
  return box(h('b',{},form.id?'Edit belanja':'Tambah belanja'),
    h('label',{class:'lb'},'Nama pengeluaran *',catSelect),
    h('label',{class:'lb'},'Jumlah (¥) *',jumlah),
    h('label',{class:'lb'},'Tanggal *',tanggal),
    h('label',{class:'lb'},'Foto nota'),
    form.nota&&h('img',{class:'fin-nota-preview',...memberMediaAttributes(form.nota,'src'),alt:'Foto nota'}),
    photoState&&h('p',{class:'warn '+(photoState.status==='error'?'storage-warning':'')},photoState.message),
    h('div',{class:'fl'},
      pick('Ambil foto','image/*',1,file=>upNotaFinance(file)),
      pick('Pilih foto','image/*',0,file=>upNotaFinance(file)),
      form.nota&&h('button',{class:'btn s btn-eh',onclick:()=>{form.nota='';render()}},'Hapus foto')),
    h('label',{class:'lb'},'Catatan',catatan),
    h('div',{class:'fl'},
      h('button',{class:'btn',onclick:async()=>{
        const nama=catSelect.getValue().trim();
        const total=parseInt(String(jumlah.value||'').replace(/[^\d]/g,''),10);
        if(!nama){alert('Pilih atau isi nama pengeluaran terlebih dahulu.');return}
        if(!total||total<=0){alert('Isi jumlah belanja dalam Yen.');return}
        if(!tanggal.value){alert('Isi tanggal belanja.');return}
        if(photoState&&photoState.status==='uploading'){alert('Tunggu sampai unggah foto nota selesai.');return}
        const data={
          nama_pengeluaran:nama,
          jumlah:total,
          tanggal:tanggal.value,
          catatan:catatan.value.trim(),
          nota:form.nota||'',
          uid:form.uid||S.uid,
          nama_user:form.nama_user||S.name||S.email||'Anggota'
        };
        try{
          if(form.id)await S.db.collection('keuangan').doc(form.id).update(data);
          else await S.db.collection('keuangan').add({...data,at:Date.now()});
          try{await tambahPilihan('kategori_belanja',KATEGORI_BELANJA_AWAL,nama)}catch(error){console.error('Kategori belanja gagal disimpan:',error)}
          S.financeForm=null;
          S.financePhotoState=null;
          render();
        }catch(error){console.error(error);alert('Gagal menyimpan belanja: '+(error.message||'periksa koneksi'))}
      }},form.id?'Simpan perubahan':'Simpan belanja'),
      h('button',{class:'btn s',onclick:()=>{S.financeForm=null;S.financePhotoState=null;render()}},'Batal')));
}
function vKeuangan(){
  const today=new Date();
  const todayKey=[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-');
  const thisMonth=todayKey.slice(0,7);
  const all=[...(S.keuangan||[])].sort((a,b)=>String(b.tanggal||'').localeCompare(String(a.tanggal||''))||(b.at||0)-(a.at||0));
  const totalAll=all.reduce((sum,item)=>sum+(Number(item.jumlah)||0),0);
  const totalMonth=all.filter(item=>financeMonthKey(item.tanggal)===thisMonth).reduce((sum,item)=>sum+(Number(item.jumlah)||0),0);
  const monthKeys=[...new Set(all.map(item=>financeMonthKey(item.tanggal)).filter(Boolean))].sort().reverse();
  if(!monthKeys.includes(thisMonth))monthKeys.unshift(thisMonth);
  const selected=S.financeMonth||thisMonth;
  const filtered=selected==='semua'?all:all.filter(item=>financeMonthKey(item.tanggal)===selected);
  const monthSelect=h('select',{class:'fin-month-select','aria-label':'Saring bulan'},
    h('option',{value:'semua'},'Semua bulan'),
    ...monthKeys.map(key=>h('option',{value:key},financeMonthLabel(key))));
  monthSelect.value=selected;
  monthSelect.onchange=()=>{S.financeMonth=monthSelect.value;render()};
  const perUser=new Map();
  filtered.forEach(item=>{
    const key=String(item.uid||item.nama_user||'anggota');
    const current=perUser.get(key)||{nama:item.nama_user||'Anggota',total:0,count:0};
    current.total+=Number(item.jumlah)||0;
    current.count++;
    perUser.set(key,current);
  });
  const summary=[...perUser.values()].sort((a,b)=>b.total-a.total);
  const rows=filtered.map(item=>{
    const editable=canEditFinance(item);
    return h('article',{class:'fin-row'},
      item.nota
        ?h('img',{class:'fin-thumb',...memberMediaAttributes(item.nota,'src'),alt:'Foto nota '+(item.nama_pengeluaran||'belanja'),onclick:()=>{S.financePhoto=item.nota;render()}})
        :h('div',{class:'fin-thumb fin-thumb-empty'},icon('camera',20)),
      h('div',{class:'fin-info'},
        h('b',{},item.nama_pengeluaran||'Belanja'),
        h('small',{},(item.nama_user||'Anggota')+' · '+financeDateLabel(item.tanggal)),
        item.catatan&&h('small',{class:'fin-note'},item.catatan)),
      h('div',{class:'fin-side'},
        h('b',{class:'fin-amount'},formatYen(item.jumlah)),
        editable&&h('div',{class:'fin-actions'},
          h('button',{class:'btn s btn-eh',onclick:()=>{S.financeForm={...item};S.financePhotoState=null;render()}},icon('edit',14),h('span',{},'Edit')),
          h('button',{class:'btn s fin-delete btn-eh',onclick:async()=>{
            if(!confirm('Hapus catatan belanja "'+(item.nama_pengeluaran||'ini')+'" sebesar '+formatYen(item.jumlah)+'?'))return;
            try{await S.db.collection('keuangan').doc(item.id).delete()}catch(error){console.error(error);alert('Gagal menghapus catatan: '+(error.message||'periksa koneksi'))}
          }},'Hapus'))));
  });
  return [
    h('div',{class:'duty-heading'},h('div',{},h('h1',{},'Laporan Keuangan')),h('span',{class:'duty-count'},all.length+' catatan')),
    guard(),
    h('div',{class:'fin-totals'},
      h('div',{class:'fin-total'},h('small',{},'Total Bulan Ini'),h('b',{},formatYen(totalMonth))),
      h('div',{class:'fin-total'},h('small',{},'Total Keseluruhan'),h('b',{},formatYen(totalAll)))),
    h('div',{class:'fin-toolbar'},
      h('label',{class:'fin-filter-label'},'Bulan',monthSelect),
      !S.financeForm&&h('button',{class:'btn',onclick:()=>{S.financeForm={tanggal:todayKey,uid:S.uid,nama_user:S.name||S.email||'Anggota'};S.financePhotoState=null;render()}},'+ Tambah Belanja')),
    S.financeForm&&financeEditor(),
    summary.length?h('section',{class:'card fin-summary',style:'display:block'},
      h('b',{},'Belanja per pengguna'),
      ...summary.map(entry=>h('div',{class:'fin-summary-row'},h('span',{},entry.nama+' · '+entry.count+'x belanja'),h('b',{},formatYen(entry.total))))):null,
    rows.length?h('div',{class:'fin-list'},...rows):h('div',{class:'duty-empty'},icon('wallet',24),h('b',{},'Belum ada catatan belanja'),h('p',{},selected==='semua'?'Catatan belanja anggota akan tampil di sini.':'Belum ada catatan pada '+financeMonthLabel(selected)+'. Pilih "Semua bulan" untuk melihat semua catatan.')),
    S.financePhoto&&h('div',{class:'fin-lightbox',onclick:()=>{S.financePhoto=null;render()}},h('img',{...memberMediaAttributes(S.financePhoto,'src'),alt:'Foto nota ukuran besar'}))
  ];
}
