/* Foto dan dokumen anggota (bucket privat member-files) */
function isPrivateMemberMedia(path){return typeof path==='string'&&path.startsWith('members/')}
function memberMediaAttributes(path,attribute){
  /* Media mode lokal tertanam sebagai data URL dan bisa langsung ditampilkan */
  if(typeof path==='string'&&path.startsWith('data:'))return {[attribute]:path};
  if(S.supabase&&isPrivateMemberMedia(path)){
    const cached=S.memberMediaUrls.get(path);
    return {'data-member-media':path,...(cached&&cached.expiresAt>Date.now()+30000?{[attribute]:cached.url}:{})};
  }
  return {[attribute]:'/_blob/'+path};
}
function hydrateMemberMedia(){
  if(!S.supabase)return;
  document.querySelectorAll('#app [data-member-media]').forEach(element=>{
    const path=element.getAttribute('data-member-media');
    const cached=S.memberMediaUrls.get(path);
    if(cached&&cached.expiresAt>Date.now()+30000){
      element.setAttribute(element.tagName==='A'?'href':'src',cached.url);
      return;
    }
    if(S.memberMediaPending.has(path)||S.memberMediaFailed.has(path))return;
    S.memberMediaPending.add(path);
    S.supabase.storage.from('member-files').createSignedUrl(path,3600).then(({data,error})=>{
      if(error)throw error;
      if(!data?.signedUrl)throw new Error('URL privat tidak tersedia');
      S.memberMediaUrls.set(path,{url:data.signedUrl,expiresAt:Date.now()+3600000});
      document.querySelectorAll('#app [data-member-media]').forEach(current=>{
        if(current.getAttribute('data-member-media')===path)current.setAttribute(current.tagName==='A'?'href':'src',data.signedUrl);
      });
    }).catch(error=>{
      S.memberMediaFailed.add(path);
      S.memberMediaError=error.message||'Gagal membuka media anggota';
      console.error('Media privat anggota gagal dimuat:',error);
      render();
    }).finally(()=>S.memberMediaPending.delete(path));
  });
}
/* Baca berkas sebagai data URL (dipakai mode lokal untuk foto, dokumen, dan lampiran) */
function readFileAsDataUrl(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||''));reader.onerror=()=>reject(reader.error||new Error('File tidak dapat dibaca'));reader.readAsDataURL(file)})}
async function readLocalImageDataUrl(file){
  if(!file.type||!file.type.startsWith('image/'))return readFileAsDataUrl(file);
  try{
    const bitmap=await createImageBitmap(file);
    const scale=Math.min(1,1024/Math.max(bitmap.width,bitmap.height));
    if(scale>=1&&file.size<700000){if(bitmap.close)bitmap.close();return readFileAsDataUrl(file)}
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(bitmap.width*scale));
    canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
    if(bitmap.close)bitmap.close();
    return canvas.toDataURL('image/jpeg',0.82);
  }catch(e){return readFileAsDataUrl(file)}
}
async function uploadPrivateMemberMedia(file){
  if(!S.supabase||!S.uid)throw new Error('Login Supabase diperlukan untuk mengunggah media anggota.');
  const safeName=(file.name||'lampiran').replace(/[^a-zA-Z0-9._-]/g,'-');
  const path='members/'+S.uid+'/'+crypto.randomUUID()+'-'+safeName;
  const {error}=await S.supabase.storage.from('member-files').upload(path,file,{contentType:file.type||'application/octet-stream'});
  if(error)throw error;
  return path;
}
