/* Peta Google My Maps, persetujuan akun, sebaran wilayah */
function alamatJp(m,det){return [det?m.alamat_jp:'',m.kec_jp,m.kota,m.pref||m.wilayah,m.kodepos,'Japan'].filter(Boolean).join(', ')}
function mapMid(){const d=(S.pengaturan||[]).find(x=>x.id==='peta');return d&&d.mid}
function mapEmbedUrl(mid){return 'https://www.google.com/maps/d/embed?mid='+encodeURIComponent(mid)}
async function loadMapSettings(){
  if(!S.supabase)return;
  const {data,error}=await S.supabase.from('map_settings').select('map_mid').eq('id','main').maybeSingle();
  if(error){console.error(error);S.mapError=error.message||'Konfigurasi peta tidak dapat dibaca';S.pengaturan=[];return}
  S.mapError='';
  S.pengaturan=data?[{id:'peta',mid:data.map_mid}]:[];
}
async function loadPendingUsers(){
  if(!S.supabase||!S.mainAdmin){S.pendingUsers=[];return}
  const {data,error}=await S.supabase.from('profiles').select('id,name,email,created_at,approval_status').eq('approval_status','pending').order('created_at',{ascending:true});
  if(error){console.error(error);S.pendingUsers=[];return}
  S.pendingUsers=data||[];
}
function csvEsc(v){v=String(v==null?'':v);return(v.includes(',')||v.includes('"')||v.includes(String.fromCharCode(10)))?'"'+v.split('"').join('""')+'"':v}
async function exportMyMaps(det){
  const rows=[['Nama','Wilayah','Alamat','Status','Kode']].concat(S.members.map((m,i)=>[m.panggilan||m.nama,m.wilayah||m.pref||'',alamatJp(m,det),m.status||'aktif',m.kode||'MEM-'+String(i+1).padStart(5,'0')]).filter(r=>r[2]&&r[2]!=='Japan').map(row=>row.map(value=>String(value).toUpperCase())));
  try{
    const csv=String.fromCharCode(65279)+rows.map(r=>r.map(csvEsc).join(',')).join(String.fromCharCode(10));
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
    const link=h('a',{href:url,download:'anggota-untuk-my-maps.csv',style:'display:none'});
    document.body.append(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),2000);
  }catch(e){alert('Gagal mengunduh: '+(e.message||e.code||''))}
}
async function saveMid(inp){
  const u=inp.value.trim(),mm=(u.match(/[?&;]mid=([^&#"'\s<>]+)/i)||[])[1]||(/^[A-Za-z0-9_-]{10,}$/.test(u)?u:'');
  if(!mm){alert('Kode tidak dikenali. Tempel kode embed (iframe) dari Google My Maps yang memuat "mid="');return}
  if(!S.mainAdmin){alert('Hanya admin utama yang dapat mengubah peta');return}
  try{
    if(S.supabase){
      const {error}=await S.supabase.from('map_settings').upsert({id:'main',map_mid:mm,updated_at:new Date().toISOString()},{onConflict:'id'});
      if(error)throw error;
      S.pengaturan=[{id:'peta',mid:mm}];
    }else await S.db.collection('pengaturan').doc('peta').set({mid:mm,at:Date.now()});
    alert('Peta disimpan');render();
  }catch(e){alert('Gagal menyimpan peta: '+(e.message||'periksa izin admin'))}}
async function clearMap(){
  if(!S.mainAdmin){alert('Hanya admin utama yang dapat menghapus peta');return}
  if(!confirm('Hapus peta dari Beranda?'))return;
  try{
    if(S.supabase){
      const {error}=await S.supabase.from('map_settings').delete().eq('id','main');
      if(error)throw error;
    }else await S.db.collection('pengaturan').doc('peta').delete();
    S.pengaturan=[];S.mapError='';alert('Peta dihapus dari Beranda');render();
  }catch(e){alert('Gagal menghapus peta: '+(e.message||'periksa izin admin'))}}
function mapEmbed(){
  const mid=mapMid();
  return mid?h('div',{},h('iframe',{src:mapEmbedUrl(mid),style:'width:100%;height:calc(100vh - 120px);min-height:520px;border:0;border-radius:18px;background:var(--line)',loading:'lazy',allow:'fullscreen',title:'Google My Maps'}),h('a',{class:'btn s',style:'display:inline-flex;align-items:center;margin-top:10px;text-decoration:none',href:'https://www.google.com/maps/d/viewer?mid='+encodeURIComponent(mid),target:'_blank'},icon('external',16),h('span',{},'Buka di Google My Maps'))):h('p',{class:'warn'},S.mapError||'Belum ada peta. Admin dapat mengatur Google My Maps melalui menu Pengaturan Peta.');
}
function vPeta(){return [mapEmbed()]}
async function setApproval(id,status){
  if(!S.supabase||!S.mainAdmin)return;
  const {error}=await S.supabase.from('profiles').update({
    approval_status:status,
    approved_at:status==='approved'?new Date().toISOString():null
  }).eq('id',id);
  if(error){alert('Gagal memperbarui persetujuan: '+error.message);return}
  await loadPendingUsers();render();
}
function vApprovals(){
  if(!S.mainAdmin)return [h('p',{class:'warn'},'Halaman ini hanya dapat diakses admin utama.')];
  const rows=S.pendingUsers.map(user=>h('div',{class:'card approval-row'},
    h('div',{style:'flex:1;min-width:0'},h('b',{},user.name||'Nama belum diisi'),h('small',{},user.email||'-'),h('small',{},new Date(user.created_at).toLocaleString('id-ID'))),
    h('div',{class:'fl'},h('button',{class:'btn',onclick:()=>setApproval(user.id,'approved')},'Setujui'),h('button',{class:'btn s',onclick:()=>setApproval(user.id,'rejected')},'Tolak'))));
  return [h('h1',{},'Persetujuan Akun'),h('p',{class:'sub'},'Pendaftar baru menunggu persetujuan admin.'),...(rows.length?rows:[h('p',{class:'warn'},'Tidak ada pendaftar yang menunggu persetujuan.')])];
}
function vPetaSettings(){
  const mid=mapMid(),det=h('input',{type:'checkbox'}),inp=h('textarea',{rows:4,placeholder:'Tempel kode embed (iframe) dari Google My Maps'});
  inp.value=mid?mapEmbedUrl(mid):'';
  const ready=S.members.filter(m=>{const a=alamatJp(m,false);return a&&a!=='Japan'}).length;
  return [h('h1',{},'Peta Wilayah'),h('p',{class:'sub'},ready+' dari '+S.members.length+' anggota punya alamat Jepang untuk dijadikan pin'),
    S.mainAdmin&&box(h('b',{},'Pasang & perbarui peta'),
      h('p',{class:'warn'},'1) Unduh CSV. 2) Buka mymaps.google.com, buat peta baru, pilih Impor, lalu unggah CSV. 3) Pilih kolom Alamat untuk posisi pin dan kolom Nama untuk judul. 4) Atur peta agar bisa dilihat publik. 5) Di My Maps klik menu titik tiga di samping judul peta, pilih "Sematkan di situs saya", salin kode HTML-nya, lalu tempel di kotak di bawah.'),
      h('label',{class:'warn',style:'display:block;margin:8px 0'},det,' Sertakan alamat jalan/gedung (lebih tepat, tetapi lebih sensitif)'),
      h('button',{class:'btn',style:'margin-bottom:10px',onclick:()=>exportMyMaps(det.checked)},'⬇️ Unduh CSV untuk My Maps ('+ready+' pin)'),
      inp,h('div',{class:'fl'},h('button',{class:'btn',onclick:()=>saveMid(inp)},'Simpan peta'),h('button',{class:'btn s',onclick:clearMap},'Hapus peta dari Beranda'))),
    h('b',{style:'display:block;margin:6px 4px 10px'},'Sebaran per wilayah'),...sebaran()];
}

function sebaran(){const w=wilayah(),k=Object.keys(w);return k.length?k.map(n=>h('div',{class:'card',style:'display:block'},h('div',{class:'row'},h('b',{},icon('pin',16),h('span',{},n.toUpperCase())),h('span',{class:'tag'},w[n].length+' anggota')),h('small',{},w[n].map(x=>(x.nama||'').toUpperCase()).join(', ')))):[h('p',{class:'warn'},'Belum ada data wilayah.')]}
