/* Halaman Musyawarah - pencatatan rapat dengan tampilan OneNote */
function musyawarahView(){
  const notebooks=[{id:'umum',nama:'Catatan Umum'},{id:'piket',nama:'Piket & Kebersihan'},{id:'kegiatan',nama:'Kegiatan Komunitas'}];
  const sections=[{id:'agenda',nama:'Agenda Rapat'},{id:'keputusan',nama:'Keputusan'},{id:'tindak_lanjut',nama:'Tindak Lanjut'},{id:'catatan',nama:'Catatan Pembahasan'}];
  let activeNotebook=notebooks[0];
  let activeSection=sections[0];
  let activePage=null;
  let pages=[];
  let noteContent='';

  function fmtDate(d){if(!d)return '';const x=new Date(d+'T00:00:00');return isNaN(x)?d:x.toLocaleDateString('id-ID',{weekday:'short',day:'numeric',month:'short',year:'numeric'});}
  function fmtTime(t){return t||'';}
  function newId(){return (crypto||window.crypto).randomUUID();}

  function loadPages(){
    const all=[...(S.musyawarah||[])].sort((a,b)=>(b.at||0)-(a.at||0));
    pages=all.map(m=>({id:m.id,judul:m.judul||'(tanpa judul)',tanggal:m.tanggal||'',waktu:m.waktu_mulai||'',lokasi:m.lokasi||'',content:m.catatanPembahasan||'',notebook:m.notebook||'umum',section:m.section||'agenda'}));
    if(!activePage&&pages.length>0)activePage=pages[0];
    if(activePage)noteContent=activePage.content||'';
    else noteContent='';
  }
  loadPages();

  async function savePage(){
    if(!activePage){
      const judul=document.querySelector('#note-title').value.trim();
      if(!judul){alert('Judul rapat wajib diisi.');return;}
      const tanggal=document.querySelector('#note-date').value;
      const waktu=document.querySelector('#note-time').value;
      const lokasi=document.querySelector('#note-lokasi').value.trim();
      const pemimpin=document.querySelector('#note-pemimpin').value.trim();
      const notulis=document.querySelector('#note-notulis').value.trim();
      const content=document.querySelector('#note-content').textContent||'';
      const pageId=newId();
      const data={id:pageId,judul,tanggal,waktu,lokasi,pemimpin,notulis,catatanPembahasan:content,notebook:activeNotebook.id,section:activeSection.id,at:Date.now()};
      try{
        await S.db.collection('musyawarah').add(data);
        loadPages();render();
      }catch(e){alert('Gagal menyimpan: '+(e.message||'periksa koneksi'));}
      return;
    }
    const judul=document.querySelector('#note-title').value.trim()||activePage.judul;
    const tanggal=document.querySelector('#note-date').value||activePage.tanggal;
    const waktu=document.querySelector('#note-time').value||activePage.waktu;
    const lokasi=document.querySelector('#note-lokasi').value.trim()||activePage.lokasi;
    const pemimpin=document.querySelector('#note-pemimpin').value.trim()||'';
    const notulis=document.querySelector('#note-notulis').value.trim()||'';
    const content=document.querySelector('#note-content').textContent||'';
    const data={id:activePage.id,judul,tanggal,waktu,lokasi,pemimpin,notulis,catatanPembahasan:content,notebook:activeNotebook.id,section:activeSection.id,at:Date.now()};
    try{
      await S.db.collection('musyawarah').doc(activePage.id).set(data);
      loadPages();render();
    }catch(e){alert('Gagal menyimpan: '+(e.message||'periksa koneksi'));}
  }

  async function deletePage(){
    if(!activePage)return;
    if(!confirm('Hapus catatan rapat "'+(activePage.judul||'ini')+'"?'))return;
    try{await S.db.collection('musyawarah').doc(activePage.id).delete();loadPages();activePage=null;noteContent='';render();}catch(e){alert('Gagal menghapus: '+(e.message||'periksa koneksi'));}
  }

  function newPage(){
    activePage=null;
    noteContent='';
    render();
  }

  function selectPage(page){
    activePage=page;
    noteContent=page.content||'';
    render();
  }

  function selectNotebook(nb){activeNotebook=nb;render();}
  function selectSection(sec){activeSection=sec;render();}

  function pageList(){
    const filtered=pages.filter(p=>p.notebook===activeNotebook.id&&p.section===activeSection.id);
    return h('div',{class:'musyawarah-page-list'},
      h('button',{class:'musyawarah-new-page',onclick:newPage},h('span',{},'+'),h('span',{},'Halaman baru')),
      ...filtered.map(p=>h('button',{class:'musyawarah-page-item'+(activePage&&activePage.id===p.id?' on':''),onclick:()=>selectPage(p)},
        h('div',{class:'musyawarah-page-info'},
          h('div',{class:'musyawarah-page-title'},p.judul||'(tanpa judul)'),
          h('div',{class:'musyawarah-page-meta'},fmtDate(p.tanggal)+(p.waktu?' · '+fmtTime(p.waktu):'')
        )),
        h('button',{class:'musyawarah-page-delete',onclick:async(e)=>{e.stopPropagation();activePage=p;await deletePage();}},'\u00d7')
      ))
    );
  }

  function noteEditor(){
    const isNew=!activePage;
    return h('div',{class:'musyawarah-note'},
      h('div',{class:'musyawarah-note-header'},
        h('div',{class:'musyawarah-note-title-wrap'},
          h('input',{id:'note-title',placeholder:'Judul rapat...',value:isNew?'':activePage?activePage.judul:''})
        ),
        h('div',{class:'musyawarah-note-meta'},
          h('input',{id:'note-date',type:'date',value:isNew?'':activePage?activePage.tanggal:''}),
          h('input',{id:'note-time',type:'time',value:isNew?'':activePage?activePage.waktu:''}),
          h('input',{id:'note-lokasi',placeholder:'Lokasi',value:isNew?'':activePage?activePage.lokasi:''}),
          h('input',{id:'note-pemimpin',placeholder:'Pemimpin rapat',value:isNew?'':activePage?activePage.pemimpin:''}),
          h('input',{id:'note-notulis',placeholder:'Notulis',value:isNew?'':activePage?activePage.notulis:''})
        )
      ),
      h('div',{class:'musyawarah-note-body'},
        h('div',{id:'note-content',contenteditable:'true',class:'musyawarah-note-content',spellcheck:'true'},noteContent)
      )
    );
  }

  function toolbar(){
    return h('div',{class:'musyawarah-toolbar'},
      h('button',{class:'btn s',onclick:savePage},icon('check',16),h('span',{},'Simpan')),
      h('button',{class:'btn s',onclick:newPage},icon('plus',16),h('span',{},'Baru')),
      h('button',{class:'btn s',onclick:deletePage,style:activePage?'':'display:none'},icon('trash',16),h('span',{},'Hapus')),
      h('button',{class:'btn s',onclick:()=>{document.execCommand('bold')}},icon('edit',16),h('span',{},'Tebal')),
      h('button',{class:'btn s',onclick:()=>{document.execCommand('italic')}},h('span',{},'Miring')),
      h('button',{class:'btn s',onclick:()=>{document.execCommand('insertUnorderedList')}},h('span',{},'Daftar')),
      h('button',{class:'btn s',onclick:()=>{document.execCommand('insertOrderedList')}},h('span',{},'Nomor')),
    );
  }

  return [
    h('div',{class:'musyawarah-app'},
      h('div',{class:'musyawarah-sidebar'},
        h('div',{class:'musyawarah-notebooks'},
          ...notebooks.map(nb=>h('button',{class:'musyawarah-notebook'+(activeNotebook.id===nb.id?' on':''),onclick:()=>selectNotebook(nb)},nb.nama))
        ),
        h('div',{class:'musyawarah-sections'},
          ...sections.map(sec=>h('button',{class:'musyawarah-section'+(activeSection.id===sec.id?' on':''),onclick:()=>selectSection(sec)},sec.nama))
        ),
        pageList()
      ),
      h('div',{class:'musyawarah-main'},
        h('div',{class:'musyawarah-topbar'},
          h('div',{},h('h1',{},'Musyawarah'),h('p',{class:'sub'},'Catatan hasil rapat komunitas Shikoku Family')),
          h('div',{class:'musyawarah-topbar-actions'},toolbar())
        ),
        isNew?h('div',{class:'musyawarah-empty'},h('p',{},'Pilih halaman dari sisi kiri atau buat halaman baru untuk mulai mencatat rapat.')):noteEditor()
      )
    )
  ];
}