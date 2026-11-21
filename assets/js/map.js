/* Peta anggota (Leaflet), persetujuan akun, sebaran wilayah */
function alamatJp(m,det){return [det?m.alamat_jp:'',m.kec_jp,m.kota,m.pref||m.wilayah,m.kodepos,'Japan'].filter(Boolean).join(', ')}
async function loadPendingUsers(){
  if(!S.supabase){
    if(!S.mainAdmin){S.pendingUsers=[];S.approvedUsers=[]}
    else{
      const ringkas=user=>({id:user.id,name:user.name,email:user.email,created_at:user.created_at,approval_status:user.approval_status,approved_at:user.approved_at||null,approved_by:user.approved_by||'',role:user.role,is_main_admin:user.is_main_admin===true,avatar_url:user.avatar_url||''});
      S.pendingUsers=localUsers().filter(user=>user.approval_status==='pending').map(ringkas);
      S.approvedUsers=localUsers().filter(user=>user.approval_status==='approved').map(ringkas);
    }
    /* Lencana navigasi Persetujuan mengikuti daftar terbaru ini juga */
    if(typeof updateApprovalBadges==='function')updateApprovalBadges();
    return;
  }
  if(!S.mainAdmin){S.pendingUsers=[];S.approvedUsers=[];if(typeof updateApprovalBadges==='function')updateApprovalBadges();return}
  const {data,error}=await S.supabase.from('profiles').select('id,name,email,created_at,approval_status').eq('approval_status','pending').order('created_at',{ascending:true});
  if(error){console.error(error);S.pendingUsers=[]}else S.pendingUsers=data||[];
  /* Catatan akun yang sudah disetujui untuk tab 'Sudah Disetujui'.
     select('*') supaya kolom tambahan (approved_at, approved_by, avatar_url,
     region warisan) ikut terbaca bila ada, tanpa gagal bila belum ada. */
  const disetujui=await S.supabase.from('profiles').select('*').eq('approval_status','approved');
  if(disetujui.error){console.error(disetujui.error);S.approvedUsers=[]}else S.approvedUsers=disetujui.data||[];
  if(typeof updateApprovalBadges==='function')updateApprovalBadges();
}
async function setApproval(id,status){
  if(!S.mainAdmin)return;
  /* Setiap persetujuan baru mencatat waktu persetujuan (approved_at) dan
     nama admin penyetuju dari sesi (approved_by) ke data akun. */
  const oleh=S.name||S.email||'';
  if(!S.supabase){
    const users=localUsers(),user=users.find(item=>item.id===id);
    if(!user){alert('Pendaftar tidak ditemukan.');return}
    user.approval_status=status;
    user.approved_at=status==='approved'?new Date().toISOString():null;
    user.approved_by=status==='approved'?(oleh||null):null;
    try{saveLocalUsers(users)}catch(e){alert('Gagal memperbarui persetujuan: '+e.message);return}
    await loadPendingUsers();render();
    return;
  }
  const dasar={approval_status:status,approved_at:status==='approved'?new Date().toISOString():null};
  let {error}=await S.supabase.from('profiles').update({...dasar,approved_by:status==='approved'?(oleh||null):null}).eq('id',id);
  if(error&&/approved_by/.test(error.message||'')){
    /* Kolom approved_by belum ada di database lama: ulangi tanpa kolom itu
       supaya persetujuan tidak gagal hanya karena catatan nama penyetuju. */
    ({error}=await S.supabase.from('profiles').update(dasar).eq('id',id));
  }
  if(error){alert('Gagal memperbarui persetujuan: '+error.message);return}
  await loadPendingUsers();render();
}
function peranAkun(user){
  if(user.is_main_admin)return 'Admin Utama';
  if(user.role==='admin')return 'Admin';
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
  if(!S.mainAdmin)return [h('p',{class:'warn'},'Halaman ini hanya dapat diakses admin utama.')];
  const tab=S.approvalsTab==='disetujui'?'disetujui':'menunggu';
  const toggle=h('div',{class:'org-toggle'},
    h('button',{class:'org-toggle-btn'+(tab==='menunggu'?' on':''),onclick:()=>{S.approvalsTab='menunggu';render()}},'Menunggu ('+S.pendingUsers.length+')'),
    h('button',{class:'org-toggle-btn'+(tab==='disetujui'?' on':''),onclick:()=>{S.approvalsTab='disetujui';render()}},'Sudah Disetujui ('+S.approvedUsers.length+')'));
  if(tab==='menunggu'){
    const rows=S.pendingUsers.map(user=>h('div',{class:'card approval-row'},
      h('div',{style:'flex:1;min-width:0'},h('b',{},user.name||'Nama belum diisi'),h('small',{},user.email||'-'),h('small',{},new Date(user.created_at).toLocaleString('id-ID'))),
      h('div',{class:'fl'},h('button',{class:'btn',onclick:()=>setApproval(user.id,'approved')},'Setujui'),h('button',{class:'btn s',onclick:()=>setApproval(user.id,'rejected')},'Tolak'))));
    return [h('h1',{},'Persetujuan Akun'),toggle,...(rows.length?rows:[h('p',{class:'warn'},'Tidak ada pendaftar yang menunggu persetujuan.')])];
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
    return h('div',{class:'card approval-row'},
      user.avatar_url?h('img',{class:'av',src:user.avatar_url,alt:'Foto '+(user.name||'akun'),style:'object-fit:cover'}):h('div',{class:'av'},(user.name||user.email||'?').trim().slice(0,1).toUpperCase()),
      h('div',{style:'flex:1;min-width:0'},
        h('b',{},user.name||'Nama belum diisi',h('span',{class:'tag'},peranAkun(user))),
        h('small',{},user.email||'-'),
        wilayah?h('small',{},'Wilayah: '+wilayah):null,
        h('small',{},barisTanggal)));
  });
  return [h('h1',{},'Persetujuan Akun'),toggle,...(rows.length?rows:[h('p',{class:'warn'},'Belum ada akun yang disetujui.')])];
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
   bujurnya. Sumber utama: Nominatim reverse berbahasa Jepang (tanpa
   kunci API) — memberi prefektur, kota, distrik, blok, jalan, nomor,
   dan kode pos. Cadangan: GSI reverse resmi Jepang (nama distrik
   lv01Nm) untuk melengkapi hasil Nominatim yang hanya setingkat kota,
   atau berdiri sendiri bila Nominatim tidak terjangkau.
   Mengembalikan {alamat, kodepos} atau null bila titik itu memang
   tidak beralamat (mis. tengah laut): pemanggil lalu TIDAK menimpa
   alamat lama anggota. */
function petaKodeposFormat(v){const d=String(v||'').replace(/\D/g,'');return d.length===7?d.slice(0,3)+'-'+d.slice(3):''}
async function petaNomReverse(coords){
  const jeda=1100-(Date.now()-PETA_GEO.lastNom);
  if(PETA_GEO.lastNom&&jeda>0)await petaTunggu(jeda);
  PETA_GEO.lastNom=Date.now();
  const res=await fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat='+coords[0]+'&lon='+coords[1]+'&zoom=18&addressdetails=1&accept-language=ja',{headers:{'Accept':'application/json'}});
  if(!res.ok)throw new Error('Nominatim reverse HTTP '+res.status);
  const j=await res.json();
  if(!j||j.error||!j.address)return null;
  const a=j.address;
  if(a.country_code&&a.country_code!=='jp')return null;
  const ambil=(...ks)=>{for(const k of ks){if(a[k])return String(a[k])}return ''};
  const pref=ambil('province','state');
  const kota=ambil('city','town','village')||ambil('county');
  /* Detail di bawah tingkat kota (distrik/blok/jalan/nomor) adalah bukti
     titik ini benar-benar beralamat; hasil yang hanya setingkat kota
     (mis. titik di perairan yang menempel batas administrasi kota)
     tidak dianggap alamat. */
  const rinci=['city_block','quarter','neighbourhood','suburb','city_district','road','house_number'].some(k=>a[k]);
  /* Susun mengikuti urutan alamat Jepang: prefektur → kota → distrik →
     blok → jalan → nomor; bagian yang sudah tercakup tidak diulang. */
  const urutan=[pref,kota,ambil('city_district'),ambil('suburb'),ambil('quarter'),ambil('neighbourhood'),ambil('city_block'),ambil('road'),ambil('house_number')];
  let alamat='';
  urutan.forEach(bag=>{if(bag&&!alamat.includes(bag))alamat+=bag});
  return {alamat,kodepos:petaKodeposFormat(a.postcode),rinci:rinci&&!!alamat,pref,kota};
}
async function petaGsiReverse(coords){
  const res=await fetch('https://mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToAddress?lat='+coords[0]+'&lon='+coords[1],{headers:{'Accept':'application/json'}});
  if(!res.ok)throw new Error('GSI reverse HTTP '+res.status);
  const j=await res.json();
  const nama=j&&j.results?String(j.results.lv01Nm||'').trim():'';
  return nama||null;
}
async function petaReverseGeocode(coords){
  let nom=null;
  try{nom=await petaNomReverse(coords)}catch(e){/* lanjut ke GSI */}
  if(nom&&nom.rinci)return {alamat:nom.alamat,kodepos:nom.kodepos};
  let gsi=null;
  try{gsi=await petaGsiReverse(coords)}catch(e){/* kedua sumber gagal */}
  if(gsi){
    if(nom&&(nom.pref||nom.kota)){
      let alamat='';
      [nom.pref,nom.kota,gsi].forEach(bag=>{if(bag&&!alamat.includes(bag))alamat+=bag});
      return {alamat,kodepos:nom.kodepos||''};
    }
    return {alamat:gsi,kodepos:nom?nom.kodepos||'':''};
  }
  /* Nominatim hanya memberi tingkat kota / kedua layanan kosong:
     titik dianggap tidak beralamat. */
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
const PM={map:null,layer:null,markers:{},entries:[],tileLayer:null,tileOk:0,tileErr:0,tileTimer:null,basemapIdx:0,fallback:false,fallbackLayer:null,gen:0,style:'jalan',chain:null,spiderLayer:null,spider:null,spiderTimer:null,clusters:[],clusterOf:{}};
try{const tersimpan=sessionStorage.getItem('sf_peta_style');if(tersimpan&&(tersimpan==='jalan'||tersimpan==='satelit'||tersimpan==='terang'))PM.style=tersimpan}catch(e){}
/* Pilihan tampilan peta dasar — semua gratis tanpa API key. CARTO SENGAJA
   tidak dipakai: sejak 2026 servernya mengembalikan ubin placeholder
   bertuliskan "API KEY REQUIRED" dengan status HTTP sukses, jadi ubin
   watermark itu lolos deteksi tileerror/timeout dan peta tampil coretan. */
const PETA_STYLES={
  jalan:{label:'Jalan',name:'Esri World Street Map',url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',opts:{maxZoom:19,attribution:'Tiles &copy; Esri'}},
  satelit:{label:'Satelit',name:'Esri World Imagery',url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',opts:{maxZoom:19,attribution:'Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics'}},
  terang:{label:'Terang',name:'OpenStreetMap',url:'https://tile.openstreetmap.org/{z}/{x}/{y}.png',opts:{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}}
};
/* Rantai untuk gaya terpilih: gaya itu dulu; bila gagal, kembali ke Jalan
   (Esri Street); bila itu pun gagal, peta dasar cadangan lokal (SVG). */
function petaChain(){
  const urutan=[PM.style||'jalan'];
  if(urutan[0]!=='jalan')urutan.push('jalan');
  return urutan.map(k=>Object.assign({key:k},PETA_STYLES[k]));
}
/* Ganti tampilan peta: hanya lapisan dasar yang diganti — pin, pilihan
   anggota, dan posisi peta tidak berubah. Pilihan diingat selama sesi. */
function petaSetStyle(key){
  if(!PETA_STYLES[key])return;
  PM.style=key;
  try{sessionStorage.setItem('sf_peta_style',key)}catch(e){}
  document.querySelectorAll('.peta-style-btn').forEach(b=>b.classList.toggle('on',b.getAttribute('data-style')===key));
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
  if(PM.tileTimer){clearTimeout(PM.tileTimer);PM.tileTimer=null}
  if(PM.tileLayer&&PM.map){try{PM.map.removeLayer(PM.tileLayer)}catch(e){}PM.tileLayer=null}
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
  if(PM.tileLayer){try{PM.map.removeLayer(PM.tileLayer)}catch(e){}PM.tileLayer=null}
  const chain=PM.chain||petaChain();PM.chain=chain;
  if(idx>=chain.length){petaActivateFallback();return}
  const bp=chain[idx];
  petaSetAttrib('Memuat peta dasar: '+bp.name+' …');
  PM.tileLayer=L.tileLayer(bp.url,bp.opts);
  PM.tileLayer.on('tileload',()=>{PM.tileOk++;if(PM.tileOk===1){if(PM.tileTimer){clearTimeout(PM.tileTimer);PM.tileTimer=null}petaSetAttrib(idx>0?('Tampilan pilihan tidak terjangkau — memakai '+bp.name+' • Leaflet'):('Peta dasar: '+bp.name+' • Leaflet'))}});
  PM.tileLayer.on('tileerror',()=>{PM.tileErr++;petaCheckTiles()});
  PM.tileLayer.addTo(PM.map);
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
/* Isi popup pin sebagai elemen DOM (bukan teks HTML) supaya tombol
   admin di dalamnya — Perbaiki Posisi & Kembalikan Otomatis — bisa
   diberi penangan ketuk langsung. Popup menampilkan keterangan sumber
   posisi: 'Posisi manual' atau 'Otomatis dari alamat'. */
function petaPopupContent(en){
  const m=en.m;
  const anak=[
    h('div',{class:'peta-pop-name'},m.nama||'Tanpa nama'),
    h('span',{class:'peta-pop-badge',style:'background:'+regionColor(en.region)},en.region),
    h('div',{class:'peta-pop-addr'},
      [m.kota,m.pref].filter(Boolean).join(', '),
      h('br'),alamatJp(m,false),
      m.stasiun?h('span',{},h('br'),'Stasiun terdekat: '+m.stasiun):null,
      h('br'),'Sumber posisi: ',h('b',{},petaSumberLabel(en)),
      en.manual?h('span',{},h('br'),'Koordinat: '+en.coords[0].toFixed(5)+', '+en.coords[1].toFixed(5)):h('span',{},h('br'),'Ketepatan pin: '+(en.lvl||'Kode pos')))
  ];
  if(S.admin){
    const tombol=[
      h('button',{type:'button',class:'btn s',onclick:ev=>{ev.stopPropagation();petaMulaiPerbaiki(en)}},S.petaFixMode?'Geser pin ini di peta':'Perbaiki Posisi')
    ];
    if(en.manual)tombol.push(h('button',{type:'button',class:'btn s',onclick:ev=>{ev.stopPropagation();petaKembalikanOtomatis(en)}},'Kembalikan Otomatis'));
    anak.push(h('div',{class:'peta-pop-actions'},...tombol));
  }
  return h('div',{class:'peta-pop'},...anak);
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
  const kids=[buat('Semua','#2b7a8c',PM.entries.length,!S.petaFilter,()=>{S.petaFilter=null;petaRefresh()})];
  const ada=new Set();
  wilayahEfektif().forEach(([name,color])=>{
    ada.add(name);
    const n=PM.entries.filter(en=>en.region===name).length;
    kids.push(buat(name,color,n,S.petaFilter===name,()=>{S.petaFilter=S.petaFilter===name?null:name;petaRefresh()}));
  });
  /* Wilayah di luar daftar efektif (mis. 'Belum dipilih') tetap bisa disaring */
  [...new Set(PM.entries.map(en=>en.region))].filter(r=>!ada.has(r)).forEach(r=>{
    const n=PM.entries.filter(en=>en.region===r).length;
    kids.push(buat(r,regionColor(r),n,S.petaFilter===r,()=>{S.petaFilter=S.petaFilter===r?null:r;petaRefresh()}));
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
function petaRenderList(){
  const ul=document.getElementById('peta-list');if(!ul)return;
  const list=petaFiltered().slice().sort((a,b)=>a.region.localeCompare(b.region)||String(a.m.nama||'').localeCompare(String(b.m.nama||'')));
  const empty=document.getElementById('peta-empty');if(empty)empty.style.display=list.length?'none':'block';
  ul.replaceChildren(...list.map(en=>{
    const m=en.m,c=regionColor(en.region);
    return h('li',{},h('button',{type:'button',class:'peta-member-item'+(String(S.petaSelected)===en.key?' on':''),onclick:()=>petaSelect(en,{fly:true,popup:true})},
      h('span',{class:'peta-avatar',style:'background:'+c},petaInisial(m.nama)),
      h('span',{class:'peta-member-main'},h('strong',{},m.nama||'Tanpa nama'),h('span',{},[m.kota,m.pref].filter(Boolean).join(', ')||'—',m.alamat_jp?' • '+m.alamat_jp:'',en.manual?' • Posisi manual':'')),
      h('span',{class:'peta-mini-badge',style:'background:'+c},en.region)));
  }));
}
function petaRenderStats(){
  const total=document.getElementById('peta-stat-total');if(total)total.textContent=String((S.members||[]).length);
  const belumNote=document.getElementById('peta-belum-note');
  if(belumNote){
    const sisa=(S.members||[]).length-PM.entries.length;
    if(sisa>0){belumNote.style.display='block';belumNote.textContent=sisa+' anggota belum tampil di peta karena alamat/kode pos Jepangnya belum berhasil dipetakan persis. Lengkapi alamat mereka lewat menu Daftar Anggota supaya pin mereka muncul.'}
    else belumNote.style.display='none';
  }
  const pin=document.getElementById('peta-stat-pin');if(pin)pin.textContent=String(PM.entries.length);
  const wil=document.getElementById('peta-stat-wilayah');if(wil)wil.textContent=String(new Set((S.members||[]).map(m=>memberRegion(m))).size);
}
function petaRefresh(){petaRenderChips();petaRenderMarkers();petaRenderList();petaRenderStats()}
function petaShowDetail(en){
  const card=document.getElementById('peta-detail');if(!card)return;
  const m=en.m,c=regionColor(en.region);
  const boxInfo=(label,value)=>h('div',{class:'peta-detail-box'},h('label',{},label),h('p',{},value||'—'));
  const sumber=en.manual
    ?'Posisi manual — ditetapkan admin pada '+en.coords[0].toFixed(5)+', '+en.coords[1].toFixed(5)+'. Pin ini tidak digeser geocoding otomatis.'
    :('Otomatis dari alamat — ketepatan '+(en.lvl||'Kode pos')+(en.lvl==='Alamat'?' (titik hasil geocoding alamat lengkap, dekat titik kode pos alamat ini)':' (titik kawasan kode pos alamat ini)'));
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
  if(S.admin){
    const tombol=[h('button',{type:'button',class:'btn s',onclick:()=>petaMulaiPerbaiki(en)},S.petaFixMode?'Geser pin ini di peta':'Perbaiki Posisi')];
    if(en.manual)tombol.push(h('button',{type:'button',class:'btn s',onclick:()=>petaKembalikanOtomatis(en)},'Kembalikan Otomatis'));
    anak.push(h('div',{class:'fl',style:'margin-top:12px'},...tombol));
  }
  anak.push(h('p',{class:'peta-detail-note'},'Ketuk area peta di luar pin untuk menutup detail ini.'));
  card.replaceChildren(...anak);
  card.style.display='block';
}
function petaHideDetail(){const card=document.getElementById('peta-detail');if(card){card.style.display='none';card.replaceChildren()}}
function petaSelect(en,opts){
  opts=opts||{};S.petaSelected=en.key;
  petaShowDetail(en);petaRenderMarkers();petaRenderList();
  if(opts.fly&&PM.map)PM.map.flyTo(en.coords,Math.max(PM.map.getZoom(),11),{duration:.7});
  if(opts.popup&&PM.markers[en.key])setTimeout(()=>{const mk=PM.markers[en.key];if(mk)mk.openPopup()},opts.fly?750:60);
  if(window.innerWidth<900){const card=document.getElementById('peta-detail');if(card)card.scrollIntoView({behavior:'smooth',block:'nearest'})}
}
function vPeta(){
  const {entries,belum}=petaEntries();
  const stat=(id,val,label)=>h('div',{class:'peta-stat'},h('b',{id},String(val)),h('span',{},label));
  const styleBtn=(key,label)=>h('button',{type:'button',class:'peta-style-btn'+(PM.style===key?' on':''),'data-style':key,'aria-label':'Tampilan peta '+label},label);
  const fixAktif=!!(S.admin&&S.petaFixMode);
  const mapCard=h('section',{class:'peta-map-card'},
    h('div',{class:'peta-map-head'},
      h('div',{},h('h2',{},'Peta Jepang — Shikoku & sekitarnya'),h('p',{},fixAktif?'Mode Perbaiki Posisi Pin aktif — geser pin ke posisi yang benar':'Ketuk pin untuk melihat nama anggota • Geser & zoom bebas')),
      h('div',{class:'peta-map-head-side'},
        h('div',{class:'peta-style-switch',role:'group','aria-label':'Pilihan tampilan peta'},styleBtn('jalan','Jalan'),styleBtn('satelit','Satelit'),styleBtn('terang','Terang')),
        h('span',{class:'peta-count-badge',id:'peta-count'},entries.length+' pin tampil'))),
    fixAktif?h('div',{class:'peta-fix-banner'},h('b',{},'Perbaiki Posisi Pin'),h('span',{},'Geser pin anggota ke posisi yang benar lalu lepaskan — posisi baru langsung tersimpan sebagai pin manual. Ketuk "Selesai Memperbaiki" bila sudah.')):null,
    h('div',{id:'peta-fix-notice',class:'peta-fix-notice',style:S.petaFixNotice?'display:block':'display:none'},S.petaFixNotice||''),
    h('div',{id:'peta-map',role:'application','aria-label':'Peta anggota Shikoku Family'}),
    h('div',{id:'peta-geo-status',class:'peta-geo-status',style:'display:none'}),
    h('div',{id:'peta-notice',class:'peta-notice',style:'display:none'},'Server peta luar sedang tidak terjangkau, jadi yang tampil adalah ',h('b',{},'peta dasar cadangan lokal'),'. Pencarian, saringan wilayah, dan detail anggota tetap bekerja.'),
    h('div',{class:'peta-map-foot'},h('span',{id:'peta-attrib'},'Memuat peta dasar… • Leaflet'),h('span',{id:'peta-hint'},fixAktif?'Mode Perbaiki Posisi Pin aktif — geser pin untuk memindahkannya':'Menampilkan semua wilayah')));
  const stats=h('div',{class:'peta-stats'},
    stat('peta-stat-total',(S.members||[]).length,'Total anggota'),
    stat('peta-stat-pin',entries.length,'Terpetakan di peta'),
    stat('peta-stat-wilayah',new Set((S.members||[]).map(m=>memberRegion(m))).size,'Wilayah terisi'));
  const detail=h('section',{id:'peta-detail',class:'peta-detail',style:'display:none'});
  const controls=box(
    h('div',{class:'peta-controls-row'},
      h('label',{class:'peta-search'},icon('search',17),h('input',{id:'peta-search',type:'search',placeholder:'Cari nama anggota…',autocomplete:'off'})),
      h('button',{type:'button',class:'btn s',id:'peta-reset'},'Semua wilayah'),
      h('button',{type:'button',class:'btn s',id:'peta-shikoku'},'Ke Shikoku'),
      S.admin?h('button',{type:'button',class:'btn s'+(fixAktif?' peta-fix-on':''),id:'peta-fix-toggle'},fixAktif?'Selesai Memperbaiki':'Perbaiki Posisi Pin'):null),
    h('div',{class:'peta-legend-head'},h('h3',{},'Legenda warna wilayah'),h('span',{},'Angka = jumlah anggota terpetakan • Ketuk chip untuk menyaring, ketuk lagi untuk membatalkan')),
    h('div',{class:'peta-chips',id:'peta-chips'}));
  const listCard=box(
    h('h2',{class:'peta-h2'},'Daftar Anggota'),
    h('p',{class:'sub',style:'margin-bottom:4px'},'Ketuk nama untuk memusatkan peta ke pin-nya. Daftar mengikuti pencarian & saringan wilayah di atas.'),
    h('ul',{class:'peta-member-list',id:'peta-list'}),
    h('div',{class:'peta-empty',id:'peta-empty',style:'display:none'},'Tidak ada anggota yang cocok. Coba kata pencarian lain atau tampilkan semua wilayah.'));
  const out=[h('h1',{},'Peta & Wilayah'),mapCard,stats];
  if(belum.length)out.push(h('p',{class:'warn peta-belum',id:'peta-belum-note'},belum.length+' anggota belum tampil di peta karena alamat/kode pos Jepangnya belum berhasil dipetakan persis. Lengkapi alamat mereka lewat menu Daftar Anggota supaya pin mereka muncul.'));
  out.push(detail,controls,listCard);
  return out;
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
    if(PM.map){try{PM.map.remove()}catch(e){}PM.map=null;PM.layer=null;PM.markers={};PM.tileLayer=null;PM.fallbackLayer=null;PM.fallback=false;PM.spiderLayer=null;PM.spider=null;PM.clusters=[];PM.clusterOf={}}
    PM.gen=(PM.gen||0)+1;
    PM.entries=petaEntries().entries;
    document.querySelectorAll('.peta-style-btn').forEach(b=>{b.classList.toggle('on',b.getAttribute('data-style')===PM.style);b.onclick=()=>petaSetStyle(b.getAttribute('data-style'))});
    const search=document.getElementById('peta-search');
    if(search){search.value=S.petaSearch||'';search.oninput=()=>{S.petaSearch=search.value.trim();petaRenderMarkers();petaRenderList();petaRenderStats()}}
    const reset=document.getElementById('peta-reset');
    if(reset)reset.onclick=()=>{S.petaFilter=null;S.petaSearch='';S.petaSelected=null;const s=document.getElementById('peta-search');if(s)s.value='';petaHideDetail();petaRefresh()};
    const ke=document.getElementById('peta-shikoku');
    if(ke)ke.onclick=()=>{if(PM.map)PM.map.flyTo([33.9,133.7],window.innerWidth<640?7:8,{duration:.7})};
    const fixBtn=document.getElementById('peta-fix-toggle');
    if(fixBtn)fixBtn.onclick=()=>{
      if(!S.admin)return;
      S.petaFixMode=!S.petaFixMode;
      if(!S.petaFixMode)S.petaFixNotice='';
      render();
    };
    if(S.petaFixMode&&!S.admin)S.petaFixMode=false;
    if(typeof L==='undefined'){
      el.replaceChildren(h('div',{class:'peta-nomap'},h('b',{},'Peta sedang tidak tampil'),h('span',{},'Daftar anggota, legenda, dan saringan wilayah di bawah tetap bisa dipakai.')));
      petaRefresh();
      return;
    }
    PM.map=L.map(el,{scrollWheelZoom:true}).setView([33.9,133.7],window.innerWidth<640?7:8);
    PM.layer=L.layerGroup().addTo(PM.map);
    PM.spiderLayer=L.layerGroup().addTo(PM.map);
    PM.map.on('zoomstart',()=>petaSpiderCollapse());
    PM.map.on('movestart',()=>petaSpiderCollapse());
    PM.map.on('zoomend moveend',()=>petaComputeClusters());
    PM.map.on('click',()=>{petaSpiderCollapse();S.petaSelected=null;petaHideDetail();petaRenderMarkers();petaRenderList()});
    PM.chain=petaChain();
    petaTryBasemap(0);
    petaRefresh();
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
      el.replaceChildren(h('div',{class:'peta-nomap'},h('b',{},'Peta sedang tidak tampil'),h('span',{},'Periksa koneksi lalu coba lagi. Posisi pin otomatis dari alamat tetap bekerja.')));
      return;
    }
    const f=S.form;
    const awal=formPinTitikAwal(f);
    /* Titik mulai panel: pilihan sementara sesi ini (bila panel dibuka
       lagi tanpa menyimpan) didahulukan, lalu titik awal terbaik. */
    const mulai=(Array.isArray(S.formPinTemp)&&S.formPinTemp.length===2)?S.formPinTemp:(pinManualCoords(f)||awal.coords);
    FP.map=L.map(el,{scrollWheelZoom:true}).setView(awal.coords,awal.zoom);
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
