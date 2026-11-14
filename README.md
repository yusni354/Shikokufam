# Shikoku Family — Database Anggota Komunitas

Situs statis (HTML + JavaScript biasa) dengan backend **Supabase**. Tidak perlu build.

## Struktur folder
```
index.html              Halaman utama (memuat library lalu semua file JS berurutan)
assets/
  config.js             Alamat + kunci PUBLIK Supabase (dibuat oleh "npm run config")
  style.css             Tampilan
  mascot.webp           Gambar maskot
  js/
    state.js            Data keadaan aplikasi (S)
    dom.js              Pembuat elemen (h) dan ikon
    constants.js        Daftar wilayah, menu, prefektur, aturan lokasi Jepang
    shell.js            Menu samping dan navigasi go()
    member-utils.js     Pembantu data anggota (WhatsApp, sosial media)
    db.js               Akses data Supabase (+ cadangan penyimpanan lokal)
    media.js            Foto/dokumen anggota (bucket privat)
    messages.js         Pesan ke admin + lampiran
    auth.js             Masuk / daftar / lupa password
    activities.js       Kegiatan, absensi, pemindai QR
    home.js             Halaman Home & Ringkasan
    members.js          Daftar anggota, kartu ID, formulir, impor teks
    duties-forum.js     Jadwal piket dan forum
    map.js              Peta, persetujuan akun
    views.js            Daftar halaman (V), menu, render()
    mascot.js           Maskot
    main.js             Titik awal: login + muat data
supabase/schema.sql     SATU-SATUNYA skema database (jalankan seluruhnya)
scripts/make-config.mjs Pembuat assets/config.js dari .env
```
**Urutan `<script>` di `index.html` penting. Jangan ditukar.**

## Menjalankan dari nol
1. **Database:** Supabase Dashboard → SQL Editor → tempel seluruh isi `supabase/schema.sql` → Run.
2. **Akun admin:** daftar lewat aplikasi (atau buat di Authentication → Users), salin UUID-nya, lalu jalankan SQL di bagian bawah `schema.sql` (ganti UUID dan nama).
3. **Konfigurasi:** `cp .env.example .env`, isi `SUPABASE_URL` dan `SUPABASE_ANON_KEY` (kunci publik), lalu `npm run config`.
   (Folder ini sudah berisi `assets/config.js` untuk proyek lama Anda, jadi langkah ini opsional bila proyeknya sama.)
4. **Jalankan lokal:** `npm start` lalu buka alamat yang ditampilkan. Atau unggah seluruh folder ke Vercel/Netlify/GitHub Pages (tanpa perintah build).
5. **Supabase → Authentication → URL Configuration:** tambahkan alamat situs Anda ke *Site URL* / *Redirect URLs* agar tautan reset password bekerja.

## Daftar uji manual
**Login & persetujuan**
- [ ] Buka situs tanpa login → muncul form Masuk/Daftar.
- [ ] Ganti tab ke "Daftar" → tombol berubah jadi "Daftar".
- [ ] Daftar akun baru → muncul "menunggu persetujuan"; mencoba masuk ditolak dengan pesan jelas.
- [ ] Admin utama: ikon pengaturan → Persetujuan Akun → Setujui → akun tadi bisa masuk.
- [ ] Setelah masuk, **halaman Home tampil** (bukan layar kosong).

**Anggota (sebagai admin)**
- [ ] Tambah anggota lewat formulir; coba "Isi Otomatis" dengan teks salinan.
- [ ] Email/Instagram/TikTok tersimpan huruf kecil/asli, nama tetap HURUF BESAR.
- [ ] Unggah foto dan surat sambung → tampil di kartu ID.
- [ ] Kartu ID menampilkan QR; edit dan hapus anggota bekerja.

**Kegiatan & QR**
- [ ] Buat kegiatan, tambah peserta per wilayah, tandai hadir.
- [ ] Ketik/tempel ID anggota di kolom pemindai → tercatat hadir (sebelumnya selalu gagal).

**Lainnya**
- [ ] Piket: tambah, edit, hapus. Forum: kirim dan (admin) hapus topik.
- [ ] Peta: admin utama menempel kode embed → peta tampil; tombol "Unduh CSV" benar-benar mengunduh.
- [ ] Pesan: anggota kirim pertanyaan lewat maskot → admin menerima → membalas → anggota melihat balasan.
- [ ] Akun anggota biasa tidak melihat tombol tambah/edit/hapus.
- [ ] Coba di HP (layar sempit) dan desktop.

## Ringkasan perubahan
**Diperbaiki:** layar kosong setelah login (daftar halaman `V` hilang); skema database ganda/tidak lengkap → satu `schema.sql`; kebijakan storage longgar (foto/dokumen anggota bisa dibaca tanpa login) → hanya anggota disetujui; scan QR tidak pernah cocok (huruf besar vs UUID); tautan lampiran berbahaya (`javascript:`) disaring; unduh CSV peta (bergantung lingkungan Claude) → unduhan browser biasa; tombol Masuk/Daftar; forum tanpa penanganan error; pesan hanya dari akun login yang disetujui.
**Ditingkatkan:** 1 file 1.710 baris → 17 file kecil yang benar-benar dimuat; library dikunci versinya; pembacaan data memakai jeda 300 ms; sesi tidak dimuat dua kali; tanpa polling pesan; navigasi bisa dipakai keyboard; tanda fokus dan dukungan "kurangi gerakan".
**Dibuang:** `assets/js` lama (rusak), `assets/css`, `Schema.sql`, `FIX_GUIDE.md`, `fix_css.py`, peta pin lama (`vPetaLegacy`), pengisi otomatis berbasis Claude (`geo`), migrasi media lama, data lokal lama, tabel kunjungan situs.

## Masih berisiko / perlu keputusan Anda
1. **Lampiran pesan** masih di bucket *publik* (tautan acak, tapi siapa pun yang memegang tautan bisa membuka).
2. **Navigasi bawah** tetap tersembunyi (kelas `bottom-nav-hidden`), seperti sebelumnya.
3. Versi `supabase-js` dikunci ke **2.45.4**; bila ada masalah realtime/login dengan kunci `sb_publishable_...`, coba versi lebih baru.
4. Foto yang tadinya disimpan di lokasi lama (bukan `members/...`) tidak ikut dipindahkan otomatis.
5. Data di `app_data` bisa dibaca semua anggota yang disetujui, termasuk nomor HP, alamat, dan data orang tua. Pastikan semua anggota setuju.

## Saran pengembangan (maks. 5)
1. Jadikan bucket lampiran pesan privat (URL bertanda tangan).
2. Ganti `alert()` dengan notifikasi di dalam halaman.
3. Cadangan data otomatis (ekspor CSV/JSON berkala untuk admin).
4. Jadikan aplikasi PWA (bisa dipasang di layar utama HP, jalan offline sebagian).
5. Tambahkan log aktivitas admin (siapa mengubah/menghapus apa).
