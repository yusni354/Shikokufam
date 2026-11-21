/* Kegiatan: peserta, absensi, pemindai QR */
function guard(){return S.db?null:h('p',{class:'warn'},'Penyimpanan belum tersedia.')}
function eventParticipantCount(event){
  return Array.isArray(event.peserta_anggota)?event.peserta_anggota.length:(event.hadir||[]).length;
}
function eventAttendanceCount(event){
  return Array.isArray(event.hadir_anggota)?event.hadir_anggota.length:(event.hadir||[]).length;
}
function activityMemberIds(event,key){
  return Array.isArray(event[key])?event[key].map(String):[];
}
/* ===== Absensi per wilayah: status kehadiran =====
   Status tersimpan di field 'absensi_status' pada dokumen kegiatan yang
   sama (peta id anggota -> 'hadir'|'izin'|'alpha'|'cuti'). Di halaman
   fokus, admin hanya mencentang TIGA pilihan: Hadir / Izin / Cuti.
   Anggota yang tidak dipilih status apa pun otomatis terhitung ALPHA:
   saat absensi wilayah disimpan, yang kosong ditulis 'alpha' ke peta
   status. Dua field lama tetap dirawat persis seperti sebelumnya supaya
   rekap & grafik tetap terbaca: 'peserta_anggota' = anggota yang sudah
   dicatat statusnya, 'hadir_anggota' = yang berstatus hadir. Data lama
   tanpa 'absensi_status' tetap terbaca: anggota di 'hadir_anggota' =
   Hadir, peserta lama yang tidak tercatat hadir = Alpha. */
const ABSENSI_STATUS=[['hadir','Hadir'],['izin','Izin'],['alpha','Alpha'],['cuti','Cuti']];
/* Pilihan yang bisa dicentang admin di halaman fokus (Alpha tidak ada:
   Alpha adalah keadaan kosong/tidak dipilih) */
const ABSENSI_PILIHAN=[['hadir','Hadir'],['izin','Izin'],['cuti','Cuti']];
function activityStatusMap(event){
  const map={};
  if(event.absensi_status&&typeof event.absensi_status==='object'&&!Array.isArray(event.absensi_status)){
    Object.entries(event.absensi_status).forEach(([id,status])=>{
      if(ABSENSI_STATUS.some(([key])=>key===status))map[String(id)]=status;
    });
  }
  const attendees=new Set(activityMemberIds(event,'hadir_anggota'));
  activityMemberIds(event,'peserta_anggota').forEach(id=>{if(!map[id])map[id]=attendees.has(id)?'hadir':'alpha'});
  attendees.forEach(id=>{if(!map[id])map[id]='hadir'});
  return map;
}
function activityStatusOf(event,memberId){
  return activityStatusMap(event)[String(memberId)]||'';
}
async function updateActivityMember(eventId,memberId,action){
  if(!S.admin)throw new Error('Hanya admin yang dapat mengelola peserta kegiatan.');
  if(!S.db)throw new Error('Penyimpanan belum tersedia.');
  const event=S.events.find(item=>String(item.id)===String(eventId));
  if(!event)throw new Error('Kegiatan tidak ditemukan.');
  const id=String(memberId),participants=new Set(activityMemberIds(event,'peserta_anggota')),attendees=new Set(activityMemberIds(event,'hadir_anggota'));
  const statusMap=activityStatusMap(event);
  if(action==='add')participants.add(id);
  else if(action==='present'){participants.add(id);attendees.add(id);statusMap[id]='hadir'}
  else if(action==='absent'){participants.add(id);attendees.delete(id);statusMap[id]='alpha'}
  else if(action==='remove'){participants.delete(id);attendees.delete(id);delete statusMap[id]}
  else throw new Error('Tindakan peserta tidak dikenal.');
  await S.db.collection('events').doc(eventId).update({peserta_anggota:[...participants],hadir_anggota:[...attendees],absensi_status:statusMap});
}
/* Anggota aktif satu wilayah, urut nama — daftar yang diabsen di tahap 2 */
function absensiRegionMembers(region){
  return S.members
    .filter(member=>String(member.status||'aktif').toLowerCase()!=='nonaktif'&&memberRegion(member)===region)
    .sort((a,b)=>(a.nama||'').localeCompare(b.nama||'','id'));
}
function buildAbsensiDraft(event,region){
  const draft={};
  absensiRegionMembers(region).forEach(member=>{
    const status=activityStatusOf(event,member.id);
    if(status)draft[String(member.id)]=status;
  });
  return draft;
}
/* Simpan absensi SATU wilayah: status wilayah lain pada kegiatan yang
   sama dibiarkan utuh, jadi antarwilayah tidak saling menimpa. */
async function saveRegionAttendance(eventId,region,draft){
  if(!S.admin)throw new Error('Hanya admin yang dapat mengelola absensi kegiatan.');
  if(!S.db)throw new Error('Penyimpanan belum tersedia.');
  const event=S.events.find(item=>String(item.id)===String(eventId));
  if(!event)throw new Error('Kegiatan tidak ditemukan.');
  const map=activityStatusMap(event);
  absensiRegionMembers(region).forEach(member=>{
    const id=String(member.id);
    /* Yang dipilih Hadir/Izin/Cuti tersimpan apa adanya; yang KOSONG
       (tidak dipilih status apa pun) tersimpan sebagai 'alpha' —
       Alpha memang berarti tidak ada pilihan yang dicentang. */
    map[id]=draft&&ABSENSI_PILIHAN.some(([key])=>key===draft[id])?draft[id]:'alpha';
  });
  const peserta=Object.keys(map);
  const hadir=peserta.filter(id=>map[id]==='hadir');
  await S.db.collection('events').doc(eventId).update({peserta_anggota:peserta,hadir_anggota:hadir,absensi_status:map});
}
/* Masuk tahap 2: halaman fokus mengabsen satu wilayah untuk satu kegiatan */
function enterAbsensi(event,region){
  S.absensiEvent=String(event.id);
  S.absensiRegion=region;
  S.absensiDraft=buildAbsensiDraft(event,region);
  render();
  window.scrollTo(0,0);
}
function leaveAbsensi(){
  S.absensiEvent=null;
  S.absensiRegion=null;
  S.absensiDraft=null;
  render();
  window.scrollTo(0,0);
}

/* Total empat status satu kegiatan — dihitung dari peta status
   activityStatusMap (termasuk pemetaan data lama), persis seperti yang
   ditampilkan kartu kegiatan. Dipakai kartu kegiatan DAN halaman
   Ringkasan Kegiatan supaya angkanya selalu sama. */
function activityTotals(event){
  const totals={hadir:0,izin:0,cuti:0,alpha:0};
  Object.values(activityStatusMap(event)).forEach(st=>{if(totals[st]!=null)totals[st]++});
  return totals;
}
/* Pil total + GRAFIK batang tumpuk + legenda persen dengan gaya yang
   sama persis seperti di kartu kegiatan: tiap segmen berwarna sesuai
   status dan lebarnya sebanding dengan bagiannya dari totalAnggota;
   anggota yang belum tercatat tampil sebagai sisa batang kosong.
   Mengembalikan {pills, chart, legend}. */
function activityTotalsView(totals,totalAnggota){
  const countPill=(cls,label,n)=>h('b',{class:cls},label+' '+n);
  const pills=h('div',{class:'activity-counts','aria-label':'Total absensi kegiatan'},countPill('c-hadir','Hadir',totals.hadir),countPill('c-izin','Izin',totals.izin),countPill('c-cuti','Cuti',totals.cuti),countPill('c-alpha','Alpha',totals.alpha));
  const chartSeg=(cls,label,n)=>{
    const pct=totalAnggota?n/totalAnggota*100:0;
    return h('span',{class:'activity-chart-seg '+cls,style:'width:'+pct+'%',title:label+' '+n+' dari '+totalAnggota+' anggota ('+Math.round(pct)+'%)'},
      pct>=14?h('small',{},Math.round(pct)+'%'):'');
  };
  const recordedTotal=totals.hadir+totals.izin+totals.cuti+totals.alpha;
  const unrecorded=totalAnggota?Math.max(0,totalAnggota-recordedTotal):0;
  const chart=h('div',{class:'activity-chart',role:'img','aria-label':'Grafik absensi kegiatan dari '+totalAnggota+' anggota'},
    chartSeg('s-hadir','Hadir',totals.hadir),
    chartSeg('s-izin','Izin',totals.izin),
    chartSeg('s-cuti','Cuti',totals.cuti),
    chartSeg('s-alpha','Alpha',totals.alpha),
    unrecorded>0&&h('span',{class:'activity-chart-seg s-sisa',style:'width:'+(unrecorded/totalAnggota*100)+'%',title:'Belum tercatat '+unrecorded+' dari '+totalAnggota+' anggota'})
  );
  const legend=totalAnggota?h('div',{class:'activity-chart-legend'},
    ...[['hadir','Hadir'],['izin','Izin'],['cuti','Cuti'],['alpha','Alpha']].map(([key,label])=>
      h('span',{class:'lg-'+key},h('i',{'aria-hidden':'true'}),label+' '+Math.round(totals[key]/totalAnggota*100)+'%')),
    unrecorded>0&&h('span',{class:'lg-sisa'},h('i',{'aria-hidden':'true'}),'Belum tercatat '+Math.round(unrecorded/totalAnggota*100)+'%')
  ):null;
  return {pills,chart,legend};
}
function activityCard(event){
  const attendees=new Set(activityMemberIds(event,'hadir_anggota'));
  const registeredMembers=S.members.filter(member=>String(member.status||'aktif').toLowerCase()!=='nonaktif');
  const date=event.tanggal?new Date(event.tanggal+'T00:00:00'):null;
  const dateLabel=date&&!Number.isNaN(date.getTime())?date.toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'}):'Tanggal belum ditentukan';
  const legacyCount=Array.isArray(event.hadir_anggota)?0:(event.hadir||[]).length;
  const feedback=S.activityFeedback&&String(S.activityFeedback.eventId)===String(event.id)?S.activityFeedback.message:'';
  const status=h('p',{class:'activity-feedback','aria-live':'polite'},feedback);
  /* Kartu ringkas (akordeon): keadaan bawaan hanya menampilkan nama,
     keterangan, tanggal, dan TOTAL absensi gabungan semua wilayah
     (Hadir/Izin/Cuti/Alpha dari peta status tersimpan, dengan pemetaan
     data lama yang sama seperti di tempat lain). Pemilih wilayah baru
     muncul sesudah badan kartu diklik; membuka satu kartu menutup
     kartu lain (S.activityExpanded hanya memuat satu id). */
  const expanded=String(S.activityExpanded)===String(event.id);
  const totals=activityTotals(event);
  /* Pil total hanya menampilkan JUMLAH tiap status (tanpa teks
     persen). Proporsi tiap status terhadap TOTAL KESELURUHAN ANGGOTA
     aktif (semua wilayah, populasi yang sama dengan daftar absensi)
     ditampilkan sebagai GRAFIK batang tumpuk mendatar di bawah pil:
     tiap segmen berwarna sesuai status dan lebarnya sebanding dengan
     bagiannya dari keseluruhan anggota; anggota yang belum tercatat
     statusnya tampil sebagai sisa batang kosong, jadi batang selalu
     utuh 100%. Bila belum ada anggota sama sekali, batang tampil
     kosong tanpa label. */
  const totalAnggota=registeredMembers.length;
  const totalsView=activityTotalsView(totals,totalAnggota);
  const chart=totalsView.chart;
  const chartLegend=totalsView.legend;
  /* Tahap 1: pilih wilayah dulu. Daftar anggota BELUM tampil di sini;
     admin mengetuk satu wilayah untuk masuk ke halaman pengabsenannya. */
  const regionPick=(region,color)=>{
    const membersInRegion=registeredMembers.filter(member=>memberRegion(member)===region);
    const recorded=membersInRegion.filter(member=>activityStatusOf(event,member.id)).length;
    const present=membersInRegion.filter(member=>activityStatusOf(event,member.id)==='hadir').length;
    return h('button',{class:'activity-region-pick',style:'--region-color:'+color,onclick:e=>{e.stopPropagation();enterAbsensi(event,region)}},
      h('span',{class:'activity-region-pick-main'},h('b',{},region),h('small',{},membersInRegion.length+' anggota · '+recorded+' sudah dicatat · '+present+' hadir')),
      h('span',{class:'activity-region-pick-arrow'},'›'));
  };
  const regionPicks=wilayahEfektif().map(([region,color])=>regionPick(region,color));
  if(registeredMembers.some(member=>memberRegion(member)==='Belum dipilih'))regionPicks.push(regionPick('Belum dipilih','#718096'));
  const content=[
    h('div',{class:'activity-heading'},h('div',{},h('h2',{},event.judul||'Kegiatan komunitas'),h('p',{class:'activity-meta'},icon('calendar',15),h('span',{},dateLabel+(event.waktu?' · '+event.waktu:'')))),h('span',{class:'activity-heading-side'},h('span',{class:'activity-chevron','aria-hidden':'true'},'›'))),
    totalsView.pills,
    chart,
    chartLegend,
    /* Keterangan penyebut grafik: jumlah total anggota aktif yang menjadi
       dasar perhitungan batang & legenda di atas, supaya proporsinya
       terbaca utuh ("dari total N anggota"). Angka yang sama persis
       dengan penyebut grafik (totalAnggota). Tidak tampil bila belum
       ada anggota sama sekali. */
    totalAnggota>0&&h('p',{class:'activity-total-note'},'dari total '+totalAnggota+' anggota')
  ];
  if(expanded)content.push(
    event.lokasi&&h('p',{class:'activity-meta'},icon('pin',15),h('span',{},event.lokasi)),
    legacyCount>0&&h('p',{class:'warn'},legacyCount+' catatan absensi lama belum terhubung dengan data anggota.'),
    h('h3',{},'Absensi per wilayah'),
    h('div',{class:'activity-region-pick-grid'},...regionPicks)
  );
  if(S.admin){
    const barcodeInput=h('input',{class:'activity-barcode-input',placeholder:'Pindai QR / masukkan ID anggota',autocomplete:'off'});
    const scanButton=h('button',{class:'btn s',type:'button'},icon('camera',16),h('span',{},'Buka kamera'));
    const scannerVideo=h('video',{class:'activity-scanner-video',autoplay:'',muted:'',playsinline:'true',style:'display:none'});
    const processBarcode=async value=>{
      const code=String(value||'').trim().replace(/^\*|\*$/g,'');
      if(!code){status.textContent='Barcode kosong.';return}
      const matches=registeredMembers.filter(member=>memberQrValue(member).toLowerCase()===code.toLowerCase());
      if(matches.length===0){status.textContent='Barcode tidak cocok dengan anggota terdaftar.';return}
      if(matches.length>1){status.textContent='Barcode cocok dengan beberapa anggota. Periksa nomor kartu terlebih dahulu.';return}
      const member=matches[0];
      if(attendees.has(String(member.id))){status.textContent=(member.nama||'Anggota')+' sudah tercatat hadir.';return}
      try{
        await updateActivityMember(event.id,member.id,'present');
        S.activityFeedback={eventId:event.id,message:(member.nama||'Anggota')+' berhasil ditambahkan dan dicatat hadir.'};
        render();
      }catch(error){console.error(error);status.textContent='Gagal mencatat kehadiran: '+(error.message||'periksa koneksi')}
    };
    const submitBarcode=async()=>{
      const value=barcodeInput.value;
      barcodeInput.value='';
      await processBarcode(value);
    };
    barcodeInput.onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();submitBarcode()}};
    scanButton.onclick=async()=>{
      if(S.activityScannerStop){S.activityScannerStop();return}
      if(!window.BarcodeDetector||typeof window.BarcodeDetector.getSupportedFormats!=='function'||!navigator.mediaDevices?.getUserMedia){
        status.textContent='Pemindaian QR lewat kamera tidak didukung browser ini. Gunakan aplikasi pemindai QR dan ketik/pindai ID ke kolom.';
        return;
      }
      let stream=null,active=false,frame=0,stopScanner=()=>{};
      try{
        const formats=await window.BarcodeDetector.getSupportedFormats();
        if(!formats.includes('qr_code')){
          status.textContent='Browser ini belum mendukung pembacaan QR. Gunakan aplikasi pemindai QR dan ketik/pindai ID ke kolom.';
          return;
        }
        const detector=new window.BarcodeDetector({formats:['qr_code']});
        stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'},audio:false});
        active=true;
        scannerVideo.srcObject=stream;scannerVideo.style.display='block';
        scanButton.replaceChildren(icon('close',16),h('span',{},'Berhenti memindai'));
        stopScanner=()=>{
          active=false;
          if(frame)cancelAnimationFrame(frame);
          stream.getTracks().forEach(track=>track.stop());
          scannerVideo.srcObject=null;scannerVideo.style.display='none';
          scanButton.replaceChildren(icon('camera',16),h('span',{},'Buka kamera'));
          if(S.activityScannerStop===stopScanner)S.activityScannerStop=null;
        };
        S.activityScannerStop=stopScanner;
        await scannerVideo.play();
        const detect=async()=>{
          if(!active)return;
          try{
            const codes=await detector.detect(scannerVideo);
            if(codes.length&&codes[0].rawValue){
              const value=codes[0].rawValue;
              stopScanner();
              await processBarcode(value);
              return;
            }
          }catch(error){
            stopScanner();
            console.error(error);
            status.textContent='Gagal membaca QR melalui kamera: '+(error.message||'coba lagi atau masukkan ID anggota secara manual');
            return;
          }
          if(active)frame=requestAnimationFrame(detect);
        };
        detect();
      }catch(error){
        stopScanner();
        if(stream)stream.getTracks().forEach(track=>track.stop());
        scannerVideo.srcObject=null;scannerVideo.style.display='none';
        scanButton.replaceChildren(icon('camera',16),h('span',{},'Buka kamera'));
        console.error(error);
        status.textContent='Kamera tidak dapat dibuka: '+(error.message||'periksa izin kamera atau masukkan ID anggota secara manual');
      }
    };
    if(expanded)content.push(
      h('div',{class:'activity-scanner',onclick:e=>e.stopPropagation()},
        h('h3',{},'Pemindaian QR'),
        h('div',{class:'activity-scanner-row'},barcodeInput,h('button',{class:'btn s',onclick:submitBarcode},'Catat hadir')),
        h('div',{class:'activity-scanner-row'},scanButton),
        scannerVideo,status)
    );
  }
  const card=h('article',{class:'card activity-card'+(expanded?' open':''),'aria-expanded':expanded?'true':'false',title:expanded?'Ketuk untuk menutup':'Ketuk untuk melihat wilayah'},...content);
  /* Klik pada badan kartu membuka/menutup daftar wilayah; klik pada
     tombol/field di dalam kartu (pemilih wilayah, pemindai)
     tidak ikut membuka/menutup. */
  card.addEventListener('click',e=>{
    if(e.target.closest('button,input,video,a,select,textarea,label'))return;
    S.activityExpanded=expanded?null:String(event.id);
    render();
  });
  return card;
}
/* Tahap 2: halaman fokus mengabsen anggota SATU wilayah untuk satu
   kegiatan. Seluruh anggota wilayah tampil; di kanan tiap baris ada
   checklist status Hadir / Izin / Cuti (satu anggota satu status);
   yang tidak dipilih status apa pun terhitung Alpha. Pilihan bekerja
   pada draf lokal dan baru tersimpan lewat tombol 'Simpan absensi',
   jadi status lama tampil terpilih dan bisa diubah. */
function vAbsensiFokus(event,region){
  if(!S.absensiDraft)S.absensiDraft=buildAbsensiDraft(event,region);
  const draft=S.absensiDraft;
  const members=absensiRegionMembers(region);
  const color=wilayahEfektif().find(([name])=>name===region)?.[1]||'#718096';
  const date=event.tanggal?new Date(event.tanggal+'T00:00:00'):null;
  const dateLabel=date&&!Number.isNaN(date.getTime())?date.toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'}):'Tanggal belum ditentukan';
  const summary=h('p',{class:'activity-feedback absensi-summary','aria-live':'polite'},'');
  const updateSummary=()=>{
    const counts={hadir:0,izin:0,cuti:0};
    members.forEach(member=>{const st=draft[String(member.id)];if(st&&counts[st]!=null)counts[st]++});
    const done=counts.hadir+counts.izin+counts.cuti;
    /* Alpha tidak dicentang: ia adalah sisa anggota yang belum/tidak
       dipilih statusnya */
    const alpha=members.length-done;
    summary.textContent=done+' dari '+members.length+' anggota sudah dicatat · '+counts.hadir+' hadir · '+counts.izin+' izin · '+counts.cuti+' cuti · '+alpha+' alpha';
  };
  const feedback=h('p',{class:'activity-feedback','aria-live':'polite'},'');
  const memberRow=member=>{
    const id=String(member.id);
    const info=h('div',{class:'absensi-info'},h('b',{},member.nama||'Tanpa nama'));
    if(!S.admin){
      const st=draft[id]||'';
      const label=st?ABSENSI_STATUS.find(([key])=>key===st)[1]:'Belum dicatat';
      return h('div',{class:'absensi-row'},info,h('span',{class:'absensi-chip'+(st?' st-'+st:'')},label));
    }
    const seg=h('div',{class:'absensi-seg',role:'radiogroup','aria-label':'Status kehadiran '+(member.nama||'anggota')},
      ...ABSENSI_PILIHAN.map(([key,label])=>h('button',{type:'button',class:'absensi-opt'+(draft[id]===key?' on':''),'data-st':key,'aria-pressed':draft[id]===key?'true':'false',onclick:()=>{
        if(draft[id]===key)delete draft[id];
        else draft[id]=key;
        seg.querySelectorAll('.absensi-opt').forEach(btn=>{
          const on=draft[id]===btn.getAttribute('data-st');
          btn.classList.toggle('on',on);
          btn.setAttribute('aria-pressed',on?'true':'false');
        });
        feedback.textContent='';
        updateSummary();
      }},label)));
    return h('div',{class:'absensi-row'},info,seg);
  };
  updateSummary();
  return h('section',{class:'card absensi-card'},
    h('button',{class:'btn s absensi-back',onclick:()=>leaveAbsensi()},icon('back',16),h('span',{},'Ganti wilayah')),
    h('p',{class:'absensi-kicker'},'Absensi kegiatan'),
    h('h2',{},event.judul||'Kegiatan komunitas'),
    h('p',{class:'activity-meta'},icon('calendar',15),h('span',{},dateLabel+(event.waktu?' · '+event.waktu:''))),
    event.lokasi&&h('p',{class:'activity-meta'},icon('pin',15),h('span',{},event.lokasi)),
    h('div',{class:'absensi-region-title'},h('span',{class:'absensi-dot',style:'background:'+color}),h('h3',{},'Wilayah '+region)),
    summary,
    members.length?h('div',{class:'absensi-list'},...members.map(memberRow)):h('p',{class:'activity-empty'},'Belum ada anggota di wilayah ini.'),
    S.admin&&h('p',{class:'activity-help'},'Ketuk salah satu status di kanan nama anggota. Ketuk status yang sama sekali lagi untuk membatalkan pilihan. Anggota yang tidak dipilih statusnya terhitung Alpha.'),
    S.admin&&h('div',{class:'absensi-savebar'},
      h('button',{class:'btn',onclick:async()=>{
        try{
          await saveRegionAttendance(event.id,region,draft);
          feedback.textContent='Absensi wilayah '+region+' tersimpan.';
        }catch(error){console.error(error);feedback.textContent='Gagal menyimpan absensi: '+(error.message||'periksa koneksi')}
      }},'Simpan absensi'),
      h('button',{class:'btn s',onclick:()=>leaveAbsensi()},'Ganti wilayah')),
    feedback
  );
}
/* ===== Halaman Ringkasan Kegiatan: rekap SELURUH kegiatan dalam satu
   tahun, baca-saja untuk semua pengguna yang masuk & disetujui. Tahun
   sebuah kegiatan ditentukan dari tanggalnya. Total absensi memakai
   sumber & pemetaan status yang sama persis dengan kartu kegiatan
   (activityTotals + activityTotalsView), jadi angka dan grafiknya
   selalu sama dengan yang tampil di halaman Kegiatan. ===== */
function activityYear(event){
  const y=parseInt(String(event.tanggal||'').slice(0,4),10);
  return Number.isNaN(y)?null:y;
}
function vRingkasan(){
  const currentYear=new Date().getFullYear();
  /* Pilihan tahun: tahun-tahun yang memiliki kegiatan, ditambah tahun
     berjalan (bawaan terpilih) supaya tahun yang masih kosong pun bisa
     dipilih dan menampilkan pesan kosongnya. */
  const years=[...new Set([currentYear,...S.events.map(activityYear).filter(y=>y!=null)])].sort((a,b)=>b-a);
  const selected=years.includes(S.ringkasanTahun)?S.ringkasanTahun:currentYear;
  const yearSelect=h('select',{'aria-label':'Pilih tahun',onchange:e=>{S.ringkasanTahun=Number(e.target.value);render()}},
    ...years.map(y=>h('option',{value:String(y)},String(y))));
  yearSelect.value=String(selected);
  const head=[h('h1',{},'Ringkasan Kegiatan'),guard(),
    h('label',{class:'activity-field ringkasan-year'},'Tahun',yearSelect)];
  const events=S.events.filter(event=>activityYear(event)===selected)
    .sort((a,b)=>(b.tanggal||'').localeCompare(a.tanggal||'')||(b.at||0)-(a.at||0));
  if(!events.length){
    return [...head,h('p',{class:'warn'},'Belum ada kegiatan pada tahun '+selected+'.')];
  }
  const totalAnggota=S.members.filter(member=>String(member.status||'aktif').toLowerCase()!=='nonaktif').length;
  const yearTotals={hadir:0,izin:0,cuti:0,alpha:0};
  events.forEach(event=>{const t=activityTotals(event);Object.keys(yearTotals).forEach(k=>{yearTotals[k]+=t[k]})});
  /* Penyebut grafik setahun = total anggota aktif × jumlah kegiatan
     tahun itu (gabungan penyebut grafik tiap kartu kegiatan), sehingga
     sisa 'Belum tercatat' berarti slot anggota×kegiatan yang belum
     tercatat statusnya. */
  const yearView=activityTotalsView(yearTotals,totalAnggota*events.length);
  const summaryCard=h('section',{class:'card ringkasan-summary'},
    h('h2',{},'Ringkasan tahun '+selected),
    h('p',{class:'activity-meta'},icon('calendar',15),h('span',{},events.length+' kegiatan pada tahun ini')),
    yearView.pills,yearView.chart,yearView.legend);
  const item=event=>{
    const view=activityTotalsView(activityTotals(event),totalAnggota);
    const date=event.tanggal?new Date(event.tanggal+'T00:00:00'):null;
    const dateLabel=date&&!Number.isNaN(date.getTime())?date.toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'}):'Tanggal belum ditentukan';
    const card=h('article',{class:'card ringkasan-item',title:'Ketuk untuk membuka kegiatan ini di halaman Kegiatan'},
      h('h2',{},event.judul||'Kegiatan komunitas'),
      h('p',{class:'activity-meta'},icon('calendar',15),h('span',{},dateLabel+(event.waktu?' · '+event.waktu:''))),
      view.pills,view.chart,view.legend);
    /* Ketuk satu kegiatan: buka kegiatan itu dalam keadaan terbuka di
       halaman Kegiatan memakai alur yang sudah ada (activityExpanded
       + go). Keadaan fokus absensi dibersihkan dulu supaya daftar
       kegiatan yang tampil, bukan halaman fokus wilayah lain. */
    card.addEventListener('click',()=>{
      S.absensiEvent=null;S.absensiRegion=null;S.absensiDraft=null;
      S.activityExpanded=String(event.id);
      go('kegiatan');
    });
    return card;
  };
  /* ===== Laporan rekap per anggota: tabel lengkap setahun =====
     Satu baris per anggota aktif (urut wilayah mengikuti urutan resmi
     wilayahEfektif, lalu nama), satu kolom per kegiatan tahun terpilih
     (urut tanggal menaik seperti buku laporan), sel berisi huruf status
     dari peta status yang sama dengan kartu kegiatan — H/I/C/A, atau
     strip bila anggota belum tercatat pada kegiatan itu (berbeda dari
     Alpha tersimpan). Ujung kanan: total tiap status sepanjang tahun
     dan persen kehadiran = Hadir ÷ jumlah kegiatan tahun itu × 100. */
  const REKAP_HURUF={hadir:'H',izin:'I',cuti:'C',alpha:'A'};
  const rekapEvents=[...events].sort((a,b)=>(a.tanggal||'').localeCompare(b.tanggal||'')||(a.at||0)-(b.at||0));
  const regionOrder=new Map(wilayahEfektif().map(([name],index)=>[name,index]));
  const rekapMembers=S.members
    .filter(member=>String(member.status||'aktif').toLowerCase()!=='nonaktif')
    .sort((a,b)=>{
      const ra=memberRegion(a),rb=memberRegion(b);
      const oa=regionOrder.has(ra)?regionOrder.get(ra):regionOrder.size;
      const ob=regionOrder.has(rb)?regionOrder.get(rb):regionOrder.size;
      if(oa!==ob)return oa-ob;
      if(ra!==rb)return ra.localeCompare(rb,'id');
      return (a.nama||'').localeCompare(b.nama||'','id');
    });
  const shortDate=event=>{
    const d=event.tanggal?new Date(event.tanggal+'T00:00:00'):null;
    return d&&!Number.isNaN(d.getTime())?d.toLocaleDateString('id-ID',{day:'numeric',month:'short'}):'—';
  };
  const rekapHead=h('thead',{},h('tr',{},
    h('th',{class:'rekap-name-head'},'Nama'),
    ...rekapEvents.map(event=>h('th',{class:'rekap-ev',title:(event.judul||'Kegiatan komunitas')+' · '+shortDate(event)},h('small',{},shortDate(event)),h('span',{},event.judul||'Kegiatan komunitas'))),
    h('th',{class:'rekap-sum-start',title:'Total Hadir sepanjang tahun'},'Hadir'),
    h('th',{title:'Total Izin sepanjang tahun'},'Izin'),
    h('th',{title:'Total Cuti sepanjang tahun'},'Cuti'),
    h('th',{title:'Total Alpha sepanjang tahun'},'Alpha'),
    h('th',{title:'Persen kehadiran sepanjang tahun'},'% Hadir')));
  const rekapBody=h('tbody',{},...rekapMembers.map(member=>{
    const totals={hadir:0,izin:0,cuti:0,alpha:0};
    const cells=rekapEvents.map(event=>{
      const st=activityStatusOf(event,member.id);
      if(st&&totals[st]!=null){totals[st]++;return h('td',{class:'rekap-st st-'+st},REKAP_HURUF[st])}
      return h('td',{class:'rekap-none'},'–');
    });
    const pct=rekapEvents.length?Math.round(totals.hadir/rekapEvents.length*100):0;
    return h('tr',{},
      h('td',{class:'rekap-name'},h('b',{},member.nama||'Tanpa nama'),h('small',{},memberRegion(member))),
      ...cells,
      h('td',{class:'rekap-num rekap-sum-start'},String(totals.hadir)),
      h('td',{class:'rekap-num'},String(totals.izin)),
      h('td',{class:'rekap-num'},String(totals.cuti)),
      h('td',{class:'rekap-num'},String(totals.alpha)),
      h('td',{class:'rekap-num'},pct+'%'));
  }));
  const rekapCard=h('section',{class:'card ringkasan-rekap'},
    h('h2',{},'Rekap absensi per anggota'),
    h('p',{class:'activity-meta'},h('span',{},'H = Hadir · I = Izin · C = Cuti · A = Alpha · – = belum tercatat')),
    rekapMembers.length
      ?h('div',{class:'rekap-wrap'},h('table',{class:'rekap-table'},rekapHead,rekapBody))
      :h('p',{class:'warn'},'Belum ada anggota aktif.'));
  return [...head,summaryCard,rekapCard,h('div',{class:'activity-list'},...events.map(item))];
}
function vKegiatan(){
  /* Tahap 2 aktif: tampilkan hanya halaman pengabsenan wilayah terpilih */
  if(S.absensiRegion){
    const focused=S.events.find(item=>String(item.id)===String(S.absensiEvent));
    if(focused)return [h('h1',{},'Absensi Kegiatan'),guard(),vAbsensiFokus(focused,S.absensiRegion)];
    S.absensiEvent=null;S.absensiRegion=null;S.absensiDraft=null;
  }
  const title=h('input',{placeholder:'Nama kegiatan',maxlength:'150'});
  const date=h('input',{type:'date'});
  const time=h('input',{type:'time'});
  const location=h('input',{placeholder:'Lokasi kegiatan',maxlength:'180'});
  const events=[...S.events].sort((a,b)=>(b.tanggal||'').localeCompare(a.tanggal||'')||(b.at||0)-(a.at||0));
  const createForm=S.admin&&h('section',{class:'card activity-create'},h('h2',{},'Buat kegiatan'),
    h('div',{class:'activity-create-grid'},
      h('label',{class:'activity-field activity-field-wide'},'Nama kegiatan *',title),
      h('label',{class:'activity-field'},'Tanggal *',date),
      h('label',{class:'activity-field'},'Waktu',time),
      h('label',{class:'activity-field activity-field-wide'},'Lokasi',location)),
    h('button',{class:'btn',onclick:async()=>{
      const judul=title.value.trim();
      if(!judul||!date.value){alert('Isi nama dan tanggal kegiatan.');return}
      try{
        await S.db.collection('events').add({judul,tanggal:date.value,waktu:time.value,lokasi:location.value.trim(),peserta_anggota:[],hadir_anggota:[],at:Date.now()});
        title.value='';date.value='';time.value='';location.value='';
      }catch(error){console.error(error);alert('Gagal membuat kegiatan: '+(error.message||'periksa koneksi'))}
    }},'Buat kegiatan'));
  return [
    h('h1',{},'Kegiatan'),
    guard(),
    createForm,
    events.length?h('div',{class:'activity-list'},...events.map(activityCard)):h('p',{class:'warn'},'Belum ada kegiatan.')
  ];
}
