/* Daftar anggota, kartu ID, impor teks, formulir anggota */
const PERAN=['Anggota','Pengurus'];
function vMembers(){
  if(S.form)return [memberFormCard()];
  const search=h('input',{type:'search',placeholder:'Cari nama, WhatsApp, kota, wilayah, atau nomor anggota'}),region=h('select',{});
  const regions=wilayahEfektif().map(([name])=>name);
  if(S.members.some(member=>memberRegion(member)==='Belum dipilih'))regions.push('Belum dipilih');
  region.replaceChildren(h('option',{value:''},'Semua wilayah'),...regions.map(value=>h('option',{value},value)));
  search.value=S.memberQuery||'';region.value=S.memberRegion||'';
  const count=h('p',{class:'member-results-count'}),list=h('div',{class:'member-grid'});
  function draw(){
    const query=(S.memberQuery||'').trim().toLowerCase();
    const rows=S.members.filter(member=>
      (!query||[member.nama,member.wa,member.kota,member.wilayah,member.pref,member.kode].some(value=>String(value||'').toLowerCase().includes(query)))&&
      (!S.memberRegion||memberRegion(member)===S.memberRegion)
    ).sort((a,b)=>(a.nama||'').localeCompare(b.nama||'','id'));
    count.textContent='Menampilkan '+rows.length+' dari '+S.members.length+' anggota';
    list.replaceChildren(...(rows.length?rows.map(member=>{
      const code=memberCode(member),area=memberRegion(member),location=[member.kota,member.pref].filter(Boolean).join(', ');
      return h('article',{class:'member-card',style:'--region-color:'+regionColor(area)},
        member.foto?h('img',{class:'member-avatar',...memberMediaAttributes(member.foto,'src'),alt:'Foto '+(member.nama||'anggota')}):h('div',{class:'member-avatar member-avatar-placeholder'},(member.nama||'?').trim().slice(0,1).toUpperCase()),
        h('div',{class:'member-card-info'},h('div',{class:'member-name-line'},h('b',{},(member.nama||'Nama belum diisi').toUpperCase()),h('span',{class:'member-region-tag'},area.toUpperCase())),
          h('small',{},[code,location].filter(Boolean).join(' · ').toUpperCase()),
          h('small',{},member.wa?memberValue('wa',member.wa):member.email||'Kontak belum diisi')),
        h('div',{class:'member-card-actions'},
          h('button',{class:'btn s',onclick:()=>openMember(member,'members')},'Lihat kartu ID'),
          S.admin&&h('button',{class:'btn s btn-eh',onclick:()=>{S.form={...member};S.detail=null;render()}},icon('edit',15),h('span',{},'Edit')),
          S.admin&&h('button',{class:'btn s member-delete btn-eh',onclick:async()=>{
            if(!confirm('Hapus data anggota '+(member.nama||'ini')+'?'))return;
            try{await S.db.collection('members').doc(member.id).delete()}catch(error){console.error(error);alert('Gagal menghapus data anggota: '+(error.message||'periksa koneksi'))}
          }},'Hapus')))
    }):[h('div',{class:'member-empty'},icon(S.members.length?'search':'users',25),h('b',{},S.members.length?'Anggota tidak ditemukan':'Belum ada data anggota'),h('p',{},S.members.length?'Coba kata kunci atau filter wilayah yang lain.':'Data anggota yang ditambahkan akan tampil di sini.'))]));
  }
  search.oninput=()=>{S.memberQuery=search.value;draw()};
  region.onchange=()=>{S.memberRegion=region.value;draw()};
  draw();
  return [
    h('div',{class:'member-page-heading'},h('div',{},h('p',{class:'member-eyebrow'},'KOMUNITAS SHIKOKU FAMILY'),h('h1',{},'Daftar Anggota')),
      S.admin&&h('button',{class:'btn',onclick:()=>{S.form={};S.detail=null;render()}},'+ Tambah Anggota')),
    guard(),
    S.detail&&detailCard(),
    h('div',{class:'member-toolbar'},search,h('div',{class:'member-filters'},region)),
    count,list
  ];
}
/* Umur dihitung dari tanggal lahir setiap kali ditampilkan, jadi bertambah sendiri tepat pada hari ulang tahun */
function memberAge(member){
  const match=String(member?.lahir||'').trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(!match)return null;
  const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]);
  const birth=new Date(year,month-1,day);
  if(birth.getFullYear()!==year||birth.getMonth()!==month-1||birth.getDate()!==day)return null;
  const now=new Date();
  let age=now.getFullYear()-year;
  if(now.getMonth()<month-1||(now.getMonth()===month-1&&now.getDate()<day))age--;
  return age>=0?age:null;
}
function memberCode(member){
  return String(member.kode||'MEM-'+String(member.id||'00000').replace(/\D/g,'').slice(-5).padStart(5,'0'));
}
function memberQrValue(member){
  return String(member?.id||'').trim();
}
function hydrateMemberQrCodes(){
  const images=document.querySelectorAll('#app [data-member-qr]');
  images.forEach(image=>{
    const status=image.parentElement?.querySelector('[data-member-qr-status]');
    if(image.getAttribute('data-qr-ready')==='true')return;
    if(typeof window.qrcode!=='function'){
      if(status)status.textContent='Pembuat QR belum dimuat. Periksa koneksi lalu muat ulang aplikasi.';
      return;
    }
    try{
      const code=window.qrcode(0,'M');
      code.addData(image.getAttribute('data-member-qr'));
      code.make();
      image.src=code.createDataURL(6,4);
      image.setAttribute('data-qr-ready','true');
      if(status)status.textContent='Pindai QR ini untuk membaca ID anggota.';
    }catch(error){
      console.error('Gagal membuat QR anggota:',error);
      if(status)status.textContent='QR gagal dibuat: '+(error.message||'muat ulang aplikasi.');
    }
  });
}
function detailCard(){
  const member=S.detail,area=memberRegion(member),code=memberCode(member),sections=[
    ['Identitas & Keanggotaan',[['Nama lengkap',member.nama],['Nomor HP / WhatsApp',member.wa],['Nomor anggota',code],['Jenis kelamin',member.kelamin],['Tanggal lahir',member.lahir],['Umur',memberAge(member)===null?'-':memberAge(member)+' tahun'],['Peran',member.peran||'Anggota'],['Pernikahan',member.nikah],['MT',member.mt],['Email',member.email],['Instagram',member.instagram],['Facebook',member.facebook]]],
    ['Kontak & Keluarga',[['Nama pengurus daerah',member.pengurus],['Nomor HP pengurus daerah',member.hp_pengurus],['Nama orang tua',member.ortu],['Nomor HP orang tua',member.hp_ortu]]],
    ['Alamat Indonesia',[['Kelompok',member.kelompok],['Desa',member.desa],['Daerah',member.daerah],['Alamat Indonesia',member.alamat_id]]],
    ['Alamat & Pekerjaan di Jepang',[['Kode pos',member.kodepos],['Alamat',member.alamat_jp],['Stasiun',member.stasiun],['Status visa',member.tinggal],['Bidang pekerjaan',member.bidang],['Perusahaan',member.perusahaan]]],
    ['Catatan',[['Catatan',member.catatan]]]
  ];
  const qrValue=memberQrValue(member);
  return h('section',{class:'member-profile-page',style:'--region-color:'+regionColor(area)},
    h('div',{class:'member-profile-toolbar'},h('button',{class:'btn s',onclick:()=>{S.detail=null;const origin=S.detailOrigin;S.detailOrigin=null;S.view=origin==='landing'?'landing':'members';render()}},'← Kembali'),
      S.admin&&h('button',{class:'btn s btn-eh',onclick:()=>{S.form={...member};S.detail=null;S.detailOrigin=null;render()}},icon('edit',15),h('span',{},'Edit data'))),
    h('article',{class:'member-id-card'},
      h('div',{class:'member-id-banner'},h('span',{},'SHIKOKU FAMILY'),h('span',{class:'member-region-tag'},area)),
      h('div',{class:'member-id-main'},
        member.foto?h('img',{class:'member-id-photo',...memberMediaAttributes(member.foto,'src'),alt:'Foto '+(member.nama||'anggota')}):h('div',{class:'member-id-photo member-avatar-placeholder'},(member.nama||'?').trim().slice(0,1).toUpperCase()),
        h('div',{class:'member-id-info'},h('small',{},'KARTU ANGGOTA'),h('h1',{},(member.nama||'Nama belum diisi').toUpperCase()),member.wa&&h('p',{class:'member-id-phone'},icon('phone',14),h('span',{},member.wa)),h('b',{},code.toUpperCase()),h('p',{},[member.kota,member.pref].filter(Boolean).join(' · ').toUpperCase()||area.toUpperCase()))),
      h('div',{class:'member-id-barcode'},h('b',{class:'member-barcode-label'},'QR CODE ABSENSI'),qrValue?h('img',{class:'member-qr-code','data-member-qr':qrValue,alt:'QR code untuk ID anggota'}):h('p',{class:'member-barcode-help'},'ID anggota belum tersedia.'),h('small',{class:'member-barcode-help','data-member-qr-status':'true'},qrValue?'Membuat QR code...':'QR code akan tersedia setelah ID anggota tersimpan.'))),
    ...sections.filter(([,rows])=>rows.some(([,value])=>value)).map(([title,rows])=>h('section',{class:'member-detail-section'},h('h3',{},title.toUpperCase()),h('div',{class:'member-detail-grid'},...rows.filter(([,value])=>value).map(([label,value])=>h('div',{class:'member-detail-item'},h('small',{},label.toUpperCase()),h('span',{},memberValue(label==='Nomor HP / WhatsApp'?'wa':label==='Nomor HP pengurus daerah'?'hp_pengurus':label==='Nomor HP orang tua'?'hp_ortu':label.toLowerCase(),value))))))),
    (member.surat||[]).length>0&&h('section',{class:'member-detail-section'},h('h3',{},'Foto Surat Sambung'),...(member.surat||[]).map((id,index)=>h('a',{class:'member-file-link',...memberMediaAttributes(id,'href'),target:'_blank',rel:'noopener'},icon('attachment',16),h('span',{},'Buka lampiran '+(index+1))))),
    S.admin&&h('div',{class:'member-detail-actions'},h('button',{class:'btn btn-eh',onclick:()=>{S.form={...member};S.detail=null;S.detailOrigin=null;render()}},icon('edit',16),h('span',{},'Edit data anggota')))
  );
}

function normalizeImportLabel(value){return value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}
function cleanMemberValue(value){return String(value||'').replace(/[()（）]/g,'').trim()}
function cleanIndonesiaPlace(value,label){
  const text=cleanMemberValue(value);
  const prefix=new RegExp('^'+label+'(?:\\s*[:：-]\\s*|\\s+)','i');
  return text.replace(prefix,'').trim();
}
function importDate(value){
  const text=String(value||'').trim();
  if(!text)return '';
  const currentYear=new Date().getFullYear();
  const buildIso=(day,month,year)=>{
    day=Number(day);month=Number(month);year=Number(year);
    if(!Number.isInteger(day)||!Number.isInteger(month)||!Number.isInteger(year))return '';
    if(day<1||day>31||month<1||month>12||year<1900||year>currentYear)return '';
    const iso=year+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0');
    const date=new Date(iso+'T00:00:00');
    return date.getFullYear()===year&&date.getMonth()+1===month&&date.getDate()===day?iso:'';
  };
  /* Format ISO: YYYY-MM-DD (boleh di mana pun di dalam nilai) */
  const isoMatch=text.match(/(\d{4})\s*[-/.]\s*(\d{1,2})\s*[-/.]\s*(\d{1,2})/);
  if(isoMatch){
    const year=Number(isoMatch[1]);let month=Number(isoMatch[2]),day=Number(isoMatch[3]);
    if((month<1||month>12)&&day>=1&&day<=12&&month>=1&&month<=31){const swap=day;day=month;month=swap}
    const result=buildIso(day,month,year);
    if(result)return result;
    /* Bila pola ISO ditemukan tapi tidak valid, jangan lanjut menebak format lain */
    if(/^\s*\d{4}\s*[-/.]/.test(text))return '';
  }
  /* Bulan sebagai nama: Indonesia lengkap + singkatan + Inggris */
  const monthNames={januari:1,jan:1,februari:2,feb:2,maret:3,mar:3,april:4,apr:4,mei:5,may:5,juni:6,jun:6,juli:7,jul:7,agustus:8,agu:8,agt:8,aug:8,september:9,sep:9,oktober:10,okt:10,oct:10,november:11,nov:11,desember:12,des:12,dec:12};
  const monthPattern=Object.keys(monthNames).sort((a,b)=>b.length-a.length).join('|');
  const namedMatch=text.match(new RegExp('(\\d{1,2})\\s*[-/. ]?\\s*('+monthPattern+')\\.?\\s*[-/. ,]?\\s*(\\d{4})','i'));
  if(namedMatch){
    const day=Number(namedMatch[1]),month=monthNames[namedMatch[2].toLowerCase()],year=Number(namedMatch[3]);
    return buildIso(day,month,year);
  }
  /* Format angka hari-bulan-tahun, dicari di mana pun di dalam nilai; pemisah -, /, ., atau spasi */
  const numericMatch=text.match(/(\d{1,2})\s*[-/. ]\s*(\d{1,2})\s*[-/. ]\s*(\d{4})/);
  if(numericMatch){
    let day=Number(numericMatch[1]),month=Number(numericMatch[2]);const year=Number(numericMatch[3]);
    if(month<1||month>12){
      /* Angka kedua tidak mungkin jadi bulan: tukar sebagai bulan-tanggal, mis. 04-20-1987 */
      if(day>=1&&day<=12&&month>=1&&month<=31){const swap=day;day=month;month=swap}
      else return '';
    }
    return buildIso(day,month,year);
  }
  return '';
}
function parseMemberPaste(text){
  const aliases=[
    [['nama lengkap'],'nama'],[['jenis kelamin'],'kelamin'],[['tgl bln thn lahir','tanggal lahir','tgl lahir','ttl','tempat tanggal lahir','tempat dan tanggal lahir','tanggal kelahiran','tgl kelahiran','lahir','dob','date of birth'],'lahir'],
    [['kelompok desa daerah di indonesia'],'wilayah_indonesia'],
    [['kelompok'],'kelompok'],[['desa','desa kelurahan'],'desa'],[['daerah'],'daerah'],
    [['no hp pengurus daerah nama','no hp pengurus daerah'],'pengurus_contact'],
    [['status lajang menikah','status lajang menikah cerai'],'nikah'],[['mt iya bukan','mt'],'mt'],
    [['mulai tinggal di jepang'],'mulai_jp'],[['alamat tinggal di jepang'],'alamat_jp'],
    [['status visa'],'tinggal'],[['no hp wa','nomor hp wa'],'wa'],[['facebook'],'facebook'],
    [['no hp orang tua nama','no hp orang tua'],'ortu_contact']
  ];
  const values={};
  let current='';
  text.split(/\r?\n/).forEach(line=>{
    const match=line.match(/^\s*(?:\d+\s*[.)]\s*)?([^:：]+?)\s*[:：]\s*(.*)$/);
    if(match){current=normalizeImportLabel(match[1]);values[current]=cleanMemberValue(match[2])}
    else if(current&&line.trim())values[current]=cleanMemberValue(values[current]+' '+line);
  });
  const data={},recognized=[];
  aliases.forEach(([labels,key])=>{
    const label=Object.keys(values).find(candidate=>labels.includes(candidate));
    if(label&&values[label]){data[key]=values[label];recognized.push(key)}
  });
  if(data.nama)data.nama=data.nama.trim();
  if(data.kelamin){
    const gender=normalizeImportLabel(data.kelamin);
    if(gender.includes('laki laki'))data.kelamin='Laki-laki';
    else if(gender.includes('perempuan'))data.kelamin='Perempuan';
  }
  if(data.lahir){const converted=importDate(data.lahir);if(converted)data.lahir=converted;else delete data.lahir}
  if(data.wilayah_indonesia){
    const [kelompok,desa,daerah]=data.wilayah_indonesia.split(',');
    if(kelompok&&!data.kelompok)data.kelompok=kelompok;
    if(desa&&!data.desa)data.desa=desa;
    if(daerah&&!data.daerah)data.daerah=daerah;
    delete data.wilayah_indonesia;
  }
  for(const key of ['kelompok','desa','daerah'])if(data[key])data[key]=cleanIndonesiaPlace(data[key],key);
  const splitContact=(value,nameKey,phoneKey)=>{
    if(!value)return;
    const matches=[...value.matchAll(/(?:\+|00)?\d[\d\s().-]*\d/g)]
      .filter(match=>match[0].replace(/\D/g,'').length>=7&&match[0].replace(/\D/g,'').length<=15)
      .sort((a,b)=>b[0].replace(/\D/g,'').length-a[0].replace(/\D/g,'').length);
    const phone=matches[0];
    if(!phone){data[nameKey]=cleanMemberValue(value);return}
    data[phoneKey]=phone[0].replace(/[()（）]/g,'').replace(/\s+/g,' ').replace(/^[\s+,:;-]+|[\s+,:;-]+$/g,'').trim();
    const name=value.slice(0,phone.index)+' '+value.slice(phone.index+phone[0].length);
    const cleanedName=cleanMemberValue(name)
      .replace(/^[\s+,:;|\-]+|[\s+,:;|\-]+$/g,'')
      .replace(/^(?:nama|name)\s*[:：-]\s*/i,'')
      .trim();
    if(cleanedName)data[nameKey]=cleanedName;
  };
  splitContact(values[normalizeImportLabel('No. Hp Pengurus Daerah + Nama')], 'pengurus','hp_pengurus');
  if(!data.pengurus&&!data.hp_pengurus)splitContact(data.pengurus_contact,'pengurus','hp_pengurus');
  splitContact(values[normalizeImportLabel('No. HP Orang Tua + Nama')], 'ortu','hp_ortu');
  if(!data.ortu&&!data.hp_ortu)splitContact(data.ortu_contact,'ortu','hp_ortu');
  delete data.pengurus_contact;delete data.ortu_contact;
  if(data.nikah){
    const status=normalizeImportLabel(data.nikah);
    if(status.includes('lajang')||status.includes('belum'))data.nikah='Belum menikah';
    else if(status.includes('menikah'))data.nikah='Menikah';
    else if(status.includes('cerai'))data.nikah='Cerai';
  }
  if(data.mt)data.mt=data.mt.trim();
  if(data.mulai_jp)data.mulai_jp=data.mulai_jp.trim();
  if(data.alamat_jp){
    const address=data.alamat_jp.trim();
    const location=inferJapanLocation(address);
    if(location){data.pref=location.pref;data.wilayah=location.wilayah;if(location.kota)data.kota=location.kota}
    data.alamat_jp=address;
  }
  if(data.tinggal){
    const visa=normalizeImportLabel(data.tinggal);
    if(visa.includes('tokutei ginou')||visa.includes('tokuteginou'))data.tinggal='Specified Skilled Worker (Tokutei Ginou)';
    else if(visa.includes('ginou jisshu')||visa.includes('technical intern'))data.tinggal='Technical Intern (Ginou Jisshu)';
    else if(!TGL.includes(data.tinggal))data.tinggal=data.tinggal.trim();
  }
  return {data,recognized};
}
const KEEP_CASE=['foto','email','instagram','tiktok'];
/* Penghitung pemakaian pilihan pada data anggota (untuk cegah hapus) */
const hitungPemakaianAnggota=field=>value=>S.members.filter(m=>String(m[field]||'').trim().toLowerCase()===String(value||'').trim().toLowerCase()).length;
function fld(l,k,o){o=o||{};const f=S.form;let e;
  if(o.opts&&o.managed){
    const ms=managedSelect({key:o.managed.key,bawaan:o.opts,value:String(f[k]||''),placeholder:o.ph||'Pilih',countUsage:o.managed.countUsage,onChange:v=>{f[k]=v?v.toUpperCase():''}});
    return h('label',{class:'lb'},l,ms);
  }
  if(o.opts)e=h('select',{},h('option',{value:''},o.ph||'Pilih'),...o.opts.map(x=>h('option',{value:x},x)));
  else if(o.area)e=h('textarea',{rows:3,placeholder:o.ph||''});
  else e=h('input',{placeholder:o.ph||'',type:o.type||'text'});
  if(o.opts){
    const option=o.opts.find(value=>value.toUpperCase()===String(f[k]||'').toUpperCase());
    if(f[k]&&!option)e.append(h('option',{value:String(f[k]).toUpperCase()},String(f[k]).toUpperCase()));
    e.value=option||String(f[k]||'').toUpperCase();
    e.onchange=()=>{f[k]=e.value.toUpperCase()};
  }else{
    const keepCase=KEEP_CASE.includes(k),fix=v=>keepCase?v:v.toUpperCase();
    e.value=fix(String(f[k]||''));
    e.oninput=()=>{
      const start=e.selectionStart;
      e.value=fix(e.value);
      f[k]=e.value;
      if(start!==null&&typeof e.setSelectionRange==='function'&&(['text','search','tel','url','password'].includes(e.type)||e.tagName==='TEXTAREA'))e.setSelectionRange(start,start);
    };
  }
  return h('label',{class:'lb'},l,e)}
const box=(...k)=>h('div',{class:'card',style:'display:block'},...k);
function autoFill(txt){
  if(!S.admin)return;
  if(!txt.trim()){alert('Tempel data diri terlebih dahulu.');return}
  const {data,recognized}=parseMemberPaste(txt);
  if(!recognized.length){alert('Data belum dikenali. Pastikan setiap baris memakai format "Nama Kolom : Isi".');return}
  Object.entries(data).forEach(([key,value])=>{if(value!==null&&value!==undefined&&value!=='')S.form[key]=cleanMemberValue(value).toUpperCase()});
  const location=inferJapanLocation(data.alamat_jp,S.form.alamat_jp,data.kota,S.form.kota,data.kec_jp,S.form.kec_jp,data.kodepos,S.form.kodepos,data.pref,S.form.pref,data.wilayah,S.form.wilayah);
  if(location){
    if(!S.form.pref)S.form.pref=location.pref.toUpperCase();
    if(!S.form.wilayah)S.form.wilayah=location.wilayah.toUpperCase();
    if(!S.form.kota&&location.kota)S.form.kota=location.kota.toUpperCase();
  }
  render();
  const invalidDate=recognized.includes('lahir')&&!data.lahir;
  alert('Data berhasil dibaca ('+recognized.length+' kolom). Periksa kembali isian sebelum disimpan.'+
    (invalidDate?' Format tanggal lahir tidak dikenali; isi tanggal lahir secara manual.':'')+
    ((!S.form.pref||!S.form.wilayah)?' Prefektur/wilayah belum dapat dikenali dari alamat. Pilih wilayah di Shikoku atau Okayama dan lengkapi alamat Jepang.':''));
}
async function up(file,key,multi){
  if(!file)return;
  if(!S.admin){alert('Hanya admin yang dapat mengunggah foto dan dokumen anggota.');return}
  if(S.memberUploadState?.form===S.form&&S.memberUploadState.status==='uploading')return;
  const targetForm=S.form;
  S.memberUploadState={form:targetForm,status:'uploading',message:S.supabase?'Mengunggah file ke penyimpanan bersama...':'Menyiapkan file di perangkat ini...'};
  render();
  try{
    const id=S.supabase?await uploadPrivateMemberMedia(file):await readLocalImageDataUrl(file);
    targetForm[key]=multi?[...(targetForm[key]||[]),id]:id;
    S.memberUploadState={form:targetForm,status:'success',message:'File berhasil diunggah. Simpan profil untuk menyimpan perubahan.'};
    render();
  }catch(error){
    console.error('Unggah media anggota gagal:',error);
    const detail=[error.message,error.error_description,error.statusCode,error.code].filter(Boolean).join(' · ');
    const lower=detail.toLowerCase();
    let message=detail||'Kesalahan tidak diketahui';
    if(lower.includes('bucket')&&(lower.includes('not found')||lower.includes('does not exist'))){
      message='Bucket member-files belum tersedia. Jalankan ulang file supabase/schema.sql di Supabase SQL Editor.';
    }else if(lower.includes('row-level security')||lower.includes('unauthorized')||lower.includes('not authorized')||String(error.statusCode)==='403'){
      message='Supabase menolak unggahan. Pastikan akun ini berstatus admin dan kebijakan Storage dari supabase/schema.sql sudah dijalankan.';
    }else if(lower.includes('too large')||lower.includes('payload')||lower.includes('size limit')){
      message='File terlalu besar untuk batas unggah Supabase. Pilih file yang lebih kecil.';
    }
    S.memberUploadState={form:targetForm,status:'error',message:'Gagal mengunggah: '+message};
    render();
  }
}
function pick(label,acc,cap,cb){const i=h('input',{type:'file',accept:acc,style:'display:none'});if(cap)i.setAttribute('capture','environment');i.onchange=()=>cb(i.files[0]);return h('button',{class:'btn s',onclick:()=>i.click()},icon(cap?'camera':'attachment',16),h('span',{},label))}
function dropZone(label,accept,key,multi){
  const zone=h('div',{class:'drop-zone',role:'button',tabindex:0,'aria-label':label});
  const input=h('input',{type:'file',accept,style:'display:none',multiple:multi});
  const body=h('div',{class:'drop-zone-body'},h('b',{},label),h('small',{},'Seret file ke sini, atau klik untuk memilih'));
  const active=flag=>zone.classList.toggle('drop-zone-active',flag);
  const handle=files=>{Array.from(files||[]).forEach(file=>up(file,key,multi));input.value=''};
  zone.ondragover=e=>{e.preventDefault();active(true)};
  zone.ondragleave=()=>active(false);
  zone.ondragend=()=>active(false);
  zone.ondrop=e=>{e.preventDefault();active(false);handle(e.dataTransfer.files)};
  zone.onclick=()=>input.click();
  input.onchange=()=>handle(input.files);
  zone.replaceChildren(body,input);
  return zone;
}
async function saveForm(){
  const f=S.form;
  if(S.memberUploadState?.form===f&&S.memberUploadState.status==='uploading'){alert('Tunggu sampai unggah file selesai sebelum menyimpan profil.');return}
  if(!(f.nama||'').trim()){alert('Nama lengkap wajib diisi.');return}
  const inferredLocation=inferJapanLocation(f.alamat_jp,f.kota,f.kec_jp,f.kodepos,f.pref,f.wilayah);
  if(inferredLocation){
    if(!f.pref)f.pref=inferredLocation.pref;
    if(!f.wilayah)f.wilayah=inferredLocation.wilayah;
    if(!f.kota&&inferredLocation.kota)f.kota=inferredLocation.kota;
  }
  if(!f.pref||!f.wilayah){
    alert('Prefektur dan wilayah belum terisi. Lengkapi alamat Jepang yang mencantumkan prefektur, kota, atau kode pos di Shikoku/Okayama, atau pilih secara manual.');
    return;
  }
  const allowedPref=PREF.find(pref=>pref.toLowerCase()===String(f.pref).trim().toLowerCase());
  const allowedRegion=wilayahEfektif().some(([name])=>name.toLowerCase()===String(f.wilayah).trim().toLowerCase());
  if(!allowedPref||!allowedRegion){
    alert('Data anggota dibatasi untuk prefektur Shikoku dan Okayama. Periksa kembali prefektur dan wilayah.');
    return;
  }
  f.pref=allowedPref;
  const d={...f};delete d.id;Object.keys(d).forEach(key=>{if(typeof d[key]!=='string')return;const v=cleanMemberValue(d[key]);d[key]=key==='email'?v.toLowerCase():KEEP_CASE.includes(key)?v:v.toUpperCase()});d.peran=d.peran||'ANGGOTA';
  try{if(f.id)await S.db.collection('members').doc(f.id).set(d);else await S.db.collection('members').add({...d,at:Date.now()});S.form=null;S.memberUploadState=null;render()}catch(e){console.error(e);alert('Tidak bisa menyimpan: '+(e.message||'periksa koneksi dan izin database'))}}
function memberFormCard(){
  const f=S.form;
  if(!f.id&&!f.kode){
    const n=Math.max(S.members.length,...S.members.map(member=>parseInt(String(member.kode||'').split('-').pop())||0))+1;
    f.kode='IJCCS-'+String(n).padStart(4,'0');
  }
  const years=Array.from({length:12},(_,index)=>String(new Date().getFullYear()-index));
  const fieldGrid=(...fields)=>h('div',{class:'member-form-grid'},...fields);
  const topCard=()=>{
    const text=S.admin?h('textarea',{rows:1,placeholder:'Tempel teks data anggota'}):null;if(text)text.value='';
    return box(h('div',{class:'member-top-card'},
      fld('Wilayah anggota *','wilayah',{opts:WILAYAH.map(([name])=>name),ph:'Pilih wilayah',managed:{key:'wilayah',countUsage:value=>S.members.filter(m=>memberRegion(m)===value).length}}),
      S.admin&&h('div',{class:'member-top-auto'},
        h('span',{class:'member-top-label'},'Isi Otomatis'),
        text,
        h('button',{class:'btn s',onclick:()=>autoFill(text.value)},'Isi Otomatis'))));
  };
  const photoBox=()=>box(h('b',{},'Foto Setengah Badan (terbaru)'),
    f.foto&&h('img',{...memberMediaAttributes(f.foto,'src'),style:'width:88px;height:88px;border-radius:18px;object-fit:cover;display:block;margin:10px 0'}),
    S.memberUploadState?.form===f&&h('p',{class:'warn '+(S.memberUploadState.status==='error'?'storage-warning':'')},S.memberUploadState.message),
    h('div',{class:'fl'},pick('Ambil foto','image/jpeg,image/png,image/webp',1,file=>up(file,'foto')),pick('Pilih foto','image/jpeg,image/png,image/webp',0,file=>up(file,'foto'))),
    dropZone('Ganti foto setengah badan','image/jpeg,image/png,image/webp','foto',0))
  const documentBox=()=>box(h('b',{},'Foto Surat Sambung'),
    ...(f.surat||[]).map((id,index)=>h('div',{class:'member-file-row'},h('a',{...memberMediaAttributes(id,'href'),target:'_blank'},icon('attachment',16),h('span',{},'Lampiran '+(index+1))),h('button',{class:'btn s btn-eh',onclick:()=>{f.surat=f.surat.filter(value=>value!==id);render()}},'Hapus'))),
    h('div',{class:'fl'},pick('Ambil / foto dokumen','image/*,application/pdf',1,file=>up(file,'surat',1)),pick('Pilih dokumen','image/*,application/pdf',0,file=>up(file,'surat',1))),
    dropZone('Tambah foto atau PDF surat sambung','image/*,application/pdf','surat',1));
  return h('div',{class:'member-editor'},
    h('div',{class:'member-editor-heading'},h('button',{class:'btn s',onclick:()=>{S.form=null;render()}},'← Kembali'),
      h('div',{},h('p',{class:'member-eyebrow'},'DATA KOMUNITAS'),h('h1',{},f.id?'Edit data anggota':'Anggota baru'))),
    topCard(),
    box(h('div',{class:'member-section-heading'},h('b',{},'Profil anggota')),
      fieldGrid(fld('Nama lengkap *','nama'),fld('Nomor HP / WhatsApp','wa',{type:'tel'}),fld('Nomor anggota','kode'),fld('Jenis kelamin','kelamin',{opts:['Laki-laki','Perempuan'],ph:'Pilih jenis kelamin',managed:{key:'kelamin',countUsage:hitungPemakaianAnggota('kelamin')}}),fld('Tanggal lahir','lahir',{type:'date'}),fld('Peran','peran',{opts:PERAN}),fld('Status pernikahan','nikah',{opts:['Belum menikah','Menikah','Cerai'],ph:'Pilih status pernikahan',managed:{key:'nikah',countUsage:hitungPemakaianAnggota('nikah')}}),fld('MT','mt'),fld('Bulan kedatangan','bln',{opts:BLN}),fld('Tahun kedatangan','thn',{opts:years}),fld('Mulai tinggal di Jepang','mulai_jp',{ph:'Contoh: 22-09-2026'}),fld('Email','email',{type:'email'}),fld('Instagram','instagram',{ph:'@username'}),fld('Facebook','facebook'))),
    box(h('div',{class:'member-section-heading'},h('b',{},'Kontak & keluarga')),
      fieldGrid(fld('Nama pengurus daerah','pengurus'),fld('Nomor HP pengurus daerah','hp_pengurus',{type:'tel'}),fld('Nama orang tua','ortu'),fld('Nomor HP orang tua','hp_ortu',{type:'tel'}))),
    box(h('div',{class:'member-section-heading'},h('b',{},'Asal di Indonesia')),
      fieldGrid(fld('Kelompok','kelompok',{opts:[],ph:'Pilih kelompok',managed:{key:'kelompok',countUsage:hitungPemakaianAnggota('kelompok')}}),fld('Desa','desa'),fld('Daerah','daerah'),fld('Alamat Indonesia','alamat_id',{area:1}))),
    box(h('div',{class:'member-section-heading'},h('b',{},'Alamat & pekerjaan di Jepang')),
      fieldGrid(fld('Kode pos','kodepos',{inputmode:'numeric'}),fld('Alamat di Jepang','alamat_jp',{area:1}),fld('Stasiun terdekat','stasiun'),fld('Status visa','tinggal',{opts:TGL,ph:'Pilih status visa',managed:{key:'tinggal',countUsage:hitungPemakaianAnggota('tinggal')}}),fld('Bidang pekerjaan','bidang',{opts:BIDANG_PEKERJAAN_AWAL,ph:'Pilih bidang pekerjaan',managed:{key:'bidang',countUsage:hitungPemakaianAnggota('bidang')}}),fld('Nama perusahaan','perusahaan'))),
    photoBox(),documentBox(),
    box(h('div',{class:'member-section-heading'},h('b',{},'Catatan tambahan')),fld('Catatan','catatan',{area:1})),
    h('div',{class:'member-editor-actions'},h('button',{class:'btn s',onclick:()=>{S.form=null;render()}},'Batal'),h('button',{class:'btn',onclick:saveForm},f.id?'Simpan perubahan':'Simpan anggota'))
  );
}

/* ===== Kepengurusan: POHON jabatan yang bisa diatur admin.
   Susunan disimpan sebagai satu dokumen 'susunan_pengurus' di koleksi
   'pengaturan' (pola yang sama dengan pesan sambutan dan daftar pilihan
   dropdown). Format baru (versi 2): {versi:2, simpul:[{id, nama, induk,
   urutan, pemegang}]} — setiap jabatan adalah simpul pohon: 'induk' id
   simpul di atasnya (null untuk jabatan puncak), 'urutan' urutan antar
   saudara, 'pemegang' id anggota dari daftar anggota (boleh kosong).
   Tingkat hierarki dihitung dari kedalaman pohon, bukan kolom terpisah.
   Format lama {pemegang:{kunci:uidAnggota}} dimigrasikan otomatis saat
   dibaca: jabatan bawaan menjadi simpul awal dan semua pemegang yang
   sudah ditetapkan dipertahankan pada jabatan yang sama.
   Hanya admin yang bisa mengubah struktur (mode 'Atur Struktur');
   anggota biasa hanya melihat Bagan dan Tabel seperti sebelumnya. ===== */
function susunanBawaan(pemegangSumber){
  const ambil=id=>(pemegangSumber&&pemegangSumber[id])||'';
  const nodes=[
    {id:'ketua',nama:'Ketua',induk:null,urutan:0,pemegang:ambil('ketua')},
    {id:'wakil-ketua',nama:'Wakil Ketua',induk:'ketua',urutan:0,pemegang:ambil('wakil-ketua')},
    {id:'sekretaris',nama:'Sekretaris',induk:'ketua',urutan:1,pemegang:ambil('sekretaris')},
    {id:'bendahara',nama:'Bendahara',induk:'ketua',urutan:2,pemegang:ambil('bendahara')},
    {id:'koord-wilayah',nama:'Koordinator Wilayah',induk:'ketua',urutan:3,pemegang:ambil('koord-wilayah')}
  ];
  wilayahEfektif().forEach(([name],i)=>{
    const id='koord-'+name;
    nodes.push({id,nama:'Koordinator '+name,induk:'koord-wilayah',urutan:i,pemegang:ambil(id),wilayah:name});
  });
  return nodes;
}
/* Rapikan pohon dari data tersimpan: buang simpul rusak, pastikan tepat
   satu akar (induk null), putus putaran dengan menaikkan simpul ke akar,
   dan nomor ulang urutan antar saudara. Mengembalikan null bila kosong. */
function susunanBersih(raw){
  if(!Array.isArray(raw))return null;
  const nodes=[],seen=new Set();
  raw.forEach(item=>{
    if(!item||typeof item!=='object')return;
    const id=String(item.id||'').trim(),nama=String(item.nama||'').trim();
    if(!id||!nama||seen.has(id))return;
    seen.add(id);
    const node={id,nama,induk:item.induk==null||item.induk===''?null:String(item.induk),urutan:Number.isFinite(Number(item.urutan))?Number(item.urutan):0,pemegang:item.pemegang?String(item.pemegang):''};
    if(item.wilayah)node.wilayah=String(item.wilayah);
    nodes.push(node);
  });
  if(!nodes.length)return null;
  const byId=new Map(nodes.map(n=>[n.id,n]));
  let roots=nodes.filter(n=>n.induk===null||!byId.has(n.induk));
  if(!roots.length){nodes[0].induk=null;roots=[nodes[0]]}
  const root=roots[0];
  roots.slice(1).forEach(n=>{n.induk=root.id});
  nodes.forEach(n=>{
    const visited=new Set([n.id]);let cur=n;
    while(cur.induk!==null){
      const parent=byId.get(cur.induk);
      if(!parent)break;
      if(visited.has(parent.id)){n.induk=root.id;break}
      visited.add(parent.id);cur=parent;
    }
  });
  const groups={};
  nodes.forEach(n=>{const k=n.induk||'';(groups[k]=groups[k]||[]).push(n)});
  Object.values(groups).forEach(list=>{list.sort((a,b)=>a.urutan-b.urutan);list.forEach((n,i)=>{n.urutan=i})});
  return nodes;
}
/* Pohon yang dipakai halaman: hasil langganan bila sudah tiba; sebelum
   itu pohon bawaan dengan pemegang format lama (bila ada). */
function susunanSimpul(){
  if(Array.isArray(S.susunanSimpul)&&S.susunanSimpul.length)return S.susunanSimpul;
  return susunanBawaan(S.susunanPemegang||{});
}
function susunanCari(nodes,id){return nodes.find(n=>n.id===id)||null}
function susunanAkar(nodes){return nodes.find(n=>n.induk===null)||nodes[0]||null}
function susunanAnak(nodes,id){return nodes.filter(n=>n.induk===id).sort((a,b)=>a.urutan-b.urutan)}
function susunanKeturunan(nodes,id){
  const set=new Set([id]);let berubah=true;
  while(berubah){berubah=false;nodes.forEach(n=>{if(n.induk&&set.has(n.induk)&&!set.has(n.id)){set.add(n.id);berubah=true}})}
  return set;
}
function susunanKedalaman(nodes,node){
  let depth=0,cur=node;const guard=new Set();
  while(cur&&cur.induk!==null&&!guard.has(cur.id)){guard.add(cur.id);cur=susunanCari(nodes,cur.induk);depth++}
  return depth;
}
function pemegangJabatan(node){
  return node&&node.pemegang?S.members.find(member=>member.id===node.pemegang)||null:null;
}
async function simpanSusunan(nodes){
  const bersih=susunanBersih(nodes)||[];
  S.susunanSimpul=bersih;
  const map={};bersih.forEach(n=>{if(n.pemegang)map[n.id]=n.pemegang});
  S.susunanPemegang=map;
  if(S.db)await S.db.collection('pengaturan').doc('susunan_pengurus').set({versi:2,simpul:bersih,at:Date.now()});
}
function subscribeSusunan(){
  if(!S.db)return ()=>{};
  try{
    return S.db.collection('pengaturan').onSnapshot(snap=>{
      const doc=(snap.docs||[]).find(d=>d.id==='susunan_pengurus');
      const data=doc&&typeof doc.data==='function'?doc.data():null;
      let next=(data&&Array.isArray(data.simpul))?susunanBersih(data.simpul):null;
      if(!next){
        /* Migrasi format lama {pemegang:{...}}: jabatan bawaan menjadi
           simpul awal, pemegang lama dipertahankan pada jabatannya. */
        const legacy=data&&data.pemegang&&typeof data.pemegang==='object'&&!Array.isArray(data.pemegang)?data.pemegang:{};
        next=susunanBawaan(legacy);
        Object.keys(legacy).forEach(key=>{
          if(key.indexOf('koord-')===0&&key!=='koord-wilayah'&&!next.some(n=>n.id===key)){
            next.push({id:key,nama:'Koordinator '+key.slice(6),induk:'koord-wilayah',urutan:next.filter(n=>n.induk==='koord-wilayah').length,pemegang:legacy[key]||'',wilayah:key.slice(6)});
          }
        });
        next=susunanBersih(next);
      }
      if(JSON.stringify(next)!==JSON.stringify(S.susunanSimpul||null)){
        S.susunanSimpul=next;
        const map={};(next||[]).forEach(n=>{if(n.pemegang)map[n.id]=n.pemegang});
        S.susunanPemegang=map;
        if(S.view==='susunan')render();
      }
    },error=>{console.error('Susunan pengurus gagal dimuat:',error)});
  }catch(error){console.error('Susunan pengurus gagal dimuat:',error);return ()=>{}}
}
/* ===== Aksi perubahan struktur (semua lewat simpanSusunan) ===== */
async function tetapkanPengurus(id,memberId){
  await simpanSusunan(susunanSimpul().map(n=>n.id===id?{...n,pemegang:memberId||''}:n));
}
async function gantiNamaJabatan(id,nama){
  await simpanSusunan(susunanSimpul().map(n=>n.id===id?{...n,nama}:n));
}
async function tambahJabatanBaru(nama,indukId,memberId){
  const nodes=susunanSimpul().slice();
  const id='jab-'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
  nodes.push({id,nama,induk:indukId,urutan:nodes.filter(n=>n.induk===indukId).length,pemegang:memberId||''});
  await simpanSusunan(nodes);
}
/* Hapus jabatan: anak-anaknya NAIK ke induk jabatan yang dihapus (tidak
   ikut terhapus), disisipkan pada posisi jabatan itu di antara saudara;
   pemegang jabatan yang dihapus menjadi tidak menjabat. */
async function hapusJabatan(id){
  const nodes=susunanSimpul().map(n=>({...n}));
  const target=nodes.find(n=>n.id===id);
  if(!target||target.induk===null)return;
  const parentId=target.induk;
  const anak=nodes.filter(n=>n.induk===id).sort((a,b)=>a.urutan-b.urutan);
  anak.forEach(n=>{n.induk=parentId});
  const rest=nodes.filter(n=>n.id!==id);
  const saudara=rest.filter(n=>n.induk===parentId&&!anak.includes(n)).sort((a,b)=>a.urutan-b.urutan);
  const pos=Math.min(target.urutan,saudara.length);
  [...saudara.slice(0,pos),...anak,...saudara.slice(pos)].forEach((n,i)=>{n.urutan=i});
  await simpanSusunan(rest);
}
async function geserUrutanJabatan(id,arah){
  const nodes=susunanSimpul().map(n=>({...n}));
  const node=nodes.find(n=>n.id===id);
  if(!node)return;
  const sib=nodes.filter(n=>n.induk===node.induk).sort((a,b)=>a.urutan-b.urutan);
  const i=sib.findIndex(n=>n.id===id),j=i+arah;
  if(i<0||j<0||j>=sib.length)return;
  const tmp=sib[i].urutan;sib[i].urutan=sib[j].urutan;sib[j].urutan=tmp;
  await simpanSusunan(nodes);
}
/* Pindah induk. Ditolak (false) bila tujuannya diri sendiri/keturunan,
   induk tidak ada, atau simpulnya akar. Memindah ke jabatan puncak sama
   dengan menjadi anak langsung akar. */
async function pindahIndukJabatan(id,indukBaru){
  const nodes=susunanSimpul().map(n=>({...n}));
  const node=nodes.find(n=>n.id===id);
  if(!node||node.induk===null)return false;
  if(!indukBaru||indukBaru===id||!nodes.some(n=>n.id===indukBaru))return false;
  if(susunanKeturunan(nodes,id).has(indukBaru))return false;
  if(node.induk===indukBaru)return true;
  node.induk=indukBaru;
  node.urutan=Number.MAX_SAFE_INTEGER;
  await simpanSusunan(nodes);
  return true;
}
/* Hasil seret di Bagan: 'before'/'after' menyusun ulang antar saudara
   target, 'child' menjadikan jabatan anak dari target (paling bawah). */
async function seretJabatan(id,targetId,mode){
  const nodes=susunanSimpul().map(n=>({...n}));
  const node=nodes.find(n=>n.id===id),target=nodes.find(n=>n.id===targetId);
  if(!node||!target||node.induk===null)return false;
  if(susunanKeturunan(nodes,id).has(targetId))return false;
  if(mode==='child'){
    if(node.induk===targetId)return true;
    node.induk=targetId;node.urutan=Number.MAX_SAFE_INTEGER;
  }else{
    const parentId=target.induk;
    const sib=nodes.filter(n=>n.induk===parentId&&n.id!==id).sort((a,b)=>a.urutan-b.urutan);
    const ti=sib.findIndex(n=>n.id===targetId);
    if(ti<0)return false;
    node.induk=parentId;
    sib.splice(mode==='before'?ti:ti+1,0,node);
    sib.forEach((n,i)=>{n.urutan=i});
  }
  await simpanSusunan(nodes);
  return true;
}
async function kembalikanSusunanAwal(){
  const current={};
  susunanSimpul().forEach(n=>{if(n.pemegang)current[n.id]=n.pemegang});
  await simpanSusunan(susunanBawaan(current));
}
/* ===== Panel-panel penyuntingan (tanpa tombol X: tutup lewat
   Simpan/Batal; satu panel tampil pada satu waktu di atas halaman) ===== */
function bukaPanelSusunan(jenis,id){S.susunanPanel={jenis,id:id||null};render();window.scrollTo({top:0,behavior:'smooth'})}
function tutupPanelSusunan(){S.susunanPanel=null;render()}
function susunanPilihAnggota(currentId){
  const sel=h('select',{});
  sel.replaceChildren(
    h('option',{value:''},'— Belum ditetapkan —'),
    ...[...S.members].sort((a,b)=>(a.nama||'').localeCompare(b.nama||'','id'))
      .map(member=>h('option',{value:member.id},(member.nama||'Tanpa nama')+' · '+memberRegion(member)))
  );
  sel.value=currentId||'';
  return sel;
}
/* Pemilih induk: semua jabatan dalam urutan pohon, menjorok menurut
   kedalaman. Simpul dalam 'excludeSet' (diri + keturunan) tidak
   ditawarkan supaya putaran hierarki tidak mungkin terjadi. */
function susunanPilihInduk(nodes,currentId,excludeSet){
  const sel=h('select',{});
  const opts=[];
  const walk=(node,depth)=>{
    if(excludeSet&&excludeSet.has(node.id))return;
    opts.push(h('option',{value:node.id},'  '.repeat(depth)+node.nama+(depth===0?' (puncak)':'')));
    susunanAnak(nodes,node.id).forEach(k=>walk(k,depth+1));
  };
  const root=susunanAkar(nodes);
  if(root)walk(root,0);
  sel.replaceChildren(...opts);
  if(currentId&&[...sel.options].some(o=>o.value===currentId))sel.value=currentId;
  return sel;
}
function susunanPanelRender(nodes){
  const panel=S.susunanPanel;
  if(!panel)return null;
  if(panel.jenis==='tambah')return susunanPanelTambah(nodes);
  const node=susunanCari(nodes,panel.id);
  if(!node)return null;
  if(panel.jenis==='nama')return susunanPanelNama(node);
  if(panel.jenis==='geser')return susunanPanelGeser(nodes,node);
  return susunanPanelPemegang(node);
}
function susunanPanelPemegang(node){
  const current=pemegangJabatan(node);
  const sel=susunanPilihAnggota(current?current.id:'');
  return box(h('b',{},'Tetapkan pengurus — '+node.nama),
    h('p',{class:'sub'},'Pilih pemegang jabatan dari daftar anggota. Kosongkan bila jabatan belum ada pemegangnya.'),
    sel,
    h('div',{class:'fl'},
      h('button',{class:'btn',onclick:async()=>{
        try{await tetapkanPengurus(node.id,sel.value||'');tutupPanelSusunan()}
        catch(error){console.error(error);alert('Gagal menyimpan penetapan: '+(error.message||'periksa koneksi'))}
      }},'Simpan'),
      h('button',{class:'btn s',onclick:tutupPanelSusunan},'Batal')));
}
function susunanPanelNama(node){
  const input=h('input',{type:'text',value:node.nama,maxlength:'60',placeholder:'Nama jabatan'});
  return box(h('b',{},'Ganti nama jabatan'),
    h('p',{class:'sub'},'Nama jabatan "'+node.nama+'" diganti menjadi:'),
    input,
    h('div',{class:'fl'},
      h('button',{class:'btn',onclick:async()=>{
        const nama=input.value.trim();
        if(!nama){alert('Nama jabatan tidak boleh kosong.');return}
        try{await gantiNamaJabatan(node.id,nama);tutupPanelSusunan()}
        catch(error){console.error(error);alert('Gagal mengganti nama jabatan: '+(error.message||'periksa koneksi'))}
      }},'Simpan'),
      h('button',{class:'btn s',onclick:tutupPanelSusunan},'Batal')));
}
/* Panel Geser: andalan di HP — Naik/Turun untuk urutan antar saudara dan
   pemilih induk baru. Panel tetap terbuka sesudah tiap gerakan supaya
   admin bisa menggeser beberapa kali berturut-turut. */
function susunanPanelGeser(nodes,node){
  if(node.induk===null){
    return box(h('b',{},'Geser posisi — '+node.nama),
      h('p',{class:'sub'},'Ini jabatan puncak: posisinya tetap di paling atas dan tidak dapat dipindah atau dihapus. Jabatan lain bisa dipindahkan ke bawah jabatan ini (menjadi anak langsung puncak).'),
      h('div',{class:'fl'},h('button',{class:'btn s',onclick:tutupPanelSusunan},'Tutup')));
  }
  const sib=susunanAnak(nodes,node.induk);
  const idx=sib.findIndex(n=>n.id===node.id);
  const naik=h('button',{class:'btn s',onclick:async()=>{
    try{await geserUrutanJabatan(node.id,-1);render()}
    catch(error){console.error(error);alert('Gagal menggeser urutan: '+(error.message||'periksa koneksi'))}
  }},'↑ Naik');
  const turun=h('button',{class:'btn s',onclick:async()=>{
    try{await geserUrutanJabatan(node.id,1);render()}
    catch(error){console.error(error);alert('Gagal menggeser urutan: '+(error.message||'periksa koneksi'))}
  }},'↓ Turun');
  if(idx<=0)naik.disabled=true;
  if(idx<0||idx>=sib.length-1)turun.disabled=true;
  const selInduk=susunanPilihInduk(nodes,node.induk,susunanKeturunan(nodes,node.id));
  return box(h('b',{},'Geser posisi — '+node.nama),
    h('p',{class:'sub'},'Urutan di antara jabatan setingkat di bawah "'+(susunanCari(nodes,node.induk)||{}).nama+'": posisi '+(idx+1)+' dari '+sib.length+'.'),
    h('div',{class:'fl'},naik,turun),
    h('p',{class:'sub',style:'margin-top:14px'},'Pindahkan ke bawah jabatan lain (jabatan ini beserta seluruh jabatan di bawahnya ikut pindah; tidak bisa dipindah ke bawah dirinya atau keturunannya):'),
    selInduk,
    h('div',{class:'fl'},
      h('button',{class:'btn',onclick:async()=>{
        if(selInduk.value===node.induk){alert('Jabatan ini sudah berada di bawah jabatan tersebut.');return}
        try{
          const ok=await pindahIndukJabatan(node.id,selInduk.value);
          if(!ok){alert('Jabatan tidak dapat dipindah ke bawah dirinya sendiri atau keturunannya.');return}
          render();
        }catch(error){console.error(error);alert('Gagal memindah jabatan: '+(error.message||'periksa koneksi'))}
      }},'Pindahkan'),
      h('button',{class:'btn s',onclick:tutupPanelSusunan},'Selesai')));
}
function susunanPanelTambah(nodes){
  const root=susunanAkar(nodes);
  const input=h('input',{type:'text',maxlength:'60',placeholder:'Nama jabatan baru'});
  const selInduk=susunanPilihInduk(nodes,root?root.id:'',null);
  const selPemegang=susunanPilihAnggota('');
  return box(h('b',{},'Tambah jabatan baru'),
    h('p',{class:'sub'},'Nama jabatan:'),input,
    h('p',{class:'sub',style:'margin-top:10px'},'Berada di bawah jabatan:'),selInduk,
    h('p',{class:'sub',style:'margin-top:10px'},'Pemegang jabatan (boleh dikosongkan dulu):'),selPemegang,
    h('div',{class:'fl'},
      h('button',{class:'btn',onclick:async()=>{
        const nama=input.value.trim();
        if(!nama){alert('Isi nama jabatan baru terlebih dahulu.');return}
        if(!selInduk.value){alert('Pilih jabatan induk terlebih dahulu.');return}
        try{await tambahJabatanBaru(nama,selInduk.value,selPemegang.value||'');tutupPanelSusunan()}
        catch(error){console.error(error);alert('Gagal menambah jabatan: '+(error.message||'periksa koneksi'))}
      }},'Simpan'),
      h('button',{class:'btn s',onclick:tutupPanelSusunan},'Batal')));
}
/* ===== Alat mode atur pada kartu/baris jabatan ===== */
function orgTombolHapus(nodes,node){
  return h('button',{class:'btn s btn-eh',onclick:async()=>{
    const anak=susunanAnak(nodes,node.id);
    const pesan='Hapus jabatan "'+node.nama+'"?'+(anak.length?' '+anak.length+' jabatan di bawahnya akan naik ke jabatan di atasnya ("'+(susunanCari(nodes,node.induk)||{}).nama+'").':'')+' Pemegangnya menjadi tidak menjabat.';
    if(!confirm(pesan))return;
    try{
      await hapusJabatan(node.id);
      if(S.susunanPanel&&S.susunanPanel.id===node.id)S.susunanPanel=null;
      render();
    }catch(error){console.error(error);alert('Gagal menghapus jabatan: '+(error.message||'periksa koneksi'))}
  }},'Hapus');
}
function orgAlat(nodes,node){
  const isRoot=node.induk===null;
  return h('div',{class:'org-tools'},
    h('button',{class:'btn s',onclick:()=>bukaPanelSusunan('nama',node.id)},'Nama'),
    h('button',{class:'btn s',onclick:()=>bukaPanelSusunan('pemegang',node.id)},pemegangJabatan(node)?'Pemegang':'Tetapkan'),
    !isRoot&&h('button',{class:'btn s',onclick:()=>bukaPanelSusunan('geser',node.id)},'Geser'),
    !isRoot&&orgTombolHapus(nodes,node));
}
/* ===== Seret jabatan di Bagan (khusus mode atur, desktop & sentuh).
   Seret dimulai dari pegangan pada kartu — bukan seluruh kartu — supaya
   gulir halaman di HP tidak terganggu. Lepas di atas saudara menyusun
   ulang urutan; lepas di atas jabatan lain menjadikannya anak jabatan
   itu. Target yang sah berbingkai teal, yang terlarang (diri sendiri /
   keturunan) berbingkai merah. ===== */
function mulaiSeretSusunan(event,node){
  const wrap=event.currentTarget.closest('.org-node');
  const main=wrap&&wrap.querySelector('.org-node-main');
  if(!main)return;
  event.preventDefault();
  const nodes=susunanSimpul();
  const keturunan=susunanKeturunan(nodes,node.id);
  const rect=main.getBoundingClientRect();
  const ghost=main.cloneNode(true);
  ghost.classList.add('org-ghost');
  ghost.style.width=rect.width+'px';
  ghost.style.left=rect.left+'px';
  ghost.style.top=rect.top+'px';
  document.body.appendChild(ghost);
  wrap.classList.add('org-dragging');
  let targetEl=null,targetId=null,targetMode=null;
  const clearTarget=()=>{if(targetEl)targetEl.classList.remove('org-drop-ok','org-drop-bad');targetEl=null;targetId=null;targetMode=null};
  const onMove=ev=>{
    ghost.style.left=(ev.clientX-rect.width/2)+'px';
    ghost.style.top=(ev.clientY-28)+'px';
    ghost.style.display='none';
    const under=document.elementFromPoint(ev.clientX,ev.clientY);
    ghost.style.display='';
    const host=under&&under.closest?under.closest('[data-susunan-id]'):null;
    clearTarget();
    if(!host)return;
    const tmain=host.querySelector('.org-node-main');
    if(!tmain)return;
    const tid=host.getAttribute('data-susunan-id');
    const targetNode=susunanCari(nodes,tid);
    if(!targetNode)return;
    const terlarang=tid===node.id||keturunan.has(tid);
    const menyamping=window.innerWidth>720;
    const sesudah=menyamping?(ev.clientX>tmain.getBoundingClientRect().left+tmain.getBoundingClientRect().width/2):(ev.clientY>tmain.getBoundingClientRect().top+tmain.getBoundingClientRect().height/2);
    targetMode=targetNode.induk===node.induk?(sesudah?'after':'before'):'child';
    targetEl=tmain;
    tmain.classList.add(terlarang?'org-drop-bad':'org-drop-ok');
    if(!terlarang)targetId=tid;
  };
  const onUp=async()=>{
    window.removeEventListener('pointermove',onMove);
    window.removeEventListener('pointerup',onUp);
    window.removeEventListener('pointercancel',onUp);
    ghost.remove();
    wrap.classList.remove('org-dragging');
    const tid=targetId,mode=targetMode;
    clearTarget();
    if(tid&&mode){
      try{await seretJabatan(node.id,tid,mode);render()}
      catch(error){console.error(error);alert('Gagal memindah jabatan: '+(error.message||'periksa koneksi'))}
    }
  };
  window.addEventListener('pointermove',onMove);
  window.addEventListener('pointerup',onUp);
  window.addEventListener('pointercancel',onUp);
}
/* Satu simpul bagan (rekursif): kartu jabatan + foto/nama pemegang dari
   data anggota; anak-anaknya digambar sebagai baris berkonektor di
   bawahnya. Ketuk kartu membuka kartu ID anggota. */
function orgNode(nodes,node,root){
  const atur=!!(S.admin&&S.susunanAtur);
  const member=pemegangJabatan(node);
  const area=member?memberRegion(member):'';
  const avatar=member
    ?(member.foto?h('img',{class:'org-avatar',...memberMediaAttributes(member.foto,'src'),alt:'Foto '+(member.nama||'pengurus')}):h('div',{class:'org-avatar org-avatar-ph'},(member.nama||'?').trim().slice(0,1).toUpperCase()))
    :h('div',{class:'org-avatar org-avatar-ph'},icon('team',22));
  const isi=[
    h('span',{class:'org-node-role'},node.nama),
    avatar,
    h('b',{class:'org-node-name'},member?(member.nama||'Nama belum diisi'):'Belum ditetapkan'),
    member?h('span',{class:'member-region-tag',style:'--region-color:'+regionColor(area)},area.toUpperCase()):null
  ];
  const main=member
    ?h('button',{class:'org-node-main',title:'Lihat kartu ID '+(member.nama||''),onclick:()=>openMember(member,'members')},...isi)
    :h('div',{class:'org-node-main org-node-empty'},...isi);
  const parts=[];
  if(atur&&node.induk!==null){
    const grip=h('div',{class:'org-grip',title:'Seret untuk memindah posisi jabatan ini','aria-label':'Seret untuk memindah '+node.nama},'⠿');
    grip.onpointerdown=ev=>mulaiSeretSusunan(ev,node);
    parts.push(grip);
  }
  parts.push(main);
  if(atur)parts.push(orgAlat(nodes,node));
  else if(S.admin)parts.push(h('button',{class:'btn s',onclick:()=>bukaPanelSusunan('pemegang',node.id)},member?'Atur':'Tetapkan'));
  const el=h('div',{class:'org-node'+(root?' org-node-root':''),'data-susunan-id':node.id},...parts);
  const kids=susunanAnak(nodes,node.id);
  if(kids.length)el.append(h('ul',{class:'org-kids'},...kids.map(k=>h('li',{},orgNode(nodes,k,false)))));
  return el;
}
/* Tipe HIERARKI: pohon digambar dari akar dengan garis penghubung;
   di HP baris anak menumpuk ke bawah tanpa geser menyamping. */
function orgBagan(nodes){
  const root=susunanAkar(nodes);
  if(!root)return h('p',{class:'warn'},'Susunan kepengurusan belum tersedia.');
  return h('div',{class:'org-tree'},orgNode(nodes,root,true));
}
/* Tipe TABEL: satu baris per jabatan, berkelompok mengikuti cabang
   pohon — kelompok pertama berisi jabatan puncak beserta anak-anaknya,
   lalu satu kelompok per cabang yang mempunyai anak. */
function orgRow(nodes,node){
  const atur=!!(S.admin&&S.susunanAtur);
  const member=pemegangJabatan(node);
  const person=member
    ?h('button',{class:'org-person',title:'Lihat kartu ID '+(member.nama||''),onclick:()=>openMember(member,'members')},
        member.foto?h('img',{class:'org-mini',...memberMediaAttributes(member.foto,'src'),alt:'Foto '+(member.nama||'pengurus')}):h('span',{class:'org-mini org-avatar-ph'},(member.nama||'?').trim().slice(0,1).toUpperCase()),
        h('span',{},member.nama||'Nama belum diisi'))
    :h('span',{class:'org-empty-text'},'Belum ditetapkan');
  const depth=susunanKedalaman(nodes,node);
  return h('div',{class:'org-row'},
    h('div',{class:'org-c-jabatan'},h('b',{style:'margin-left:'+(depth*14)+'px'},node.nama)),
    h('div',{class:'org-c-orang'},person),
    h('div',{class:'org-c-wilayah'},member?memberRegion(member):(node.wilayah||'—')),
    h('div',{class:'org-c-kontak'},member?(member.wa?memberValue('wa',member.wa):(member.email||'—')):'—'),
    S.admin?h('div',{class:'org-c-aksi'},atur?orgAlat(nodes,node):h('button',{class:'btn s',onclick:()=>bukaPanelSusunan('pemegang',node.id)},'Atur')):null);
}
function orgTabel(nodes){
  const root=susunanAkar(nodes);
  if(!root)return h('p',{class:'warn'},'Susunan kepengurusan belum tersedia.');
  const groups=[{nama:root.nama,items:[root,...susunanAnak(nodes,root.id)]}];
  const walk=node=>{susunanAnak(nodes,node.id).forEach(k=>{
    const kids=susunanAnak(nodes,k.id);
    if(kids.length)groups.push({nama:k.nama,items:kids});
    walk(k);
  })};
  walk(root);
  return h('div',{class:'org-table-wrap'},...groups.map(group=>h('section',{class:'org-table-group'},
    h('h2',{class:'org-group-heading'},group.nama),
    h('div',{class:'org-table'+(S.admin?' org-table-admin':'')},
      h('div',{class:'org-row org-row-head'},h('span',{},'Jabatan'),h('span',{},'Pengurus'),h('span',{},'Wilayah'),h('span',{},'Kontak'),S.admin?h('span',{},''):null),
      ...group.items.map(item=>orgRow(nodes,item))))));
}
/* Halaman Kepengurusan: pemilih tampilan Bagan | Tabel di bagian atas;
   pilihan tampilan diingat selama sesi berjalan. Admin mendapat tombol
   'Atur Struktur' untuk membuka mode atur struktur pohon. */
function vSusunan(){
  const nodes=susunanSimpul();
  const mode=S.susunanMode==='tabel'?'tabel':'bagan';
  const atur=!!(S.admin&&S.susunanAtur);
  const out=[h('h1',{},'Kepengurusan'),guard(),
    h('div',{class:'org-toggle'},
      h('button',{class:'org-toggle-btn'+(mode==='bagan'?' on':''),onclick:()=>{S.susunanMode='bagan';render()}},'Bagan'),
      h('button',{class:'org-toggle-btn'+(mode==='tabel'?' on':''),onclick:()=>{S.susunanMode='tabel';render()}},'Tabel'))];
  if(S.admin){
    out.push(h('div',{class:'org-atur-bar'},
      h('button',{class:'btn s',onclick:()=>{S.susunanAtur=!S.susunanAtur;if(!S.susunanAtur)S.susunanPanel=null;render()}},atur?'Selesai Mengatur':'Atur Struktur'),
      atur&&h('button',{class:'btn s',onclick:()=>bukaPanelSusunan('tambah',null)},'+ Tambah Jabatan'),
      atur&&h('button',{class:'btn s',onclick:async()=>{
        if(!confirm('Kembalikan susunan ke jabatan bawaan? Jabatan tambahan akan hilang dan susunan hierarki kembali seperti semula; pemegang jabatan bawaan dipertahankan sebisa mungkin.'))return;
        try{await kembalikanSusunanAwal();S.susunanPanel=null;render()}
        catch(error){console.error(error);alert('Gagal mengembalikan susunan awal: '+(error.message||'periksa koneksi'))}
      }},'Kembalikan Susunan Awal'),
      atur&&h('p',{class:'sub org-atur-note'},'Mode atur aktif: pakai tombol Nama, Pemegang, Geser, dan Hapus pada tiap jabatan. Di tampilan Bagan, jabatan juga bisa diseret lewat pegangan ⠿ pada kartunya untuk memindah induk atau menggeser urutan.')
    ));
  }
  if(S.admin&&S.susunanPanel){
    const panelEl=susunanPanelRender(nodes);
    if(panelEl)out.push(panelEl);
  }
  out.push(mode==='bagan'?orgBagan(nodes):orgTabel(nodes));
  return out;
}
