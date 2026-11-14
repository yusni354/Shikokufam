/* Jadwal piket dan forum */
function vPiket(){
  const form=S.dutyForm;
  const edit=form&&form.id;
  const dateLabel=value=>value?new Date(value+'T00:00:00').toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'}):'Tanggal belum diatur';
  const assignmentsFor=duty=>Array.isArray(duty.assignments)&&duty.assignments.length?duty.assignments:[{nama:duty.nama||'',tugas:duty.tugas||''}];
  const cards=[...S.cleaningDuties].sort((a,b)=>(a.tanggal||'').localeCompare(b.tanggal||'')).map(duty=>{
    const date=duty.tanggal?new Date(duty.tanggal+'T00:00:00') : null;
    return h('article',{class:'duty-card'},
      h('div',{class:'duty-date'},date&&h('b',{},String(date.getDate()).padStart(2,'0')),h('small',{},date?date.toLocaleDateString('id-ID',{month:'short'}):'—')),
      h('div',{class:'duty-info'},h('small',{},dateLabel(duty.tanggal)),h('div',{class:'duty-assignments'},...assignmentsFor(duty).map(assignment=>
        h('div',{class:'duty-assignment'},h('b',{},assignment.nama),h('span',{},assignment.tugas))))),
      S.admin&&h('div',{class:'duty-actions'},
        h('button',{class:'btn s',title:'Edit jadwal',onclick:()=>{S.dutyForm={...duty,assignments:assignmentsFor(duty).map(assignment=>({...assignment}))};render()}},icon('edit',15),h('span',{},'Edit')),
        h('button',{class:'btn s',title:'Hapus jadwal',onclick:async()=>{
          if(!confirm('Hapus jadwal piket tanggal '+dateLabel(duty.tanggal)+'?'))return;
          try{await S.db.collection('cleaning_duties').doc(duty.id).delete()}catch(error){console.error(error);alert('Gagal menghapus jadwal: '+(error.message||'periksa koneksi'))}
        }},'Hapus')));
  });
  let editor=null;
  if(S.admin&&form){
    form.assignments=form.assignments?.length?form.assignments:[{nama:form.nama||'',tugas:form.tugas||''}];
    const date=h('input',{type:'date'});
    date.value=form.tanggal||'';
    date.oninput=()=>{form.tanggal=date.value};
    const rows=h('div',{class:'duty-form-assignments'});
    const drawAssignments=()=>{
      rows.replaceChildren(...form.assignments.map((assignment,index)=>{
        const name=h('input',{placeholder:'Nama yang bertugas',maxlength:'120'}),task=h('input',{placeholder:'Tugas kebersihan',maxlength:'300'});
        name.value=assignment.nama||'';task.value=assignment.tugas||'';
        name.oninput=()=>{assignment.nama=name.value};
        task.oninput=()=>{assignment.tugas=task.value};
        return h('div',{class:'duty-form-assignment'},
          h('span',{class:'duty-assignment-number'},String(index+1)),
          h('div',{class:'duty-form-fields'},
            h('label',{class:'lb'},'Nama *',name),
            h('label',{class:'lb'},'Tugas *',task)),
          form.assignments.length>1&&h('button',{class:'btn s duty-remove',title:'Hapus nama dan tugas ini',onclick:()=>{form.assignments.splice(index,1);drawAssignments()}},icon('close',15)));
      }));
    };
    drawAssignments();
    editor=box(h('b',{},edit?'Edit jadwal piket':'Tambah jadwal piket'),
      h('label',{class:'lb'},'Tanggal *',date),
      h('div',{class:'duty-form-heading'},h('b',{},'Nama dan tugas'),h('small',{},'Tambahkan satu baris untuk setiap orang yang bertugas.')),
      rows,
      h('button',{class:'btn s duty-add-person',onclick:()=>{form.assignments.push({nama:'',tugas:''});drawAssignments()}},'+ Tambah nama dan tugas'),
      h('div',{class:'fl'},
        h('button',{class:'btn',onclick:async()=>{
          const assignments=form.assignments.map(assignment=>({nama:(assignment.nama||'').trim(),tugas:(assignment.tugas||'').trim()}));
          if(!form.tanggal||assignments.some(assignment=>!assignment.nama||!assignment.tugas)){alert('Tanggal, semua nama, dan tugas wajib diisi.');return}
          const data={tanggal:form.tanggal,assignments,nama:assignments[0].nama,tugas:assignments[0].tugas,at:Date.now()};
          try{
            if(form.id)await S.db.collection('cleaning_duties').doc(form.id).update(data);
            else await S.db.collection('cleaning_duties').add(data);
            S.dutyForm=null;render();
          }catch(error){console.error(error);alert('Gagal menyimpan jadwal: '+(error.message||'periksa koneksi'))}
        }},edit?'Simpan perubahan':'Tambah jadwal'),
        h('button',{class:'btn s',onclick:()=>{S.dutyForm=null;render()}},'Batal')));
  }
  return [h('div',{class:'duty-heading'},h('div',{},h('h1',{},'Jadwal Piket'),h('p',{class:'sub'},'Bersama menjaga kebersihan tempat kita berkumpul.')),h('span',{class:'duty-count'},S.cleaningDuties.length+' jadwal')),
    S.admin&&!form&&h('button',{class:'btn duty-add',onclick:()=>{const today=new Date();S.dutyForm={tanggal:[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-'),assignments:[{nama:'',tugas:''}]};render()}},'+ Tambah jadwal'),
    editor,
    cards.length?h('div',{class:'duty-list'},...cards):h('div',{class:'duty-empty'},icon('brush',24),h('b',{},'Belum ada jadwal piket'),h('p',{},S.admin?'Tambahkan jadwal pertama untuk mulai mengatur tugas kebersihan.':'Jadwal piket yang akan datang akan tampil di sini.'))];
}
function vForum(){
  const t=h('input',{placeholder:'Judul topik'}),b=h('textarea',{placeholder:'Isi diskusi',rows:3});
  const list=S.topics.map(x=>h('div',{class:'card',style:'display:block'},h('b',{},x.judul),h('p',{class:'warn'},x.isi||''),
    S.admin&&h('button',{class:'btn s',onclick:async()=>{
      if(!confirm('Hapus topik ini?'))return;
      try{await S.db.collection('topics').doc(x.id).delete()}catch(error){console.error(error);alert('Gagal menghapus topik: '+(error.message||'periksa koneksi'))}
    }},'Hapus')));
  return [h('h1',{},'Forum'),h('p',{class:'sub'},'Diskusi anggota'),guard(),
    h('div',{class:'card',style:'display:block'},t,b,h('button',{class:'btn',onclick:async()=>{
      if(!t.value.trim()||!S.db){alert('Isi judul topik terlebih dahulu.');return}
      try{await S.db.collection('topics').add({judul:t.value.trim(),isi:b.value.trim(),by:S.uid,at:Date.now()});t.value='';b.value=''}
      catch(error){console.error(error);alert('Gagal mengirim topik: '+(error.message||'periksa koneksi'))}
    }},'Kirim')),
    list.length?list:h('p',{class:'warn'},'Belum ada topik.')];
}
