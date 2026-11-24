/* Meeting Video: rapat video daring memakai Jitsi Meet gratis
   (meet.jit.si) yang disematkan di dalam aplikasi — tidak ada WebRTC
   buatan sendiri dan tidak ada kunci rahasia apa pun. Data rapat
   tersimpan di koleksi 'meeting' lewat lapisan data yang sama
   (Supabase app_data / lokal). Semua pengguna yang masuk & disetujui
   bisa melihat daftar dan bergabung; membuat rapat hanya Pengurus &
   Admin Utama (S.admin); Mulai/Akhiri/Ubah/Hapus hanya host pembuat
   rapat itu atau Admin Utama. */
function meetStatus(item){return item&&item.status==='berlangsung'?'berlangsung':item&&item.status==='selesai'?'selesai':'terjadwal'}
function meetWaktu(item){
  const t=item&&item.tanggal?String(item.tanggal):'';
  const j=item&&item.jam?String(item.jam):'00:00';
  const d=t?new Date(t+'T'+(j||'00:00')+':00'):null;
  return d&&!Number.isNaN(d.getTime())?d:null;
}
/* Rapat "sudah lewat": yang sudah selesai, atau yang terjadwal tetapi
   tanggal & jamnya sudah terlewati. Rapat yang sedang berlangsung
   selalu tampil di bagian "Akan datang". */
function meetSudahLewat(item){
  if(meetStatus(item)==='selesai')return true;
  if(meetStatus(item)==='terjadwal'){const w=meetWaktu(item);return Boolean(w&&w.getTime()<Date.now())}
  return false;
}
function meetBolehBuat(){return !!S.admin}
function meetBolehKelola(item){return Boolean(S.mainAdmin||String(item&&item.host_uid||'')===String(S.uid||''))}
function meetTanggalLabel(item){
  const w=meetWaktu(item);
  if(!w)return 'Tanggal belum diatur';
  return w.toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'})+' · '+String(item.jam||'').slice(0,5)+' WIB';
}
function meetRuangBaru(){
  const huruf='abcdefghjkmnpqrstuvwxyz23456789';
  let kode='';
  try{const arr=new Uint8Array(10);crypto.getRandomValues(arr);arr.forEach(n=>{kode+=huruf[n%huruf.length]})}catch(e){for(let i=0;i<10;i++)kode+=huruf[Math.floor(Math.random()*huruf.length)]}
  return 'shikoku-'+kode;
}
function meetTautan(item){return 'https://meet.jit.si/'+(item&&item.ruang||'')}
/* Salin tautan undangan (= alamat ruang Jitsi, bisa dibuka juga di
   luar aplikasi). Umpan balik langsung pada tombol tanpa menggambar
   ulang halaman, supaya ruang rapat yang sedang terbuka tidak
   terputus. */
async function meetSalinTautan(item,btn){
  const teks=meetTautan(item);
  let ok=false;
  try{await navigator.clipboard.writeText(teks);ok=true}catch(e){
    try{
      const ta=document.createElement('textarea');
      ta.value=teks;ta.style.position='fixed';ta.style.opacity='0';
      document.body.append(ta);ta.select();
      ok=document.execCommand('copy');ta.remove();
    }catch(err){ok=false}
  }
  if(btn){const lama=btn.innerHTML;btn.textContent=ok?'Tautan tersalin':'Gagal menyalin';setTimeout(()=>{btn.innerHTML=lama},2000)}
  else if(!ok)alert('Tautan rapat: '+teks);
}
async function meetUbahStatus(item,status){
  try{
    await S.db.collection('meeting').doc(item.id).update({status,diubah_oleh:S.name||S.email||'Pengurus'});
    item.status=status;
    return true;
  }catch(error){console.error(error);alert('Gagal mengubah status rapat: '+(error.message||'periksa koneksi'));return false}
}
/* ===== Formulir buat / ubah rapat (khusus Pengurus & Admin Utama) ===== */
function meetingEditor(){
  const form=S.meetingForm;
  const judul=h('input',{placeholder:'Contoh: Rapat pengurus bulanan',maxlength:'120'});
  judul.value=form.judul||'';
  const tanggal=h('input',{type:'date'});
  tanggal.value=form.tanggal||'';
  const jam=h('input',{type:'time'});
  jam.value=form.jam||'';
  const keterangan=h('textarea',{placeholder:'Keterangan rapat (boleh kosong)',maxlength:'500',rows:'3'});
  keterangan.value=form.keterangan||'';
  return box(h('b',{},form.id?'Ubah rapat':'Buat rapat baru'),
    h('label',{class:'lb'},'Judul rapat *',judul),
    h('div',{class:'inv-form-2col'},
      h('label',{class:'lb'},'Tanggal *',tanggal),
      h('label',{class:'lb'},'Jam *',jam)),
    h('label',{class:'lb'},'Keterangan',keterangan),
    h('div',{class:'fl'},
      h('button',{class:'btn',onclick:async()=>{
        const judulRapat=judul.value.trim();
        if(!judulRapat){alert('Isi judul rapat terlebih dahulu.');return}
        if(!tanggal.value){alert('Isi tanggal rapat.');return}
        if(!jam.value){alert('Isi jam rapat.');return}
        const data={judul:judulRapat,tanggal:tanggal.value,jam:jam.value,keterangan:keterangan.value.trim()};
        try{
          if(form.id)await S.db.collection('meeting').doc(form.id).update({...data,diubah_oleh:S.name||S.email||'Pengurus'});
          else await S.db.collection('meeting').add({...data,ruang:meetRuangBaru(),status:'terjadwal',host_uid:String(S.uid||''),host_nama:S.name||S.email||'Pengurus',at:Date.now()});
          S.meetingForm=null;
          render();
        }catch(error){console.error(error);alert('Gagal menyimpan rapat: '+(error.message||'periksa koneksi'))}
      }},form.id?'Simpan perubahan':'Simpan rapat'),
      h('button',{class:'btn s',onclick:()=>{S.meetingForm=null;render()}},'Batal')));
}
/* Konfirmasi hapus rapat: pola dialog aplikasi (confirm-overlay,
   tanpa tombol X — mengetuk bidang di luar kotak atau Batal
   menutupnya). */
function meetConfirmOverlay(item){
  const tutup=()=>{S.meetingConfirm=null;render()};
  return h('div',{class:'confirm-overlay',onclick:tutup},
    h('div',{class:'card confirm-card',onclick:ev=>ev.stopPropagation()},
      h('b',{class:'confirm-title'},'Hapus Rapat'),
      h('p',{class:'confirm-text'},'Hapus rapat "'+(item.judul||'ini')+'" ('+meetTanggalLabel(item)+')? Catatan rapat ini hilang dan tidak bisa dikembalikan.'),
      h('div',{class:'fl confirm-actions'},
        h('button',{class:'btn s',onclick:tutup},'Batal'),
        h('button',{class:'btn',onclick:async()=>{
          try{
            await S.db.collection('meeting').doc(item.id).delete();
            S.meetingConfirm=null;
            if(S.meetingRoom===item.id)S.meetingRoom=null;
            render();
          }catch(error){console.error(error);S.meetingConfirm=null;alert('Gagal menghapus rapat: '+(error.message||'periksa koneksi'))}
        }},'Hapus rapat'))));
}
function meetBadge(item){
  const st=meetStatus(item);
  return h('span',{class:'inv-badge '+(st==='berlangsung'?'inv-badge-ok':st==='selesai'?'inv-badge-cat':'inv-badge-warn')},st==='berlangsung'?'Sedang Berlangsung':st==='selesai'?'Selesai':'Terjadwal');
}
function meetKartu(item){
  const st=meetStatus(item);
  const kelola=meetBolehKelola(item);
  const aksi=[];
  if(st!=='selesai')aksi.push(h('button',{class:'btn meet-join-btn',onclick:()=>{S.meetingRoom=item.id;window.scrollTo(0,0);render()}},icon('video',15),h('span',{},'Gabung')));
  aksi.push(h('button',{class:'btn s btn-eh',onclick:ev=>meetSalinTautan(item,ev.currentTarget)},icon('share',14),h('span',{},'Salin Tautan Undangan')));
  if(kelola&&st==='terjadwal')aksi.push(h('button',{class:'btn s btn-eh',onclick:async()=>{if(await meetUbahStatus(item,'berlangsung'))render()}},'Mulai'));
  if(kelola&&st==='berlangsung')aksi.push(h('button',{class:'btn s btn-eh',onclick:async()=>{if(await meetUbahStatus(item,'selesai'))render()}},'Akhiri'));
  if(kelola){
    aksi.push(h('button',{class:'btn s btn-eh',onclick:()=>{S.meetingForm={...item};window.scrollTo(0,0);render()}},icon('edit',14),h('span',{},'Ubah')));
    aksi.push(h('button',{class:'btn s fin-delete btn-eh',onclick:()=>{S.meetingConfirm=item;render()}},'Hapus'));
  }
  return h('article',{class:'meet-card'},
    h('div',{class:'meet-card-main'},
      h('div',{class:'meet-card-top'},h('b',{class:'meet-title'},item.judul||'Rapat'),meetBadge(item)),
      h('small',{class:'meet-meta'},icon('calendar',14),h('span',{},meetTanggalLabel(item))),
      h('small',{class:'meet-meta'},icon('users',14),h('span',{},'Host: '+(item.host_nama||'Pengurus'))),
      item.keterangan&&h('p',{class:'meet-note'},item.keterangan)),
    h('div',{class:'fl meet-actions'},...aksi));
}
/* ===== Ruang rapat: video Jitsi memenuhi area utama =====
   Jitsi dimuat MALAS lewat External API resmi (external_api.js) saat
   ruang rapat pertama dibuka — nama tampil peserta diambil dari akun
   yang masuk. Bila berkas API gagal dimuat (jaringan), cadangan
   iframe biasa dipakai dengan nama tampil lewat hash URL. Kontrol
   bawaan Jitsi (mikrofon, kamera, angkat tangan, obrolan, bagikan
   layar, tinggalkan rapat) dibiarkan aktif apa adanya. */
let meetApi=null,meetApiRoomId=null,meetApiScript=null;
function meetMuatApi(){
  if(window.JitsiMeetExternalAPI)return Promise.resolve(true);
  if(meetApiScript)return meetApiScript;
  meetApiScript=new Promise(resolve=>{
    const s=document.createElement('script');
    s.src='https://meet.jit.si/external_api.js';
    s.onload=()=>resolve(true);
    s.onerror=()=>{meetApiScript=null;resolve(false)};
    document.head.appendChild(s);
  });
  return meetApiScript;
}
function meetTampilCatatanIzin(){
  const el=document.getElementById('meet-perm-note');
  if(el)el.style.display='';
}
function meetKeluarRuang(){
  if(meetApi){try{meetApi.dispose()}catch(e){}meetApi=null;meetApiRoomId=null}
  S.meetingRoom=null;
  render();
}
async function initMeetingRoom(){
  const wrap=document.getElementById('meet-jitsi');
  const roomId=S.view==='meeting'&&S.meetingRoom?String(S.meetingRoom):null;
  if(!wrap||!roomId){
    if(meetApi){try{meetApi.dispose()}catch(e){}meetApi=null;meetApiRoomId=null}
    return;
  }
  if(wrap.dataset.mounted==='1'&&meetApiRoomId===roomId)return;
  const item=(S.meeting||[]).find(m=>String(m.id)===roomId);
  if(!item)return;
  if(meetApi){try{meetApi.dispose()}catch(e){}meetApi=null;meetApiRoomId=null}
  wrap.replaceChildren();
  wrap.dataset.mounted='1';
  meetApiRoomId=roomId;
  const nama=S.name||S.email||'Anggota Shikoku Family';
  const siap=await meetMuatApi();
  /* Wadah bisa sudah diganti render lain selama API dimuat */
  if(!wrap.isConnected||S.meetingRoom!==item.id)return;
  if(siap&&window.JitsiMeetExternalAPI){
    try{
      meetApi=new window.JitsiMeetExternalAPI('meet.jit.si',{
        roomName:item.ruang,
        parentNode:wrap,
        width:'100%',
        height:'100%',
        userInfo:{displayName:nama},
        configOverwrite:{prejoinPageEnabled:false,disableDeepLinking:true},
        interfaceConfigOverwrite:{MOBILE_APP_PROMO:false,SHOW_JITSI_WATERMARK:false}
      });
      /* Menekan tombol tinggalkan rapat di Jitsi = kembali ke daftar */
      meetApi.addEventListener('videoConferenceLeft',()=>{if(S.meetingRoom===item.id)meetKeluarRuang()});
      meetApi.addEventListener('readyToClose',()=>{if(S.meetingRoom===item.id)meetKeluarRuang()});
      /* Izin kamera/mikrofon ditolak peramban: tampilkan pesan sopan */
      meetApi.addEventListener('cameraError',meetTampilCatatanIzin);
      meetApi.addEventListener('micError',meetTampilCatatanIzin);
      return;
    }catch(error){console.error('Jitsi External API gagal dimulai, memakai iframe cadangan:',error)}
  }
  /* Cadangan: iframe biasa dengan izin kamera/mikrofon penuh */
  const frame=h('iframe',{
    src:meetTautan(item)+'#userInfo.displayName='+encodeURIComponent(JSON.stringify(nama))+'&config.prejoinPageEnabled=false&config.disableDeepLinking=true',
    allow:'camera; microphone; fullscreen; display-capture; autoplay',
    allowfullscreen:'true',
    title:'Ruang rapat '+(item.judul||''),
    style:'width:100%;height:100%;border:0;display:block'
  });
  wrap.append(frame);
}
function meetRuangView(item){
  const st=meetStatus(item);
  const kelola=meetBolehKelola(item);
  const aksiRuang=[h('button',{class:'btn s btn-eh',onclick:ev=>meetSalinTautan(item,ev.currentTarget)},icon('share',14),h('span',{},'Salin Tautan Undangan'))];
  if(kelola&&st==='terjadwal')aksiRuang.push(h('button',{class:'btn s btn-eh',onclick:async ev=>{
    if(await meetUbahStatus(item,'berlangsung')){
      /* Tanpa menggambar ulang (video tidak terputus): perbarui
         lencana status & sembunyikan tombol Mulai langsung di DOM */
      const badge=document.getElementById('meet-room-status');
      if(badge){badge.textContent='Sedang Berlangsung';badge.className='inv-badge inv-badge-ok'}
      ev.currentTarget.style.display='none';
      const btnAkhiri=document.getElementById('meet-room-end');
      if(btnAkhiri)btnAkhiri.style.display='';
    }
  }},'Mulai'));
  if(kelola)aksiRuang.push(h('button',{class:'btn s btn-eh',id:'meet-room-end',style:st==='berlangsung'?'':'display:none',onclick:async()=>{if(await meetUbahStatus(item,'selesai'))meetKeluarRuang()}},'Akhiri Rapat'));
  return h('div',{class:'meet-room'},
    h('div',{class:'meet-room-bar'},
      h('button',{class:'btn s',onclick:()=>meetKeluarRuang()},icon('back',16),h('span',{},'Kembali ke daftar')),
      h('div',{class:'meet-room-head'},
        h('b',{class:'meet-room-title'},item.judul||'Rapat'),
        h('span',{class:'meet-room-badgewrap'},h('span',{class:'inv-badge '+(st==='berlangsung'?'inv-badge-ok':st==='selesai'?'inv-badge-cat':'inv-badge-warn'),id:'meet-room-status'},st==='berlangsung'?'Sedang Berlangsung':st==='selesai'?'Selesai':'Terjadwal'))),
      h('div',{class:'fl meet-room-actions'},...aksiRuang)),
    h('p',{class:'meet-hint'},'Bila peramban meminta izin kamera & mikrofon, pilih "Izinkan" agar Anda bisa terlihat dan terdengar. Nama tampil Anda: '+(S.name||S.email||'Anggota')),
    h('p',{class:'warn storage-warning meet-perm-note',id:'meet-perm-note',style:'display:none'},'Izin kamera atau mikrofon belum diberikan. Rapat tetap bisa diikuti untuk mendengar dan melihat peserta lain. Bila ingin berbicara atau tampil di video, izinkan kamera & mikrofon lewat ikon gembok/kamera di bilah alamat peramban, lalu masuk lagi ke ruang rapat ini.'),
    h('div',{class:'meet-frame-wrap',id:'meet-jitsi'}));
}
function vMeeting(){
  /* Ruang rapat terbuka: tampilkan video saja memenuhi area utama */
  if(S.meetingRoom){
    const item=(S.meeting||[]).find(m=>String(m.id)===String(S.meetingRoom));
    if(item)return [meetRuangView(item)];
    S.meetingRoom=null;
  }
  const all=[...(S.meeting||[])];
  const akanDatang=all.filter(m=>!meetSudahLewat(m)).sort((a,b)=>{
    const sa=meetStatus(a)==='berlangsung'?0:1,sb=meetStatus(b)==='berlangsung'?0:1;
    if(sa!==sb)return sa-sb;
    return (meetWaktu(a)?.getTime()||0)-(meetWaktu(b)?.getTime()||0);
  });
  const sudahLewat=all.filter(m=>meetSudahLewat(m)).sort((a,b)=>(meetWaktu(b)?.getTime()||0)-(meetWaktu(a)?.getTime()||0));
  const hasil=[
    h('div',{class:'duty-heading'},h('div',{},h('h1',{},'Meeting Video')),h('span',{class:'duty-count'},all.length+' rapat')),
    guard(),
    h('p',{class:'sub'},'Rapat video daring bersama anggota Shikoku Family, langsung dari aplikasi ini. Tekan "Gabung" untuk masuk ke ruang rapat.')
  ];
  if(meetBolehBuat()&&!S.meetingForm)hasil.push(h('div',{class:'meet-toolbar'},h('button',{class:'btn',onclick:()=>{
    const kini=new Date();
    const tgl=[kini.getFullYear(),String(kini.getMonth()+1).padStart(2,'0'),String(kini.getDate()).padStart(2,'0')].join('-');
    S.meetingForm={tanggal:tgl,jam:'19:00'};
    render();
  }},'+ Buat Rapat')));
  if(S.meetingForm&&meetBolehBuat())hasil.push(meetingEditor());
  if(!all.length){
    hasil.push(h('div',{class:'duty-empty'},icon('video',24),h('b',{},'Belum ada rapat terjadwal'),h('p',{},meetBolehBuat()?'Tekan tombol "Buat Rapat" di atas untuk menjadwalkan rapat video pertama.':'Rapat video yang dijadwalkan pengurus akan tampil di sini. Sampai jumpa di rapat berikutnya!')));
  }else{
    if(akanDatang.length)hasil.push(h('h2',{class:'meet-section-title'},'Akan datang'),h('div',{class:'meet-list'},...akanDatang.map(meetKartu)));
    if(sudahLewat.length)hasil.push(h('h2',{class:'meet-section-title'},'Sudah lewat'),h('div',{class:'meet-list meet-list-past'},...sudahLewat.map(meetKartu)));
  }
  if(S.meetingConfirm)hasil.push(meetConfirmOverlay(S.meetingConfirm));
  return hasil;
}
