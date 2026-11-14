/* Maskot: bisa digeser, ketuk untuk tanya admin */
const ADMIN_WA=''; /* isi nomor WhatsApp admin, contoh: 6281234567890 */
const pet=$('#pet');let drag=null;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function closeMenu(){const m=$('#pm');if(m)m.remove()}
function askForm(){
  closeMenu();
  if(!S.uid){alert('Silakan daftar atau login terlebih dahulu agar dapat menerima balasan admin.');go('pesan');return}
  const nama=h('input',{placeholder:'Nama lengkap',autocomplete:'name'});
  nama.value=S.name||'';
  const ta=h('textarea',{rows:5,placeholder:'Tulis pertanyaan untuk admin...',autocomplete:'off'});
  const picker=attachmentPicker();
  const askMenu=h('div',{class:'attachment-menu'},picker.buttons);
  const askPlus=h('button',{class:'composer-plus',type:'button',title:'Lampiran',onclick:()=>askMenu.classList.toggle('open')},'+');
  const m=h('div',{id:'qm'},h('div',{class:'card',style:'display:block;max-width:420px'},
    h('b',{},icon('messages',18),h('span',{},'Tanya Admin')),
    h('p',{class:'warn',style:'margin:4px 0 2px'},'Sampaikan pertanyaan Anda. Admin akan membalasnya.'),
    h('label',{class:'lb'},'Nama lengkap *',nama),
    h('label',{class:'lb'},'Pertanyaan *',ta),
    askMenu,askPlus,picker.label,
    h('div',{class:'row',style:'justify-content:flex-start;margin-top:8px'},
      h('button',{class:'btn',onclick:async()=>{
        if(!nama.value.trim()||(!ta.value.trim()&&!picker.files.length)){alert('Nama dan pertanyaan atau lampiran wajib diisi');return}
        if(!S.supabase){alert('Supabase belum tersedia');return}
        try{
          const namaValue=nama.value.trim();
          const attachments=await uploadMessageFiles(picker.files);
          await submitMessage({nama:namaValue,teks:ta.value.trim(),attachments});
          S.name=namaValue;m.remove();
          await loadMessages();
          alert('Pertanyaan terkirim dan sudah masuk ke Pesan Masuk.');
        }catch(e){
          console.error(e);
          alert('Gagal mengirim: '+(e.message||'periksa koneksi Supabase'));
        }
      }},'Kirim pertanyaan'),
      h('button',{class:'btn s',onclick:()=>m.remove()},'Batal'))));
  document.body.append(m);ta.focus()}
function openMenu(){
  if($('#pm'))return closeMenu();
  document.body.append(h('div',{id:'pm'},h('b',{},icon('messages',18),h('span',{},'Mau tanya apa?')),
    h('button',{class:'btn',onclick:askForm},icon('edit',16),h('span',{},'Tulis pertanyaan ke Admin')),
    ADMIN_WA&&h('a',{class:'btn s',href:'https://wa.me/'+ADMIN_WA+'?text='+encodeURIComponent('Halo Admin, saya mau bertanya...'),target:'_blank'},icon('messages',16),h('span',{},'Chat WhatsApp Admin')),
    h('button',{class:'btn s',onclick:closeMenu},'Tutup')))}
pet.addEventListener('pointerdown',e=>{const r=pet.getBoundingClientRect();drag={x:e.clientX,y:e.clientY,l:r.left,t:r.top,m:false};try{pet.setPointerCapture(e.pointerId)}catch(_){}});
pet.addEventListener('pointermove',e=>{
  if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
  if(!drag.m){if(Math.hypot(dx,dy)<8)return;drag.m=true;closeMenu();pet.style.right=pet.style.bottom='auto'}
  pet.style.left=clamp(drag.l+dx,0,innerWidth-pet.offsetWidth)+'px';pet.style.top=clamp(drag.t+dy,60,innerHeight-pet.offsetHeight-4)+'px'});
pet.addEventListener('pointerup',()=>{if(!drag)return;const moved=drag.m;drag=null;if(!moved)openMenu()});
pet.addEventListener('pointercancel',()=>{drag=null});
addEventListener('resize',()=>{if(pet.style.left){pet.style.left=clamp(pet.offsetLeft,0,innerWidth-pet.offsetWidth)+'px';pet.style.top=clamp(pet.offsetTop,60,innerHeight-pet.offsetHeight-4)+'px'}});
