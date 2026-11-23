/* Pilihan dropdown terkelola: setiap dropdown formulir bisa ditambah dan
   dihapus pilihannya oleh pengguna. Daftar kelola per field disimpan di
   koleksi 'pengaturan' sebagai dokumen 'pilihan_<kunci>' berisi
   {tambah:[], hapus:[]}; pilihan efektif = pilihan bawaan kode + tambah
   − hapus. Pilihan yang sedang dipakai data tersimpan tidak bisa dihapus. */
function bersihDaftarPilihan(v){return Array.isArray(v)?v.filter(x=>typeof x==='string'&&x.trim()).map(x=>x.trim()):[]}
function pilihanDoc(key){const doc=(S.pilihan||{})[key];return {tambah:bersihDaftarPilihan(doc&&doc.tambah),hapus:bersihDaftarPilihan(doc&&doc.hapus)}}
function pilihanEfektif(key,bawaan){
  const doc=pilihanDoc(key);
  const hapusSet=new Set(doc.hapus.map(v=>v.toLowerCase()));
  const seen=new Map();
  [...(bawaan||[]),...doc.tambah].forEach(item=>{
    const label=String(item||'').trim();
    if(!label)return;
    const k=label.toLowerCase();
    if(hapusSet.has(k)||seen.has(k))return;
    seen.set(k,label);
  });
  return [...seen.values()];
}
async function simpanPilihanDoc(key,doc){
  S.pilihan={...(S.pilihan||{}),[key]:{tambah:doc.tambah,hapus:doc.hapus}};
  if(!S.db)return;
  await S.db.collection('pengaturan').doc('pilihan_'+key).set({tambah:doc.tambah,hapus:doc.hapus,at:Date.now()});
}
async function tambahPilihan(key,bawaan,nama){
  const label=String(nama||'').trim();
  if(!label)return;
  const doc=pilihanDoc(key);
  doc.hapus=doc.hapus.filter(v=>v.toLowerCase()!==label.toLowerCase());
  if(!pilihanEfektif(key,bawaan).some(v=>v.toLowerCase()===label.toLowerCase())&&!doc.tambah.some(v=>v.toLowerCase()===label.toLowerCase()))doc.tambah.push(label);
  await simpanPilihanDoc(key,doc);
}
async function hapusPilihan(key,bawaan,nama){
  const label=String(nama||'').trim();
  if(!label)return;
  const doc=pilihanDoc(key);
  doc.tambah=doc.tambah.filter(v=>v.toLowerCase()!==label.toLowerCase());
  if((bawaan||[]).some(v=>String(v).trim().toLowerCase()===label.toLowerCase())&&!doc.hapus.some(v=>v.toLowerCase()===label.toLowerCase()))doc.hapus.push(label);
  await simpanPilihanDoc(key,doc);
}
/* Langganan semua dokumen pilihan_* di koleksi 'pengaturan'. Dokumen lama
   'kategori_belanja' ({items}) tetap dibaca sebagai daftar tambah kategori
   belanja supaya pilihan yang sudah tersimpan tidak hilang. */
function subscribePilihan(){
  if(!S.db)return ()=>{};
  try{
    return S.db.collection('pengaturan').onSnapshot(snap=>{
      const next={};
      let legacy=null;
      (snap.docs||[]).forEach(d=>{
        const data=d&&typeof d.data==='function'?d.data():null;
        if(!data)return;
        if(d.id==='kategori_belanja'&&Array.isArray(data.items))legacy=data.items;
        else if(String(d.id).indexOf('pilihan_')===0){
          next[String(d.id).slice('pilihan_'.length)]={tambah:bersihDaftarPilihan(data.tambah),hapus:bersihDaftarPilihan(data.hapus)};
        }
      });
      if(legacy){
        const cur=next['kategori_belanja']||(next['kategori_belanja']={tambah:[],hapus:[]});
        const hapusSet=new Set(cur.hapus.map(v=>v.toLowerCase()));
        legacy.forEach(item=>{
          const label=String(item||'').trim();
          if(label&&!hapusSet.has(label.toLowerCase())&&!cur.tambah.some(v=>v.toLowerCase()===label.toLowerCase()))cur.tambah.push(label);
        });
      }
      if(JSON.stringify(next)!==JSON.stringify(S.pilihan||{})){
        S.pilihan=next;
        if(S.view==='keuangan'||S.view==='inventaris'||S.view==='landing'||S.view==='kegiatan'||(S.view==='members'&&!S.form))renderDariData();
      }
    },error=>{console.error('Daftar pilihan dropdown gagal dimuat:',error)});
  }catch(error){console.error('Daftar pilihan dropdown gagal dimuat:',error);return ()=>{}}
}
/* Daftar wilayah efektif: konstanta WILAYAH + dokumen 'pilihan_wilayah'.
   Dipakai bersama oleh dropdown formulir, saringan daftar anggota, kartu
   wilayah Home, dan absensi per wilayah. */
const WARNA_WILAYAH_TAMBAHAN=['#4f772d','#2b7a8c','#b5651d','#7d5ba6','#c04b7a','#3a7d8c','#5b8c5a','#946846'];
function wilayahEfektif(){
  const doc=pilihanDoc('wilayah');
  const hapusSet=new Set(doc.hapus.map(v=>v.toLowerCase()));
  const seen=new Set();
  const out=[];
  WILAYAH.forEach(([name,color])=>{
    const k=name.toLowerCase();
    if(hapusSet.has(k)||seen.has(k))return;
    seen.add(k);out.push([name,color]);
  });
  doc.tambah.forEach((raw,i)=>{
    const label=String(raw||'').trim(),k=label.toLowerCase();
    if(!label||seen.has(k))return;
    seen.add(k);out.push([label,WARNA_WILAYAH_TAMBAHAN[i%WARNA_WILAYAH_TAMBAHAN.length]]);
  });
  return out;
}
/* Pilihan bawaan bidang pekerjaan (sebelumnya isian teks bebas) */
const BIDANG_PEKERJAAN_AWAL=['Pertanian','Perikanan','Konstruksi','Manufaktur','Pengolahan Makanan','Perawatan Lansia (Kaigo)','Perhotelan','Restoran','Kebersihan Gedung','Lainnya'];
/* Pembangun select terkelola bersama: di bawah daftar pilihan selalu ada
   '＋ Tambah pilihan baru…' dan '－ Hapus pilihan…'. Panel tambah/hapus
   tampil sebaris di bawah dropdown (tanpa tombol X; tutup lewat tombol
   Batal/Selesai atau memilih pilihan biasa). Nilai tersimpan yang belum
   ada di daftar efektif disisipkan sebagai pilihan tampilan khusus
   formulir ini saja, jadi nilai lama tidak pernah hilang dari formulir. */
function managedSelect(cfg){
  const wrap=h('div',{class:'managed-select'});
  const select=h('select',{});
  const panel=h('div',{class:'managed-panel',style:'display:none'});
  let current=String(cfg.value||'');
  const effective=()=>pilihanEfektif(cfg.key,cfg.bawaan);
  const canonical=v=>effective().find(x=>x.toLowerCase()===String(v||'').trim().toLowerCase())||null;
  function refresh(){
    const opts=effective();
    const kids=[h('option',{value:''},cfg.placeholder||'Pilih')];
    opts.forEach(o=>kids.push(h('option',{value:o},o)));
    const canon=current?canonical(current):null;
    if(current&&!canon)kids.push(h('option',{value:current},current));
    kids.push(h('option',{value:'__tambah__'},'＋ Tambah pilihan baru…'));
    kids.push(h('option',{value:'__hapus__'},'－ Hapus pilihan…'));
    select.replaceChildren(...kids);
    select.value=canon||current||'';
  }
  function hidePanel(){panel.style.display='none';panel.replaceChildren()}
  function showAdd(){
    const input=h('input',{type:'text',placeholder:'Ketik pilihan baru',maxlength:'60'});
    const save=h('button',{type:'button',class:'btn s',onclick:async()=>{
      const nama=input.value.trim();
      if(!nama){alert('Isi pilihan baru terlebih dahulu.');return}
      const ada=canonical(nama);
      if(ada){current=ada;refresh();hidePanel();if(cfg.onChange)cfg.onChange(ada);return}
      save.disabled=true;
      try{
        await tambahPilihan(cfg.key,cfg.bawaan,nama);
        current=nama;refresh();hidePanel();
        if(cfg.onChange)cfg.onChange(nama);
      }catch(e){console.error(e);save.disabled=false;alert('Gagal menyimpan pilihan baru: '+(e.message||'periksa koneksi'))}
    }},'Simpan pilihan');
    panel.replaceChildren(h('div',{class:'managed-add-row'},input,save,h('button',{type:'button',class:'btn s',onclick:hidePanel},'Batal')));
    panel.style.display='';
    input.focus();
  }
  function showDelete(){
    const opts=effective();
    if(!opts.length){panel.replaceChildren(h('p',{class:'warn',style:'margin:0'},'Belum ada pilihan yang bisa dihapus.'));panel.style.display='';return}
    const rows=opts.map(o=>{
      const used=cfg.countUsage?cfg.countUsage(o):0;
      const right=used>0
        ?h('small',{class:'managed-used'},'Dipakai '+used+' data — tidak bisa dihapus')
        :h('button',{type:'button',class:'btn s btn-eh',onclick:async()=>{
            if(!confirm('Hapus pilihan "'+o+'" dari daftar?'))return;
            try{
              await hapusPilihan(cfg.key,cfg.bawaan,o);
              if(current&&current.toLowerCase()===o.toLowerCase()){current='';if(cfg.onChange)cfg.onChange('')}
              refresh();showDelete();
            }catch(e){console.error(e);alert('Gagal menghapus pilihan: '+(e.message||'periksa koneksi'))}
          }},'Hapus');
      return h('div',{class:'managed-del-row'},h('span',{class:'managed-del-name'},o),right);
    });
    panel.replaceChildren(
      h('p',{class:'managed-panel-title'},'Pilihan yang sedang dipakai data tersimpan tidak dapat dihapus.'),
      ...rows,
      h('div',{class:'managed-panel-foot'},h('button',{type:'button',class:'btn s',onclick:hidePanel},'Selesai')));
    panel.style.display='';
  }
  select.onchange=()=>{
    const v=select.value;
    if(v==='__tambah__'){select.value=canonical(current)||current||'';showAdd();return}
    if(v==='__hapus__'){select.value=canonical(current)||current||'';showDelete();return}
    current=v;hidePanel();
    if(cfg.onChange)cfg.onChange(v);
  };
  refresh();
  wrap.replaceChildren(select,panel);
  wrap.getValue=()=>canonical(current)||current||'';
  return wrap;
}
