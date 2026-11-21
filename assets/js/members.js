/* Daftar anggota, kartu ID, impor teks, formulir anggota */
const PERAN=['Anggota','Pengurus'];
function vMembers(){
  if(S.form)return [memberFormCard()];
  const search=h('input',{type:'search',placeholder:'Cari nama, WhatsApp, kota, wilayah, atau nomor anggota'}),region=h('select',{});
  const regions=WILAYAH.map(([name])=>name);
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
          S.admin&&h('button',{class:'btn s',onclick:()=>{S.form={...member};S.detail=null;render()}},icon('edit',15),h('span',{},'Edit')),
          S.admin&&h('button',{class:'btn s member-delete',onclick:async()=>{
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
      S.admin&&h('button',{class:'btn s',onclick:()=>{S.form={...member};S.detail=null;S.detailOrigin=null;render()}},icon('edit',15),h('span',{},'Edit data'))),
    h('article',{class:'member-id-card'},
      h('div',{class:'member-id-banner'},h('span',{},'SHIKOKU FAMILY'),h('span',{class:'member-region-tag'},area)),
      h('div',{class:'member-id-main'},
        member.foto?h('img',{class:'member-id-photo',...memberMediaAttributes(member.foto,'src'),alt:'Foto '+(member.nama||'anggota')}):h('div',{class:'member-id-photo member-avatar-placeholder'},(member.nama||'?').trim().slice(0,1).toUpperCase()),
        h('div',{class:'member-id-info'},h('small',{},'KARTU ANGGOTA'),h('h1',{},(member.nama||'Nama belum diisi').toUpperCase()),member.wa&&h('p',{class:'member-id-phone'},icon('phone',14),h('span',{},member.wa)),h('b',{},code.toUpperCase()),h('p',{},[member.kota,member.pref].filter(Boolean).join(' · ').toUpperCase()||area.toUpperCase()))),
      h('div',{class:'member-id-barcode'},h('b',{class:'member-barcode-label'},'QR CODE ABSENSI'),qrValue?h('img',{class:'member-qr-code','data-member-qr':qrValue,alt:'QR code untuk ID anggota'}):h('p',{class:'member-barcode-help'},'ID anggota belum tersedia.'),h('small',{class:'member-barcode-help','data-member-qr-status':'true'},qrValue?'Membuat QR code...':'QR code akan tersedia setelah ID anggota tersimpan.'))),
    ...sections.filter(([,rows])=>rows.some(([,value])=>value)).map(([title,rows])=>h('section',{class:'member-detail-section'},h('h3',{},title.toUpperCase()),h('div',{class:'member-detail-grid'},...rows.filter(([,value])=>value).map(([label,value])=>h('div',{class:'member-detail-item'},h('small',{},label.toUpperCase()),h('span',{},memberValue(label==='Nomor HP / WhatsApp'?'wa':label==='Nomor HP pengurus daerah'?'hp_pengurus':label==='Nomor HP orang tua'?'hp_ortu':label.toLowerCase(),value))))))),
    (member.surat||[]).length>0&&h('section',{class:'member-detail-section'},h('h3',{},'Foto Surat Sambung'),...(member.surat||[]).map((id,index)=>h('a',{class:'member-file-link',...memberMediaAttributes(id,'href'),target:'_blank',rel:'noopener'},icon('attachment',16),h('span',{},'Buka lampiran '+(index+1))))),
    S.admin&&h('div',{class:'member-detail-actions'},h('button',{class:'btn',onclick:()=>{S.form={...member};S.detail=null;S.detailOrigin=null;render()}},icon('edit',16),h('span',{},'Edit data anggota')))
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
function fld(l,k,o){o=o||{};const f=S.form;let e;
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
  const allowedRegion=WILAYAH.some(([name])=>name.toLowerCase()===String(f.wilayah).trim().toLowerCase());
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
      fld('Wilayah anggota *','wilayah',{opts:WILAYAH.map(([name])=>name),ph:'Pilih wilayah'}),
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
    ...(f.surat||[]).map((id,index)=>h('div',{class:'member-file-row'},h('a',{...memberMediaAttributes(id,'href'),target:'_blank'},icon('attachment',16),h('span',{},'Lampiran '+(index+1))),h('button',{class:'btn s',onclick:()=>{f.surat=f.surat.filter(value=>value!==id);render()}},'Hapus'))),
    h('div',{class:'fl'},pick('Ambil / foto dokumen','image/*,application/pdf',1,file=>up(file,'surat',1)),pick('Pilih dokumen','image/*,application/pdf',0,file=>up(file,'surat',1))),
    dropZone('Tambah foto atau PDF surat sambung','image/*,application/pdf','surat',1));
  return h('div',{class:'member-editor'},
    h('div',{class:'member-editor-heading'},h('button',{class:'btn s',onclick:()=>{S.form=null;render()}},'← Kembali'),
      h('div',{},h('p',{class:'member-eyebrow'},'DATA KOMUNITAS'),h('h1',{},f.id?'Edit data anggota':'Anggota baru'))),
    topCard(),
    box(h('div',{class:'member-section-heading'},h('b',{},'Profil anggota')),
      fieldGrid(fld('Nama lengkap *','nama'),fld('Nomor HP / WhatsApp','wa',{type:'tel'}),fld('Nomor anggota','kode'),fld('Jenis kelamin','kelamin',{opts:['Laki-laki','Perempuan']}),fld('Tanggal lahir','lahir',{type:'date'}),fld('Peran','peran',{opts:PERAN}),fld('Status pernikahan','nikah',{opts:['Belum menikah','Menikah','Cerai']}),fld('MT','mt'),fld('Bulan kedatangan','bln',{opts:BLN}),fld('Tahun kedatangan','thn',{opts:years}),fld('Mulai tinggal di Jepang','mulai_jp',{ph:'Contoh: 22-09-2026'}),fld('Email','email',{type:'email'}),fld('Instagram','instagram',{ph:'@username'}),fld('Facebook','facebook'))),
    box(h('div',{class:'member-section-heading'},h('b',{},'Kontak & keluarga')),
      fieldGrid(fld('Nama pengurus daerah','pengurus'),fld('Nomor HP pengurus daerah','hp_pengurus',{type:'tel'}),fld('Nama orang tua','ortu'),fld('Nomor HP orang tua','hp_ortu',{type:'tel'}))),
    box(h('div',{class:'member-section-heading'},h('b',{},'Asal di Indonesia')),
      fieldGrid(fld('Kelompok','kelompok'),fld('Desa','desa'),fld('Daerah','daerah'),fld('Alamat Indonesia','alamat_id',{area:1}))),
    box(h('div',{class:'member-section-heading'},h('b',{},'Alamat & pekerjaan di Jepang')),
      fieldGrid(fld('Kode pos','kodepos',{inputmode:'numeric'}),fld('Alamat di Jepang','alamat_jp',{area:1}),fld('Stasiun terdekat','stasiun'),fld('Status visa','tinggal',{opts:TGL,ph:'Pilih status visa'}),fld('Bidang pekerjaan','bidang'),fld('Nama perusahaan','perusahaan'))),
    photoBox(),documentBox(),
    box(h('div',{class:'member-section-heading'},h('b',{},'Catatan tambahan')),fld('Catatan','catatan',{area:1})),
    h('div',{class:'member-editor-actions'},h('button',{class:'btn s',onclick:()=>{S.form=null;render()}},'Batal'),h('button',{class:'btn',onclick:saveForm},f.id?'Simpan perubahan':'Simpan anggota'))
  );
}

/* Halaman Kepengurusan: anggota dengan peran Pengurus dari data anggota */
function vSusunan(){
  const pengurus=S.members.filter(member=>String(member.peran||'').toUpperCase()==='PENGURUS')
    .sort((a,b)=>(a.nama||'').localeCompare(b.nama||'','id'));
  const cards=pengurus.length?pengurus.map(member=>{
    const area=memberRegion(member),location=[member.kota,member.pref].filter(Boolean).join(', ');
    return h('article',{class:'member-card',style:'--region-color:'+regionColor(area)},
      member.foto?h('img',{class:'member-avatar',...memberMediaAttributes(member.foto,'src'),alt:'Foto '+(member.nama||'pengurus')}):h('div',{class:'member-avatar member-avatar-placeholder'},(member.nama||'?').trim().slice(0,1).toUpperCase()),
      h('div',{class:'member-card-info'},h('div',{class:'member-name-line'},h('b',{},(member.nama||'Nama belum diisi').toUpperCase()),h('span',{class:'member-region-tag'},area.toUpperCase())),
        h('small',{},[memberCode(member),location].filter(Boolean).join(' · ').toUpperCase()),
        h('small',{},member.wa?memberValue('wa',member.wa):member.email||'Kontak belum diisi')),
      h('div',{class:'member-card-actions'},h('button',{class:'btn s',onclick:()=>openMember(member,'members')},'Lihat kartu ID')));
  }):[h('div',{class:'member-empty'},icon('team',25),h('b',{},'Belum ada data pengurus'),h('p',{},'Anggota dengan peran Pengurus akan tampil di sini. Atur peran dari formulir data anggota.'))];
  return [h('h1',{},'Kepengurusan'),guard(),h('div',{class:'member-grid'},...cards)];
}
