/* Cadangan lokal pustaka QR (qrcode-generator 1.4.4): hanya disuntikkan
   bila skrip CDN di index.html gagal dimuat (mis. ditolak SRI atau
   jaringan putus), supaya muatan awal tidak selalu memikulnya.
   Berkas ini terpisah (bukan skrip sebaris di index.html) agar CSP
   aplikasi bisa melarang skrip sebaris sama sekali. */
if(!window.qrcode){var s=document.createElement('script');s.src='assets/js/qrcode-fallback.js';document.head.appendChild(s)}
