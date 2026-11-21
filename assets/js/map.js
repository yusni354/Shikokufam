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
   warna wilayah aplikasi (wilayahEfektif, termasuk wilayah tambahan dari
   pilihan terkelola). Posisi pin dari alamat anggota: kota/prefektur
   dikenali lewat inferJapanLocation (cara yang sama dengan penentuan
   wilayah), lalu dipasangkan ke kamus koordinat kota di bawah, ditambah
   geseran kecil yang stabil per anggota. Anggota yang alamat/kotanya
   tidak dikenal TIDAK dibuatkan pin — mereka dihitung dan diberi
   keterangan di bawah peta.
   Peta dasar dicoba berurutan dari beberapa penyedia ubin gratis; bila
   satu gagal, otomatis pindah ke berikutnya. Bila semuanya gagal, tampil
   peta dasar cadangan lokal (assets/japan-basemap.svg) supaya tidak
   pernah muncul tulisan error dari server ubin. Seluruh modul dijaga:
   bila Leaflet gagal dimuat, halaman tetap tampil (daftar, legenda, dan
   statistik tetap bekerja) dan aplikasi tidak berhenti. */
function petaNormKey(v){return String(v||'').toLowerCase().replace(/[^a-z0-9]/g,'')}
/* Kamus koordinat tingkat kota [lat, lng] — kunci sudah dinormalkan
   (huruf kecil, tanpa spasi/tanda baca) lewat petaNormKey. */
const PETA_KOTA={
  tokushima:[34.0658,134.5593],naruto:[34.1729,134.6089],anan:[33.9215,134.6596],komatsushima:[34.0069,134.5908],yoshinogawa:[34.075,134.358],mima:[34.055,134.170],
  takamatsu:[34.3401,134.0434],sanuki:[34.322,134.204],higashikagawa:[34.243,134.358],miki:[34.267,134.133],naoshima:[34.460,133.995],shodoshima:[34.482,134.185],
  marugame:[34.2895,133.7977],sakaide:[34.3164,133.8605],utazu:[34.311,133.826],ayagawa:[34.254,134.006],tadotsu:[34.272,133.753],
  zentsuji:[34.2276,133.7872],zentsujitakuma:[34.210,133.730],takuma:[34.182,133.646],mitoyo:[34.177,133.715],kanonji:[34.126,133.661],kotohira:[34.183,133.817],manno:[34.193,133.843],
  matsuyama:[33.8392,132.7657],niihama:[33.9603,133.2834],imabari:[34.0661,132.9978],saijo:[33.9196,133.1810],shikokuchuo:[33.981,133.549],ozu:[33.506,132.544],uwajima:[33.223,132.560],
  kochi:[33.5586,133.5311],nankoku:[33.575,133.641],shimanto:[32.991,132.934],aki:[33.502,133.906],susaki:[33.393,133.283],
  okayama:[34.6618,133.9344],kurashiki:[34.585,133.772],tsuyama:[35.069,134.004],tamano:[34.493,133.948],soja:[34.672,133.745],bizen:[34.738,134.188],setouchi:[34.660,134.095],kasaoka:[34.507,133.507],ibara:[34.598,133.461],akaiwa:[34.755,133.955]
};
const PETA_PREF={tokushima:[34.0658,134.5593],kagawa:[34.3401,134.0434],ehime:[33.8392,132.7657],kochi:[33.5586,133.5311],okayama:[34.6618,133.9344]};
function petaHash(s){let x=0;for(let i=0;i<s.length;i++)x=((x<<5)-x+s.charCodeAt(i))|0;return Math.abs(x)}
function petaJitter(base,m){
  const x=petaHash(String(m.id||m.nama||'')+'|'+String(m.alamat_jp||''));
  return [base[0]+(((x%160)-80)/10000),base[1]+((((x>>3)%160)-80)/10000)];
}
/* Koordinat anggota dari alamatnya; null bila kota & prefektur tidak dikenal */
function petaCoords(m){
  const loc=inferJapanLocation(m.alamat_jp,m.kota,m.kec_jp,m.kodepos,m.pref,m.wilayah);
  const calon=[loc&&loc.kota,m.kota,m.kec_jp];
  for(const k of calon){const c=k&&PETA_KOTA[petaNormKey(k)];if(c)return petaJitter(c,m)}
  const pref=(loc&&loc.pref)||m.pref;
  const pc=pref&&PETA_PREF[petaNormKey(pref)];
  return pc?petaJitter(pc,m):null;
}
/* Bagi anggota menjadi yang terpetakan (punya koordinat) dan yang belum */
function petaEntries(){
  const entries=[],belum=[];
  (S.members||[]).forEach((m,i)=>{
    const coords=petaCoords(m);
    if(coords)entries.push({m,region:memberRegion(m),coords,key:String(m.id||('idx'+i))});
    else belum.push(m);
  });
  return {entries,belum};
}
function petaEsc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function petaInisial(nama){const p=String(nama||'?').trim().split(/\s+/);return ((p[0]||'?')[0]+((p[1]||'')[0]||'')).toUpperCase()}
/* Keadaan peta yang sedang hidup (satu instance Leaflet dalam satu waktu) */
const PM={map:null,layer:null,markers:{},entries:[],tileLayer:null,tileOk:0,tileErr:0,tileTimer:null,basemapIdx:0,fallback:false,fallbackLayer:null};
/* Rantai peta dasar: hanya penyedia yang benar-benar gratis tanpa API key.
   CARTO (light & Voyager) SENGAJA dikeluarkan: sejak 2026 servernya
   mengembalikan ubin placeholder bertuliskan "API KEY REQUIRED" dengan
   status HTTP sukses, jadi ubin watermark itu lolos deteksi tileerror/
   timeout, rantai tidak pernah berpindah, dan peta tampil coretan.
   Esri World Street Map terbukti menyajikan ubin peta asli tanpa kunci;
   OpenStreetMap standar cadangan kedua; terakhir peta lokal (SVG). */
const PETA_BASEMAPS=[
  {name:'Esri World Street Map',url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',opts:{maxZoom:19,attribution:'Tiles &copy; Esri'}},
  {name:'OpenStreetMap',url:'https://tile.openstreetmap.org/{z}/{x}/{y}.png',opts:{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}}
];
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
  if(idx>=PETA_BASEMAPS.length){petaActivateFallback();return}
  const bp=PETA_BASEMAPS[idx];
  petaSetAttrib('Memuat peta dasar: '+bp.name+' …');
  PM.tileLayer=L.tileLayer(bp.url,bp.opts);
  PM.tileLayer.on('tileload',()=>{PM.tileOk++;if(PM.tileOk===1){if(PM.tileTimer){clearTimeout(PM.tileTimer);PM.tileTimer=null}petaSetAttrib('Peta dasar: '+bp.name+' • Leaflet')}});
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
  const hint=document.getElementById('peta-hint');if(hint)hint.textContent=S.petaFilter?('Menyaring: '+S.petaFilter):'Menampilkan semua wilayah';
  if(!PM.map||!PM.layer||typeof L==='undefined')return;
  PM.layer.clearLayers();PM.markers={};
  list.forEach(en=>{
    const mk=L.marker(en.coords,{icon:petaIcon(en,String(S.petaSelected)===en.key)});
    const m=en.m;
    const popup='<div class="peta-pop"><div class="peta-pop-name">'+petaEsc(m.nama||'Tanpa nama')+'</div>'
      +'<div class="peta-pop-badge" style="background:'+regionColor(en.region)+'">'+petaEsc(en.region)+'</div>'
      +'<div class="peta-pop-addr">'+petaEsc([m.kota,m.pref].filter(Boolean).join(', '))+'<br>'+petaEsc(alamatJp(m,false))+(m.stasiun?'<br>Stasiun terdekat: '+petaEsc(m.stasiun):'')+'</div></div>';
    mk.bindPopup(popup,{closeButton:false,maxWidth:280,className:'peta-popup'});
    /* Tooltip hover: nama anggota melayang di atas pin saat kursor diarahkan.
       interactive:false + sticky:false → murni label, hilang saat kursor
       menjauh dan tidak menangkap ketukan di layar sentuh. */
    const tip='<div class="pin-tip-name">'+petaEsc(m.nama||'Tanpa nama')+'</div>'
      +'<div class="pin-tip-sub"><i style="background:'+regionColor(en.region)+'"></i>'+petaEsc(en.region)+(m.kota?' • '+petaEsc(m.kota):'')+'</div>';
    mk.bindTooltip(tip,{direction:'top',offset:[0,-34],className:'pin-tip',sticky:false,interactive:false,opacity:1});
    mk.on('click',()=>{if(mk.closeTooltip)mk.closeTooltip();petaSelect(en,{popup:true})});
    mk.addTo(PM.layer);PM.markers[en.key]=mk;
  });
  petaLayoutPins();
}
/* Sebar pin yang berdekatan dalam ruang layar supaya tidak saling menutupi.
   Posisi dasar (kota anggota) tidak berubah — geseran dihitung ulang dari
   posisi dasar setiap kali peta digambar atau zoom berubah. */
function petaLayoutPins(){
  if(!PM.map||typeof L==='undefined')return;
  const zoom=PM.map.getZoom(),pts=[];
  petaFiltered().forEach(en=>{
    const mk=PM.markers[en.key];if(!mk)return;
    const p=PM.map.project(L.latLng(en.coords[0],en.coords[1]),zoom);
    pts.push({mk,x:p.x,y:p.y});
  });
  if(pts.length<2)return;
  const MIN=37;
  for(let it=0;it<90;it++){
    let moved=false;
    for(let i=0;i<pts.length;i++)for(let j=i+1;j<pts.length;j++){
      const a=pts[i],b=pts[j];
      let dx=b.x-a.x,dy=b.y-a.y,d=Math.sqrt(dx*dx+dy*dy);
      if(d<MIN){
        if(d<0.01){dx=(j+1)*0.6;dy=0.4;d=Math.sqrt(dx*dx+dy*dy)}
        const push=(MIN-d)/2,ux=dx/d,uy=dy/d;
        a.x-=ux*push;a.y-=uy*push;b.x+=ux*push;b.y+=uy*push;moved=true;
      }
    }
    if(!moved)break;
  }
  pts.forEach(o=>o.mk.setLatLng(PM.map.unproject(L.point(o.x,o.y),zoom)));
}
function petaRenderList(){
  const ul=document.getElementById('peta-list');if(!ul)return;
  const list=petaFiltered().slice().sort((a,b)=>a.region.localeCompare(b.region)||String(a.m.nama||'').localeCompare(String(b.m.nama||'')));
  const empty=document.getElementById('peta-empty');if(empty)empty.style.display=list.length?'none':'block';
  ul.replaceChildren(...list.map(en=>{
    const m=en.m,c=regionColor(en.region);
    return h('li',{},h('button',{type:'button',class:'peta-member-item'+(String(S.petaSelected)===en.key?' on':''),onclick:()=>petaSelect(en,{fly:true,popup:true})},
      h('span',{class:'peta-avatar',style:'background:'+c},petaInisial(m.nama)),
      h('span',{class:'peta-member-main'},h('strong',{},m.nama||'Tanpa nama'),h('span',{},[m.kota,m.pref].filter(Boolean).join(', ')||'—',m.alamat_jp?' • '+m.alamat_jp:'')),
      h('span',{class:'peta-mini-badge',style:'background:'+c},en.region)));
  }));
}
function petaRenderStats(){
  const total=document.getElementById('peta-stat-total');if(total)total.textContent=String((S.members||[]).length);
  const pin=document.getElementById('peta-stat-pin');if(pin)pin.textContent=String(PM.entries.length);
  const wil=document.getElementById('peta-stat-wilayah');if(wil)wil.textContent=String(new Set((S.members||[]).map(m=>memberRegion(m))).size);
}
function petaRefresh(){petaRenderChips();petaRenderMarkers();petaRenderList();petaRenderStats()}
function petaShowDetail(en){
  const card=document.getElementById('peta-detail');if(!card)return;
  const m=en.m,c=regionColor(en.region);
  const boxInfo=(label,value)=>h('div',{class:'peta-detail-box'},h('label',{},label),h('p',{},value||'—'));
  card.replaceChildren(
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
      boxInfo('Stasiun terdekat • Kode pos',[m.stasiun,m.kodepos?('〒'+m.kodepos):''].filter(Boolean).join('  •  '))),
    h('p',{class:'peta-detail-note'},'Ketuk area peta di luar pin untuk menutup detail ini.'));
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
  const mapCard=h('section',{class:'peta-map-card'},
    h('div',{class:'peta-map-head'},
      h('div',{},h('h2',{},'Peta Jepang — Shikoku & sekitarnya'),h('p',{},'Ketuk pin untuk melihat nama anggota • Geser & zoom bebas')),
      h('span',{class:'peta-count-badge',id:'peta-count'},entries.length+' pin tampil')),
    h('div',{id:'peta-map',role:'application','aria-label':'Peta anggota Shikoku Family'}),
    h('div',{id:'peta-notice',class:'peta-notice',style:'display:none'},'Server peta luar sedang tidak terjangkau, jadi yang tampil adalah ',h('b',{},'peta dasar cadangan lokal'),'. Pencarian, saringan wilayah, dan detail anggota tetap bekerja.'),
    h('div',{class:'peta-map-foot'},h('span',{id:'peta-attrib'},'Memuat peta dasar… • Leaflet'),h('span',{id:'peta-hint'},'Menampilkan semua wilayah')));
  const stats=h('div',{class:'peta-stats'},
    stat('peta-stat-total',(S.members||[]).length,'Total anggota'),
    stat('peta-stat-pin',entries.length,'Terpetakan di peta'),
    stat('peta-stat-wilayah',new Set((S.members||[]).map(m=>memberRegion(m))).size,'Wilayah terisi'));
  const detail=h('section',{id:'peta-detail',class:'peta-detail',style:'display:none'});
  const controls=box(
    h('div',{class:'peta-controls-row'},
      h('label',{class:'peta-search'},icon('search',17),h('input',{id:'peta-search',type:'search',placeholder:'Cari nama anggota…',autocomplete:'off'})),
      h('button',{type:'button',class:'btn s',id:'peta-reset'},'Semua wilayah'),
      h('button',{type:'button',class:'btn s',id:'peta-shikoku'},'Ke Shikoku')),
    h('div',{class:'peta-legend-head'},h('h3',{},'Legenda warna wilayah'),h('span',{},'Angka = jumlah anggota terpetakan • Ketuk chip untuk menyaring, ketuk lagi untuk membatalkan')),
    h('div',{class:'peta-chips',id:'peta-chips'}));
  const listCard=box(
    h('h2',{class:'peta-h2'},'Daftar Anggota'),
    h('p',{class:'sub',style:'margin-bottom:4px'},'Ketuk nama untuk memusatkan peta ke pin-nya. Daftar mengikuti pencarian & saringan wilayah di atas.'),
    h('ul',{class:'peta-member-list',id:'peta-list'}),
    h('div',{class:'peta-empty',id:'peta-empty',style:'display:none'},'Tidak ada anggota yang cocok. Coba kata pencarian lain atau tampilkan semua wilayah.'));
  const out=[h('h1',{},'Peta & Wilayah'),mapCard,stats];
  if(belum.length)out.push(h('p',{class:'warn peta-belum'},belum.length+' anggota belum tampil di peta karena alamat/kota Jepangnya belum dikenal. Lengkapi alamat mereka lewat menu Daftar Anggota supaya pin mereka muncul.'));
  out.push(detail,controls,listCard,
    h('h2',{class:'peta-h2',style:'margin:20px 4px 10px'},'Sebaran per Wilayah'),
    ...sebaran());
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
    if(PM.map){try{PM.map.remove()}catch(e){}PM.map=null;PM.layer=null;PM.markers={};PM.tileLayer=null;PM.fallbackLayer=null;PM.fallback=false}
    PM.entries=petaEntries().entries;
    const search=document.getElementById('peta-search');
    if(search){search.value=S.petaSearch||'';search.oninput=()=>{S.petaSearch=search.value.trim();petaRenderMarkers();petaRenderList();petaRenderStats()}}
    const reset=document.getElementById('peta-reset');
    if(reset)reset.onclick=()=>{S.petaFilter=null;S.petaSearch='';S.petaSelected=null;const s=document.getElementById('peta-search');if(s)s.value='';petaHideDetail();petaRefresh()};
    const ke=document.getElementById('peta-shikoku');
    if(ke)ke.onclick=()=>{if(PM.map)PM.map.flyTo([33.9,133.7],window.innerWidth<640?7:8,{duration:.7})};
    if(typeof L==='undefined'){
      el.replaceChildren(h('div',{class:'peta-nomap'},h('b',{},'Peta sedang tidak tampil'),h('span',{},'Daftar anggota, legenda, dan saringan wilayah di bawah tetap bisa dipakai.')));
      petaRefresh();
      return;
    }
    PM.map=L.map(el,{scrollWheelZoom:true}).setView([33.9,133.7],window.innerWidth<640?7:8);
    PM.layer=L.layerGroup().addTo(PM.map);
    PM.map.on('click',()=>{S.petaSelected=null;petaHideDetail();petaRenderMarkers();petaRenderList()});
    PM.map.on('zoomend',()=>petaLayoutPins());
    petaTryBasemap(0);
    petaRefresh();
    if(S.petaSelected){const en=PM.entries.find(x=>x.key===String(S.petaSelected));if(en)petaShowDetail(en)}
  }catch(e){
    console.error('Peta anggota gagal dimulai (halaman lain tidak terpengaruh):',e);
    PM.map=null;
    try{petaRefresh()}catch(e2){console.error(e2)}
  }
}

function sebaran(){const w=wilayah(),k=Object.keys(w);return k.length?k.map(n=>h('div',{class:'card',style:'display:block'},h('div',{class:'row'},h('b',{},icon('pin',16),h('span',{},n.toUpperCase())),h('span',{class:'tag'},w[n].length+' anggota')),h('small',{},w[n].map(x=>(x.nama||'').toUpperCase()).join(', ')))):[h('p',{class:'warn'},'Belum ada data wilayah.')]}
