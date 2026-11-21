/* Pembantu data anggota: wilayah, tautan WhatsApp/sosial, nilai kontak */
function regionColor(value){return wilayahEfektif().find(([name])=>name===value)?.[1]||'#718096'}
function memberRegion(member){
  const known=value=>wilayahEfektif().find(([name])=>name.toLowerCase()===String(value||'').trim().toLowerCase())?.[0];
  const legacy=legacyRegionTarget(member);
  if(legacy)return legacy;
  return known(member.wilayah)||inferJapanLocation(member.alamat_jp,member.kota,member.kec_jp,member.kodepos,member.pref,member.wilayah)?.wilayah||'Belum dipilih';
}
/* Wilayah lama yang sudah dihapus: Okayama -> Marugame;
   Kagawa -> wilayah terdekat dari alamat (fallback Takamatsu) */
function legacyRegionTarget(member){
  const current=String(member?.wilayah||'').trim().toLowerCase();
  if(current==='okayama')return 'Marugame';
  if(current==='kagawa'){
    const inferred=inferJapanLocation(member.alamat_jp,member.kota,member.kec_jp,member.kodepos,member.pref)?.wilayah;
    return ['Marugame','Takamatsu','Zentsuji / Takuma'].includes(inferred)?inferred:'Takamatsu';
  }
  return null;
}
/* Samakan wilayah tersimpan anggota lama saat data dimuat, lalu simpan seperti biasa */
const regionMigrationPending=new Set();
function migrateMemberRegions(){
  if(!S.db||!Array.isArray(S.members))return;
  S.members.forEach(member=>{
    /* Dijaga per anggota: satu data lama yang bentuknya tidak biasa tidak
       boleh melempar error yang menghentikan pemrosesan anggota lain
       atau gambar ulang daftar. */
    try{
      const target=legacyRegionTarget(member);
      if(!target||!member.id||regionMigrationPending.has(member.id))return;
      regionMigrationPending.add(member.id);
      const stored=target.toUpperCase();
      member.wilayah=stored;
      setTimeout(()=>{
        Promise.resolve()
          .then(()=>S.db.collection('members').doc(member.id).update({wilayah:stored}))
          .catch(error=>console.error('Migrasi wilayah anggota gagal:',error))
          .finally(()=>regionMigrationPending.delete(member.id));
      },0);
    }catch(error){console.error('Migrasi wilayah satu anggota dilewati:',error)}
  });
}
function wilayah(){const m={};S.members.forEach(x=>{const w=memberRegion(x);(m[w]=m[w]||[]).push(x)});return m}
function openMember(member,origin){S.detail=member;S.detailOrigin=origin;S.view='members';render()}
function whatsappUrl(value){
  const raw=String(value||'').trim();
  let number=raw.replace(/\D/g,'');
  if(raw.startsWith('00'))number=number.slice(2);
  else if(!raw.startsWith('+')&&number.startsWith('0'))number='62'+number.slice(1);
  else if(!raw.startsWith('+')&&!number.startsWith('62')&&!number.startsWith('81'))number='62'+number;
  return number.length>=8&&number.length<=15?'https://wa.me/'+number:'';
}
function socialUrl(platform,value){
  const raw=String(value||'').trim();
  if(!raw)return '';
  if(/^https?:\/\//i.test(raw)){
    try{
      const url=new URL(raw);
      const hosts={facebook:['facebook.com','www.facebook.com','m.facebook.com'],instagram:['instagram.com','www.instagram.com'],tiktok:['tiktok.com','www.tiktok.com','vm.tiktok.com']};
      if(url.protocol==='http:')url.protocol='https:';
      return url.protocol==='https:'&&hosts[platform]?.includes(url.hostname.toLowerCase())?url.href:'';
    }catch(error){return ''}
  }
  const handle=raw.replace(/^@/,'').trim();
  if(!handle)return '';
  if(platform==='facebook')return /\s/.test(handle)?'https://www.facebook.com/search/top/?q='+encodeURIComponent(handle):'https://www.facebook.com/'+encodeURIComponent(handle);
  if(platform==='instagram')return 'https://www.instagram.com/'+encodeURIComponent(handle.toLowerCase())+'/';
  return 'https://www.tiktok.com/@'+encodeURIComponent(handle.toLowerCase());
}
function memberValue(key,value){
  if(value==null||value==='')return '';
  const phones=['wa','hp_pengurus','hp_ortu'];
  const platforms={facebook:'facebook',instagram:'instagram',tiktok:'tiktok'};
  const href=phones.includes(key)?whatsappUrl(value):platforms[key]?socialUrl(platforms[key],value):'';
  const text=String(value).toUpperCase();
  return href?h('a',{class:'member-contact-link',href,target:'_blank',rel:'noopener noreferrer'},text):text;
}
