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
     keterangan, tanggal & lokasi, dan TOTAL absensi gabungan semua wilayah
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
    /* Lokasi tampil BERSEBELAHAN dengan tanggal & waktu pada baris
       meta kepala kartu (mis. '29 Nov 2026 · 09:00 · Aula Takamatsu'),
       jadi terlihat pada keadaan kartu tertutup maupun terbuka —
       tidak ada lagi baris lokasi tersendiri di badan kartu. */
    h('div',{class:'activity-heading'},h('div',{},h('h2',{},event.judul||'Kegiatan komunitas'),h('p',{class:'activity-meta'},icon('calendar',15),h('span',{},dateLabel+(event.waktu?' · '+event.waktu:'')+(event.lokasi?' · '+event.lokasi:'')))),h('span',{class:'activity-heading-side'},h('span',{class:'activity-chevron','aria-hidden':'true'},'›'))),
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
  /* ===== Seret-untuk-mengisi (drag fill) pada segmen status =====
     Menekan tombol status lalu menyeret ke atas/bawah mengisi semua
     baris yang dilewati dengan status yang sama, langsung pada DRAF
     (tersimpan hanya lewat 'Simpan absensi', sama seperti ketukan).
     Ketukan biasa tanpa seret tetap berperilaku lama (pilih / ketuk
     status yang sama untuk membatalkan) lewat onclick di bawah;
     klik yang mengikuti akhir sebuah seretan ditelan memakai
     penanda waktu suppressClickUntil supaya baris awal tidak malah
     ter-batalkan. Gulir halaman dari luar segmen status tidak
     terganggu: pencegahan gulir hanya berasal dari segmen itu
     sendiri (touch-action:none di CSS + preventDefault saat aktif). */
  const rowSegs=new Map();
  let suppressClickUntil=0;
  const paintRow=id=>{
    const seg=rowSegs.get(id);
    if(!seg)return;
    seg.querySelectorAll('.absensi-opt').forEach(btn=>{
      const on=draft[id]===btn.getAttribute('data-st');
      btn.classList.toggle('on',on);
      btn.setAttribute('aria-pressed',on?'true':'false');
    });
  };
  const applyDragRange=(fromIdx,toIdx,key)=>{
    const lo=Math.min(fromIdx,toIdx),hi=Math.max(fromIdx,toIdx);
    for(let i=lo;i<=hi;i++){
      const mid=String(members[i].id);
      if(draft[mid]!==key){draft[mid]=key;paintRow(mid)}
    }
    feedback.textContent='';
    updateSummary();
  };
  const startDragFill=(e,startId,key)=>{
    if(e.button!=null&&e.button>0)return;
    const startIdx=members.findIndex(m=>String(m.id)===startId);
    if(startIdx<0)return;
    const pointerId=e.pointerId,startY=e.clientY;
    let active=false;
    const onMove=ev=>{
      if(ev.pointerId!==pointerId)return;
      if(!active){
        if(Math.abs(ev.clientY-startY)<8)return;
        active=true;
      }
      if(ev.cancelable)ev.preventDefault();
      const el=document.elementFromPoint(ev.clientX,ev.clientY);
      const rowEl=el&&el.closest?el.closest('.absensi-row'):null;
      if(!rowEl)return;
      const targetIdx=members.findIndex(m=>String(m.id)===String(rowEl.getAttribute('data-mid')));
      if(targetIdx<0)return;
      applyDragRange(startIdx,targetIdx,key);
    };
    const onUp=ev=>{
      if(ev.pointerId!==pointerId)return;
      window.removeEventListener('pointermove',onMove);
      window.removeEventListener('pointerup',onUp);
      window.removeEventListener('pointercancel',onUp);
      if(active)suppressClickUntil=Date.now()+400;
    };
    window.addEventListener('pointermove',onMove,{passive:false});
    window.addEventListener('pointerup',onUp);
    window.addEventListener('pointercancel',onUp);
  };
  const memberRow=member=>{
    const id=String(member.id);
    const info=h('div',{class:'absensi-info'},h('b',{},member.nama||'Tanpa nama'));
    if(!S.admin){
      const st=draft[id]||'';
      const label=st?ABSENSI_STATUS.find(([key])=>key===st)[1]:'Belum dicatat';
      return h('div',{class:'absensi-row','data-mid':id},info,h('span',{class:'absensi-chip'+(st?' st-'+st:'')},label));
    }
    const seg=h('div',{class:'absensi-seg',role:'radiogroup','aria-label':'Status kehadiran '+(member.nama||'anggota')},
      ...ABSENSI_PILIHAN.map(([key,label])=>h('button',{type:'button',class:'absensi-opt'+(draft[id]===key?' on':''),'data-st':key,'aria-pressed':draft[id]===key?'true':'false',
        onpointerdown:e=>startDragFill(e,id,key),
        onclick:()=>{
          if(Date.now()<suppressClickUntil)return;
          if(draft[id]===key)delete draft[id];
          else draft[id]=key;
          paintRow(id);
          feedback.textContent='';
          updateSummary();
        }},label)));
    rowSegs.set(id,seg);
    return h('div',{class:'absensi-row','data-mid':id},info,seg);
  };
  updateSummary();
  return h('section',{class:'card absensi-card'},
    h('button',{class:'btn s absensi-back',onclick:()=>leaveAbsensi()},icon('back',16),h('span',{},'Kembali')),
    h('p',{class:'absensi-kicker'},'Absensi kegiatan'),
    h('h2',{},event.judul||'Kegiatan komunitas'),
    h('p',{class:'activity-meta'},icon('calendar',15),h('span',{},dateLabel+(event.waktu?' · '+event.waktu:''))),
    event.lokasi&&h('p',{class:'activity-meta'},icon('pin',15),h('span',{},event.lokasi)),
    h('div',{class:'absensi-region-title'},h('span',{class:'absensi-dot',style:'background:'+color}),h('h3',{},'Wilayah '+region)),
    summary,
    members.length?h('div',{class:'absensi-list'},...members.map(memberRow)):h('p',{class:'activity-empty'},'Belum ada anggota di wilayah ini.'),
    S.admin&&h('p',{class:'activity-help'},'Ketuk salah satu status di kanan nama anggota. Ketuk status yang sama sekali lagi untuk membatalkan pilihan. Tekan lalu seret satu status ke baris-baris lain untuk mengisi banyak anggota sekaligus dengan status yang sama. Anggota yang tidak dipilih statusnya terhitung Alpha.'),
    S.admin&&h('div',{class:'absensi-savebar'},
      h('button',{class:'btn',onclick:async()=>{
        try{
          await saveRegionAttendance(event.id,region,draft);
          /* Berhasil tersimpan: langsung kembali ke pilihan wilayah
             pada kartu kegiatan yang sama (kartu tetap terbuka).
             Bila gagal, tetap di halaman ini dan pesan kesalahan
             tampil lewat feedback di bawah. */
          leaveAbsensi();
        }catch(error){console.error(error);feedback.textContent='Gagal menyimpan absensi: '+(error.message||'periksa koneksi')}
      }},'Simpan absensi'),
      h('button',{class:'btn s',onclick:()=>leaveAbsensi()},'Kembali')),
    feedback
  );
}
/* ===== Ruangan laporan: halaman Ringkasan & Laporan dibagi empat
   ruangan dengan tab di bagian atas — Kegiatan, Jadwal Piket,
   Keuangan, Anggota. Mengetuk satu tab hanya menampilkan ruangan itu;
   ruangan lain tersembunyi. Ruangan yang terakhir dibuka diingat di
   sessionStorage (pola yang sama seperti halaman terakhir aplikasi),
   dan ruangan bawaan yang terbuka pertama adalah Kegiatan.
   Semua ruangan baca-saja dan dihitung dari data aplikasi yang sudah
   ada: kegiatan (events), keuangan, jadwal piket (cleaning_duties),
   dan anggota (members) — tidak ada model data baru. ===== */
const RINGKASAN_RUANG=[['kegiatan','Kegiatan'],['piket','Jadwal Piket'],['keuangan','Keuangan'],['anggota','Anggota']];
const RINGKASAN_RUANG_KEY='shikoku-family:ringkasan-ruang';
function ringkasanRuangAktif(){
  if(!RINGKASAN_RUANG.some(([key])=>key===S.ringkasanRuang)){
    let saved='';
    try{saved=sessionStorage.getItem(RINGKASAN_RUANG_KEY)||''}catch(e){/* storage terblokir: abaikan */}
    S.ringkasanRuang=RINGKASAN_RUANG.some(([key])=>key===saved)?saved:'kegiatan';
  }
  return S.ringkasanRuang;
}
function setRingkasanRuang(ruang){
  S.ringkasanRuang=ruang;
  try{sessionStorage.setItem(RINGKASAN_RUANG_KEY,ruang)}catch(e){/* storage terblokir: abaikan */}
  render();
  window.scrollTo(0,0);
}
function tahunDariTanggal(tanggal){
  const y=parseInt(String(tanggal||'').slice(0,4),10);
  return Number.isNaN(y)?null:y;
}
/* Tabel laporan bersama ruangan-ruangan baru: kepala slate dan baris
   zebra mengikuti gaya tabel rekap, wadahnya bisa digeser kanan-kiri
   bila tabel lebih lebar dari layar. Kolom memakai kelas 'lap-left'
   (rata kiri) atau 'lap-num' (rata kanan, tebal untuk isi angka). */
function laporanTabel(kolom,baris,lebarMin){
  return h('div',{class:'laporan-wrap'},
    h('table',{class:'laporan-table',...(lebarMin?{style:'min-width:'+lebarMin+'px'}:{})},
      h('thead',{},h('tr',{},...kolom.map(([label,kelas])=>h('th',kelas?{class:kelas}:{},label)))),
      h('tbody',{},...baris)));
}
/* Batang mendatar sederhana untuk kolom 'Bagian' (persen) */
function laporanBar(persen,warna){
  const pct=Math.max(0,Math.min(100,Number(persen)||0));
  return h('span',{class:'laporan-bar','aria-hidden':'true'},
    h('span',{class:'laporan-bar-fill',style:'width:'+pct+'%'+(warna?';background:'+warna:'')}));
}
/* ===== Ruangan KEUANGAN: ringkasan koleksi 'keuangan' pada tahun
   terpilih — total setahun, pengeluaran per bulan, per kategori
   belanja, dan per pengguna/pembelanja. Format uang memakai
   formatYen dari modul Keuangan; pengelompokan per pengguna memakai
   kunci yang sama seperti ringkasan di halaman Laporan Keuangan
   (uid, cadangan nama pengguna). ===== */
function vRingkasanKeuangan(year){
  const records=(S.keuangan||[]).filter(item=>tahunDariTanggal(item.tanggal)===year)
    .sort((a,b)=>String(a.tanggal||'').localeCompare(String(b.tanggal||''))||(a.at||0)-(b.at||0));
  if(!records.length)return [h('p',{class:'warn'},'Belum ada catatan keuangan pada tahun '+year+'.')];
  const total=records.reduce((sum,item)=>sum+(Number(item.jumlah)||0),0);
  const persen=n=>total?Math.round(n/total*100):0;
  const summary=h('section',{class:'card ringkasan-summary'},
    h('h2',{},'Keuangan tahun '+year),
    h('p',{class:'activity-meta'},icon('wallet',15),h('span',{},records.length+' catatan belanja pada tahun ini')),
    h('div',{class:'activity-counts','aria-label':'Total keuangan tahun '+year},
      h('b',{class:'c-cuti'},'Total '+formatYen(total)),
      h('b',{},'Rata-rata '+formatYen(Math.round(total/records.length))+' per catatan')));
  /* Pengeluaran per bulan (hanya bulan yang memiliki catatan) */
  const perBulan=new Map();
  records.forEach(item=>{
    const key=financeMonthKey(item.tanggal);
    if(!key)return;
    const cur=perBulan.get(key)||{count:0,total:0};
    cur.count++;cur.total+=Number(item.jumlah)||0;
    perBulan.set(key,cur);
  });
  const bulanRows=[...perBulan.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([key,v])=>h('tr',{},
    h('td',{class:'lap-left'},financeMonthLabel(key)),
    h('td',{class:'lap-num'},String(v.count)),
    h('td',{class:'lap-num'},formatYen(v.total)),
    h('td',{class:'lap-num'},persen(v.total)+'%')));
  bulanRows.push(h('tr',{class:'lap-total-row'},
    h('td',{class:'lap-left'},'Total tahun '+year),
    h('td',{class:'lap-num'},String(records.length)),
    h('td',{class:'lap-num'},formatYen(total)),
    h('td',{class:'lap-num'},'100%')));
  const bulanCard=h('section',{class:'card lap-card'},
    h('h3',{class:'lap-h'},'Pengeluaran per bulan'),
    laporanTabel([['Bulan','lap-left'],['Catatan','lap-num'],['Total','lap-num'],['Bagian','lap-num']],bulanRows));
  /* Pengelompokan generik: kunci -> {label, count, total}, urut total terbesar */
  const kelompokkan=(keyOf,labelOf)=>{
    const map=new Map();
    records.forEach(item=>{
      const key=keyOf(item);
      const cur=map.get(key)||{label:labelOf(item),count:0,total:0};
      cur.count++;cur.total+=Number(item.jumlah)||0;
      map.set(key,cur);
    });
    return [...map.values()].sort((a,b)=>b.total-a.total||a.label.localeCompare(b.label,'id'));
  };
  const kategoriRows=kelompokkan(
    item=>String(item.nama_pengeluaran||'').trim().toLowerCase()||'belanja',
    item=>item.nama_pengeluaran||'Belanja'
  ).map(v=>h('tr',{},
    h('td',{class:'lap-left'},v.label),
    h('td',{class:'lap-num'},String(v.count)),
    h('td',{class:'lap-num'},formatYen(v.total)),
    h('td',{class:'lap-bar-cell'},laporanBar(persen(v.total)),h('span',{class:'lap-pct'},persen(v.total)+'%'))));
  const kategoriCard=h('section',{class:'card lap-card'},
    h('h3',{class:'lap-h'},'Pengeluaran per kategori'),
    laporanTabel([['Kategori','lap-left'],['Catatan','lap-num'],['Total','lap-num'],['Bagian','lap-left']],kategoriRows));
  const penggunaRows=kelompokkan(
    item=>String(item.uid||item.nama_user||'anggota'),
    item=>item.nama_user||'Anggota'
  ).map(v=>h('tr',{},
    h('td',{class:'lap-left'},v.label),
    h('td',{class:'lap-num'},String(v.count)),
    h('td',{class:'lap-num'},formatYen(v.total)),
    h('td',{class:'lap-num'},persen(v.total)+'%')));
  const penggunaCard=h('section',{class:'card lap-card'},
    h('h3',{class:'lap-h'},'Belanja per pengguna'),
    laporanTabel([['Nama','lap-left'],['Catatan','lap-num'],['Total','lap-num'],['Bagian','lap-num']],penggunaRows));
  return [summary,bulanCard,kategoriCard,penggunaCard];
}
/* ===== Ruangan ANGGOTA: potret daftar anggota SAAT INI (tanpa
   pemilih tahun) — total anggota aktif, rincian per wilayah dengan
   warna wilayah dan grafik batang tumpuk mengikuti gaya halaman ini,
   lalu rincian angka lain dari field yang memang terisi pada data
   anggota (kelompok, status visa, bidang pekerjaan, jenis kelamin).
   Rincian yang field-nya kosong pada semua anggota tidak ditampilkan.
   Daftar lengkap anggota tetap di halaman Daftar Anggota; ruangan ini
   hanya ringkasan angka. ===== */
function vRingkasanAnggota(){
  const aktif=S.members.filter(member=>String(member.status||'aktif').toLowerCase()!=='nonaktif');
  const total=aktif.length;
  if(!total)return [h('p',{class:'warn'},'Belum ada anggota aktif.')];
  const persen=n=>Math.round(n/total*100);
  const wilayahRows=wilayahEfektif()
    .map(([name,color])=>({name,color,count:aktif.filter(m=>memberRegion(m)===name).length}))
    .filter(r=>r.count>0);
  const belumDipilih=aktif.filter(m=>memberRegion(m)==='Belum dipilih').length;
  if(belumDipilih)wilayahRows.push({name:'Belum dipilih',color:'#718096',count:belumDipilih});
  const chart=h('div',{class:'activity-chart',role:'img','aria-label':'Grafik anggota per wilayah dari '+total+' anggota'},
    ...wilayahRows.map(r=>h('span',{class:'activity-chart-seg',style:'width:'+(r.count/total*100)+'%;background:'+r.color,title:r.name+' '+r.count+' anggota ('+persen(r.count)+'%)'},
      persen(r.count)>=14?h('small',{},persen(r.count)+'%'):'')));
  const legend=h('div',{class:'activity-chart-legend'},
    ...wilayahRows.map(r=>h('span',{},h('i',{style:'background:'+r.color,'aria-hidden':'true'}),r.name+' '+persen(r.count)+'%')));
  const nonaktif=S.members.length-total;
  const summary=h('section',{class:'card ringkasan-summary'},
    h('h2',{},'Anggota saat ini'),
    h('p',{class:'activity-meta'},icon('users',15),h('span',{},'Potret daftar anggota terbaru, tanpa saringan tahun')),
    h('div',{class:'activity-counts','aria-label':'Total anggota'},
      h('b',{class:'c-hadir'},'Aktif '+total),
      nonaktif>0&&h('b',{class:'c-alpha'},'Nonaktif '+nonaktif)),
    chart,legend);
  const wilayahCard=h('section',{class:'card lap-card'},
    h('h3',{class:'lap-h'},'Anggota per wilayah'),
    laporanTabel([['Wilayah','lap-left'],['Anggota','lap-num'],['Bagian','lap-num']],
      wilayahRows.map(r=>h('tr',{},
        h('td',{class:'lap-left'},h('span',{class:'lap-dot',style:'background:'+r.color,'aria-hidden':'true'}),r.name),
        h('td',{class:'lap-num'},String(r.count)),
        h('td',{class:'lap-num'},persen(r.count)+'%')))));
  /* Kartu rincian dari satu field anggota; null bila field itu kosong
     pada semua anggota aktif (tidak ada yang bisa dilaporkan). */
  const rincian=(judul,kolom,ambil)=>{
    const map=new Map();
    aktif.forEach(member=>{
      const value=String(ambil(member)||'').trim();
      if(!value)return;
      map.set(value,(map.get(value)||0)+1);
    });
    if(!map.size)return null;
    const rows=[...map.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'id'))
      .map(([label,count])=>h('tr',{},
        h('td',{class:'lap-left'},label),
        h('td',{class:'lap-num'},String(count)),
        h('td',{class:'lap-num'},persen(count)+'%')));
    return h('section',{class:'card lap-card'},
      h('h3',{class:'lap-h'},judul),
      laporanTabel([[kolom,'lap-left'],['Anggota','lap-num'],['Bagian','lap-num']],rows));
  };
  return [summary,wilayahCard,
    rincian('Anggota per kelompok','Kelompok',m=>m.kelompok),
    rincian('Anggota per status visa','Status visa',m=>m.tinggal),
    rincian('Anggota per bidang pekerjaan','Bidang pekerjaan',m=>m.bidang),
    rincian('Anggota per jenis kelamin','Jenis kelamin',m=>m.kelamin)
  ].filter(Boolean);
}
/* ===== Ruangan JADWAL PIKET: ringkasan koleksi 'cleaning_duties'
   yang sama dengan halaman Jadwal Piket — jadwal terdekat yang akan
   datang (tanggal, nama bertugas, tugas) dan hitungan jumlah piket
   per anggota pada tahun terpilih. Bentuk penugasan dibaca persis
   seperti di halaman Jadwal Piket: daftar 'assignments', dengan
   cadangan field lama nama/tugas pada dokumennya. ===== */
function piketAssignments(duty){
  return Array.isArray(duty.assignments)&&duty.assignments.length?duty.assignments:[{nama:duty.nama||'',tugas:duty.tugas||''}];
}
function vRingkasanPiket(year){
  const duties=[...(S.cleaningDuties||[])].sort((a,b)=>(a.tanggal||'').localeCompare(b.tanggal||'')||(a.at||0)-(b.at||0));
  if(!duties.length)return [h('p',{class:'warn'},'Belum ada data jadwal piket.')];
  const today=new Date();
  const todayKey=[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-');
  const yearDuties=duties.filter(d=>tahunDariTanggal(d.tanggal)===year);
  const yearAssignments=yearDuties.reduce((n,d)=>n+piketAssignments(d).length,0);
  const upcoming=duties.filter(d=>d.tanggal&&d.tanggal>=todayKey);
  const summary=h('section',{class:'card ringkasan-summary'},
    h('h2',{},'Jadwal piket tahun '+year),
    h('p',{class:'activity-meta'},icon('brush',15),h('span',{},yearDuties.length+' jadwal · '+yearAssignments+' penugasan pada tahun ini')),
    h('div',{class:'activity-counts','aria-label':'Ringkasan jadwal piket'},
      h('b',{class:'c-hadir'},'Jadwal '+yearDuties.length),
      h('b',{class:'c-cuti'},'Penugasan '+yearAssignments),
      upcoming.length?h('b',{class:'c-izin'},'Terdekat '+financeDateLabel(upcoming[0].tanggal)):h('b',{},'Tidak ada jadwal mendatang')));
  const out=[summary];
  if(upcoming.length){
    const rows=[];
    upcoming.slice(0,10).forEach(duty=>{
      piketAssignments(duty).forEach((assignment,index)=>rows.push(h('tr',{},
        h('td',{class:'lap-left'},index===0?financeDateLabel(duty.tanggal):''),
        h('td',{class:'lap-left'},assignment.nama||'—'),
        h('td',{class:'lap-left'},assignment.tugas||'—'))));
    });
    out.push(h('section',{class:'card lap-card'},
      h('h3',{class:'lap-h'},'Jadwal terdekat'),
      laporanTabel([['Tanggal','lap-left'],['Nama bertugas','lap-left'],['Tugas','lap-left']],rows,520)));
  }else{
    out.push(h('p',{class:'warn'},'Tidak ada jadwal piket yang akan datang.'));
  }
  if(yearDuties.length){
    const counts=new Map();
    yearDuties.forEach(duty=>piketAssignments(duty).forEach(assignment=>{
      const nama=String(assignment.nama||'').trim();
      if(!nama)return;
      counts.set(nama,(counts.get(nama)||0)+1);
    }));
    const rows=[...counts.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'id'))
      .map(([nama,count])=>h('tr',{},
        h('td',{class:'lap-left'},nama),
        h('td',{class:'lap-num'},String(count)),
        h('td',{class:'lap-num'},(yearAssignments?Math.round(count/yearAssignments*100):0)+'%')));
    if(rows.length)out.push(h('section',{class:'card lap-card'},
      h('h3',{class:'lap-h'},'Jumlah piket per anggota · '+year),
      laporanTabel([['Nama','lap-left'],['Kali piket','lap-num'],['Bagian','lap-num']],rows)));
  }else{
    out.push(h('p',{class:'warn'},'Belum ada jadwal piket pada tahun '+year+'.'));
  }
  return out;
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
  const ruang=ringkasanRuangAktif();
  /* Pilihan tahun: gabungan tahun-tahun yang memiliki kegiatan,
     catatan keuangan, atau jadwal piket, ditambah tahun berjalan
     (bawaan terpilih) supaya tahun yang masih kosong pun bisa dipilih
     dan menampilkan pesan kosongnya. Tahun yang sama berlaku untuk
     ruangan Kegiatan, Jadwal Piket, dan Keuangan. */
  const years=[...new Set([currentYear,
    ...S.events.map(activityYear),
    ...(S.keuangan||[]).map(item=>tahunDariTanggal(item.tanggal)),
    ...(S.cleaningDuties||[]).map(duty=>tahunDariTanggal(duty.tanggal))
  ].filter(y=>y!=null))].sort((a,b)=>b-a);
  const selected=years.includes(S.ringkasanTahun)?S.ringkasanTahun:currentYear;
  const yearSelect=h('select',{'aria-label':'Pilih tahun',onchange:e=>{S.ringkasanTahun=Number(e.target.value);render()}},
    ...years.map(y=>h('option',{value:String(y)},String(y))));
  yearSelect.value=String(selected);
  const tabs=h('nav',{class:'ringkasan-tabs','aria-label':'Ruangan laporan'},
    ...RINGKASAN_RUANG.map(([key,label])=>h('button',{type:'button',class:'ringkasan-tab'+(ruang===key?' on':''),'aria-pressed':ruang===key?'true':'false',onclick:()=>{if(ruang!==key)setRingkasanRuang(key)}},label)));
  const head=[h('h1',{},'Ringkasan & Laporan'),guard(),tabs];
  /* Ruangan Anggota adalah potret saat ini: pemilih tahun tidak tampil di sana. */
  if(ruang!=='anggota')head.push(h('label',{class:'activity-field ringkasan-year'},'Tahun',yearSelect));
  if(ruang==='anggota')return [...head,...vRingkasanAnggota()];
  if(ruang==='keuangan')return [...head,...vRingkasanKeuangan(selected)];
  if(ruang==='piket')return [...head,...vRingkasanPiket(selected)];
  /* Ruangan Kegiatan: isi persis seperti halaman Ringkasan Kegiatan
     sebelumnya (ringkasan setahun + tabel rekap per anggota + daftar
     kegiatan tahun terpilih). */
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
  /* Singkatan nama kegiatan untuk kepala kolom: inisial huruf pertama
     tiap kata, huruf besar ('Sambung Kebaikan' → 'SK', 'Ngaji 2' →
     'N2'). Nama satu kata yang pendek (≤4 huruf, mis. 'dsf') tampil
     apa adanya supaya tetap terbaca wajar. */
  const singkatanKegiatan=nama=>{
    const kata=String(nama||'').trim().split(/\s+/).filter(Boolean);
    if(!kata.length)return '–';
    if(kata.length===1&&kata[0].length<=4)return kata[0].toUpperCase();
    return kata.map(k=>k.charAt(0).toUpperCase()).join('');
  };
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
    /* Kepala kolom kegiatan: tanggal + SINGKATAN nama kegiatan saja
       supaya kolom sempit dan seragam, tidak melebar mengikuti panjang
       nama. Saat kursor berada di atasnya (hover desktop) singkatan
       berganti menjadi nama asli selengkapnya dan kembali lagi saat
       kursor pergi; atribut title memuat nama penuh sebagai cadangan.
       Khusus admin bisa diklik untuk membuka panel pengaturan kegiatan
       itu (satu-satunya tempat hapus kegiatan sekarang); anggota biasa
       tidak mendapat reaksi klik apa pun. */
    ...rekapEvents.map(event=>{
      const namaPenuh=event.judul||'Kegiatan komunitas';
      const singkatan=singkatanKegiatan(namaPenuh);
      const label=h('span',{class:'rekap-ev-label'},singkatan);
      const props={class:'rekap-ev'+(S.admin?' rekap-ev-admin':''),title:namaPenuh+' · '+shortDate(event)+(S.admin?' — ketuk untuk pengaturan kegiatan':''),
        onmouseenter:()=>{label.textContent=namaPenuh},
        onmouseleave:()=>{label.textContent=singkatan}};
      if(S.admin)props.onclick=()=>{S.rekapDialog={id:event.id,judul:namaPenuh,tanggal:event.tanggal||'',tahap:'atur'};render()};
      return h('th',props,h('small',{},shortDate(event)),label);
    }),
    h('th',{class:'rekap-sum-start',title:'Total Hadir sepanjang tahun'},'Hadir'),
    h('th',{title:'Total Izin sepanjang tahun'},'Izin'),
    h('th',{title:'Total Cuti sepanjang tahun'},'Cuti'),
    h('th',{title:'Total Alpha sepanjang tahun'},'Alpha'),
    h('th',{title:'Persen kehadiran sepanjang tahun'},'% Hadir')));
  /* Kelompok per wilayah: anggota sudah terurut wilayah lalu nama,
     jadi tiap kelompok didahului SATU baris pembatas selebar penuh
     tabel (nama wilayah + jumlah anggota + chevron) yang bisa diklik
     untuk melipat/membuka baris-baris anggotanya; keadaan lipat
     diingat di S.rekapLipatan selama aplikasi dibuka (bawaan: semua
     kelompok terbuka). Sel nama tidak lagi memuat label wilayah —
     latarnya memakai turunan pastel sangat muda dari warna wilayah
     (regionColor yang sama dengan pin peta & kepala kelompok), teks
     tetap hitam; pembatas memakai turunan yang sedikit lebih tegas,
     tetap lembut. */
  if(!(S.rekapLipatan instanceof Set))S.rekapLipatan=new Set();
  const rekapTotalKolom=1+rekapEvents.length+5;
  const warnaLembut=(hex,f)=>{
    const m=/^#?([0-9a-f]{6})$/i.exec(String(hex||''));
    if(!m)return '#eef3f6';
    const n=parseInt(m[1],16),campur=v=>Math.round(v+(255-v)*f);
    return 'rgb('+campur((n>>16)&255)+','+campur((n>>8)&255)+','+campur(n&255)+')';
  };
  const kelompokRekap=[];
  rekapMembers.forEach(member=>{
    const wilayah=memberRegion(member);
    const grup=kelompokRekap[kelompokRekap.length-1];
    if(grup&&grup.wilayah===wilayah)grup.anggota.push(member);
    else kelompokRekap.push({wilayah,anggota:[member]});
  });
  const barisRekap=[];
  kelompokRekap.forEach(grup=>{
    const warna=regionColor(grup.wilayah);
    const terlipat=S.rekapLipatan.has(grup.wilayah);
    const barisAnggota=grup.anggota.map(member=>{
      const totals={hadir:0,izin:0,cuti:0,alpha:0};
      const cells=rekapEvents.map(event=>{
        const st=activityStatusOf(event,member.id);
        if(st&&totals[st]!=null){totals[st]++;return h('td',{class:'rekap-st st-'+st},REKAP_HURUF[st])}
        return h('td',{class:'rekap-none'},'–');
      });
      const pct=rekapEvents.length?Math.round(totals.hadir/rekapEvents.length*100):0;
      return h('tr',{class:terlipat?'rekap-tersembunyi':''},
        h('td',{class:'rekap-name',style:'background:'+warnaLembut(warna,.85)},h('b',{},member.nama||'Tanpa nama')),
        ...cells,
        h('td',{class:'rekap-num rekap-sum-start'},String(totals.hadir)),
        h('td',{class:'rekap-num'},String(totals.izin)),
        h('td',{class:'rekap-num'},String(totals.cuti)),
        h('td',{class:'rekap-num'},String(totals.alpha)),
        h('td',{class:'rekap-num'},pct+'%'));
    });
    const pembatas=h('tr',{class:'rekap-divider'+(terlipat?' tertutup':''),'aria-expanded':terlipat?'false':'true',title:(terlipat?'Tampilkan':'Sembunyikan')+' anggota '+grup.wilayah},
      h('td',{class:'rekap-divider-cell',colspan:String(rekapTotalKolom),style:'background:'+warnaLembut(warna,.62)},
        h('span',{class:'rekap-divider-label'},icon('chevD',14),h('b',{},grup.wilayah),h('span',{class:'rekap-divider-count'},'· '+grup.anggota.length+' anggota'))));
    pembatas.addEventListener('click',()=>{
      const tutup=!S.rekapLipatan.has(grup.wilayah);
      if(tutup)S.rekapLipatan.add(grup.wilayah);else S.rekapLipatan.delete(grup.wilayah);
      pembatas.classList.toggle('tertutup',tutup);
      pembatas.setAttribute('aria-expanded',tutup?'false':'true');
      pembatas.title=(tutup?'Tampilkan':'Sembunyikan')+' anggota '+grup.wilayah;
      barisAnggota.forEach(b=>b.classList.toggle('rekap-tersembunyi',tutup));
    });
    barisRekap.push(pembatas,...barisAnggota);
  });
  const rekapBody=h('tbody',{},...barisRekap);
  const rekapCard=h('section',{class:'card ringkasan-rekap'},
    rekapMembers.length
      ?h('div',{class:'rekap-wrap'},h('table',{class:'rekap-table'},rekapHead,rekapBody))
      :h('p',{class:'warn'},'Belum ada anggota aktif.'));
  return [...head,summaryCard,rekapCard,h('div',{class:'activity-list'},...events.map(item)),dialogRekapKegiatan()];
}
/* ===== Panel pengaturan kegiatan dari kepala kolom tabel rekap =====
   Dibuka dengan mengklik kepala kolom sebuah kegiatan di tabel rekap
   (khusus admin). Pola aplikasi: tanpa tombol X — mengetuk bidang di
   luar kotak atau tombol penutup menutupnya. Tahap pertama menampilkan
   nama + tanggal kegiatan dan tombol 'Hapus Kegiatan'; menekannya
   membuka konfirmasi tegas yang menyebut nama kegiatannya. Sesudah
   dikonfirmasi, dokumen kegiatan (beserta data absensi di dalamnya)
   dihapus lewat jalur data aplikasi dan tabel digambar ulang. */
function dialogRekapKegiatan(){
  const d=S.rekapDialog;
  if(!d)return null;
  const tutup=()=>{S.rekapDialog=null;render()};
  const nama=d.judul||'Kegiatan komunitas';
  const tgl=d.tanggal?new Date(d.tanggal+'T00:00:00'):null;
  const tglLabel=tgl&&!Number.isNaN(tgl.getTime())?tgl.toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'}):'Tanggal belum ditentukan';
  if(d.tahap==='yakin'){
    return h('div',{class:'confirm-overlay',onclick:tutup},
      h('div',{class:'card confirm-card',onclick:ev=>ev.stopPropagation()},
        h('b',{class:'confirm-title'},'Hapus Kegiatan'),
        h('p',{class:'confirm-text'},'Hapus kegiatan "'+nama+'" ('+tglLabel+')? Kegiatan ini beserta seluruh data absensinya akan terhapus dan tidak bisa dibatalkan.'),
        h('div',{class:'fl confirm-actions'},
          h('button',{class:'btn s',onclick:tutup},'Batal'),
          h('button',{class:'btn',onclick:async()=>{
            const id=d.id;S.rekapDialog=null;
            try{
              await S.db.collection('events').doc(id).delete();
              S.events=S.events.filter(e=>String(e.id)!==String(id));
            }catch(error){console.error(error);alert('Gagal menghapus kegiatan: '+(error.message||'periksa koneksi'))}
            render();
          }},'Hapus'))));
  }
  return h('div',{class:'confirm-overlay',onclick:tutup},
    h('div',{class:'card confirm-card',onclick:ev=>ev.stopPropagation()},
      h('b',{class:'confirm-title'},'Pengaturan Kegiatan'),
      h('p',{class:'confirm-text'},h('b',{},nama),h('br',{}),tglLabel),
      h('div',{class:'fl confirm-actions'},
        h('button',{class:'btn s',onclick:tutup},'Tutup'),
        h('button',{class:'btn',onclick:()=>{S.rekapDialog={...d,tahap:'yakin'};render()}},'Hapus Kegiatan'))));
}
/* ===== Pengulangan bulanan pada formulir Buat Kegiatan =====
   Tanggal pada formulir adalah AWAL rangkaian. Untuk pola 'tanggal',
   tanggalnya tetap tiap bulan; bila tanggal itu tidak ada pada suatu
   bulan (mis. 31 di Februari), dipakai hari terakhir bulan tersebut.
   Untuk pola 'minggu', dipakai hari yang sama pada minggu ke-n tiap
   bulan (atau kemunculan terakhir hari itu bila memilih 'Terakhir').
   Rangkaian berisi 12 kejadian: kejadian pertama adalah tanggal yang
   sesuai pola pada/setelah tanggal awal, lalu satu per bulan sesudahnya.
   Hasilnya dokumen events BIASA yang berdiri sendiri-sendiri — tidak
   ada aturan pengulangan yang disimpan. */
function activityDateKey(d){
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function activityMonthShort(d){
  return d.toLocaleDateString('id-ID',{month:'short',year:'numeric'});
}
function activityMonthlyByDay(y,m,day){
  const dim=new Date(y,m+1,0).getDate();
  return new Date(y,m,Math.min(day,dim));
}
function activityMonthlyByWeek(y,m,week,weekday){
  if(week==='last'){
    const last=new Date(y,m+1,0);
    return new Date(y,m,last.getDate()-((last.getDay()-weekday+7)%7));
  }
  const n=parseInt(week,10)||1;
  const first=new Date(y,m,1);
  let day=1+((weekday-first.getDay()+7)%7)+(n-1)*7;
  const dim=new Date(y,m+1,0).getDate();
  if(day>dim)day-=7;
  return new Date(y,m,day);
}
/* Pengulangan mingguan: kejadian pertama adalah tanggal awal itu
   sendiri, lalu tiap 7 hari sesudahnya (hari yang sama) sebanyak 12
   kejadian. Hasilnya juga dokumen events biasa yang berdiri sendiri. */
function activityWeeklyDates(startValue){
  const parts=String(startValue).split('-').map(Number);
  const start=new Date(parts[0],(parts[1]||1)-1,parts[2]||1);
  const dates=[];
  for(let i=0;i<12;i++)dates.push(new Date(start.getFullYear(),start.getMonth(),start.getDate()+i*7));
  return dates;
}
function activityDateShort(d){
  return d.toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'});
}
function activityRecurringDates(startValue,mode,opts){
  const parts=String(startValue).split('-').map(Number);
  const start=new Date(parts[0],(parts[1]||1)-1,parts[2]||1);
  const dates=[];
  let offset=0;
  while(dates.length<12&&offset<48){
    const base=new Date(start.getFullYear(),start.getMonth()+offset,1);
    const y=base.getFullYear(),m=base.getMonth();
    const candidate=mode==='tanggal'
      ?activityMonthlyByDay(y,m,opts.day)
      :activityMonthlyByWeek(y,m,opts.week,opts.weekday);
    if(candidate>=start)dates.push(candidate);
    offset++;
  }
  return dates;
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
  /* Pengulangan bulanan: pilihan utama selebar penuh di bawah dua baris
     field yang ada; sub-pemilihnya hanya tampil sesuai pilihan. */
  const repeat=h('select',{'aria-label':'Pengulangan kegiatan'},
    h('option',{value:'sekali'},'Sekali saja'),
    h('option',{value:'mingguan'},'Setiap minggu'),
    h('option',{value:'bulanan-tanggal'},'Setiap bulan — tanggal tertentu'),
    h('option',{value:'bulanan-minggu'},'Setiap bulan — minggu tertentu'));
  const repeatDay=h('select',{'aria-label':'Tanggal pengulangan bulanan'},
    ...Array.from({length:31},(_,i)=>h('option',{value:String(i+1)},String(i+1))));
  const repeatWeek=h('select',{'aria-label':'Minggu ke- pengulangan bulanan'},
    h('option',{value:'1'},'1'),
    h('option',{value:'2'},'2'),
    h('option',{value:'3'},'3'),
    h('option',{value:'4'},'4'),
    h('option',{value:'last'},'Terakhir'));
  const repeatWeekday=h('select',{'aria-label':'Hari pengulangan bulanan'},
    h('option',{value:'1'},'Senin'),
    h('option',{value:'2'},'Selasa'),
    h('option',{value:'3'},'Rabu'),
    h('option',{value:'4'},'Kamis'),
    h('option',{value:'5'},'Jumat'),
    h('option',{value:'6'},'Sabtu'),
    h('option',{value:'0'},'Minggu'));
  const repeatDateWrap=h('div',{class:'activity-repeat-sub',style:'display:none'},
    h('label',{class:'activity-field'},'Tanggal',repeatDay));
  const repeatWeekWrap=h('div',{class:'activity-repeat-sub activity-repeat-week',style:'display:none'},
    h('label',{class:'activity-field'},'Minggu ke-',repeatWeek),
    h('label',{class:'activity-field'},'Hari',repeatWeekday));
  const repeatFeedback=h('p',{class:'activity-feedback','aria-live':'polite'},'');
  repeat.onchange=()=>{
    repeatDateWrap.style.display=repeat.value==='bulanan-tanggal'?'':'none';
    repeatWeekWrap.style.display=repeat.value==='bulanan-minggu'?'':'none';
    /* Bawaan tanggal mengikuti tanggal awal yang sudah diisi */
    if(repeat.value==='bulanan-tanggal'&&date.value){
      const d=parseInt(String(date.value).split('-')[2],10);
      if(d>=1&&d<=31)repeatDay.value=String(d);
    }
    repeatFeedback.textContent='';
  };
  const events=[...S.events].sort((a,b)=>(b.tanggal||'').localeCompare(a.tanggal||'')||(b.at||0)-(a.at||0));
  const createForm=S.admin&&h('section',{class:'card activity-create'},h('h2',{},'Buat kegiatan'),
    h('div',{class:'activity-create-grid'},
      h('label',{class:'activity-field'},'Nama kegiatan *',title),
      h('label',{class:'activity-field'},'Lokasi',location),
      h('label',{class:'activity-field'},'Tanggal *',date),
      h('label',{class:'activity-field'},'Waktu',time)),
    h('label',{class:'activity-field activity-repeat-field'},'Pengulangan',repeat),
    repeatDateWrap,
    repeatWeekWrap,
    h('button',{class:'btn',onclick:async()=>{
      const judul=title.value.trim();
      if(!judul||!date.value){alert('Isi nama dan tanggal kegiatan.');return}
      const lokasi=location.value.trim();
      try{
        if(repeat.value==='sekali'){
          await S.db.collection('events').add({judul,tanggal:date.value,waktu:time.value,lokasi,peserta_anggota:[],hadir_anggota:[],at:Date.now()});
        }else if(repeat.value==='mingguan'){
          /* Setiap minggu pada hari yang sama dengan tanggal awal,
             12 minggu berturut-turut mulai dari tanggal awal itu. */
          const dates=activityWeeklyDates(date.value);
          const baseAt=Date.now();
          for(let i=0;i<dates.length;i++){
            await S.db.collection('events').add({judul,tanggal:activityDateKey(dates[i]),waktu:time.value,lokasi,peserta_anggota:[],hadir_anggota:[],at:baseAt+i});
          }
          const pesan=dates.length+' kegiatan dibuat (setiap minggu, '+activityDateShort(dates[0])+' – '+activityDateShort(dates[dates.length-1])+')';
          repeatFeedback.textContent=pesan;
          alert(pesan);
        }else{
          const mode=repeat.value==='bulanan-tanggal'?'tanggal':'minggu';
          const dates=activityRecurringDates(date.value,mode,{
            day:parseInt(repeatDay.value,10)||1,
            week:repeatWeek.value,
            weekday:parseInt(repeatWeekday.value,10)||0
          });
          const baseAt=Date.now();
          for(let i=0;i<dates.length;i++){
            await S.db.collection('events').add({judul,tanggal:activityDateKey(dates[i]),waktu:time.value,lokasi,peserta_anggota:[],hadir_anggota:[],at:baseAt+i});
          }
          const pesan=dates.length+' kegiatan dibuat ('+activityMonthShort(dates[0])+' – '+activityMonthShort(dates[dates.length-1])+')';
          repeatFeedback.textContent=pesan;
          alert(pesan);
        }
        title.value='';date.value='';time.value='';location.value='';
        repeat.value='sekali';
        repeatDateWrap.style.display='none';
        repeatWeekWrap.style.display='none';
      }catch(error){console.error(error);alert('Gagal membuat kegiatan: '+(error.message||'periksa koneksi'))}
    }},'Buat kegiatan'),
    repeatFeedback);
  return [
    h('h1',{},'Kegiatan'),
    guard(),
    createForm,
    events.length?h('div',{class:'activity-list'},...events.map(activityCard)):h('p',{class:'warn'},'Belum ada kegiatan.')
  ];
}
