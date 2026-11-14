/* Halaman Home dan Ringkasan */
function vHome(){
  const today=new Date(),todayKey=[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-');
  const upcomingDuties=[...S.cleaningDuties].filter(duty=>duty.tanggal&&duty.tanggal>=todayKey).sort((a,b)=>a.tanggal.localeCompare(b.tanggal)).slice(0,2);
  const recentEvents=[...S.events].sort((a,b)=>(b.at||0)-(a.at||0)).slice(0,2);
  const memberGroups=wilayah();
  const regionCards=WILAYAH.map(([name,color])=>{
    const members=[...(memberGroups[name]||[])].sort((a,b)=>(a.nama||'').localeCompare(b.nama||'','id'));
    return h('section',{class:'home-region-card',style:'--region-color:'+color},
      h('div',{class:'home-region-heading'},h('b',{},name),h('span',{},members.length+' anggota')),
      members.length
        ?h('div',{class:'home-region-members'},...members.map(member=>
          h('button',{class:'home-region-member',onclick:()=>openMember(member,'landing')},
            member.foto?h('img',{...memberMediaAttributes(member.foto,'src'),alt:''}):h('span',{class:'member-avatar-placeholder'},(member.nama||'?').trim().slice(0,1).toUpperCase()),
            h('span',{},member.nama||'Nama belum diisi'),h('span',{class:'home-region-arrow'},'›'))))
        :h('p',{class:'home-region-empty'},'Belum ada anggota di wilayah ini.')
    );
  });
  if(memberGroups['Belum dipilih']?.length)regionCards.push(h('section',{class:'home-region-card home-region-unknown'},h('div',{class:'home-region-heading'},h('b',{},'Wilayah belum dipilih'),h('span',{},memberGroups['Belum dipilih'].length+' anggota')),
    ...memberGroups['Belum dipilih'].map(member=>h('button',{class:'home-region-member',onclick:()=>openMember(member,'landing')},h('span',{class:'member-avatar-placeholder'},(member.nama||'?').trim().slice(0,1).toUpperCase()),h('span',{},member.nama||'Nama belum diisi'),h('span',{class:'home-region-arrow'},'›')))));
  const shortcuts=[['brush','Jadwal Piket','piket'],['calendar','Kegiatan','kegiatan'],['messages','Forum','forum'],['map','Peta','peta']];
  const dutyRows=upcomingDuties.flatMap(duty=>{
    const assignments=Array.isArray(duty.assignments)&&duty.assignments.length?duty.assignments:[{nama:duty.nama||'',tugas:duty.tugas||''}];
    return [h('div',{class:'home-duty'},
      h('div',{class:'home-duty-date'},h('b',{},String(new Date(duty.tanggal+'T00:00:00').getDate()).padStart(2,'0')),h('small',{},new Date(duty.tanggal+'T00:00:00').toLocaleDateString('id-ID',{month:'short'}))),
      h('div',{class:'home-duty-info'},...assignments.map(assignment=>h('p',{},h('b',{},assignment.nama),h('span',{},assignment.tugas))))
    )];
  });
  return [
    h('section',{class:'home-welcome'},
      h('span',{class:'home-welcome-icon'},icon('users',25)),
      h('div',{},h('small',{},today.toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'})),h('h1',{},'Selamat datang'+(S.name?', '+S.name.split(' ')[0]:'')+'!'),h('p',{},'Senang bisa berkumpul bersama keluarga Shikoku.'))
    ),
    h('div',{class:'stats home-stats'},...[['Anggota',S.members.length],['Kegiatan',S.events.length],['Wilayah',Object.keys(wilayah()).length]].map(item=>h('div',{},h('small',{},item[0]),h('b',{},String(item[1]))))),
    h('div',{class:'home-section-heading'},h('h2',{},'Daftar anggota'),S.admin&&h('button',{class:'btn s',onclick:()=>go('members')},'+ Tambah')),
    h('p',{class:'home-member-intro'},'Pilih nama anggota untuk membuka kartu identitas lengkap.'),
    h('div',{class:'home-region-list'},...regionCards),
    h('div',{class:'home-section-heading'},h('h2',{},'Akses cepat'),h('small',{},'Yang sering dibuka')),
    h('div',{class:'home-shortcuts'},...shortcuts.map(([glyph,label,view])=>h('button',{class:'home-shortcut',onclick:()=>go(view)},h('span',{class:'home-shortcut-icon'},icon(glyph,22)),h('b',{},label),h('span',{class:'home-shortcut-arrow'},'›')))),
    h('div',{class:'home-section-heading'},h('h2',{},'Jadwal piket terdekat'),h('button',{class:'btn s',onclick:()=>go('piket')},'Lihat semua')),
    upcomingDuties.length?h('div',{class:'home-agenda'},...dutyRows):h('div',{class:'home-empty'},icon('brush',23),h('p',{},'Belum ada jadwal piket mendatang.')),
    h('div',{class:'home-section-heading'},h('h2',{},'Kegiatan komunitas'),h('button',{class:'btn s',onclick:()=>go('kegiatan')},'Lihat kegiatan')),
    recentEvents.length?h('div',{class:'home-events'},...recentEvents.map(event=>h('div',{class:'home-event'},icon('calendar',19),h('div',{},h('b',{},event.judul||'Kegiatan komunitas'),h('small',{},eventParticipantCount(event)+' peserta · '+eventAttendanceCount(event)+' hadir'))))):h('div',{class:'home-empty'},icon('calendar',23),h('p',{},'Belum ada kegiatan komunitas.')),
    h('button',{class:'home-admin-link',onclick:askForm},icon('messages',17),' Butuh bantuan? Hubungi Admin')
  ];
}
function vDash(){
  const c=(glyph,t,d,n,v)=>h('button',{class:'card',onclick:()=>go(v)},
    h('span',{class:'e',style:'position:relative'},icon(glyph,23),v==='pesan'&&h('span',{class:'icon-badge','data-message-badge':'true',style:S.unreadMessages>0?'':'display:none'},String(S.unreadMessages))),
    h('span',{style:'flex:1'},h('b',{},t),h('small',{},d),h('br'),h('b',{style:'font-size:15px'},n)),'›');
  return [h('h1',{},'Selamat datang'+(S.name?', '+S.name.split(' ')[0]:'')+'!'),
    h('p',{class:'sub'},new Date().toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'})),
    h('div',{class:'card',style:'display:block'},h('small',{class:'warn'},'User ID'),h('br'),h('b',{},S.email||S.uid||'-')),
    h('div',{class:'stats'},...[['Anggota',S.members.length],['Kegiatan',S.events.length],['Wilayah',Object.keys(wilayah()).length]].map(x=>h('div',{},h('small',{},x[0]),h('b',{},String(x[1]))))),
    c('users','Daftar Anggota','Kelola data anggota komunitas',S.members.length+' anggota','members'),
    c('calendar','Kegiatan','Agenda, peserta, dan absensi anggota',S.events.length+' kegiatan','kegiatan'),
    c('brush','Jadwal Piket','Jadwal kebersihan komunitas',S.cleaningDuties.length+' jadwal','piket'),
    c('messages','Forum','Diskusi & komentar anggota',S.topics.length+' topik','forum'),
    c('inbox','Pesan Masuk','Pesan dan balasan admin',S.admin?((S.tanya?.length||0)+' pesan'):'Pesan saya','pesan'),
    c('map','Peta & Wilayah','Sebaran anggota di Jepang',Object.keys(wilayah()).length+' wilayah','peta'),
    h('button',{class:'card',onclick:async()=>{await S.supabase.auth.signOut()}},h('span',{class:'e'},icon('logout',22)),h('span',{style:'flex:1'},h('b',{},'Keluar'),h('small',{},'Akhiri sesi akun')),'›')];
}
