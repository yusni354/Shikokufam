/* ===== Animasi hidup aplikasi =====
   Tiga pustaka luar, semuanya DIMUAT MALAS dari CDN jsDelivr sesudah
   aplikasi tampil (dipicu panggilan animasikanHalaman() pertama dari
   render() di views.js), versi DIPIN PERSIS dan dikunci SRI (SHA-384)
   sama seperti pustaka lain di index.html — berkas CDN yang isinya
   berubah/dipalsukan ditolak peramban:
   - GSAP 3.12.5 + ScrollTrigger: judul halaman muncul PER KATA —
     judul yang sudah terlihat beranimasi saat halaman dibuka, judul
     di bawah lipatan beranimasi saat digulir masuk pandangan.
   - Motion 12.23.24 (motion.dev): kartu daftar masuk berjenjang
     (fade + naik halus) dan hover kartu terangkat ringan + bayangan
     clay yang menguat. Hover dipasang lewat DELEGASI pada #app,
     jadi berlaku untuk SEMUA kartu (animasi masuk saja yang
     dibatasi 24 pertama demi kecepatan).
   - Lenis 1.1.14: gulir halus HANYA di desktop (≥1024px + penunjuk
     presisi). Di HP gulir tetap alami bawaan peramban.
   KESELAMATAN (aturan tetap): tidak ada keadaan awal tersembunyi di
   CSS — keadaan awal animasi selalu dipasang lewat JS pustaka itu
   sendiri, jadi bila CDN gagal dimuat ATAU pengguna mengaktifkan
   prefers-reduced-motion, halaman tampil statis PENUH seperti biasa
   tanpa error dan tanpa konten yang terjebak tak terlihat.
   PENGECUALIAN LENIS: halaman Peta (Leaflet menguasai gulirnya
   sendiri), panel/modal, drawer, halaman profil, dan semua wadah
   yang bergulir sendiri (utas pesan, tabel rekap/laporan/inventaris,
   daftar anggota peta) tidak pernah diambil alih Lenis.
   Musyawarah TIDAK dianimasikan sama sekali (berkas pemilik). */
(function(){
  'use strict';
  var kurangiGerak=false;
  try{kurangiGerak=!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)}catch(e){}

  var PUSTAKA=[
    {url:'https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js',
     sri:'sha384-g4NTh/Iv5PPU4xPyhEWqPcwtNXOvdaDI8LLnyYfyNZOjKJeYQyjzQ9X5275eBjpt',
     siap:function(){return !!window.gsap}},
    {url:'https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js',
     sri:'sha384-Z3REaz79l2IaAZqJsSABtTbhjgOUYyV3p90XNnAPCSHg3EMTz1fouunq9WZRtj3d',
     siap:function(){return !!window.ScrollTrigger}},
    {url:'https://cdn.jsdelivr.net/npm/motion@12.23.24/dist/motion.js',
     sri:'sha384-nBgsjHMooWkZSws+BwZCIUfFVZTogsEqtZPFOlTYB/0EAQ2VEKdgw1WsP9A90HER',
     siap:function(){return !!(window.Motion&&typeof window.Motion.animate==='function')}},
    {url:'https://cdn.jsdelivr.net/npm/lenis@1.1.14/dist/lenis.min.js',
     sri:'sha384-O55L/6rhHr9CFvrxqv5luxOCcmVaBmETbZbJDP+Do8T0pztTACsFBD/IXCNkj7DV',
     siap:function(){return typeof window.Lenis==='function'}}
  ];
  var muatPromise=null,libsSiap=false;
  function muatSkrip(item){
    return new Promise(function(resolve){
      if(item.siap()){resolve(true);return}
      var s=document.createElement('script');
      s.src=item.url;s.async=true;s.crossOrigin='anonymous';s.integrity=item.sri;
      s.onload=function(){resolve(item.siap())};
      s.onerror=function(){resolve(false)};
      document.head.appendChild(s);
    });
  }
  function muatSemuaPustaka(){
    if(muatPromise)return muatPromise;
    /* GSAP lebih dulu (ScrollTrigger bergantung padanya), lalu Motion
       & Lenis sejajar. Kegagalan satu pustaka tidak membatalkan yang
       lain: tiap fungsi animasi memeriksa pustakanya sendiri. */
    muatPromise=muatSkrip(PUSTAKA[0])
      .then(function(){return muatSkrip(PUSTAKA[1])})
      .then(function(){return Promise.all([muatSkrip(PUSTAKA[2]),muatSkrip(PUSTAKA[3])])})
      .then(function(){
        libsSiap=true;
        if(window.gsap&&window.ScrollTrigger){try{window.gsap.registerPlugin(window.ScrollTrigger)}catch(e){}}
        return true;
      });
    return muatPromise;
  }

  /* ===== Lenis: gulir halus desktop saja ===== */
  var SELEKTOR_CEGAH='.chat-body,.rekap-wrap,.laporan-wrap,.inv-wrap,.member-profile-page,.picker-card,.peta-member-list,.inv-detail-card,.anggota-saran,#dr,.confirm-overlay,#qm,.fin-lightbox,.leaflet-container,.musy-root';
  function dalamWadahSendiri(el){return !!(el&&el.closest&&el.closest(SELEKTOR_CEGAH))}
  function desktopHalus(){
    try{return window.innerWidth>=1024&&window.matchMedia('(hover: hover) and (pointer: fine)').matches}
    catch(e){return window.innerWidth>=1024}
  }
  var lenis=null,lenisRaf=0;
  function buatLenis(){
    if(lenis||kurangiGerak||!desktopHalus()||typeof window.Lenis!=='function')return;
    try{
      lenis=new window.Lenis({duration:1.05,smoothWheel:true,prevent:function(el){return dalamWadahSendiri(el)}});
      if(window.ScrollTrigger)lenis.on('scroll',window.ScrollTrigger.update);
      var putar=function(waktu){if(lenis)lenis.raf(waktu);lenisRaf=requestAnimationFrame(putar)};
      lenisRaf=requestAnimationFrame(putar);
    }catch(e){lenis=null}
  }
  function hancurkanLenis(){
    if(lenisRaf)cancelAnimationFrame(lenisRaf);
    lenisRaf=0;
    if(lenis){try{lenis.destroy()}catch(e){}lenis=null}
  }
  function segarkanKeadaanLenis(){
    if(kurangiGerak)return;
    /* Tandai wadah gulir sendiri yang sedang ada di halaman, supaya
       Lenis melewatinya (lapis kedua di samping opsi prevent). */
    try{document.querySelectorAll(SELEKTOR_CEGAH).forEach(function(el){el.setAttribute('data-lenis-prevent','')})}catch(e){}
    if(!desktopHalus()){hancurkanLenis();return}
    buatLenis();
    if(!lenis)return;
    var view=(typeof S!=='undefined'&&S.view)||'';
    var halangan=view==='peta'||document.body.classList.contains('peta-view')||document.body.classList.contains('open')||!!document.querySelector('.confirm-overlay,#qm,.fin-lightbox,.member-profile-page');
    try{if(halangan)lenis.stop();else lenis.start()}catch(e){}
  }
  var tundaResize=null;
  window.addEventListener('resize',function(){
    if(tundaResize)clearTimeout(tundaResize);
    tundaResize=setTimeout(segarkanKeadaanLenis,200);
  });
  /* Drawer & panel bisa berubah tanpa render (mis. tombol hamburger
     hanya menukar class body): pengamat ringan ini menyelaraskan
     keadaan Lenis sesudahnya. */
  function pasangPengamatLenis(){
    if(!window.MutationObserver||!document.body)return;
    var tunda=null;
    var obs=new MutationObserver(function(){
      if(tunda)clearTimeout(tunda);
      tunda=setTimeout(segarkanKeadaanLenis,60);
    });
    obs.observe(document.body,{attributes:true,attributeFilter:['class'],childList:true});
    var app=document.getElementById('app');
    if(app)obs.observe(app,{childList:true});
  }
  if(document.body)pasangPengamatLenis();
  else document.addEventListener('DOMContentLoaded',pasangPengamatLenis);

  /* ===== GSAP: judul muncul per kata ===== */
  function bersihkanTriggerMati(){
    if(!window.ScrollTrigger)return;
    try{window.ScrollTrigger.getAll().forEach(function(t){if(t.trigger&&!document.contains(t.trigger))t.kill()})}catch(e){}
  }
  /* Pecah teks judul menjadi span per kata TANPA mengubah teksnya;
     judul yang berisi unsur lain (ikon dsb.) tidak dipecah. Judul
     mendapat aria-label teks utuh dan tiap kata aria-hidden, jadi
     pembaca layar tetap membaca judul seperti semula. */
  function pecahKata(el){
    if(el.dataset.animKata==='1')return null;
    var anak=Array.prototype.slice.call(el.childNodes);
    if(!anak.length)return null;
    for(var i=0;i<anak.length;i++){if(anak[i].nodeType!==3)return null}
    var teks=el.textContent.replace(/\s+/g,' ').trim();
    if(!teks)return null;
    var kata=teks.split(' ');
    el.setAttribute('aria-label',teks);
    el.dataset.animKata='1';
    el.textContent='';
    var spans=[];
    kata.forEach(function(k,idx){
      var sp=document.createElement('span');
      sp.className='anim-kata';
      sp.setAttribute('aria-hidden','true');
      sp.textContent=k;
      el.appendChild(sp);
      if(idx<kata.length-1)el.appendChild(document.createTextNode(' '));
      spans.push(sp);
    });
    return spans;
  }
  function animasiJudul(app){
    if(!window.gsap)return;
    var judul=Array.prototype.slice.call(app.querySelectorAll('h1,h2')).filter(function(el){
      return !el.closest('.confirm-overlay,#qm,.fin-lightbox,.member-profile-page,.chat-card,.leaflet-container');
    });
    judul.forEach(function(el){
      var spans=pecahKata(el);
      if(!spans)return;
      try{
        var rect=el.getBoundingClientRect();
        var diLayar=rect.top<(window.innerHeight||0)*0.92&&rect.bottom>0;
        var vars={opacity:1,y:0,duration:0.45,stagger:0.055,ease:'power2.out',overwrite:true,clearProps:'all'};
        /* Judul di bawah lipatan: picu ScrollTrigger saat digulir
           masuk pandangan; tanpa ScrollTrigger putar langsung. */
        if(!diLayar&&window.ScrollTrigger)vars.scrollTrigger={trigger:el,start:'top 92%',once:true};
        window.gsap.fromTo(spans,{opacity:0,y:'0.35em'},vars);
      }catch(e){/* satu judul gagal tidak boleh mengganggu halaman */}
    });
    if(window.ScrollTrigger){try{window.ScrollTrigger.refresh()}catch(e){}}
  }

  /* ===== Motion: kartu masuk berjenjang + hover terangkat ===== */
  var SELEKTOR_KARTU='.card,.member-card,.home-region-card,.home-shortcut,.home-event,.home-duty,.duty-card,.piket-card,.conversation-row';
  function kumpulkanKartu(app){
    var daftar=Array.prototype.slice.call(app.querySelectorAll(SELEKTOR_KARTU));
    return daftar.filter(function(el){
      if(el.closest('.confirm-overlay,#qm,.fin-lightbox,.member-profile-page,.chat-card,.leaflet-container,.rekap-wrap,.laporan-wrap,.inv-wrap'))return false;
      if(el.classList.contains('confirm-card')||el.classList.contains('auth-card')||el.classList.contains('ringkasan-rekap'))return false;
      /* Kartu di dalam kartu lain tidak ikut: cukup kartu terluar. */
      var induk=el.parentElement;
      while(induk&&induk!==app){
        if(induk.matches&&induk.matches(SELEKTOR_KARTU))return false;
        induk=induk.parentElement;
      }
      return true;
    });
  }
  function bersihkanGayaAnimasi(el){
    if(el.dataset.hoverAktif==='1')return;
    el.style.opacity='';
    el.style.transform='';
  }
  /* Hover kartu lewat DELEGASI pointerover/pointerout pada #app,
     dipasang sekali saja: berlaku untuk semua kartu yang dirender
     tanpa kecuali — termasuk kartu ke-25 dst. pada daftar anggota
     (±100 orang) dan kartu yang baru muncul sesudah gambar ulang
     data di halaman yang sama. Efeknya kartu terangkat ringan
     (y -3) SEKALIGUS bayangan clay-nya menguat; saat kursor pergi
     keduanya kembali halus ke bayangan asli kartu itu, lalu gaya
     sebaris dibersihkan supaya bayangan CSS kartu yang berlaku. */
  var BAYANGAN_HOVER='0 14px 30px rgba(47,134,184,.20)';
  var hoverTerpasang=false,kartuHover=null,bayanganAsalHover='';
  function kartuDariTarget(target){
    var app=document.getElementById('app');
    if(!app||!target)return null;
    var el=target.nodeType===1?target:target.parentElement;
    var terluar=null;
    /* Ambil kartu TERLUAR yang membungkus titik sentuh, sejalan
       dengan aturan animasi masuk (kartu di dalam kartu tidak ikut). */
    while(el&&el!==app){
      if(el.matches&&el.matches(SELEKTOR_KARTU))terluar=el;
      el=el.parentElement;
    }
    if(!terluar)return null;
    if(terluar.closest('.confirm-overlay,#qm,.fin-lightbox,.member-profile-page,.chat-card,.leaflet-container,.rekap-wrap,.laporan-wrap,.inv-wrap,.musy-root'))return null;
    if(terluar.classList.contains('confirm-card')||terluar.classList.contains('auth-card')||terluar.classList.contains('ringkasan-rekap'))return null;
    return terluar;
  }
  function akhiriHover(){
    var el=kartuHover;
    kartuHover=null;
    if(!el)return;
    var asal=bayanganAsalHover;
    bayanganAsalHover='';
    var selesai=function(){delete el.dataset.hoverAktif;el.style.transform='';el.style.boxShadow=''};
    var M=window.Motion;
    if(M&&typeof M.animate==='function'&&document.contains(el)){
      try{
        var a=M.animate(el,{y:0,boxShadow:asal||'0 0 0 rgba(47,134,184,0)'},{duration:0.18,easing:'ease-out'});
        if(a&&a.finished&&a.finished.then)a.finished.then(selesai,selesai);
        else setTimeout(selesai,220);
      }catch(e){selesai()}
    }else selesai();
  }
  function mulaiHover(el){
    var M=window.Motion;
    if(!M||typeof M.animate!=='function')return;
    kartuHover=el;
    el.dataset.hoverAktif='1';
    /* Ingat bayangan asli kartu ini (dari CSS-nya) untuk dikembalikan
       persis saat kursor pergi. */
    try{bayanganAsalHover=window.getComputedStyle(el).boxShadow||''}catch(e){bayanganAsalHover=''}
    try{M.animate(el,{y:-3,boxShadow:BAYANGAN_HOVER},{duration:0.18,easing:'ease-out'})}catch(e){}
  }
  function pasangDelegasiHover(){
    if(hoverTerpasang||kurangiGerak)return;
    var app=document.getElementById('app');
    if(!app)return;
    /* Hanya perangkat yang sungguh bisa hover (desktop): di HP tidak
       ada efek tempel yang mengganggu ketukan. */
    var bisaHover=false;
    try{bisaHover=window.matchMedia('(hover: hover) and (pointer: fine)').matches}catch(e){}
    if(!bisaHover)return;
    hoverTerpasang=true;
    app.addEventListener('pointerover',function(ev){
      var kartu=kartuDariTarget(ev.target);
      if(kartu===kartuHover)return;
      if(kartuHover)akhiriHover();
      if(kartu)mulaiHover(kartu);
    });
    app.addEventListener('pointerout',function(ev){
      if(!kartuHover)return;
      /* Masih di dalam kartu yang sama (pindah antar anak kartu):
         bukan akhir hover. */
      if(ev.relatedTarget&&kartuDariTarget(ev.relatedTarget)===kartuHover)return;
      akhiriHover();
    });
  }
  function animasiKartuMasuk(app){
    /* Animasi MASUK berjenjang dibatasi 24 kartu pertama demi
       kecepatan; HOVER tidak dibatasi (lihat pasangDelegasiHover). */
    var kartu=kumpulkanKartu(app).slice(0,24);
    if(!kartu.length)return;
    var M=window.Motion;
    if(M&&typeof M.animate==='function'){
      kartu.forEach(function(el,i){
        try{
          var a=M.animate(el,{opacity:[0,1],y:[10,0]},{duration:0.28,delay:Math.min(i*0.045,0.5),easing:'ease-out'});
          if(a&&a.finished&&a.finished.then)a.finished.then(function(){bersihkanGayaAnimasi(el)},function(){bersihkanGayaAnimasi(el)});
          else setTimeout(function(){bersihkanGayaAnimasi(el)},900);
        }catch(e){bersihkanGayaAnimasi(el)}
      });
    }else if(window.gsap){
      /* Cadangan: bila Motion gagal dimuat, GSAP mengisi animasi
         masuk kartu supaya halaman tetap terasa hidup. */
      try{window.gsap.fromTo(kartu,{opacity:0,y:10},{opacity:1,y:0,duration:0.3,stagger:0.045,ease:'power2.out',overwrite:true,clearProps:'all'})}catch(e){}
    }
  }

  /* ===== Pintu masuk dari render() (views.js) =====
     Animasi hanya diputar saat halaman BERGANTI (tanda tangan =
     view + teks judul pertama berubah). Gambar ulang dari data latar
     pada halaman yang sama tidak mengulang animasi, supaya mengetik
     dan membaca tidak terganggu kedipan. */
  var tandaTerakhir=null;
  function jalankanAnimasiHalaman(){
    var app=document.getElementById('app');
    if(!app)return;
    var view=(typeof S!=='undefined'&&S.view)||'';
    segarkanKeadaanLenis();
    if(view==='musyawarah'){tandaTerakhir='musyawarah';return}
    bersihkanTriggerMati();
    var judulPertama=app.querySelector('h1');
    var tanda=view+'|'+(judulPertama?judulPertama.textContent.replace(/\s+/g,' ').trim():'');
    if(tanda===tandaTerakhir)return;
    tandaTerakhir=tanda;
    if(view!=='peta')animasiKartuMasuk(app);
    animasiJudul(app);
  }
  function animasikanHalaman(){
    if(kurangiGerak)return;
    /* Delegasi hover dipasang sedini mungkin (tidak menunggu pustaka
       selesai dimuat; penangannya memeriksa Motion saat peristiwa
       terjadi) dan hanya sekali. */
    pasangDelegasiHover();
    if(libsSiap){jalankanAnimasiHalaman();return}
    /* Pustaka belum tiba: halaman tetap tampil penuh apa adanya;
       begitu pustaka selesai dimuat, halaman yang sedang tampil
       dianimasikan satu kali. */
    muatSemuaPustaka().then(function(){jalankanAnimasiHalaman()});
  }
  window.animasikanHalaman=animasikanHalaman;
})();
