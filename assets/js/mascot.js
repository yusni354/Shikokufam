/* Tanya Admin: formulir pertanyaan ke admin.
   Dulu dibuka lewat maskot melayang di pojok kanan bawah; maskot itu
   sudah dihapus atas permintaan pengguna, jadi formulir ini sekarang
   dibuka lewat tombol 'Butuh bantuan? Hubungi Admin' di Home dan lewat
   halaman Pesan. Fungsi askForm dipertahankan apa adanya. */
function askForm(){
  if(!S.uid){alert('Silakan daftar atau login terlebih dahulu agar dapat menerima balasan admin.');go('pesan');return}
  const nama=h('input',{placeholder:'Nama lengkap',autocomplete:'name'});
  nama.value=S.name||'';
  const ta=h('textarea',{rows:5,placeholder:'Tulis pertanyaan untuk admin...',autocomplete:'off'});
  const picker=attachmentPicker();
  const askMenu=h('div',{class:'attachment-menu'},picker.buttons);
  const askPlus=h('button',{class:'composer-plus',type:'button',title:'Lampiran',onclick:()=>askMenu.classList.toggle('open')},'+');
  const m=h('div',{id:'qm'},h('div',{class:'card',style:'display:block;max-width:420px'},
    h('b',{},icon('messages',18),h('span',{},'Tanya Admin')),
    h('label',{class:'lb'},'Nama lengkap *',nama),
    h('label',{class:'lb'},'Pertanyaan *',ta),
    askMenu,askPlus,picker.label,
    h('div',{class:'row',style:'justify-content:flex-start;margin-top:8px'},
      h('button',{class:'btn',onclick:async()=>{
        if(!nama.value.trim()||(!ta.value.trim()&&!picker.files.length)){alert('Nama dan pertanyaan atau lampiran wajib diisi');return}
        try{
          const namaValue=nama.value.trim();
          const attachments=await uploadMessageFiles(picker.files);
          await submitMessage({nama:namaValue,teks:ta.value.trim(),attachments});
          S.name=namaValue;m.remove();
          await loadMessages();
          alert('Pertanyaan terkirim dan sudah masuk ke Pesan Masuk.');
        }catch(e){
          console.error(e);
          alert('Gagal mengirim: '+(e.message||'periksa koneksi'));
        }
      }},'Kirim pertanyaan'),
      h('button',{class:'btn s',onclick:()=>m.remove()},'Batal'))));
  document.body.append(m);ta.focus()}
