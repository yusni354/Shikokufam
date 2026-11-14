/* Daftar halaman: nama tampilan -> fungsi yang menggambarnya */
const V={
  landing:vHome,
  dash:vDash,
  members:vMembers,
  kegiatan:vKegiatan,
  piket:vPiket,
  peta:vPeta,
  forum:vForum,
  pesan:vPesan,
  'map-settings':vPetaSettings,
  approvals:vApprovals
};
function navTo(view){return event=>{event.preventDefault();go(view)}}
/* Menu samping, render() utama, dan langganan data */
function renderDrawer(){
  const d=$('#dr');
  if(S.adminMenuOpen){
    d.replaceChildren(
      h('p',{class:'sub',style:'padding:0 14px'},h('b',{style:'color:var(--ink)'},'PENGATURAN ADMIN'),h('br'),'Pengelolaan situs'),
      ...ADMIN_MENU.map(([view,label,glyph])=>h('a',{class:S.view===view?'on':'',href:'#',onclick:navTo(view)},icon(glyph),h('span',{},label))),
      h('button',{class:'menu-logout',onclick:()=>go('landing')},icon('back',17),h('span',{},'Kembali ke menu utama'))
    );
    return;
  }
  d.replaceChildren(h('p',{class:'sub',style:'padding:0 14px'},h('b',{style:'color:var(--ink)'},'KOMUNITAS ID-JP'),h('br'),'Database Anggota'),
    ...ALL.filter(x=>!x[2]||(x[3]?S.mainAdmin:S.admin)).map(x=>h('a',{class:S.view===x[0]?'on':'',href:'#',onclick:navTo(x[0]),...(x[0]==='pesan'?{'data-message-nav':'true'}:{})},
      icon(x[4],19),h('span',{},x[1]),x[0]==='pesan'&&S.unreadMessages>0&&h('span',{class:'nav-badge'},String(S.unreadMessages)))),
    h('button',{class:'menu-logout',onclick:async()=>{await S.supabase.auth.signOut()}},icon('logout',17),h('span',{},'Keluar')));
}
function render(){
  if(S.activityScannerStop)S.activityScannerStop();
  if(!S.mainAdmin)S.adminMenuOpen=false;
  syncAdminTheme();
  if(S.authLoading){
    $('#dr').replaceChildren();
    $('#app').replaceChildren(h('p',{class:'warn',style:'text-align:center;padding:40px 16px'},'Memeriksa sesi login...'));
    $('#tb').style.display='none';
    $('#pet').style.display='none';
    $('#sw').style.display='none';
    return;
  }
  if(S.supabase&&!S.uid){
    $('#dr').replaceChildren();
    $('#app').replaceChildren(h('div',{class:'landing'},h('section',{class:'hero'},
      h('p',{style:'font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-bottom:10px'},'SHIKOKU FAMILY'),
      h('h1',{},'Selamat datang!'),
      h('p',{},'Silakan masuk atau buat akun untuk bergabung dan menerima balasan dari admin.'),
      accountForm()
    )));
    $('#tb').style.display='none';
    $('#pet').style.display='none';
    $('#sw').style.display='none';
    document.body.classList.remove('open');
    return;
  }
  if(S.supabase&&S.uid&&S.approvalStatus!=='approved'&&!S.admin){
    $('#dr').replaceChildren();
    const status=S.approvalStatus==='rejected'?'Akun ini ditolak admin.':'Akun ini belum disetujui admin.';
    $('#app').replaceChildren(h('section',{class:'card auth-card'},h('b',{},status),h('p',{class:'sub'},'Data anggota, kegiatan, dan wilayah hanya dimuat setelah akun disetujui. Hubungi admin utama untuk memeriksa status akun.'),h('button',{class:'btn',onclick:async()=>{await S.supabase.auth.signOut()}},'Keluar')));
    $('#tb').style.display='none';
    $('#pet').style.display='none';
    $('#sw').style.display='none';
    document.body.classList.remove('open');
    return;
  }
  renderDrawer();
  $('#sw').style.display=S.mainAdmin?'flex':'none';
  const approvalBadge=$('#ab');
  if(approvalBadge){
    approvalBadge.textContent=S.pendingUsers.length?String(S.pendingUsers.length):'';
    approvalBadge.style.display=S.pendingUsers.length?'inline-grid':'none';
  }
  const current=ALL.find(x=>x[0]===S.view);
  if(!V[S.view]||(['map-settings','approvals'].includes(S.view)&&!S.mainAdmin))S.view='landing';
  const content=[];
  const storageErrors=Object.values(S.storageErrors||{});
  if(storageErrors.length)content.push(h('p',{class:'warn storage-warning'},'Database bersama tidak dapat dibaca: '+storageErrors.join(' · ')+' Jalankan pembaruan skema Supabase, lalu muat ulang aplikasi.'));
  if(S.memberMediaError)content.push(h('p',{class:'warn storage-warning'},'Media anggota: '+S.memberMediaError));

  content.push(...[].concat(V[S.view]()).filter(Boolean));
  $('#app').replaceChildren(...content);
  hydrateMemberQrCodes();
  hydrateMemberMedia();
  const tb=$('#tb');tb.style.display=S.form?'none':'flex';$('#pet').style.display=S.form?'none':'block';
  tb.replaceChildren(...[['landing','home','Home'],['dash','chart','Ringkasan'],['members','users','Anggota'],['kegiatan','calendar','Kegiatan'],['piket','brush','Piket'],['forum','messages','Forum'],['pesan','inbox','Pesan Masuk']].map(x=>h('a',{class:S.view===x[0]?'on':'',href:'#',onclick:navTo(x[0])},icon(x[1],19),h('span',{},x[2]))));
}
function sub(name,key){
  return S.db.collection(name).onSnapshot(s=>{
    const hadError=Boolean(S.storageErrors[name]);
    if(hadError)delete S.storageErrors[name];
    const next=s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.at||0)-(b.at||0));
    const previous=JSON.stringify(S[key]||[]);
    S[key]=next;
    if(JSON.stringify(next)!==previous||hadError)render();
  },error=>{
    console.error('Koleksi Supabase '+name+' gagal dimuat:',error);
    S.storageErrors[name]=error.message||'Koneksi gagal';
    render();
  });
}
let dataUnsubscribers=[];
function stopDataSubscriptions(){
  dataUnsubscribers.forEach(unsubscribe=>{try{unsubscribe?.()}catch(error){console.error('Gagal menghentikan subscription data:',error)}});
  dataUnsubscribers=[];
}
function startDataSubscriptions(){
  stopDataSubscriptions();
  if(!S.db)return;
  dataUnsubscribers=[
    sub('members','members'),
    sub('events','events'),
    sub('topics','topics'),
    sub('cleaning_duties','cleaningDuties'),
    sub('pin','pins'),
  ];
  if(!S.supabase)dataUnsubscribers.push(sub('pengaturan','pengaturan'));
}
