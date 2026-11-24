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
      renderDariData();
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

/* ===== Pendeteksian wajah otomatis (Shape Detection API) =====
   Foto anggota yang wajahnya kecil di dalam bingkai (mis. foto lanskap
   pemandangan) tampil mungil di Kartu Anggota. Bila peramban menyediakan
   FaceDetector bawaan, foto otomatis dibingkai ke AREA WAJAH + LEHER saja:
   1) SAAT UNGGAH (siapkanFotoAnggotaOtomatis): foto dipotong di sekitar
      wajah terbesar SEBELUM disimpan; hasil potong itulah yang diproses
      & disimpan sebagai foto anggota.
   2) SAAT TAMPIL di Kartu ID (hydrateMemberIdFaceFraming): foto lama yang
      sudah tersimpan dibingkai ulang secara dinamis dari kotak wajahnya,
      hasilnya disimpan di cache ringan (memori + localStorage) per foto
      agar tidak dideteksi berulang.
   Bila FaceDetector tidak tersedia, wajah tidak ditemukan, atau deteksi
   gagal, SEMUA berjalan persis seperti sebelumnya (unggah tanpa potong,
   Kartu ID memakai zoom 1,55x center 24% dari CSS) — deteksi tidak pernah
   menggagalkan unggahan maupun tampilan. */
let _detektorWajah=null,_detektorWajahGagal=false;
function detektorWajah(){
  if(typeof FaceDetector==='undefined')return null;
  if(_detektorWajahGagal)return null;
  if(_detektorWajah)return _detektorWajah;
  try{_detektorWajah=new FaceDetector({fastMode:true,maxDetectedFaces:5})}
  catch(e1){try{_detektorWajah=new FaceDetector()}catch(e2){_detektorWajahGagal=true;return null}}
  return _detektorWajah;
}
/* Wajah terbesar dari sebuah sumber gambar (bitmap/elemen img/dll).
   Mengembalikan {x,y,width,height} dalam piksel sumber, atau null. */
async function deteksiWajahTerbesar(sumber){
  const det=detektorWajah();
  if(!det||!sumber)return null;
  try{
    const hasil=await det.detect(sumber);
    if(!hasil||!hasil.length)return null;
    let terbaik=null,luasTerbaik=-1;
    hasil.forEach(wajah=>{
      const bb=wajah&&(wajah.boundingBox||wajah.bounding_box);
      if(!bb||!(bb.width>0)||!(bb.height>0))return;
      const luas=bb.width*bb.height;
      if(luas>luasTerbaik){luasTerbaik=luas;terbaik={x:bb.x,y:bb.y,width:bb.width,height:bb.height}}
    });
    return terbaik;
  }catch(e){return null}
}
/* Wilayah potong kepala–leher dari kotak wajah (semua dalam piksel):
   kotak wajah diperluas ±0,8x lebar wajah ke tiap sisi, naik 0,5x tinggi
   wajah (rambut/dahi), turun 1,1x tinggi wajah (leher/bahu), dijepit ke
   tepi gambar, lalu rasio disesuaikan ke bingkai foto Kartu ID (104:126). */
function hitungPotongKepalaLeher(lebar,tinggi,wajah){
  if(!(lebar>0)||!(tinggi>0)||!wajah)return null;
  const aspek=104/126;
  let x1=wajah.x-0.8*wajah.width,x2=wajah.x+wajah.width+0.8*wajah.width;
  let y1=wajah.y-0.5*wajah.height,y2=wajah.y+wajah.height+1.1*wajah.height;
  x1=Math.max(0,x1);y1=Math.max(0,y1);x2=Math.min(lebar,x2);y2=Math.min(tinggi,y2);
  let w=x2-x1,hh=y2-y1;
  if(!(w>0&&hh>0))return null;
  if(w/hh>aspek){const hBaru=w/aspek,cy=(y1+y2)/2;y1=cy-hBaru/2;y2=cy+hBaru/2}
  else{const wBaru=hh*aspek,cx=(x1+x2)/2;x1=cx-wBaru/2;x2=cx+wBaru/2}
  if(x1<0){x2-=x1;x1=0}
  if(y1<0){y2-=y1;y1=0}
  if(x2>lebar){x1-=x2-lebar;x2=lebar}
  if(y2>tinggi){y1-=y2-tinggi;y2=tinggi}
  x1=Math.max(0,x1);y1=Math.max(0,y1);x2=Math.min(lebar,x2);y2=Math.min(tinggi,y2);
  w=x2-x1;hh=y2-y1;
  if(w>lebar){w=lebar;hh=w/aspek;const cy=(y1+y2)/2;y1=Math.max(0,Math.min(tinggi-hh,cy-hh/2));y2=y1+hh;x1=0;x2=w}
  if(hh>tinggi){hh=tinggi;w=hh*aspek;const cx=(x1+x2)/2;x1=Math.max(0,Math.min(lebar-w,cx-w/2));x2=x1+w;y1=0;y2=hh}
  w=x2-x1;hh=y2-y1;
  if(!(w>=20&&hh>=20))return null;
  return {x:Math.round(x1),y:Math.round(y1),width:Math.round(w),height:Math.round(hh)};
}
/* 1) UNGGAH: potong berkas foto anggota ke wajah+leher sebelum disimpan.
   Mengembalikan File hasil potong, atau berkas asal apa adanya bila
   deteksi tidak tersedia / wajah tidak ditemukan / langkah apa pun gagal. */
async function siapkanFotoAnggotaOtomatis(file){
  try{
    if(!file||!file.type||file.type.indexOf('image/')!==0)return file;
    if(!detektorWajah())return file;
    let bitmap=null;
    try{bitmap=await createImageBitmap(file,{imageOrientation:'from-image'})}
    catch(e){try{bitmap=await createImageBitmap(file)}catch(e2){return file}}
    try{
      const wajah=await deteksiWajahTerbesar(bitmap);
      if(!wajah)return file;
      const potong=hitungPotongKepalaLeher(bitmap.width,bitmap.height,wajah);
      if(!potong)return file;
      /* Potongan mencakup hampir seluruh foto: tidak ada gunanya memotong */
      if(potong.width>=bitmap.width*0.98&&potong.height>=bitmap.height*0.98)return file;
      const skala=Math.min(1,1024/Math.max(potong.width,potong.height));
      const cw=Math.max(1,Math.round(potong.width*skala)),ch=Math.max(1,Math.round(potong.height*skala));
      const canvas=document.createElement('canvas');canvas.width=cw;canvas.height=ch;
      const ctx=canvas.getContext('2d');if(!ctx)return file;
      ctx.drawImage(bitmap,potong.x,potong.y,potong.width,potong.height,0,0,cw,ch);
      const blob=await new Promise(res=>{try{canvas.toBlob(res,'image/jpeg',0.88)}catch(e){res(null)}});
      if(!blob||!blob.size)return file;
      const namaDasar=(String(file.name||'foto-anggota').replace(/\.[^.]*$/,'')||'foto-anggota');
      try{return new File([blob],namaDasar+'-wajah.jpg',{type:'image/jpeg',lastModified:Date.now()})}
      catch(e){return blob}
    }finally{if(bitmap&&bitmap.close){try{bitmap.close()}catch(e){}}}
  }catch(e){return file}
}
/* ===== Cache bingkai wajah per foto (ringan) ===== */
const KUNCI_CACHE_WAJAH='sf_bingkai_wajah_v1';
let _cacheWajahMemori=null;
function muatCacheWajah(){
  if(_cacheWajahMemori)return _cacheWajahMemori;
  _cacheWajahMemori={};
  try{const mentah=localStorage.getItem(KUNCI_CACHE_WAJAH);if(mentah){const obj=JSON.parse(mentah);if(obj&&typeof obj==='object'&&!Array.isArray(obj))_cacheWajahMemori=obj}}catch(e){}
  return _cacheWajahMemori;
}
function simpanCacheWajah(){
  try{
    const cache=muatCacheWajah(),kunci=Object.keys(cache);
    if(kunci.length>120)kunci.slice(0,kunci.length-120).forEach(k=>delete cache[k]);
    localStorage.setItem(KUNCI_CACHE_WAJAH,JSON.stringify(cache));
  }catch(e){}
}
/* Kunci cache stabil dari nilai foto tersimpan: jalur privat dipakai apa
   adanya; data URL panjang diringkas menjadi hash agar DOM & cache tetap
   ringan (isi data URL tidak pernah ditulis sebagai kunci). */
function kunciWajahDariNilai(nilai){
  const s=String(nilai||'');
  if(!s)return '';
  if(s.length<=300)return s;
  let hash=0;for(let i=0;i<s.length;i++){hash=((hash<<5)-hash+s.charCodeAt(i))|0}
  return 'data:'+s.length+':'+hash;
}
function kunciCacheWajahUntuk(img){
  return img.getAttribute('data-member-media')||img.getAttribute('data-face-key')||kunciWajahDariNilai(img.getAttribute('src')||img.src||'');
}
/* 2) TAMPIL: terapkan bingkai wajah+leher pada foto Kartu ID. Elemen img
   diposisikan mutlak di dalam bingkainya (overflow hidden) sedemikian
   rupa sehingga wilayah potong kepala–leher mengisi bingkai PERSIS:
   lebar/tinggi elemen = kebalikan fraksi potong, geser kiri/atas =
   posisi potong relatif terhadap potongannya. Mengembalikan false bila
   potongannya mencakup hampir seluruh foto (bingkai bawaan lebih baik). */
function terapkanBingkaiWajah(img,wajahNorm){
  try{
    const iw=img.naturalWidth,ih=img.naturalHeight;
    if(!iw||!ih||!wajahNorm)return false;
    const potong=hitungPotongKepalaLeher(iw,ih,{x:wajahNorm.x*iw,y:wajahNorm.y*ih,width:wajahNorm.w*iw,height:wajahNorm.h*ih});
    if(!potong)return false;
    if(potong.width>=iw*0.98&&potong.height>=ih*0.98)return false;
    const cw=potong.width/iw,ch=potong.height/ih,cx=potong.x/iw,cy=potong.y/ih;
    img.classList.add('face-framed');
    img.style.position='absolute';
    img.style.left=(-(cx/cw)*100)+'%';
    img.style.top=(-(cy/ch)*100)+'%';
    img.style.width=(100/cw)+'%';
    img.style.height=(100/ch)+'%';
    img.style.maxWidth='none';
    img.style.maxHeight='none';
    img.style.transform='none';
    img.style.objectPosition='center center';
    img.setAttribute('data-face-applied','1');
    return true;
  }catch(e){return false}
}
/* Deteksi wajah pada foto yang SEDANG tampil di Kartu ID, simpan hasilnya
   ke cache, lalu terapkan bingkainya. Percobaan pertama langsung dari
   elemen img; bila peramban menolaknya (mis. batas CORS), ulangi dari
   salinan blob hasil fetch alamat gambarnya. Kegagalan total dicatat
   sebagai 'tanpa wajah' di cache agar tidak dideteksi berulang, dan
   bingkai bawaan (zoom CSS) tetap dipakai. */
async function deteksiDanBingkaiFotoKartu(img,kunci){
  let wajahNorm=null;
  const langsung=await deteksiWajahTerbesar(img);
  if(langsung&&img.naturalWidth&&img.naturalHeight){
    wajahNorm={x:langsung.x/img.naturalWidth,y:langsung.y/img.naturalHeight,w:langsung.width/img.naturalWidth,h:langsung.height/img.naturalHeight};
  }else{
    let bmp=null;
    try{
      const src=img.currentSrc||img.src;
      if(src){
        const resp=await fetch(src);
        if(resp.ok){
          const blob=await resp.blob();
          bmp=await createImageBitmap(blob);
          const w2=await deteksiWajahTerbesar(bmp);
          if(w2)wajahNorm={x:w2.x/bmp.width,y:w2.y/bmp.height,w:w2.width/bmp.width,h:w2.height/bmp.height};
        }
      }
    }catch(e){wajahNorm=null}
    finally{if(bmp&&bmp.close){try{bmp.close()}catch(e){}}}
  }
  const cache=muatCacheWajah();
  if(wajahNorm){cache[kunci]=wajahNorm;simpanCacheWajah();terapkanBingkaiWajah(img,wajahNorm)}
  else{cache[kunci]={none:true};simpanCacheWajah()}
  img.setAttribute('data-face-done','1');
}
/* Dipanggil render() sesudah media anggota terhidrasi. KHUSUS foto di
   dalam bingkai Kartu ID (.member-id-photo-frame); ubin, avatar, dan
   penampil foto besar tidak disentuh. Foto yang alamatnya baru terisi
   belakangan (URL bertanda tangan privat) diproses saat peristiwa load
   gambarnya tiba. */
function hydrateMemberIdFaceFraming(){
  document.querySelectorAll('#app .member-id-photo-frame img.member-id-photo').forEach(img=>{
    if(img.getAttribute('data-face-done')==='1'||img.getAttribute('data-face-processing')==='1')return;
    const proses=()=>{
      if(img.getAttribute('data-face-done')==='1'||img.getAttribute('data-face-processing')==='1')return;
      const kunci=kunciCacheWajahUntuk(img);
      if(!kunci)return;
      const tersimpan=muatCacheWajah()[kunci];
      if(tersimpan){img.setAttribute('data-face-done','1');if(!tersimpan.none)terapkanBingkaiWajah(img,tersimpan);return}
      if(!detektorWajah()){img.setAttribute('data-face-done','1');return}
      img.setAttribute('data-face-processing','1');
      deteksiDanBingkaiFotoKartu(img,kunci).catch(()=>{}).finally(()=>{img.removeAttribute('data-face-processing')});
    };
    if(img.complete&&img.naturalWidth)proses();
    else img.addEventListener('load',proses,{once:true});
  });
}
