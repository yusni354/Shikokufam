/* Daftar anggota, kartu ID, impor teks, formulir anggota */
const PERAN=['Anggota','Pengurus'];
function vMembers(){
  if(S.form)return [memberFormCard()];
  /* Field saringan 'Semua wilayah' SUDAH DIHAPUS dari halaman ini:
     kartu anggota kini tampil BERKELOMPOK per wilayah, jadi penyaringan
     wilayah tidak diperlukan lagi. S.memberRegion tidak lagi dipakai
     sebagai saringan — nilai yang dipasang kartu wilayah di Home kini
     hanya menjadi SASARAN GULIR ke kelompok wilayah itu (lalu dibersihkan
     di sini, supaya tidak ada saringan tersembunyi yang menjebak pengguna
     tanpa cara mematikannya). Pencarian nama tetap bekerja lintas kelompok. */
  const fokusWilayah=S.memberRegion?labelKelompokWilayah(S.memberRegion):'';
  S.memberRegion='';
  const search=h('input',{type:'search',placeholder:'Cari nama, WhatsApp, kota, wilayah, atau nomor anggota'});
  search.value=S.memberQuery||'';
  const count=h('p',{class:'member-results-count'}),list=h('div',{class:'member-groups'});
  /* Label tampil sebuah wilayah pada kepala kelompok & lencana kartu:
     anggota tanpa wilayah tampil sebagai 'Tanpa Wilayah'. */
  function labelKelompokWilayah(area){return area==='Belum dipilih'?'Tanpa Wilayah':area}
  /* Kartu ringkas: HANYA foto, nama, dan lencana wilayah — kota,
     nomor telepon, dan tombol Edit/Hapus TIDAK tampil di muka kartu
     (pengeditan & hapus tetap ada di halaman detail anggota).
     Seluruh badan kartu bisa diklik untuk membuka kartu ID anggota. */
  function memberTile(member){
    const area=memberRegion(member);
    return h('article',{class:'member-card',style:'--region-color:'+regionColor(area),title:'Lihat kartu ID '+(member.nama||'anggota'),onclick:()=>{
        openMember(member,'members');
      }},
      member.foto?h('img',{class:'member-avatar',...memberMediaAttributes(member.foto,'src'),alt:'Foto '+(member.nama||'anggota')}):h('div',{class:'member-avatar member-avatar-placeholder'},(member.nama||'?').trim().slice(0,1).toUpperCase()),
      h('b',{class:'member-tile-name'},(member.nama||'Nama belum diisi').toUpperCase()),
      h('span',{class:'member-region-tag'},labelKelompokWilayah(area).toUpperCase()));
  }
  function draw(){
    const query=(S.memberQuery||'').trim().toLowerCase();
    const rows=S.members.filter(member=>
      (!query||[member.nama,member.wa,member.kota,member.wilayah,member.pref,member.kode].some(value=>String(value||'').toLowerCase().includes(query)))
    ).sort((a,b)=>(a.nama||'').localeCompare(b.nama||'','id'));
    count.textContent='Menampilkan '+rows.length+' dari '+S.members.length+' anggota';
    if(!rows.length){
      list.replaceChildren(h('div',{class:'member-empty'},icon(S.members.length?'search':'users',25),h('b',{},S.members.length?'Anggota tidak ditemukan':'Belum ada data anggota'),h('p',{},S.members.length?'Coba kata kunci yang lain.':'Data anggota yang ditambahkan akan tampil di sini.')));
      return;
    }
    /* Kelompokkan hasil menurut wilayah. Urutan kelompok mengikuti
       urutan daftar wilayah aplikasi (wilayahEfektif); wilayah di luar
       daftar itu (bila ada) menyusul sesudahnya menurut abjad; kelompok
       'Tanpa Wilayah' selalu paling akhir dan hanya tampil bila berisi.
       Di dalam kelompok, anggota tetap urut nama A–Z (rows sudah urut). */
    const buckets=new Map();
    rows.forEach(member=>{
      const area=memberRegion(member);
      if(!buckets.has(area))buckets.set(area,[]);
      buckets.get(area).push(member);
    });
    const urutanDikenal=wilayahEfektif().map(([name])=>name).filter(name=>buckets.has(name));
    const urutanLain=[...buckets.keys()].filter(name=>name!=='Belum dipilih'&&!urutanDikenal.includes(name)).sort((a,b)=>a.localeCompare(b,'id'));
    const urutan=[...urutanDikenal,...urutanLain];
    if(buckets.has('Belum dipilih'))urutan.push('Belum dipilih');
    list.replaceChildren(...urutan.map(area=>{
      const members=buckets.get(area),label=labelKelompokWilayah(area);
      return h('section',{class:'member-group',style:'--region-color:'+regionColor(area),'data-member-region':label},
        h('div',{class:'member-group-head'},
          h('span',{class:'member-group-dot','aria-hidden':'true'}),
          h('h2',{class:'member-group-title'},label),
          h('span',{class:'member-group-count'},members.length+' anggota')),
        h('div',{class:'member-grid'},...members.map(memberTile)));
    }));
  }
  search.oninput=()=>{S.memberQuery=search.value;draw()};
  draw();
  if(fokusWilayah){
    /* Datang dari kartu wilayah di Home: gulir ke kelompok wilayah itu
       (kelompoknya mungkin tidak tampil bila sedang ada pencarian —
       dalam hal itu tidak ada yang digulir). */
    setTimeout(()=>{
      const target=[...list.querySelectorAll('.member-group')].find(group=>group.getAttribute('data-member-region')===fokusWilayah);
      if(target)target.scrollIntoView({behavior:'smooth',block:'start'});
    },120);
  }
  return [
    h('div',{class:'member-page-heading'},h('div',{},h('p',{class:'member-eyebrow'},'KOMUNITAS SHIKOKU FAMILY'),h('h1',{},'Daftar Anggota')),
      S.admin&&h('button',{class:'btn',onclick:()=>{S.form={};S.detail=null;S.detailOrigin=null;S.detailReturnView=null;S.formPinAlamatHasil='';render()}},'+ Tambah Anggota')),
    guard(),
    S.detail&&detailCard(),
    h('div',{class:'member-toolbar'},search),
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
  const member=S.detail,area=memberRegion(member),code=memberCode(member);
  /* Baris 'Posisi pin di peta': isi field-nya TIDAK ditampilkan di sini.
     Sebagai gantinya, bila anggota sudah punya posisi (pin manual atau
     hasil geocoding alamatnya), tampil satu link 'Lihat Posisi di Peta'
     yang membuka halaman Peta & Wilayah terpusat pada pin anggota itu
     dengan popup-nya terbuka. Tanpa posisi, barisnya tidak tampil. */
  const posisiPinDetail=(typeof posisiPinAnggota==='function')?posisiPinAnggota(member):null;
  const linkPosisiPinDetail=posisiPinDetail?h('a',{class:'member-contact-link pin-lihat-link',href:'#',onclick:ev=>{ev.preventDefault();if(typeof bukaPosisiPinDiPeta==='function')bukaPosisiPinDiPeta(member)}},'Lihat Posisi di Peta'):null;
  const sections=[
    ['Identitas & Keanggotaan',[['Nama lengkap',member.nama],['Nomor HP / WhatsApp',member.wa],['Jenis kelamin',member.kelamin],['Tanggal lahir',member.lahir],['Umur',memberAge(member)===null?'-':memberAge(member)+' tahun'],['Peran',member.peran||'Anggota'],['Pernikahan',member.nikah],['MT',member.mt],['Email',member.email],['Instagram',member.instagram],['Facebook',member.facebook]]],
    ['Kontak & Keluarga',[['Nama pengurus daerah',member.pengurus],['Nomor HP pengurus daerah',member.hp_pengurus],['Nama orang tua',member.ortu],['Nomor HP orang tua',member.hp_ortu]]],
    ['Alamat Indonesia',[['Kelompok',member.kelompok],['Desa',member.desa],['Daerah',member.daerah],['Alamat Indonesia',member.alamat_id]]],
    ['Alamat & Pekerjaan di Jepang',[['Kode pos',member.kodepos],['Alamat',member.alamat_jp],['Stasiun',member.stasiun],['Status visa',member.tinggal],['Bidang pekerjaan',member.bidang],['Perusahaan',member.perusahaan],['Posisi pin di peta',linkPosisiPinDetail]]],
    ['Catatan',[['Catatan',member.catatan]]]
  ];
  const qrValue=memberQrValue(member);
  return h('section',{class:'member-profile-page',style:'--region-color:'+regionColor(area)},
    h('div',{class:'member-profile-toolbar'},h('button',{class:'btn s',onclick:()=>kembaliDariDetailAnggota()},'← Kembali'),
      S.admin&&h('button',{class:'btn s btn-eh',onclick:()=>{S.form={...member};S.detail=null;S.idPhoto=null;S.detailOrigin=null;S.detailReturnView=null;S.view='members';S.formPinAlamatHasil='';render()}},icon('edit',15),h('span',{},'Edit data'))),
    h('article',{class:'member-id-card'},
      h('div',{class:'member-id-banner'},h('span',{},'SHIKOKU FAMILY'),h('span',{class:'member-region-tag'},area)),
      h('div',{class:'member-id-main'},
        member.foto?h('img',{class:'member-id-photo member-id-photo-zoom',...memberMediaAttributes(member.foto,'src'),alt:'Foto '+(member.nama||'anggota'),title:'Klik untuk memperbesar foto',onclick:()=>{S.idPhoto=member.foto;render()}}):h('div',{class:'member-id-photo member-avatar-placeholder'},(member.nama||'?').trim().slice(0,1).toUpperCase()),
        h('div',{class:'member-id-info'},h('small',{},'KARTU ANGGOTA'),h('h1',{},(member.nama||'Nama belum diisi').toUpperCase()),member.wa&&h('p',{class:'member-id-phone'},icon('phone',14),h('span',{},member.wa)),h('b',{},code.toUpperCase()),h('p',{},[member.kota,member.pref].filter(Boolean).join(' · ').toUpperCase()||area.toUpperCase()))),
      h('div',{class:'member-id-barcode'},h('b',{class:'member-barcode-label'},'QR CODE ABSENSI'),qrValue?h('img',{class:'member-qr-code','data-member-qr':qrValue,alt:'QR code untuk ID anggota'}):h('p',{class:'member-barcode-help'},'ID anggota belum tersedia.'),h('small',{class:'member-barcode-help','data-member-qr-status':'true'},qrValue?'Membuat QR code...':'QR code akan tersedia setelah ID anggota tersimpan.'))),
    ...sections.filter(([,rows])=>rows.some(([,value])=>value)).map(([title,rows])=>h('section',{class:'member-detail-section'},h('h3',{},title.toUpperCase()),h('div',{class:'member-detail-grid'},...rows.filter(([,value])=>value).map(([label,value])=>h('div',{class:'member-detail-item'},h('small',{},label.toUpperCase()),h('span',{},label==='Posisi pin di peta'?value:memberValue(label==='Nomor HP / WhatsApp'?'wa':label==='Nomor HP pengurus daerah'?'hp_pengurus':label==='Nomor HP orang tua'?'hp_ortu':label.toLowerCase(),value))))))),
    (member.surat||[]).length>0&&h('section',{class:'member-detail-section'},h('h3',{},'Foto Surat Sambung'),...(member.surat||[]).map((id,index)=>h('a',{class:'member-file-link',...memberMediaAttributes(id,'href'),target:'_blank',rel:'noopener'},icon('attachment',16),h('span',{},'Buka lampiran '+(index+1))))),
    S.admin&&h('div',{class:'member-detail-actions'},h('button',{class:'btn btn-eh',onclick:()=>{S.form={...member};S.detail=null;S.idPhoto=null;S.detailOrigin=null;S.detailReturnView=null;S.view='members';S.formPinAlamatHasil='';render()}},icon('edit',16),h('span',{},'Edit data anggota'))),
    /* Penampil foto besar kartu ID: klik foto di kartu membuka lapisan ini;
       mengetuk bidang di luar foto menutupnya (tanpa tombol X, mengikuti
       pola penampil foto nota di Laporan Keuangan). */
    S.idPhoto&&h('div',{class:'fin-lightbox',onclick:()=>{S.idPhoto=null;render()}},h('img',{...memberMediaAttributes(S.idPhoto,'src'),alt:'Foto '+(member.nama||'anggota')+' ukuran besar',onclick:ev=>ev.stopPropagation()}))
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
  /* Pin manual: hanya koordinat valid yang disimpan; selain itu bidang
     dibuang supaya anggota kembali ke penempatan otomatis. */
  if(f.pinManual){
    const lat=Number(f.pinManual.lat),lng=Number(f.pinManual.lng);
    if(isFinite(lat)&&isFinite(lng)&&lat>=20&&lat<=50&&lng>=120&&lng<=155)f.pinManual={lat:Number(lat.toFixed(6)),lng:Number(lng.toFixed(6))};
    else delete f.pinManual;
  }
  const d={...f};delete d.id;Object.keys(d).forEach(key=>{if(typeof d[key]!=='string')return;const v=cleanMemberValue(d[key]);d[key]=key==='email'?v.toLowerCase():KEEP_CASE.includes(key)?v:v.toUpperCase()});d.peran=d.peran||'ANGGOTA';
  try{if(f.id)await S.db.collection('members').doc(f.id).set(d);else await S.db.collection('members').add({...d,at:Date.now()});S.form=null;S.memberUploadState=null;S.formPinOpen=false;S.formPinTemp=null;S.formPinAlamatHasil='';render()}catch(e){console.error(e);alert('Tidak bisa menyimpan: '+(e.message||'periksa koneksi dan izin database'))}}
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
    f.foto&&h('img',{...memberMediaAttributes(f.foto,'src'),style:'width:88px;height:88px;border-radius:18px;object-fit:cover;object-position:center 20%;display:block;margin:10px 0'}),
    S.memberUploadState?.form===f&&h('p',{class:'warn '+(S.memberUploadState.status==='error'?'storage-warning':'')},S.memberUploadState.message),
    h('div',{class:'fl'},pick('Ambil foto','image/jpeg,image/png,image/webp',1,file=>up(file,'foto')),pick('Pilih foto','image/jpeg,image/png,image/webp',0,file=>up(file,'foto'))),
    dropZone('Ganti foto setengah badan','image/jpeg,image/png,image/webp','foto',0))
  const pinBox=()=>{
    const manual=(typeof pinManualCoords==='function')?pinManualCoords(f):null;
    const anak=[
      h('div',{class:'form-pin-head'},h('b',{},'Posisi Pin di Peta'),h('span',{class:'form-pin-sumber'},manual?'Posisi manual':'Otomatis dari alamat'))
    ];
    /* Isi hasil penempatan pin TIDAK ditampilkan di bagian ini: alamat
       dari titik pin tetap terisi ke field Alamat di Jepang & Kode Pos
       seperti biasa dan ikut tersimpan saat formulir disimpan — hanya
       tampilannya di sini yang diganti. Sebagai gantinya, bila anggota
       sudah punya posisi (pin manual atau hasil geocoding alamatnya),
       tampil satu link 'Lihat Posisi di Peta' yang membuka panel peta
       yang sudah ada di bawah ini, terpusat pada pin anggota itu dengan
       penandanya terlihat. Anggota tanpa posisi apa pun tidak
       menampilkan link. */
    const posisiPin=(typeof posisiPinAnggota==='function')?posisiPinAnggota(f):(manual?{coords:manual,manual:true}:null);
    if(posisiPin)anak.push(h('p',{class:'form-pin-lihat'},h('a',{class:'member-contact-link pin-lihat-link',href:'#',onclick:ev=>{
      ev.preventDefault();
      S.formPinTemp=[posisiPin.coords[0],posisiPin.coords[1]];
      S.formPinOpen=true;render();
      setTimeout(()=>{const el=document.getElementById('form-pin-map');if(el)el.scrollIntoView({behavior:'smooth',block:'center'})},80);
    }},'Lihat Posisi di Peta')));
    const tombol=[
      h('button',{type:'button',class:'btn s',onclick:()=>{
        if(!S.admin){alert('Hanya admin yang dapat meletakkan pin.');return}
        S.formPinTemp=manual?[manual[0],manual[1]]:null;
        S.formPinOpen=true;render();
        setTimeout(()=>{const el=document.getElementById('form-pin-map');if(el)el.scrollIntoView({behavior:'smooth',block:'center'})},80);
      }},manual?'Ubah Posisi Pin':'Letakkan Pin di Peta')
    ];
    if(manual)tombol.push(h('button',{type:'button',class:'btn s',onclick:()=>{delete f.pinManual;S.formPinTemp=null;S.formPinOpen=false;S.formPinAlamatHasil='';render()}},'Hapus Pin Manual'));
    anak.push(h('div',{class:'fl form-pin-actions'},...tombol));
    if(S.formPinOpen){
      anak.push(h('div',{class:'form-pin-panel'},
        h('p',{class:'sub',style:'margin:0 0 8px'},'Ketuk peta untuk meletakkan pin, atau geser penanda ke posisi yang tepat. Sesudah menekan "Pakai Posisi Ini", alamat dari titik itu terisi otomatis ke field Alamat di Jepang (dan Kode Pos bila tersedia).'),
        h('div',{id:'form-pin-map',role:'application','aria-label':'Peta untuk meletakkan pin anggota'}),
        h('p',{class:'form-pin-coords',id:'form-pin-coords'},manual?'Pin manual sudah terpasang — ketuk titik baru atau geser penanda bila ingin mengubahnya.':'Belum ada titik dipilih — ketuk peta untuk meletakkan pin.'),
        h('div',{class:'fl'},
          h('button',{type:'button',class:'btn s',onclick:async()=>{
            const t=S.formPinTemp;
            if(!t||t.length!==2){alert('Ketuk peta dulu untuk memilih titik pin.');return}
            if(S.formPinBusy)return;
            S.formPinBusy=true;
            f.pinManual={lat:Number(Number(t[0]).toFixed(6)),lng:Number(Number(t[1]).toFixed(6))};
            /* Geocoding terbalik atas titik terpilih: yang dicatat di
               field alamat adalah TEKS ALAMAT titik itu, bukan angka
               koordinatnya. Alamat tidak ditemukan -> field alamat lama
               tidak ditimpa, pin tetap dipakai. */
            const status=document.getElementById('form-pin-coords');
            if(status)status.textContent='Mencari alamat dari titik…';
            let hasil=null;
            try{hasil=(typeof petaReverseGeocode==='function')?await petaReverseGeocode(t):null}catch(e){hasil=null}
            S.formPinBusy=false;
            if(hasil&&hasil.alamat){
              f.alamat_jp=hasil.alamat;
              if(hasil.kodepos)f.kodepos=hasil.kodepos;
              S.formPinAlamatHasil=hasil.alamat;
              const loc=inferJapanLocation(hasil.alamat,hasil.kodepos||'');
              if(loc){
                if(!f.pref)f.pref=loc.pref.toUpperCase();
                if(!f.wilayah)f.wilayah=loc.wilayah.toUpperCase();
                if(!f.kota&&loc.kota)f.kota=loc.kota.toUpperCase();
              }
            }else{
              S.formPinAlamatHasil='';
            }
            S.formPinOpen=false;S.formPinTemp=null;render();
            if(!hasil)alert('Alamat tidak ditemukan dari titik ini — alamat bisa diisi manual');
          }},'Pakai Posisi Ini'),
          h('button',{type:'button',class:'btn s',onclick:()=>{S.formPinOpen=false;S.formPinTemp=null;render()}},'Batal'))));
    }
    return h('div',{class:'form-pin-box'},...anak);
  };
  const documentBox=()=>box(h('b',{},'Foto Surat Sambung'),
    ...(f.surat||[]).map((id,index)=>h('div',{class:'member-file-row'},h('a',{...memberMediaAttributes(id,'href'),target:'_blank'},icon('attachment',16),h('span',{},'Lampiran '+(index+1))),h('button',{class:'btn s btn-eh',onclick:()=>{f.surat=f.surat.filter(value=>value!==id);render()}},'Hapus'))),
    h('div',{class:'fl'},pick('Ambil / foto dokumen','image/*,application/pdf',1,file=>up(file,'surat',1)),pick('Pilih dokumen','image/*,application/pdf',0,file=>up(file,'surat',1))),
    dropZone('Tambah foto atau PDF surat sambung','image/*,application/pdf','surat',1));
  return h('div',{class:'member-editor'},
    h('div',{class:'member-editor-heading'},h('button',{class:'btn s',onclick:()=>{S.form=null;S.formPinOpen=false;S.formPinTemp=null;S.formPinAlamatHasil='';render()}},'← Kembali'),
      h('div',{},h('p',{class:'member-eyebrow'},'DATA KOMUNITAS'),h('h1',{},f.id?'Edit data anggota':'Anggota baru'))),
    topCard(),
    box(h('div',{class:'member-section-heading'},h('b',{},'Profil anggota')),
      fieldGrid(fld('Nama lengkap *','nama'),fld('Nomor HP / WhatsApp','wa',{type:'tel'}),fld('Jenis kelamin','kelamin',{opts:['Laki-laki','Perempuan'],ph:'Pilih jenis kelamin',managed:{key:'kelamin',countUsage:hitungPemakaianAnggota('kelamin')}}),fld('Tanggal lahir','lahir',{type:'date'}),fld('Peran','peran',{opts:PERAN}),fld('Status pernikahan','nikah',{opts:['Belum menikah','Menikah','Cerai'],ph:'Pilih status pernikahan',managed:{key:'nikah',countUsage:hitungPemakaianAnggota('nikah')}}),fld('MT','mt'),fld('Bulan kedatangan','bln',{opts:BLN}),fld('Tahun kedatangan','thn',{opts:years}),fld('Mulai tinggal di Jepang','mulai_jp',{ph:'Contoh: 22-09-2026'}),fld('Email','email',{type:'email'}),fld('Instagram','instagram',{ph:'@username'}),fld('Facebook','facebook'))),
    box(h('div',{class:'member-section-heading'},h('b',{},'Kontak & keluarga')),
      fieldGrid(fld('Nama pengurus daerah','pengurus'),fld('Nomor HP pengurus daerah','hp_pengurus',{type:'tel'}),fld('Nama orang tua','ortu'),fld('Nomor HP orang tua','hp_ortu',{type:'tel'}))),
    box(h('div',{class:'member-section-heading'},h('b',{},'Asal di Indonesia')),
      fieldGrid(fld('Kelompok','kelompok',{opts:[],ph:'Pilih kelompok',managed:{key:'kelompok',countUsage:hitungPemakaianAnggota('kelompok')}}),fld('Desa','desa'),fld('Daerah','daerah'),fld('Alamat Indonesia','alamat_id',{area:1}))),
    box(h('div',{class:'member-section-heading'},h('b',{},'Alamat & pekerjaan di Jepang')),
      fieldGrid(fld('Kode pos','kodepos',{inputmode:'numeric'}),fld('Alamat di Jepang','alamat_jp',{area:1}),fld('Stasiun terdekat','stasiun'),fld('Status visa','tinggal',{opts:TGL,ph:'Pilih status visa',managed:{key:'tinggal',countUsage:hitungPemakaianAnggota('tinggal')}}),fld('Bidang pekerjaan','bidang',{opts:BIDANG_PEKERJAAN_AWAL,ph:'Pilih bidang pekerjaan',managed:{key:'bidang',countUsage:hitungPemakaianAnggota('bidang')}}),fld('Nama perusahaan','perusahaan')),
      S.admin?pinBox():null),
    photoBox(),documentBox(),
    box(h('div',{class:'member-section-heading'},h('b',{},'Catatan tambahan')),fld('Catatan','catatan',{area:1})),
    h('div',{class:'member-editor-actions'},h('button',{class:'btn s',onclick:()=>{S.form=null;S.formPinOpen=false;S.formPinTemp=null;S.formPinAlamatHasil='';render()}},'Batal'),h('button',{class:'btn',onclick:saveForm},f.id?'Simpan perubahan':'Simpan anggota'))
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
   Hanya admin yang bisa mengubah struktur, dan pengaturannya tampil
   LANGSUNG di tabel (tidak ada mode khusus); anggota biasa hanya
   melihat tabel susunan kepengurusan yang bersih. Dokumen yang sama
   juga menyimpan 'labelKelompokPuncak': tulisan kepala kelompok
   teratas pada tabel (bawaan 'Pengurus Inti'), yang bisa diubah admin.
   Sejak versi 3 dokumen juga menyimpan 'kelompok': daftar KELOMPOK
   TAMBAHAN buatan admin ([{id, nama}]) yang tampil sebagai kartu tabel
   tersendiri di bawah kelompok-kelompok bawaan. Dapukan yang masuk ke
   kelompok tambahan tetap simpul pohon biasa (induk = jabatan puncak)
   dengan penanda 'kelompokId' pada simpulnya, supaya pengelompokan
   tampilnya mengikuti kelompok tambahan itu, bukan kelompok puncak.
   Kelompok tambahan yang belum dikenal data lama dianggap tidak ada,
   jadi migrasi aman: tampilan data lama persis sama seperti sebelumnya. ===== */
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
    if(item.kelompokId)node.kelompokId=String(item.kelompokId);
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
/* ===== Kelompok tambahan (kartu tabel tersendiri buatan admin) =====
   Daftar kelompok tambahan tersimpan di dokumen susunan sebagai
   'kelompok': [{id, nama}]. Rapikan dari data mentah: buang entri
   rusak/duplikat, nama kosong menjadi 'Kelompok Baru'. */
function susunanKelompokBersih(raw){
  if(!Array.isArray(raw))return [];
  const out=[],seen=new Set();
  raw.forEach(item=>{
    if(!item||typeof item!=='object')return;
    const id=String(item.id||'').trim();
    if(!id||seen.has(id))return;
    seen.add(id);
    out.push({id,nama:String(item.nama||'').trim()||'Kelompok Baru'});
  });
  return out;
}
function susunanKelompok(){
  return susunanKelompokBersih(S.susunanKelompok||[]);
}
function susunanKelompokAda(id){
  return !!id&&susunanKelompok().some(k=>k.id===id);
}
/* Kelompok TAMPIL sebuah simpul pada tabel:
   - 'kel:<id>' bila simpul bertanda kelompokId yang masih dikenal;
   - 'puncak' untuk jabatan puncak dan anak-anak langsungnya;
   - 'cabang:<id induk>' untuk anak dapukan lain mana pun. */
function susunanKunciKelompok(nodes,node){
  if(node.kelompokId&&susunanKelompokAda(node.kelompokId))return 'kel:'+node.kelompokId;
  const root=susunanAkar(nodes);
  if(!root||node.id===root.id||node.induk===root.id)return 'puncak';
  return 'cabang:'+node.induk;
}
/* Daftar saudara SATU KELOMPOK TAMPIL dengan simpul ini, terurut —
   inilah daftar yang urutannya diatur dengan menyeret barisnya
   langsung di tabel (seret manual di dalam kelompoknya sendiri).
   Jabatan puncak sendirian dalam daftarnya. */
function susunanSaudaraKelompok(nodes,node){
  if(node.induk===null)return [node];
  const kunci=susunanKunciKelompok(nodes,node);
  return nodes.filter(n=>n.induk!==null&&susunanKunciKelompok(nodes,n)===kunci).sort((a,b)=>a.urutan-b.urutan);
}
/* Tulisan kepala kelompok teratas pada tabel. Tersimpan tersendiri di
   dokumen susunan sebagai 'labelKelompokPuncak'; kosong = bawaan. */
function labelKelompokPuncak(){
  const label=String(S.susunanLabelPuncak||'').trim();
  return label||'Pengurus Inti';
}
async function simpanLabelKelompokPuncak(label){
  S.susunanLabelPuncak=String(label||'').trim();
  await simpanSusunan(susunanSimpul());
}
async function simpanSusunan(nodes,kelompokBaru){
  if(Array.isArray(kelompokBaru))S.susunanKelompok=susunanKelompokBersih(kelompokBaru);
  const kelompok=susunanKelompok();
  const bersih=susunanBersih(nodes)||[];
  /* Penanda kelompokId yang kelompoknya sudah tidak ada dibuang, supaya
     dapukannya kembali ke kelompok menurut induknya (tidak yatim). */
  bersih.forEach(n=>{if(n.kelompokId&&!kelompok.some(k=>k.id===n.kelompokId))delete n.kelompokId});
  S.susunanSimpul=bersih;
  const map={};bersih.forEach(n=>{if(n.pemegang)map[n.id]=n.pemegang});
  S.susunanPemegang=map;
  if(S.db)await S.db.collection('pengaturan').doc('susunan_pengurus').set({versi:3,simpul:bersih,labelKelompokPuncak:String(S.susunanLabelPuncak||'').trim(),kelompok,at:Date.now()});
}
function subscribeSusunan(){
  if(!S.db)return ()=>{};
  try{
    return S.db.collection('pengaturan').onSnapshot(snap=>{
      const doc=(snap.docs||[]).find(d=>d.id==='susunan_pengurus');
      const data=doc&&typeof doc.data==='function'?doc.data():null;
      const labelBaru=data&&typeof data.labelKelompokPuncak==='string'?data.labelKelompokPuncak:'';
      const kelompokBaru=susunanKelompokBersih(data?data.kelompok:null);
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
      if(JSON.stringify(next)!==JSON.stringify(S.susunanSimpul||null)||labelBaru!==String(S.susunanLabelPuncak||'')||JSON.stringify(kelompokBaru)!==JSON.stringify(susunanKelompok())){
        S.susunanLabelPuncak=labelBaru;
        S.susunanKelompok=kelompokBaru;
        S.susunanSimpul=next;
        const map={};(next||[]).forEach(n=>{if(n.pemegang)map[n.id]=n.pemegang});
        S.susunanPemegang=map;
        if(S.view==='susunan')renderDariData();
      }
    },error=>{console.error('Susunan pengurus gagal dimuat:',error)});
  }catch(error){console.error('Susunan pengurus gagal dimuat:',error);return ()=>{}}
}
/* ===== Aksi perubahan struktur (semua lewat simpanSusunan) ===== */
/* Ganti nama dapukan saja — dipakai edit langsung pada nama dapukan
   yang tertera di barisnya. */
async function gantiNamaJabatan(id,nama){
  await simpanSusunan(susunanSimpul().map(n=>n.id===id?{...n,nama}:n));
}
/* Ganti pemegang dapukan saja — dipakai edit langsung pada nama
   pemegang yang tertera di barisnya (pemilih anggota di tempat). */
async function gantiPemegangDapukan(id,memberId){
  await simpanSusunan(susunanSimpul().map(n=>n.id===id?{...n,pemegang:memberId||''}:n));
}
/* Tambah dapukan baru TANPA pilihan posisi/acuan: dapukan baru selalu
   masuk sebagai saudara di KELOMPOK YANG SAMA dengan sasarannya, pada
   urutan paling bawah kelompok itu. Sasaran dinyatakan sebagai
   {induk, kelompokId}: dari pengaturan inline sebuah baris, sasarannya
   kelompok baris itu sendiri; dari tombol tambah di kaki kartu sebuah
   kelompok, sasarannya kelompok kartu itu. Mengatur urutan sesudahnya
   sepenuhnya manual dengan menyeret barisnya langsung di tabel. */
async function tambahDapukanBaru(nama,sasaran,memberId){
  const nodes=susunanSimpul().map(n=>({...n}));
  const root=susunanAkar(nodes);
  if(!root)return;
  const indukId=sasaran&&sasaran.induk?sasaran.induk:root.id;
  if(!susunanCari(nodes,indukId))return;
  const kelompokId=sasaran&&sasaran.kelompokId&&susunanKelompokAda(sasaran.kelompokId)?sasaran.kelompokId:'';
  const id='jab-'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
  const urutan=nodes.filter(n=>n.induk===indukId).reduce((maks,n)=>Math.max(maks,n.urutan),-1)+1;
  const nodeBaru={id,nama,induk:indukId,urutan,pemegang:memberId||''};
  if(kelompokId)nodeBaru.kelompokId=kelompokId;
  nodes.push(nodeBaru);
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
  anak.forEach(n=>{n.induk=parentId;if(target.kelompokId&&!n.kelompokId)n.kelompokId=target.kelompokId});
  const rest=nodes.filter(n=>n.id!==id);
  const saudara=rest.filter(n=>n.induk===parentId&&!anak.includes(n)).sort((a,b)=>a.urutan-b.urutan);
  const pos=Math.min(target.urutan,saudara.length);
  [...saudara.slice(0,pos),...anak,...saudara.slice(pos)].forEach((n,i)=>{n.urutan=i});
  await simpanSusunan(rest);
}
/* Simpan urutan baru sesudah baris diseret (drag) di dalam kelompok
   tampilnya: nilai 'urutan' milik anggota kelompok itu dipakai ulang
   (himpunan nilainya sama, hanya pemiliknya bertukar mengikuti urutan
   hasil seret), jadi dapukan dari kelompok lain yang kebetulan satu
   induk tidak ikut bergeser. idsBaru = urutan id hasil seret. */
async function susunanAturUrutanGrup(grupItems,idsBaru){
  const nodes=susunanSimpul().map(n=>({...n}));
  const byId=new Map(nodes.map(n=>[n.id,n]));
  const nilai=grupItems.map(n=>n.urutan).sort((a,b)=>a-b);
  idsBaru.forEach((id,i)=>{const n=byId.get(id);if(n)n.urutan=nilai[i]});
  await simpanSusunan(nodes);
}
/* ===== Aksi kelompok tambahan (kartu tabel tersendiri) ===== */
async function tambahKelompokBaru(){
  const kelompok=susunanKelompok();
  kelompok.push({id:'kel-'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),nama:'Kelompok Baru'});
  await simpanSusunan(susunanSimpul(),kelompok);
}
async function gantiNamaKelompok(id,nama){
  await simpanSusunan(susunanSimpul(),susunanKelompok().map(k=>k.id===id?{...k,nama}:k));
}
/* Hapus kelompok tambahan: hanya boleh bila kelompok itu KOSONG.
   Mengembalikan false bila masih berisi dapukan (pemanggil memberi
   peringatan untuk mengosongkan dulu). */
async function hapusKelompok(id){
  if(susunanSimpul().some(n=>n.kelompokId===id&&susunanKelompokAda(id)))return false;
  await simpanSusunan(susunanSimpul(),susunanKelompok().filter(k=>k.id!==id));
  return true;
}
/* ===== Edit LANGSUNG di dalam tabel (tanpa panel, tanpa tombol X) =====
   S.susunanInline menandai SATU edit yang sedang terbuka:
   {jenis:'edit-nama', id} — nama dapukan baris itu berubah menjadi
   isian teks di tempatnya; {jenis:'edit-pemegang', id} — nama pemegang
   baris itu berubah menjadi pemilih anggota di tempatnya;
   {jenis:'tambah', kunci} — formulir tambah dapukan di kaki kartu
   kelompok berkunci itu. Membuka edit pada baris lain memindahkannya
   ke sana; mengetuk bidang di luar edit pemegang membatalkannya. */
function toggleTambahSusunan(kunci){
  const cur=S.susunanInline;
  S.susunanInline=cur&&cur.jenis==='tambah'&&cur.kunci===kunci?null:{jenis:'tambah',kunci};
  render();
}
function tutupInlineSusunan(){S.susunanInline=null;render()}
/* Pemilih pemegang jabatan: SATU field gabungan (combobox/autocomplete).
   Field menampilkan nama pemegang saat ini; mengetik langsung memunculkan
   daftar saran melayang di bawah field, bersumber dari daftar anggota
   (nama mengandung ketikan, tidak peka huruf besar/kecil, cocok dari
   tengah nama). Menyentuh field dengan ketikan kosong menampilkan
   seluruh daftar anggota. Baris teratas selalu '— Tanpa pemegang —'
   untuk mengosongkan jabatan. Daftar menutup saat memilih saran atau
   menyentuh bidang di luar field/daftar. Nilai komponen (.value) tetap
   uid anggota terpilih atau '' supaya pemanggil tidak berubah. Bila
   pemanggil memberi onPilih, fungsi itu dipanggil SETIAP kali pengguna
   memilih saran (termasuk '— Tanpa pemegang —') — dipakai edit
   langsung pemegang di baris tabel, yang menyimpan begitu dipilih. */
function susunanPilihAnggota(currentId,onPilih){
  const daftar=[...S.members].sort((a,b)=>(a.nama||'').localeCompare(b.nama||'','id'));
  const cariNama=id=>daftar.find(m=>m.id===id)||null;
  let terpilih=cariNama(currentId)?currentId:'';
  let sorot=-1;
  let barisPilihan=[];
  const input=h('input',{type:'text',placeholder:'Ketik nama anggota…',autocomplete:'off',role:'combobox','aria-expanded':'false','aria-autocomplete':'list'});
  if(terpilih)input.value=cariNama(terpilih).nama||'';
  const daftarEl=h('div',{class:'anggota-saran',role:'listbox'});
  daftarEl.style.display='none';
  const tutup=()=>{
    daftarEl.style.display='none';
    daftarEl.replaceChildren();
    sorot=-1;barisPilihan=[];
    input.setAttribute('aria-expanded','false');
  };
  const pilih=id=>{
    terpilih=id||'';
    const m=terpilih?cariNama(terpilih):null;
    input.value=m?(m.nama||''):'';
    tutup();
    if(typeof onPilih==='function')onPilih(terpilih);
  };
  const buka=()=>{
    const teks=input.value;
    const pemegang=terpilih?cariNama(terpilih):null;
    /* Bila isi field masih nama pemegang terpilih (baru disentuh), tampilkan
       daftar lengkap; selain itu saring menurut ketikan. */
    const q=pemegang&&teks===(pemegang.nama||'')?'':teks.trim().toLowerCase();
    const cocok=daftar.filter(m=>!q||(m.nama||'').toLowerCase().includes(q));
    barisPilihan=[];sorot=-1;
    const barisKosong=h('div',{class:'anggota-opt anggota-opt-clear',role:'option'},'— Tanpa pemegang —');
    barisKosong.addEventListener('pointerdown',ev=>{ev.preventDefault();pilih('')});
    barisPilihan.push({el:barisKosong,id:''});
    const anak=[barisKosong];
    if(!cocok.length){
      anak.push(h('div',{class:'anggota-opt anggota-opt-note'},'Tidak ada anggota dengan nama itu'));
    }else{
      cocok.forEach(member=>{
        const baris=h('div',{class:'anggota-opt',role:'option'},
          member.foto?h('img',{class:'org-mini',...memberMediaAttributes(member.foto,'src'),alt:''}):h('span',{class:'org-mini org-avatar-ph'},(member.nama||'?').trim().slice(0,1).toUpperCase()),
          h('span',{class:'anggota-opt-info'},h('b',{},member.nama||'Tanpa nama'),h('small',{},memberRegion(member))));
        baris.addEventListener('pointerdown',ev=>{ev.preventDefault();pilih(member.id)});
        barisPilihan.push({el:baris,id:member.id});
        anak.push(baris);
      });
    }
    daftarEl.replaceChildren(...anak);
    daftarEl.style.display='block';
    input.setAttribute('aria-expanded','true');
    if(typeof hydrateMemberMedia==='function')hydrateMemberMedia();
  };
  input.addEventListener('focus',buka);
  input.addEventListener('input',()=>{
    const m=terpilih?cariNama(terpilih):null;
    if(!m||input.value!==(m.nama||''))terpilih='';
    buka();
  });
  input.addEventListener('keydown',ev=>{
    if(daftarEl.style.display==='none'){
      if(ev.key==='ArrowDown'){ev.preventDefault();buka()}
      return;
    }
    if(ev.key==='ArrowDown'||ev.key==='ArrowUp'){
      ev.preventDefault();
      if(!barisPilihan.length)return;
      sorot=ev.key==='ArrowDown'?(sorot+1)%barisPilihan.length:(sorot-1+barisPilihan.length)%barisPilihan.length;
      barisPilihan.forEach((b,i)=>b.el.classList.toggle('on',i===sorot));
      barisPilihan[sorot].el.scrollIntoView({block:'nearest'});
    }else if(ev.key==='Enter'){
      if(sorot>=0&&barisPilihan[sorot]){ev.preventDefault();pilih(barisPilihan[sorot].id)}
    }else if(ev.key==='Escape'){
      tutup();
    }
  });
  input.addEventListener('blur',()=>{setTimeout(()=>{if(document.activeElement!==input)tutup()},150)});
  const wadah=h('div',{class:'anggota-picker'},input,daftarEl);
  /* Sentuhan di luar field/daftar menutup daftar saran (tanpa tombol X).
     Pendengar membersihkan dirinya sendiri begitu komponen terlepas
     dari dokumen karena panel digambar ulang. */
  const onDocPointer=ev=>{
    if(!wadah.isConnected){document.removeEventListener('pointerdown',onDocPointer,true);return}
    if(!wadah.contains(ev.target))tutup();
  };
  document.addEventListener('pointerdown',onDocPointer,true);
  Object.defineProperty(wadah,'value',{get:()=>terpilih,set:v=>pilih(v||'')});
  return wadah;
}
/* ===== Ketuk-untuk-edit pada nama yang tertera di baris =====
   Nama dapukan & nama pemegang pada baris (khusus admin) adalah tombol
   teks. Ketukan yang membuka edit dibedakan dari seret/gulir seperti
   pola aplikasi: tekanan yang BERGERAK lebih dari 10px atau menahan
   lebih dari ±600 ms MEMBATALKAN niat edit (gerakan itu milik seret
   tekan-lama baris / gulir halaman), dan klik susulan dari ketukan
   yang sama ditekan supaya edit tidak terbuka dua kali. Ketukan dari
   papan ketik (Enter/Spasi pada tombol terfokus) tetap membuka edit. */
function pasangKetukEdit(el,aksi){
  let startX=0,startY=0,startT=0,batal=false,baruSaja=false;
  el.addEventListener('pointerdown',ev=>{
    if(ev.button!=null&&ev.button>0)return;
    startX=ev.clientX;startY=ev.clientY;startT=Date.now();batal=false;
  });
  el.addEventListener('pointermove',ev=>{
    if(Math.hypot(ev.clientX-startX,ev.clientY-startY)>10)batal=true;
  });
  el.addEventListener('pointerup',()=>{
    if(batal||Date.now()-startT>600)return;
    baruSaja=true;
    setTimeout(()=>{baruSaja=false},350);
    aksi();
  });
  el.addEventListener('click',ev=>{
    if(baruSaja){ev.preventDefault();return}
    aksi();
  });
}
/* ===== Isian edit nama dapukan DI TEMPAT =====
   Menggantikan teks nama dapukan pada baris itu sendiri: isian teks
   yang sudah terfokus & terpilih, tersimpan saat Enter atau saat fokus
   berpindah, batal dengan Escape. Selama baris ini sedang diedit
   namanya, ikon sampah kecil tampil di samping isiannya — satu-satunya
   jalan menghapus dapukan (dapukan puncak tidak bisa dihapus). Tombol
   sampah bekerja pada pointerdown dengan preventDefault supaya fokus
   isian tidak berpindah lebih dulu (yang akan menyimpan & menggambar
   ulang sebelum hapus sempat berjalan). */
function orgEditNamaInline(nodes,node){
  const input=h('input',{type:'text',class:'org-inline-input',value:node.nama,maxlength:'60','aria-label':'Nama dapukan'});
  let selesai=false;
  const selesaiEdit=()=>{S.susunanInline=null;render()};
  const simpan=async()=>{
    if(selesai)return;
    selesai=true;
    const nama=input.value.trim();
    if(!nama||nama===node.nama){selesaiEdit();return}
    try{await gantiNamaJabatan(node.id,nama)}
    catch(error){console.error(error);alert('Gagal mengganti nama dapukan: '+(error.message||'periksa koneksi'))}
    selesaiEdit();
  };
  const batalEdit=()=>{if(selesai)return;selesai=true;selesaiEdit()};
  input.addEventListener('keydown',ev=>{
    if(ev.key==='Enter'){ev.preventDefault();simpan()}
    else if(ev.key==='Escape'){ev.preventDefault();batalEdit()}
  });
  input.addEventListener('blur',()=>{simpan()});
  setTimeout(()=>{if(input.isConnected){input.focus();input.select()}},0);
  const anak=[input];
  if(node.induk!==null){
    const trash=h('button',{type:'button',class:'org-icon-btn org-icon-btn-danger org-inline-trash',title:'Hapus dapukan '+node.nama,'aria-label':'Hapus dapukan '+node.nama},icon('trash',15));
    trash.addEventListener('pointerdown',async ev=>{
      ev.preventDefault();ev.stopPropagation();
      if(selesai)return;
      const anak2=susunanAnak(nodes,node.id);
      const pesan='Hapus dapukan "'+node.nama+'"?'+(anak2.length?' '+anak2.length+' dapukan di bawahnya akan naik ke dapukan di atasnya ("'+(susunanCari(nodes,node.induk)||{}).nama+'").':'')+' Pemegangnya menjadi tidak menjabat.';
      if(!confirm(pesan))return;
      selesai=true;
      try{await hapusJabatan(node.id);S.susunanInline=null;render()}
      catch(error){console.error(error);selesai=false;alert('Gagal menghapus dapukan: '+(error.message||'periksa koneksi'))}
    });
    anak.push(trash);
  }
  return h('div',{class:'org-edit-wrap'},...anak);
}
/* ===== Pemilih pemegang DI TEMPAT =====
   Menggantikan teks nama pemegang pada baris itu sendiri dengan
   combobox anggota yang sama seperti sebelumnya (saran foto + nama +
   wilayah, baris teratas '— Tanpa pemegang —'). Begitu pengguna
   MEMILIH saran, pemegang langsung tersimpan dan baris kembali ke
   teks (nama + wilayah mengikuti pemegang baru). Menekan bidang di
   luar pemilih membatalkan edit tanpa mengubah apa pun. */
function orgEditPemegangInline(node){
  const current=pemegangJabatan(node);
  const picker=susunanPilihAnggota(current?current.id:'',async memberId=>{
    S.susunanInline=null;
    if((memberId||'')===(current?current.id:'')){render();return}
    try{await gantiPemegangDapukan(node.id,memberId||'')}
    catch(error){console.error(error);alert('Gagal mengganti pemegang dapukan: '+(error.message||'periksa koneksi'))}
    render();
  });
  setTimeout(()=>{
    const inp=picker.querySelector('input');
    if(inp&&inp.isConnected)inp.focus();
  },30);
  /* Tekan di luar pemilih = batal edit (pendengar membersihkan dirinya
     sendiri begitu pemilih terlepas dari dokumen karena gambar ulang). */
  const onDocPointer=ev=>{
    if(!picker.isConnected){document.removeEventListener('pointerdown',onDocPointer,true);return}
    if(!picker.contains(ev.target)){
      document.removeEventListener('pointerdown',onDocPointer,true);
      if(S.susunanInline&&S.susunanInline.jenis==='edit-pemegang'&&S.susunanInline.id===node.id){S.susunanInline=null;render()}
    }
  };
  setTimeout(()=>document.addEventListener('pointerdown',onDocPointer,true),60);
  return picker;
}
/* Formulir tambah dapukan INLINE di kaki kartu sebuah kelompok:
   hanya nama dapukan + pemegang (combobox anggota) + Simpan/Batal —
   tanpa pemilih acuan dan tanpa pilihan letak. Dapukan baru masuk
   sebagai saudara paling bawah di kelompok kartu ini. */
function orgTambahInline(grup){
  const input=h('input',{type:'text',maxlength:'60',placeholder:'Nama dapukan baru'});
  const selPemegang=susunanPilihAnggota('');
  return h('div',{class:'org-tambah-inline'},
    h('b',{class:'org-set-judul'},'Tambah dapukan di kelompok "'+grup.nama+'"'),
    input,
    h('p',{class:'sub',style:'margin:10px 0 8px'},'Pemegang dapukan (boleh dikosongkan dulu):'),selPemegang,
    h('div',{class:'fl'},
      h('button',{class:'btn s',onclick:async()=>{
        const nama=input.value.trim();
        if(!nama){alert('Isi nama dapukan baru terlebih dahulu.');return}
        try{await tambahDapukanBaru(nama,grup.sasaran,selPemegang.value||'');S.susunanInline=null;render()}
        catch(error){console.error(error);alert('Gagal menambah dapukan: '+(error.message||'periksa koneksi'))}
      }},'Simpan'),
      h('button',{class:'btn s',onclick:tutupInlineSusunan},'Batal')));
}

/* ===== SUSUNAN KEPENGURUSAN BERBASIS TABEL =====
   Tampilan hierarki (Bagan) sudah dihapus: halaman Kepengurusan kini
   langsung menampilkan tabel. Data pohon dapukan tetap dipakai di
   belakang layar untuk pengelompokan dan urutan tampil.
   Tiap kelompok tampil sebagai KARTU TABEL TERSENDIRI yang terpisah:
   kelompok pertama berlabel tersimpan (bawaan 'Pengurus Inti') berisi
   dapukan puncak beserta anak-anak langsungnya; sesudah itu satu
   kelompok per dapukan yang mempunyai bawahan, dengan nama dapukan itu
   sebagai kepala kelompok; terakhir kelompok-kelompok tambahan buatan
   admin. Semua baris RATA SEJAJAR (tanpa indentasi dan tanpa garis
   pemandu) dan SEMINIMAL mungkin: isinya hanya nama dapukan, nama
   pemegang, dan wilayah pemegang. */
/* Kepala kelompok: pemisah ringan antar kelompok pada tabel. Bagi admin
   tulisannya bisa disunting langsung lewat ikon pensil di sampingnya:
   kepala kelompok puncak menyunting label tersimpan 'labelKelompokPuncak',
   kepala kelompok cabang menyunting nama dapukan induknya (jalur ganti
   nama yang sama, supaya baris dan data tetap seirama), dan kepala
   kelompok TAMBAHAN menyunting nama kelompok itu di daftar 'kelompok'.
   Kelompok tambahan juga punya tombol hapus kecil di kepalanya — hanya
   berfungsi bila kelompoknya sudah kosong. */
function orgKepalaKelompok(grup){
  const terisi=grup.items.filter(n=>!!pemegangJabatan(n)).length;
  const kosong=grup.items.length-terisi;
  const subParts=[grup.items.length+' dapukan'];
  if(kosong)subParts.push(kosong+' belum terisi');
  else subParts.push('semua terisi');
  if(S.admin&&S.susunanLabelEdit&&S.susunanLabelEdit===grup.kunciEdit){
    const input=h('input',{type:'text',class:'org-group-edit-input',value:grup.nama,maxlength:'60','aria-label':'Tulisan kepala kelompok'});
    const simpan=async()=>{
      const teks=input.value.trim();
      if(!teks){alert('Tulisan kepala kelompok tidak boleh kosong.');return}
      try{
        if(grup.nodeId)await gantiNamaJabatan(grup.nodeId,teks);
        else if(grup.jenis==='kel')await gantiNamaKelompok(grup.kelompokId,teks);
        else await simpanLabelKelompokPuncak(teks);
        S.susunanLabelEdit=null;render();
      }catch(error){console.error(error);alert('Gagal menyimpan tulisan kepala kelompok: '+(error.message||'periksa koneksi'))}
    };
    input.addEventListener('keydown',ev=>{if(ev.key==='Enter'){ev.preventDefault();simpan()}else if(ev.key==='Escape'){S.susunanLabelEdit=null;render()}});
    setTimeout(()=>{if(input.isConnected){input.focus();input.select()}},0);
    return h('div',{class:'org-group-head'},
      h('span',{class:'org-group-ic','aria-hidden':'true'},icon('team',20)),
      h('div',{class:'org-group-edit'},input,
        h('button',{class:'btn s',onclick:simpan},'Simpan'),
        h('button',{class:'btn s',onclick:()=>{S.susunanLabelEdit=null;render()}},'Batal')));
  }
  return h('div',{class:'org-group-head'},
    h('span',{class:'org-group-ic','aria-hidden':'true'},icon('team',20)),
    h('div',{class:'org-group-head-main'},
      h('h2',{class:'org-group-heading'},grup.nama),
      h('p',{class:'org-group-sub'},subParts.join(' • '))),
    S.admin?h('button',{class:'org-group-edit-btn',title:'Ubah tulisan kepala kelompok ini','aria-label':'Ubah tulisan kepala kelompok '+grup.nama,onclick:()=>{S.susunanLabelEdit=grup.kunciEdit;render()}},icon('edit',15)):null,
    S.admin&&grup.jenis==='kel'?h('button',{class:'org-icon-btn org-icon-btn-danger org-group-del',title:'Hapus kelompok ini (hanya bila kosong)','aria-label':'Hapus kelompok '+grup.nama+' (hanya bila kosong)',onclick:async()=>{
      if(grup.items.length){alert('Kelompok "'+grup.nama+'" masih berisi '+grup.items.length+' dapukan. Kosongkan dulu kelompok ini — ketuk nama dapukannya lalu hapus lewat ikon sampah yang muncul — sebelum kelompok bisa dihapus.');return}
      if(!confirm('Hapus kelompok "'+grup.nama+'"? Kartu kelompok kosong ini akan hilang dari tabel.'))return;
      try{
        const ok=await hapusKelompok(grup.kelompokId);
        if(!ok){alert('Kelompok ini masih berisi dapukan. Kosongkan dulu sebelum dihapus.');return}
        if(S.susunanLabelEdit===grup.kunciEdit)S.susunanLabelEdit=null;
        if(S.susunanInline&&S.susunanInline.kunci===grup.kunciEdit)S.susunanInline=null;
        render();
      }catch(error){console.error(error);alert('Gagal menghapus kelompok: '+(error.message||'periksa koneksi'))}
    }},icon('trash',15)):null,
    h('span',{class:'org-group-count'},terisi+'/'+grup.items.length+' terisi'));
}
/* ===== Geser urutan dapukan dengan TEKAN LAMA pada baris =====
   Tidak ada lagi pegangan '⠿': admin menekan dan menahan baris
   dapukan (±450 ms tanpa bergerak) sampai baris terangkat masuk mode
   seret, lalu menggesernya ke atas/bawah di dalam KELOMPOK TAMPIL-nya
   sendiri sambil tetap menekan, dan melepas untuk menjatuhkan. Selama
   menyeret, baris mengikuti jari/kursor (transform) dan baris tujuan
   ditandai garis sisip di tepi atas/bawahnya. Saat dilepas di posisi
   baru, urutan disimpan otomatis lewat susunanAturUrutanGrup lalu
   halaman digambar ulang.
   Bedakan dengan gulir halaman: sentuhan yang BERGERAK sebelum batas
   tekan lama tercapai membatalkan niat seret dan halaman bergulir
   seperti biasa; sesudah mode seret aktif, gerakan menggeser baris
   (gulir dicegah lewat pendengar touchmove non-pasif). Tekan lama
   pada nama yang bisa diketuk-edit (tombol teks) atau pada field edit
   yang sedang terbuka tidak memicu seret, dan melepas jauh di luar
   kelompok atau membatalkan sentuhan tidak mengubah urutan. */
function orgPasangSeretTekanLama(rowEl,node,nodes){
  rowEl.addEventListener('pointerdown',ev=>{
    if(ev.button!=null&&ev.button>0)return;
    if(ev.target&&ev.target.closest&&ev.target.closest('button,a,input,select,textarea,[contenteditable="true"]'))return;
    const table=rowEl.closest('.org-table');
    if(!table)return;
    const grup=susunanSaudaraKelompok(nodes,node);
    if(grup.length<2)return;
    const rows=grup.map(n=>table.querySelector('.org-row-v2[data-node-id="'+n.id+'"]')).filter(Boolean);
    if(rows.length!==grup.length)return;
    const startIdx=rows.indexOf(rowEl);
    if(startIdx<0)return;
    const pid=ev.pointerId;
    const startX=ev.clientX,startY=ev.clientY;
    const rects=rows.map(r=>r.getBoundingClientRect());
    const minDy=rects[0].top-rects[startIdx].top;
    const maxDy=rects[rects.length-1].bottom-rects[startIdx].bottom;
    let aktif=false,targetIdx=startIdx,selesai=false,timer=null;
    const bersih=()=>{
      rowEl.classList.remove('org-row-dragging');
      rowEl.style.transform='';
      rows.forEach(r=>r.classList.remove('org-drop-above','org-drop-below'));
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
           batalkan seret, biarkan halaman bergulir seperti biasa. */
        if(Math.hypot(e.clientX-startX,e.clientY-startY)>10){selesai=true;lepas()}
        return;
      }
      e.preventDefault();
      const dy=Math.max(minDy,Math.min(maxDy,e.clientY-startY));
      rowEl.style.transform='translateY('+dy+'px)';
      /* Indeks tujuan: baris pertama yang titik tengahnya dilewati oleh
         titik tengah baris yang diseret. */
      const tengah=rects[startIdx].top+rects[startIdx].height/2+dy;
      let t=rows.length-1;
      for(let i=0;i<rows.length;i++){
        if(tengah<rects[i].top+rects[i].height/2){t=i;break}
      }
      targetIdx=t;
      rows.forEach((r,i)=>{
        r.classList.toggle('org-drop-above',i===targetIdx&&targetIdx<startIdx);
        r.classList.toggle('org-drop-below',i===targetIdx&&targetIdx>startIdx);
      });
    };
    const onUp=async e=>{
      if(e.pointerId!==pid||selesai)return;
      selesai=true;
      lepas();
      const t=targetIdx,pernahAktif=aktif;
      bersih();
      if(!pernahAktif)return;
      /* Batal: sentuhan dibatalkan sistem, atau dilepas jauh di luar
         kelompok — urutan tidak berubah, gambar ulang untuk
         mengembalikan tampilan baris seperti semula. */
      const batal=e.type==='pointercancel'||e.clientY<rects[0].top-24||e.clientY>rects[rects.length-1].bottom+24;
      if(batal){render();return}
      if(t===startIdx)return;
      const idsBaru=grup.map(n=>n.id);
      const pindah=idsBaru.splice(startIdx,1)[0];
      idsBaru.splice(t,0,pindah);
      try{await susunanAturUrutanGrup(grup,idsBaru)}
      catch(error){console.error(error);alert('Gagal menyimpan urutan baru: '+(error.message||'periksa koneksi'))}
      render();
    };
    timer=setTimeout(()=>{
      timer=null;
      if(selesai)return;
      aktif=true;
      rowEl.classList.add('org-row-dragging');
      if(navigator.vibrate){try{navigator.vibrate(15)}catch(_){}}
    },450);
    document.addEventListener('pointermove',onMove);
    document.addEventListener('pointerup',onUp);
    document.addEventListener('pointercancel',onUp);
    document.addEventListener('touchmove',cegahGulir,{passive:false});
  });
}
/* ===== Baris dapukan SEMINIMAL mungkin =====
   Isi baris HANYA tiga hal: nama dapukan, nama pemegang, dan wilayah
   pemegang (tampilan saja, mengikuti pemegang terpilih; pemegang
   kosong → '—'). Tidak ada foto, nomor urut, tombol WhatsApp, tombol
   Atur/Hapus, dan tidak ada panel pengaturan: bagi Pengurus & Admin
   Utama, mengetuk nama dapukan membuka isian teks DI TEMPAT dan
   mengetuk nama pemegang membuka pemilih anggota DI TEMPAT (lihat
   orgEditNamaInline & orgEditPemegangInline). Anggota biasa hanya
   melihat teks biasa yang tidak bisa diketuk. */
function orgRow(nodes,node){
  const member=pemegangJabatan(node);
  const depth=susunanKedalaman(nodes,node);
  const wilayahTampil=member?memberRegion(member):'';
  const sedangEditNama=S.admin&&S.susunanInline&&S.susunanInline.jenis==='edit-nama'&&S.susunanInline.id===node.id;
  const sedangEditPemegang=S.admin&&S.susunanInline&&S.susunanInline.jenis==='edit-pemegang'&&S.susunanInline.id===node.id;
  /* Sel nama dapukan */
  let dapukanEl;
  if(sedangEditNama){
    dapukanEl=orgEditNamaInline(nodes,node);
  }else if(S.admin){
    dapukanEl=h('button',{type:'button',class:'org-editable org-dapukan-name',title:'Ketuk untuk mengganti nama dapukan','aria-label':'Ganti nama dapukan '+node.nama},node.nama);
    pasangKetukEdit(dapukanEl,()=>{S.susunanInline={jenis:'edit-nama',id:node.id};render()});
  }else{
    dapukanEl=h('span',{class:'org-dapukan-name'},node.nama);
  }
  /* Sel nama pemegang */
  let pemegangEl;
  if(sedangEditPemegang){
    pemegangEl=orgEditPemegangInline(node);
  }else if(S.admin){
    pemegangEl=h('button',{type:'button',class:'org-editable org-holder-name'+(member?'':' org-holder-empty'),title:'Ketuk untuk mengganti pemegang dapukan','aria-label':'Ganti pemegang dapukan '+node.nama},member?(member.nama||'Nama belum diisi'):'Belum ditetapkan');
    pasangKetukEdit(pemegangEl,()=>{S.susunanInline={jenis:'edit-pemegang',id:node.id};render()});
  }else{
    pemegangEl=member
      ?h('span',{class:'org-holder-name'},member.nama||'Nama belum diisi')
      :h('span',{class:'org-holder-name org-holder-empty'},'Belum ditetapkan');
  }
  const rowClass='org-row org-row-v2'
    +(depth===0?' org-row-root':'')
    +(member?'':' org-row-vacant-row');
  const rowEl=h('div',{class:rowClass,'data-depth':String(depth),'data-node-id':node.id},
    h('div',{class:'org-c-dapukan'},dapukanEl),
    h('div',{class:'org-c-nama'},pemegangEl),
    h('div',{class:'org-c-wilayah'},
      wilayahTampil
        ?h('span',{class:'org-wilayah-badge'},h('i',{class:'org-wilayah-dot',style:'background:'+regionColor(wilayahTampil),'aria-hidden':'true'}),wilayahTampil)
        :h('span',{class:'org-kontak-none'},'—')));
  /* Admin menggeser urutan baris ini dengan TEKAN LAMA pada barisnya
     (baris puncak tidak bisa digeser); pendengar seret mengabaikan
     ketukan pada tombol/field, jadi tidak tertukar dengan ketuk-edit.
     Anggota biasa tidak mendapat pendengar apa pun. */
  if(S.admin&&node.induk!==null)orgPasangSeretTekanLama(rowEl,node,nodes);
  return rowEl;
}
/* Kelompok-kelompok tampil pada tabel: kelompok puncak (label
   tersimpan), satu kelompok cabang per dapukan yang mempunyai bawahan,
   lalu kelompok TAMBAHAN buatan admin — masing-masing tampil sebagai
   KARTU TABEL TERSENDIRI yang terpisah. Tiap kelompok membawa
   'sasaran' tambah dapukannya sendiri (induk + kelompokId). */
function orgKelompokTampil(nodes){
  const root=susunanAkar(nodes);
  if(!root)return [];
  const groups=[{nama:labelKelompokPuncak(),kunciEdit:'puncak',jenis:'puncak',nodeId:null,kelompokId:'',sasaran:{induk:root.id,kelompokId:''},items:[root,...susunanAnak(nodes,root.id).filter(n=>susunanKunciKelompok(nodes,n)==='puncak')]}];
  const walk=node=>{
    susunanAnak(nodes,node.id).forEach(k=>{
      const kids=susunanAnak(nodes,k.id).filter(n=>susunanKunciKelompok(nodes,n)==='cabang:'+k.id);
      if(kids.length){
        groups.push({nama:k.nama,kunciEdit:'cabang:'+k.id,jenis:'cabang',nodeId:k.id,kelompokId:'',sasaran:{induk:k.id,kelompokId:''},items:kids});
      }
      walk(k);
    });
  };
  walk(root);
  susunanKelompok().forEach(k=>{
    groups.push({nama:k.nama,kunciEdit:'kel:'+k.id,jenis:'kel',nodeId:null,kelompokId:k.id,sasaran:{induk:root.id,kelompokId:k.id},items:nodes.filter(n=>susunanKunciKelompok(nodes,n)==='kel:'+k.id).sort((a,b)=>a.urutan-b.urutan)});
  });
  return groups;
}
function orgTabel(nodes){
  const root=susunanAkar(nodes);
  if(!root)return h('p',{class:'warn'},'Susunan kepengurusan belum tersedia.');
  const groups=orgKelompokTampil(nodes);
  const groupEls=groups.map((grup,gi)=>{
    const anakTabel=[h('div',{class:'org-row org-row-head org-row-head-v2'},
      h('span',{},'Dapukan'),
      h('span',{},'Nama'),
      h('span',{},'Wilayah'))];
    grup.items.forEach(item=>{
      anakTabel.push(orgRow(nodes,item));
    });
    if(!grup.items.length){
      anakTabel.push(h('p',{class:'org-group-empty'},S.admin?'Kelompok ini masih kosong. Tambahkan dapukan lewat tombol di bawah kartu ini.':'Kelompok ini masih kosong.'));
    }
    /* Kaki kartu kelompok ini: formulir tambah inline bila sedang
       terbuka; selain itu tombol '+ Tambah Dapukan Baru' milik kartu
       ini sendiri (tiap kartu punya tombol tambahnya sendiri). */
    if(S.admin){
      if(S.susunanInline&&S.susunanInline.jenis==='tambah'&&S.susunanInline.kunci===grup.kunciEdit){
        anakTabel.push(h('div',{class:'org-table-foot org-table-foot-form'},orgTambahInline(grup)));
      }else{
        anakTabel.push(h('div',{class:'org-table-foot'},
          h('button',{class:'btn org-add-btn',title:'Tambah dapukan baru di kelompok ini','aria-label':'Tambah dapukan baru di kelompok ini',onclick:()=>toggleTambahSusunan(grup.kunciEdit)},icon('plus',15),h('span',{},'Tambah Dapukan'))));
      }
    }
    /* Tiap kelompok mendapat kelas palet pastel berputar (org-pal-0..4)
       supaya warna kepala kelompok dan baris-barisnya berbeda dari
       kelompok lain dan mudah dibedakan sekilas. */
    return h('section',{class:'org-table-group org-pal org-pal-'+(gi%5)},
      orgKepalaKelompok(grup),
      h('div',{class:'org-table'+(S.admin?' org-table-admin':'')},...anakTabel));
  });
  const parts=[...groupEls];
  /* Paling bawah halaman: tombol membuat kartu kelompok baru (admin). */
  if(S.admin){
    parts.push(h('div',{class:'org-add-group-wrap'},
      h('button',{class:'btn org-add-group-btn',title:'Tambah kartu kelompok baru','aria-label':'Tambah kartu kelompok baru',onclick:async()=>{
        try{await tambahKelompokBaru();render()}
        catch(error){console.error(error);alert('Gagal menambah kelompok: '+(error.message||'periksa koneksi'))}
      }},icon('plus',15),h('span',{},'Tambah Kelompok'))));
  }
  return h('div',{class:'org-table-wrap'},...parts);
}
/* Halaman Kepengurusan: langsung menampilkan susunan berbasis tabel
   (tanpa pemilih Bagan/Tabel dan tanpa tampilan hierarki). Bagian atas
   halaman hanya judul, lalu langsung kartu-kartu kelompok — tidak ada
   ringkasan angka dan tidak ada tombol susunan awal. Tidak ada mode
   khusus untuk mengatur: bagi Pengurus & Admin Utama pengeditan
   dilakukan LANGSUNG pada nama yang tertera di barisnya — ketuk nama
   dapukan untuk mengganti namanya (ikon sampah untuk menghapus hanya
   muncul selama nama itu diedit), ketuk nama pemegang untuk mengganti
   pemegangnya lewat pemilih anggota di tempat — ditambah tekan lama
   pada baris untuk menggeser urutannya, tombol '+ Tambah Dapukan' di
   kaki tiap kartu kelompok, tombol '+ Tambah Kelompok' di paling
   bawah halaman, dan ikon pensil pada tiap kepala kelompok untuk
   mengubah tulisannya. Anggota biasa hanya melihat kartu-kartu tabel
   yang bersih berisi teks nama dapukan, nama pemegang, dan wilayah. */
function vSusunan(){
  const nodes=susunanSimpul();
  const out=[h('h1',{},'Kepengurusan'),guard()];
  out.push(orgTabel(nodes));
  return out;
}
