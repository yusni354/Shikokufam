/* Jadwal piket dan forum */
/* ===== Jadwal Piket: susunan TANGGAL → TUGAS → PETUGAS =====
   Data tersimpan TETAP bentuk lama yang dibaca semua tempat lain
   (Home 'Jadwal piket terdekat' dan ruangan Jadwal Piket di Ringkasan
   & Laporan): dokumen cleaning_duties {tanggal, assignments:
   [{nama, tugas}], nama, tugas}. Untuk TAMPILAN dan FORMULIR,
   pasangan-pasangan assignments itu dikelompokkan per tugas:
   satu tugas menjadi satu blok, nama-nama petugasnya berderet di
   bawah nama tugas. Dokumen sangat lama {nama, tugas} tanpa
   'assignments' ikut terbaca lewat cadangan yang sama. */
function dutyAssignmentsFlat(duty){
  if(Array.isArray(duty.assignments)&&duty.assignments.length)return duty.assignments;
  return [{nama:duty.nama||'',tugas:duty.tugas||''}];
}
/* Kelompokkan assignments menjadi [{tugas, petugas:[nama, ...]}]:
   urutan tugas mengikuti kemunculan pertama, nama petugas di dalam
   satu tugas tidak diduplikasi (perbandingan tidak peka huruf). */
function dutyKelompokTugas(duty){
  const kelompok=[];
  const indeks=new Map();
  dutyAssignmentsFlat(duty).forEach(assignment=>{
    const nama=String(assignment.nama||'').trim();
    const tugas=String(assignment.tugas||'').trim()||'Tugas piket';
    if(!nama&&tugas==='Tugas piket'&&!String(assignment.tugas||'').trim())return;
    const kunci=tugas.toLowerCase();
    if(!indeks.has(kunci)){indeks.set(kunci,kelompok.length);kelompok.push({tugas,petugas:[]})}
    const grup=kelompok[indeks.get(kunci)];
    if(nama&&!grup.petugas.some(n=>n.toLowerCase()===nama.toLowerCase()))grup.petugas.push(nama);
  });
  return kelompok;
}
/* Cari anggota dari sebuah nama petugas (semua status, tidak peka
   huruf): untuk foto chip dan penanda 'dari daftar / manual'. */
function dutyCariAnggota(nama){
  const kunci=String(nama||'').trim().toLowerCase();
  if(!kunci)return null;
  return (S.members||[]).find(m=>String(m.nama||'').trim().toLowerCase()===kunci)||null;
}
/* Anggota yang DITAWARKAN pemilih petugas: hanya yang aktif, urut A–Z. */
function dutyAnggotaAktif(){
  return [...(S.members||[])]
    .filter(m=>String(m.status||'aktif').toLowerCase()!=='nonaktif')
    .sort((a,b)=>(a.nama||'').localeCompare(b.nama||'','id'));
}
/* Avatar kecil petugas: foto anggota bila ada, selain itu inisial. */
function dutyAvatar(member,nama,kelas){
  if(member&&member.foto)return h('img',{class:kelas,...memberMediaAttributes(member.foto,'src'),alt:''});
  return h('span',{class:kelas+' piket-avatar-ph'},(nama||'?').trim().slice(0,1).toUpperCase());
}
/* ===== Pemilih petugas piket: combobox anggota + ketik manual =====
   Pola yang sama dengan pemilih pemegang dapukan di Kepengurusan:
   mengetik menyaring daftar anggota aktif (nama + wilayah), menyentuh
   field menampilkan daftar, memilih saran mengisi nama anggota itu.
   Bedanya di sini nama BOLEH diketik manual: teks yang tidak cocok
   dengan anggota mana pun tetap menjadi nilai (tersimpan apa adanya
   dan ditandai 'Manual' oleh formulir). Nama yang sudah dipilih pada
   tugas yang sama (getExcluded) TIDAK ditawarkan lagi, jadi satu
   orang tidak bisa dipilih dua kali dalam satu tugas. Daftar saran
   menutup saat memilih atau menyentuh bidang di luar (tanpa tombol X).
   Nilai komponen (.value) = nama petugas saat ini (string).
   PERBAIKAN PENCARIAN: saringan memakai nama TERPANCANG (terpilih)
   yang hanya berubah saat saran dipilih — bukan 'nilai' yang ikut
   berubah pada setiap ketukan. Versi sebelumnya membandingkan isi
   field dengan 'nilai' sesudah 'nilai' ditimpa isi field itu sendiri,
   jadi perbandingannya selalu sama, saringan tidak pernah berjalan,
   dan daftar lengkap selalu tampil walau sudah mengetik. Daftar
   anggota juga diambil segar pada setiap daftar dibuka, bukan
   ditangkap sekali saat komponen dibuat. */
function piketPilihPetugas(namaAwal,getExcluded,onChange){
  let nilai=String(namaAwal||'');
  let terpilih=nilai;
  const norm=s=>String(s||'').trim().toLowerCase().replace(/\s+/g,' ');
  let sorot=-1;
  let barisPilihan=[];
  const input=h('input',{type:'text',placeholder:'Ketik atau pilih nama petugas…',autocomplete:'off',role:'combobox','aria-expanded':'false','aria-autocomplete':'list'});
  input.value=nilai;
  const daftarEl=h('div',{class:'anggota-saran',role:'listbox'});
  daftarEl.style.display='none';
  const wadah=h('div',{class:'anggota-picker piket-picker'},input,daftarEl);
  const beritahu=()=>{if(typeof onChange==='function')onChange(nilai)};
  const tutup=()=>{
    daftarEl.style.display='none';
    daftarEl.replaceChildren();
    sorot=-1;barisPilihan=[];
    input.setAttribute('aria-expanded','false');
  };
  const pilih=nama=>{
    nilai=String(nama||'');
    terpilih=nilai;
    input.value=nilai;
    tutup();
    beritahu();
  };
  const buka=()=>{
    const daftar=dutyAnggotaAktif();
    const teks=input.value;
    /* Isi field yang masih sama persis dengan nama terpancang dianggap
       belum mengetik: tampilkan daftar lengkap (minus yang sudah
       dipilih pada tugas yang sama). Selain itu saring menurut ketikan
       saat ini — tidak peka huruf besar/kecil, cocok dari tengah nama,
       dan mengikuti teks terbaru termasuk sesudah dihapus/diubah. */
    const q=norm(teks)===norm(terpilih)?'':norm(teks);
    const terkecuali=new Set((typeof getExcluded==='function'?getExcluded():[]).map(norm).filter(Boolean));
    const cocok=daftar.filter(m=>{
      const nama=norm(m.nama);
      if(!nama)return false;
      if(terkecuali.has(nama))return false;
      return !q||nama.includes(q);
    });
    barisPilihan=[];sorot=-1;
    const anak=[];
    cocok.forEach(member=>{
      const nama=member.nama||'';
      const baris=h('div',{class:'anggota-opt',role:'option'},
        dutyAvatar(member,nama,'org-mini'),
        h('span',{class:'anggota-opt-info'},h('b',{},nama),h('small',{},memberRegion(member))));
      baris.addEventListener('pointerdown',ev=>{ev.preventDefault();pilih(nama)});
      barisPilihan.push({el:baris,nama});
      anak.push(baris);
    });
    const ketikan=teks.trim();
    const persis=ketikan&&daftar.some(m=>norm(m.nama)===norm(ketikan));
    if(ketikan&&!persis&&!terkecuali.has(norm(ketikan))){
      const barisManual=h('div',{class:'anggota-opt anggota-opt-manual',role:'option'},
        h('span',{class:'org-mini org-avatar-ph'},icon('edit',15)),
        h('span',{class:'anggota-opt-info'},h('b',{},'Pakai nama manual: “'+ketikan+'”'),h('small',{},'Tidak ada di daftar anggota — tersimpan apa adanya')));
      barisManual.addEventListener('pointerdown',ev=>{ev.preventDefault();pilih(ketikan)});
      barisPilihan.push({el:barisManual,nama:ketikan});
      anak.push(barisManual);
    }
    if(!anak.length)anak.push(h('div',{class:'anggota-opt anggota-opt-note'},'Tidak ada anggota aktif yang cocok. Nama tetap bisa diketik manual.'));
    daftarEl.replaceChildren(...anak);
    daftarEl.style.display='block';
    input.setAttribute('aria-expanded','true');
    if(typeof hydrateMemberMedia==='function')hydrateMemberMedia();
  };
  input.addEventListener('focus',buka);
  input.addEventListener('input',()=>{
    nilai=input.value;
    beritahu();
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
      if(sorot>=0&&barisPilihan[sorot]){ev.preventDefault();pilih(barisPilihan[sorot].nama)}
    }else if(ev.key==='Escape'){
      tutup();
    }
  });
  input.addEventListener('blur',()=>{setTimeout(()=>{if(document.activeElement!==input)tutup()},150)});
  /* Sentuhan di luar field/daftar menutup daftar saran (tanpa tombol X) */
  const onDocPointer=ev=>{
    if(!wadah.isConnected){document.removeEventListener('pointerdown',onDocPointer,true);return}
    if(!wadah.contains(ev.target))tutup();
  };
  document.addEventListener('pointerdown',onDocPointer,true);
  Object.defineProperty(wadah,'value',{get:()=>nilai,set:v=>pilih(v||'')});
  return wadah;
}
function vPiket(){
  const form=S.dutyForm;
  const edit=form&&form.id;
  const dateLabel=value=>value?new Date(value+'T00:00:00').toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'}):'Tanggal belum diatur';
  const today=new Date();
  const todayKey=[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-');
  /* Chip satu petugas: foto/inisial + nama; nama yang tidak ditemukan
     di daftar anggota (ketik manual / anggota lama sudah keluar)
     diberi penanda kecil supaya jelas bukan dari daftar. */
  const chipPetugas=nama=>{
    const member=dutyCariAnggota(nama);
    return h('span',{class:'piket-chip'+(member?'':' piket-chip-manual')},
      dutyAvatar(member,nama,'piket-chip-ava'),
      h('span',{class:'piket-chip-nama'},nama),
      !member&&h('span',{class:'piket-chip-tag'},'Manual'));
  };
  const kartuJadwal=duty=>{
    const date=duty.tanggal?new Date(duty.tanggal+'T00:00:00'):null;
    const kelompok=dutyKelompokTugas(duty);
    const totalPetugas=kelompok.reduce((n,g)=>n+g.petugas.length,0);
    return h('article',{class:'piket-card'},
      h('div',{class:'piket-head'},
        h('div',{class:'piket-date'},date&&h('b',{},String(date.getDate()).padStart(2,'0')),h('small',{},date?date.toLocaleDateString('id-ID',{month:'short'}):'—')),
        h('div',{class:'piket-head-info'},
          h('b',{class:'piket-head-tanggal'},dateLabel(duty.tanggal)),
          h('span',{class:'piket-summary'},kelompok.length+' tugas · '+totalPetugas+' petugas')),
        /* Aksi per jadwal (Edit/Hapus, khusus admin) kini SATU tombol
           gerigi kecil di kepala kartu — panel aksinya berlabel jelas
           dibuka dari gerigi itu (aksi-gerigi.js). */
        S.admin&&aksiGearBtn('jadwal '+dateLabel(duty.tanggal),{jenis:'piket',id:duty.id})),
      h('div',{class:'piket-tasks'},...kelompok.map(grup=>
        h('section',{class:'piket-task'},
          h('div',{class:'piket-task-head'},icon('brush',15),h('b',{},grup.tugas),h('span',{class:'piket-task-count'},grup.petugas.length+' petugas')),
          grup.petugas.length
            ?h('div',{class:'piket-chips'},...grup.petugas.map(chipPetugas))
            :h('p',{class:'piket-task-empty'},'Petugas belum diatur')))));
  };
  const terurut=[...S.cleaningDuties].sort((a,b)=>(a.tanggal||'').localeCompare(b.tanggal||'')||(a.at||0)-(b.at||0));
  const mendatang=terurut.filter(d=>!d.tanggal||d.tanggal>=todayKey);
  const lewat=terurut.filter(d=>d.tanggal&&d.tanggal<todayKey);
  let editor=null;
  let dialogTugas=null;
  let menuTugas=null;
  if(S.admin&&form){
    /* Bentuk formulir: groups = [{tugas, petugas:[nama, ...]}] */
    if(!Array.isArray(form.groups)||!form.groups.length)form.groups=[{tugas:'',petugas:['']}];
    form.groups.forEach(g=>{if(!Array.isArray(g.petugas)||!g.petugas.length)g.petugas=['']});
    const date=h('input',{type:'date'});
    date.value=form.tanggal||'';
    date.oninput=()=>{form.tanggal=date.value};
    /* ===== Simpan & hapus PER TUGAS =====
       Tiap blok tugas punya tombol Simpan tugas dan Hapus tugas sendiri.
       Dasar hitungannya potret petugas yang SUDAH tersimpan per blok
       (tugasAsli + petugasTersimpan, dicatat saat formulir dibuka dan
       diperbarui sesudah tiap simpan/hapus per tugas), jadi menyimpan
       atau menghapus satu tugas menulis ulang dokumen dari potret itu
       ditambah blok yang bersangkutan — tugas lain pada tanggal yang
       sama tidak tertimpa, termasuk perubahan blok lain yang belum
       disimpan. Hasil tulis tetap assignments[{nama, tugas}] supaya
       Home dan ruangan Jadwal Piket di Ringkasan membaca data yang sama. */
    const bersihPetugas=g=>[...new Map((g.petugas||[]).map(n=>String(n||'').trim()).filter(Boolean).map(n=>[n.toLowerCase(),n])).values()];
    /* Normalisasi potret: blok pada formulir edit yang belum membawa
       tugasAsli (dibangun dari jadwal tersimpan) memakai isi awalnya
       sebagai potret tersimpan, supaya simpan/hapus per tugas punya
       dasar yang benar dari jalur pembuka formulir mana pun. */
    if(form.id)form.groups.forEach(g=>{
      if(g.tugasAsli===undefined){g.tugasAsli=(g.tugas||'').trim();g.petugasTersimpan=bersihPetugas(g)}
    });
    const pasanganLain=kecuali=>form.groups.flatMap((g,gi)=>{
      if(gi===kecuali||!(g.tugasAsli||'').trim())return [];
      return (g.petugasTersimpan||[]).map(nama=>({nama,tugas:g.tugasAsli}));
    });
    const tulisDokumen=async assignments=>{
      const data={tanggal:form.tanggal,assignments,nama:assignments[0].nama,tugas:assignments[0].tugas,at:Date.now()};
      if(form.id)await S.db.collection('cleaning_duties').doc(form.id).update(data);
      else{const ref=await S.db.collection('cleaning_duties').add(data);if(ref&&ref.id)form.id=ref.id}
    };
    const simpanTugas=async gi=>{
      const grup=form.groups[gi];if(!grup)return;
      const tugas=(grup.tugas||'').trim();
      const petugas=bersihPetugas(grup);
      if(!form.tanggal){alert('Tanggal wajib diisi sebelum menyimpan tugas.');return}
      if(!tugas){alert('Isi nama tugasnya dulu, lalu simpan tugas ini.');return}
      if(!petugas.length){alert('Tugas "'+tugas+'" belum punya petugas. Tambahkan minimal 1 petugas dulu.');return}
      try{
        await tulisDokumen([...pasanganLain(gi),...petugas.map(nama=>({nama,tugas}))]);
        grup.tugasAsli=tugas;grup.petugasTersimpan=[...petugas];
        S.dutyTaskNotice={gi,text:'Tugas "'+tugas+'" tersimpan.'};
        render();
      }catch(error){console.error(error);alert('Gagal menyimpan tugas: '+(error.message||'periksa koneksi'))}
    };
    const mintaHapusTugas=gi=>{
      const grup=form.groups[gi];if(!grup)return;
      const adaIsi=(grup.tugas||'').trim()||bersihPetugas(grup).length||(grup.tugasAsli||'').trim();
      /* Blok yang masih kosong langsung dibuang dari formulir; blok
         berisi melewati dialog konfirmasi yang menyebut nama tugasnya. */
      if(!adaIsi){form.groups.splice(gi,1);if(!form.groups.length)form.groups=[{tugas:'',petugas:['']}];gambarGroups();return}
      S.dutyTaskConfirm={gi};render();
    };
    const hapusTugas=async gi=>{
      const grup=form.groups[gi];if(!grup)return;
      const namaTugas=(grup.tugasAsli||grup.tugas||'').trim()||'Tugas '+(gi+1);
      S.dutyTaskConfirm=null;
      try{
        if(form.id&&(grup.tugasAsli||'').trim()){
          const sisa=pasanganLain(gi);
          /* Tugas terakhir pada tanggal itu: dokumennya ikut dihapus
             supaya tidak ada jadwal kosong tanpa tugas. */
          if(sisa.length)await tulisDokumen(sisa);
          else{await S.db.collection('cleaning_duties').doc(form.id).delete();form.id=null}
        }
        form.groups.splice(gi,1);
        if(!form.groups.length)form.groups=[{tugas:'',petugas:['']}];
        S.dutyTaskNotice={gi:-1,text:'Tugas "'+namaTugas+'" dihapus.'};
        render();
      }catch(error){console.error(error);alert('Gagal menghapus tugas: '+(error.message||'periksa koneksi'))}
    };
    /* Konfirmasi hapus SATU tugas: pola dialog aplikasi (confirm-overlay,
       tanpa tombol X — mengetuk bidang di luar kotak atau Batal
       menutupnya, isi kotak tidak ikut menutup). */
    if(S.dutyTaskConfirm&&form.groups[S.dutyTaskConfirm.gi]){
      const gi=S.dutyTaskConfirm.gi;
      const grup=form.groups[gi];
      const tersimpan=!!(grup.tugasAsli||'').trim();
      const namaTugas=(grup.tugas||'').trim()||(grup.tugasAsli||'').trim()||'Tugas '+(gi+1);
      const tutup=()=>{S.dutyTaskConfirm=null;render()};
      dialogTugas=h('div',{class:'confirm-overlay',onclick:tutup},
        h('div',{class:'card confirm-card',onclick:ev=>ev.stopPropagation()},
          h('b',{class:'confirm-title'},'Hapus Tugas Piket'),
          h('p',{class:'confirm-text'},tersimpan
            ?'Hapus tugas "'+namaTugas+'" dari jadwal '+dateLabel(form.tanggal)+'? Semua petugas pada tugas ini ikut terhapus dari jadwal tanggal tersebut. Tugas lain pada tanggal yang sama tidak berubah.'
            :'Buang blok tugas "'+namaTugas+'"? Blok ini belum tersimpan, jadi isinya hanya hilang dari formulir ini.'),
          h('div',{class:'fl confirm-actions'},
            h('button',{class:'btn s',onclick:tutup},'Batal'),
            h('button',{class:'btn',onclick:()=>hapusTugas(gi)},'Hapus tugas'))));
    }
    /* Panel aksi GERIGI per tugas: dibuka dari tombol gerigi di kepala
       blok tugas (S.piketTugasMenu = indeks tugasnya). Isinya tepat
       dua aksi berlabel — Simpan tugas & Hapus tugas — dengan fungsi
       yang sama persis seperti tombol kaki blok sebelumnya. Pola
       aplikasi: tanpa tombol X, mengetuk bidang di luar kotak
       menutupnya. Dibangun di sini karena simpanTugas/mintaHapusTugas
       adalah penutup (closure) formulir ini. */
    if(S.piketTugasMenu!=null&&form.groups[S.piketTugasMenu]){
      const giMenu=S.piketTugasMenu;
      const grupMenu=form.groups[giMenu];
      const namaTugasMenu=(grupMenu.tugas||'').trim()||'Tugas '+(giMenu+1);
      const tutupMenu=()=>{S.piketTugasMenu=null;render()};
      menuTugas=h('div',{class:'confirm-overlay',onclick:tutupMenu},
        h('div',{class:'card confirm-card aksi-menu-card',onclick:ev=>ev.stopPropagation()},
          h('b',{class:'confirm-title'},'Pengaturan Tugas'),
          h('p',{class:'confirm-text'},namaTugasMenu),
          h('div',{class:'aksi-menu-list'},
            h('button',{type:'button',class:'aksi-menu-item',onclick:()=>{S.piketTugasMenu=null;render();void simpanTugas(giMenu)}},icon('check',16),h('span',{},'Simpan tugas')),
            h('button',{type:'button',class:'aksi-menu-item aksi-menu-item-danger',onclick:()=>{S.piketTugasMenu=null;mintaHapusTugas(giMenu);if(!S.dutyTaskConfirm)render()}},icon('trash',16),h('span',{},'Hapus tugas')))));
    }
    const groupsEl=h('div',{class:'piket-form-groups'});
    const gambarGroups=()=>{
      groupsEl.replaceChildren(...form.groups.map((grup,gi)=>{
        const inputTugas=h('input',{type:'text',placeholder:'Contoh: Menyapu & mengepel aula',maxlength:'120'});
        inputTugas.value=grup.tugas||'';
        inputTugas.oninput=()=>{grup.tugas=inputTugas.value};
        const petugasEl=h('div',{class:'piket-form-petugas'});
        const gambarPetugas=()=>{
          petugasEl.replaceChildren(...grup.petugas.map((nama,pi)=>{
            const tagManual=h('span',{class:'piket-manual-tag'},'Manual · tidak di daftar anggota');
            const segarkanTag=()=>{
              const terisi=String(grup.petugas[pi]||'').trim();
              tagManual.style.display=terisi&&!dutyCariAnggota(terisi)?'':'none';
            };
            const pemilih=piketPilihPetugas(nama,()=>grup.petugas.filter((_,i)=>i!==pi),v=>{grup.petugas[pi]=v;segarkanTag()});
            segarkanTag();
            return h('div',{class:'piket-form-petugas-row'},
              h('div',{class:'piket-form-petugas-main'},pemilih,tagManual),
              grup.petugas.length>1&&h('button',{class:'btn s piket-icon-btn',title:'Hapus petugas ini',onclick:()=>{grup.petugas.splice(pi,1);gambarPetugas()}},icon('close',15)));
          }));
          if(typeof hydrateMemberMedia==='function')hydrateMemberMedia();
        };
        gambarPetugas();
        return h('section',{class:'piket-form-group'},
          h('div',{class:'piket-form-group-head'},
            h('span',{class:'piket-group-number'},String(gi+1)),
            h('b',{},'Tugas '+(gi+1)),
            (grup.tugasAsli||'').trim()&&h('span',{class:'piket-group-saved-tag'},'Tersimpan'),
            /* Simpan/Hapus per tugas kini lewat SATU tombol gerigi
               kecil di kepala blok tugas ini (panel berlabel di
               menuTugas pada vPiket) — fungsi simpan/hapus per
               tugasnya tidak berubah. */
            h('button',{type:'button',class:'aksi-gear-btn piket-group-gear',title:'Pengaturan tugas '+(gi+1),'aria-label':'Pengaturan tugas '+(gi+1),onclick:()=>{S.piketTugasMenu=gi;render()}},icon('gear',15))),
          h('label',{class:'lb'},'Nama tugas *',inputTugas),
          h('div',{class:'piket-form-petugas-head'},h('b',{},'Petugas *'),h('small',{},'Pilih dari daftar anggota atau ketik manual')),
          petugasEl,
          h('button',{class:'btn s piket-add-petugas',onclick:()=>{grup.petugas.push('');gambarPetugas()}},'+ Tambah petugas'),
          (S.dutyTaskNotice&&S.dutyTaskNotice.gi===gi)&&h('div',{class:'piket-form-group-foot'},
            h('span',{class:'piket-task-saved'},icon('check',13),S.dutyTaskNotice.text)));
      }));
    };
    gambarGroups();
    editor=box(h('b',{},edit?'Edit jadwal piket':'Tambah jadwal piket'),
      h('p',{class:'piket-form-hint'},'Satu tanggal bisa berisi beberapa tugas. Tiap tugas diisi nama tugasnya, lalu petugas-petugasnya di bawahnya — satu tugas boleh banyak petugas, dan satu orang boleh mengisi beberapa tugas. Tiap tugas juga bisa disimpan atau dihapus sendiri lewat tombol pada bloknya, tanpa menyimpan seluruh formulir.'),
      h('label',{class:'lb'},'Tanggal *',date),
      (S.dutyTaskNotice&&S.dutyTaskNotice.gi===-1)&&h('p',{class:'piket-task-saved piket-task-saved-form'},icon('check',13),S.dutyTaskNotice.text),
      groupsEl,
      h('button',{class:'btn s piket-add-tugas',onclick:()=>{form.groups.push({tugas:'',petugas:['']});gambarGroups()}},'+ Tambah tugas'),
      h('div',{class:'fl'},
        h('button',{class:'btn',onclick:async()=>{
          if(!form.tanggal){alert('Tanggal wajib diisi.');return}
          const groups=form.groups.map(g=>({
            tugas:(g.tugas||'').trim(),
            petugas:[...new Map((g.petugas||[]).map(n=>String(n||'').trim()).filter(Boolean).map(n=>[n.toLowerCase(),n])).values()]
          }));
          if(groups.some(g=>!g.tugas||!g.petugas.length)){alert('Setiap tugas wajib punya nama tugas dan minimal 1 petugas.');return}
          /* Simpan TETAP sebagai assignments[{nama, tugas}] supaya Home
             dan ruangan Jadwal Piket di Ringkasan membaca data yang sama. */
          const assignments=[];
          groups.forEach(g=>g.petugas.forEach(nama=>assignments.push({nama,tugas:g.tugas})));
          const data={tanggal:form.tanggal,assignments,nama:assignments[0].nama,tugas:assignments[0].tugas,at:Date.now()};
          try{
            if(form.id)await S.db.collection('cleaning_duties').doc(form.id).update(data);
            else await S.db.collection('cleaning_duties').add(data);
            S.dutyForm=null;S.dutyTaskNotice=null;S.dutyTaskConfirm=null;render();
          }catch(error){console.error(error);alert('Gagal menyimpan jadwal: '+(error.message||'periksa koneksi'))}
        }},edit?'Simpan perubahan':'Tambah jadwal'),
        h('button',{class:'btn s',onclick:()=>{S.dutyForm=null;S.dutyTaskNotice=null;S.dutyTaskConfirm=null;render()}},'Batal')));
  }
  const hasil=[h('div',{class:'duty-heading'},h('div',{},h('h1',{},'Jadwal Piket')),h('span',{class:'duty-count'},S.cleaningDuties.length+' jadwal')),
    S.admin&&!form&&h('button',{class:'btn duty-add',onclick:()=>{S.dutyForm={tanggal:todayKey,groups:[{tugas:'',petugas:['']}]};S.dutyTaskNotice=null;S.dutyTaskConfirm=null;render()}},'+ Tambah jadwal'),
    editor];
  if(dialogTugas)hasil.push(dialogTugas);
  if(menuTugas)hasil.push(menuTugas);
  const menuGerigiPiket=aksiMenuAktif();
  if(menuGerigiPiket)hasil.push(menuGerigiPiket);
  if(mendatang.length)hasil.push(h('div',{class:'piket-list'},...mendatang.map(kartuJadwal)));
  else if(!editor)hasil.push(h('div',{class:'duty-empty'},icon('brush',24),h('b',{},'Belum ada jadwal piket mendatang'),h('p',{},S.admin?'Tambahkan jadwal pertama untuk mulai mengatur tugas piket.':'Jadwal piket yang akan datang akan tampil di sini.')));
  if(lewat.length){
    hasil.push(h('button',{type:'button',class:'piket-past-toggle','aria-expanded':S.dutyPastOpen?'true':'false',onclick:()=>{S.dutyPastOpen=!S.dutyPastOpen;render()}},
      icon('calendar',16),h('span',{},'Sudah lewat · '+lewat.length+' jadwal'),h('span',{class:'piket-past-chev'+(S.dutyPastOpen?' open':'')},icon('chevD',16))));
    if(S.dutyPastOpen)hasil.push(h('div',{class:'piket-list piket-list-past'},...[...lewat].reverse().map(kartuJadwal)));
  }
  return hasil;
}
function vForum(){
  const t=h('input',{placeholder:'Judul topik'}),b=h('textarea',{placeholder:'Isi diskusi',rows:3});
  /* Hapus topik (khusus admin) kini lewat SATU tombol gerigi kecil di
     kepala kartu topik — panel aksinya berlabel jelas (aksi-gerigi.js).
     Tombol Kirim di formulir topik baru tidak berubah. */
  const list=S.topics.map(x=>h('div',{class:'card',style:'display:block'},
    h('div',{class:'forum-topic-head'},h('b',{},x.judul),S.admin&&aksiGearBtn('topik '+(x.judul||''),{jenis:'forum',id:x.id})),
    h('p',{class:'warn'},x.isi||'')));
  return [h('h1',{},'Forum'),guard(),
    h('div',{class:'card',style:'display:block'},t,b,h('button',{class:'btn',onclick:async()=>{
      if(!t.value.trim()||!S.db){alert('Isi judul topik terlebih dahulu.');return}
      try{await S.db.collection('topics').add({judul:t.value.trim(),isi:b.value.trim(),by:S.uid,at:Date.now()});t.value='';b.value=''}
      catch(error){console.error(error);alert('Gagal mengirim topik: '+(error.message||'periksa koneksi'))}
    }},'Kirim')),
    ...(list.length?list:[h('p',{class:'warn'},'Belum ada topik.')]),
    aksiMenuAktif()];
}
