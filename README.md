# SHIKOKU FAMMILY — KOMUNITAS ID-JP

Database Anggota komunitas orang Indonesia di Shikoku, Jepang.
Dibuat ulang dari Base44 ke HTML/CSS/JavaScript + Vercel + Supabase, ringan dan mobile-first.

## Status langkah

- [x] Langkah 1: Struktur folder dan skema database (disetujui)
- [x] Langkah 2: Kerangka PWA, Dashboard, login, dan persetujuan admin
- [x] Langkah 3: Data Anggota (daftar, cari, saring, detail, formulir 3 langkah; Isi Otomatis AI tampil tapi nonaktif sampai langkah api/)
- [x] Langkah 4: Absensi (riwayat, saring tanggal/status, ringkasan hadir/izin/alpa, catat/ubah/hapus admin)
- [x] Langkah 5: Galeri (grid foto, cari, detail, unggah ke Storage atau tempel URL, ubah/hapus admin)
- [x] Langkah 6: Forum (daftar topik, cari, detail, komentar berurutan, hapus admin; Tanya Admin di maskot kini membuka Forum)
- [x] Langkah 7: Peta Anggota (peta embed Google My Maps, pratinjau alamat, ekspor CSV admin untuk pin)
- [x] Langkah 8: Wilayah (daftar, cari, saring prefektur, detail, peta My Maps per wilayah, anggota per wilayah, CRUD admin)
- [x] Langkah 9: Operator (daftar pengurus khusus admin, cari, saring wilayah, tambah/ubah/hapus; tidak mengubah akun login)
- [x] Langkah 10: Import Database (template CSV, parser CSV, pratinjau dan validasi, mode duplikat, riwayat import_log)
- [x] Langkah 11: api/ admin (kelola akun, backup, Isi Otomatis AI; halaman Kelola Admin dari Dashboard)
- [x] Panduan akhir: GitHub, Vercel, environment variable, pasang di HP (lihat di bawah)

## Panduan Akhir: GitHub, Vercel, Environment Variable, Pasang di HP

Urutan yang disarankan: Supabase dulu, lalu isi config, lalu GitHub, lalu Vercel,
lalu uji, lalu pasang di HP. Jangan membalik urutan Vercel dan environment variable,
karena api/ tidak akan berfungsi tanpa kunci yang diisi di Vercel.

### A. Siapkan Supabase (sekali saja)

1. Buat proyek baru di Supabase.
2. Di SQL Editor, jalankan berurutan: `supabase/schema.sql`, lalu `supabase/rls.sql`,
   lalu (kalau mau unggah foto Galeri) `supabase/storage.sql`.
3. Di Project Settings > API, salin Project URL dan anon key. Di tempat yang sama,
   salin juga service_role key — kunci ini HANYA untuk Vercel, jangan ditempel di
   berkas frontend mana pun.
4. Di Authentication > Providers > Email, tentukan apakah konfirmasi email aktif.
   Kalau aktif, pendaftar harus klik tautan di email dulu sebelum bisa masuk.
   Kalau dimatikan untuk kemudahan komunitas, pendaftar bisa langsung masuk tapi
   tetap berstatus "menunggu" sampai disetujui admin.

### B. Isi config dan ganti maskot (di komputer, sebelum upload)

1. Ekstrak ZIP proyek ini ke satu folder, misalnya `komunitas-id-jp`.
2. Buka `js/config.js`, isi `SUPABASE_URL` dan `SUPABASE_ANON_KEY` dari Supabase.
   Kosongkan `GOOGLE_MY_MAPS_EMBED_URL` dulu kalau peta My Maps belum dibuat;
   peta bisa dipasang belakangan tanpa mengubah kode lain.
3. Ganti `assets/mascot.png` dengan gambar chibi, memakai nama berkas yang sama.
4. Periksa sekali lagi: tidak ada berkas `.env` asli di folder ini. Kalau ada,
   jangan di-upload; `.gitignore` sudah menahan `.env`, tapi periksa tetap wajib.

### C. Upload ke GitHub

Disarankan repo Private, karena ini aplikasi komunitas (meskipun tidak ada kunci
rahasia di kode, data dan struktur komunitas lebih aman tidak terbuka).

Cara lewat website (paling mudah, tanpa Git di komputer):
1. Di GitHub, buat repository baru bernama `komunitas-id-jp`, pilih Private,
   jangan centang "Add a README" supaya tidak bentrok.
2. Di halaman repo, pilih "uploading an existing file", lalu seret semua isi folder
   proyek (bukan folder ZIP-nya) ke sana. Pastikan `index.html` ada di akar repo,
   bukan di dalam subfolder.
3. Commit.

Cara lewat terminal (kalau Git sudah terpasang):
```
cd komunitas-id-jp
git init
git add .
git status
# Pastikan .env TIDAK muncul di daftar. Kalau muncul, hentikan dan hapus dari daftar dulu.
git commit -m "SHIKOKU FAMMILY - versi awal lengkap"
git branch -M main
git remote add origin https://github.com/NAMA-GITHUB-KAMU/komunitas-id-jp.git
git push -u origin main
```
Ganti `NAMA-GITHUB-KAMU` dengan nama GitHub-mu.

### D. Hubungkan ke Vercel

1. Buka Vercel, pilih "Add New > Project", lalu "Import" repository `komunitas-id-jp`.
2. Framework Preset: pilih "Other" (aplikasi ini HTML statis + fungsi `api/`).
   Biarkan Build Command kosong dan Output Directory kosong / akar proyek.
   Root Directory: akar repository.
3. JANGAN deploy dulu sebelum langkah E, atau deploy dulu lalu isi environment
   variable dan Redeploy — api/ baru berfungsi setelah Redeploy dengan kunci terisi.

### E. Atur environment variable di Vercel (wajib untuk api/)

Di Vercel, buka Project > Settings > Environment Variables, lalu isi untuk
Production (dan Preview kalau mau):

| Nama | Isi | Wajib? |
| --- | --- | --- |
| SUPABASE_URL | Project URL dari Supabase | Ya |
| SUPABASE_ANON_KEY | Anon key dari Supabase | Ya |
| SUPABASE_SERVICE_ROLE_KEY | Service role key dari Supabase | Ya, untuk api/ |
| AI_API_KEY | Kunci penyedia AI | Hanya kalau mau pakai Isi Otomatis |
| AI_MODEL | Contoh: gpt-4o-mini | Opsional, bawaan gpt-4o-mini |
| AI_API_URL | Contoh: https://api.openai.com/v1/chat/completions | Opsional, bawaan OpenAI |

Setelah mengisi, pilih "Redeploy" di Deployments (titik tiga > Redeploy).
Catatan: `GOOGLE_MY_MAPS_EMBED_URL` tidak perlu diisi di Vercel, karena peta
diatur lewat `js/config.js` di frontend. Kalau nanti mengubah `js/config.js`,
cukup commit dan push — Vercel akan deploy ulang otomatis.

### F. Buat akun Super Admin dan uji

1. Buka alamat Vercel-mu, daftar akun pertama.
2. Jadikan Super Admin dengan SQL di akhir `supabase/schema.sql` (ganti emailnya),
   atau lewat Table Editor: ubah `peran` jadi `super_admin` dan
   `status_persetujuan` jadi `disetujui` di tabel `profiles`.
3. Masuk lagi, lalu uji satu per satu:
   - Dashboard: angka anggota dan hadir hari ini.
   - Data Anggota: tambah satu anggota (admin), cari, saring, buka detail.
   - Absensi: catat satu absensi, cek ringkasan.
   - Galeri: tambah foto lewat URL dulu; coba unggah berkas kalau storage.sql sudah jalan.
   - Forum: buat topik dan komentar.
   - Peta Anggota: ekspor CSV (admin), impor ke My Maps, tempel embed ke config kalau sudah siap.
   - Wilayah, Operator, Import (coba dengan CSV kecil dulu).
   - Dashboard > Kelola Akun & Backup: daftar akun baru, setujui satu akun uji,
     unduh backup JSON, dan coba Isi Otomatis di Data Anggota kalau AI_API_KEY sudah diisi.
4. Daftarkan satu akun anggota biasa dari HP lain untuk memastikan ia melihat
   pesan "menunggu persetujuan" dan tidak bisa membuka data sebelum disetujui.

### G. Pasang di layar utama HP (PWA)

Syaratnya: alamat sudah HTTPS (Vercel sudah HTTPS otomatis) dan sudah dibuka sekali
di browser HP supaya service worker terpasang.

Android (Chrome):
1. Buka alamat Vercel di Chrome.
2. Ketuk titik tiga di kanan atas.
3. Pilih "Tambahkan ke Layar Utama" atau "Instal aplikasi" (tulisan bisa berbeda
   menurut versi Chrome), lalu "Instal"/"Tambah".
4. Ikon SHIKOKU FAMMILY akan muncul di layar utama dan dibuka tanpa bilah alamat
   browser, seperti aplikasi.

iPhone/iPad (Safari — wajib Safari, bukan Chrome):
1. Buka alamat Vercel di Safari.
2. Ketuk tombol Bagikan (kotak dengan panah ke atas).
3. Pilih "Tambah ke Layar Utama", lalu "Tambah".
4. Ikon akan muncul di layar utama.

Kalau setelah update kode aplikasi di HP masih menampilkan versi lama:
tutup aplikasi PWA sepenuhnya, buka lagi, dan kalau perlu hapus lalu pasang ulang.
Setiap kali mengubah berkas JS/CSS/halaman di pengembangan berikutnya, naikkan
angka di `CACHE` di `sw.js` (saat ini `shikoku-family-v10`) supaya HP mengambil
berkas baru, lalu commit dan push seperti biasa.

### H. Mengembangkan lagi (rutinitasnya)

1. Ubah berkas yang perlu di komputer (satu menu, satu berkas, seperti selama ini).
2. Kalau mengubah JS/CSS/halaman, naikkan versi `CACHE` di `sw.js`.
3. Uji lokal dengan server lokal, atau dengan `vercel dev` kalau mau menguji `api/`.
4. Commit dan push ke GitHub — Vercel akan deploy ulang otomatis.
5. Uji di alamat Vercel, lalu di HP kalau perlu.

### I. Kalau ada masalah

- "Supabase belum dikonfigurasi": `js/config.js` masih berisi placeholder. Isi URL dan anon key, lalu deploy ulang.
- Halaman Kelola Admin / Isi Otomatis gagal: proyek belum di-deploy ke Vercel,
  atau environment variable di Vercel belum diisi / belum di-Redeploy. Server lokal
  biasa tidak menjalankan `api/`.
- Isi Otomatis menjawab "AI_API_KEY belum diatur": isi AI_API_KEY di Vercel, lalu Redeploy.
- Unggah foto Galeri gagal: jalankan `supabase/storage.sql` setelah `rls.sql`.
- Peta kosong / "Peta belum dipasang": itu normal sebelum embed diisi. Ikuti langkah
  di menu Peta Anggota, lalu isi `GOOGLE_MY_MAPS_EMBED_URL` di `js/config.js`.
- Anggota tidak bisa membuka data padahal sudah daftar: cek `status_persetujuan`-nya
  di Kelola Admin — harus `disetujui`, bukan `menunggu`.
- Login gagal setelah daftar: kalau konfirmasi email aktif di Supabase, klik dulu
  tautan di email pendaftar.

### J. Checklist keamanan sebelum dibagikan ke komunitas

- [ ] Repo GitHub Private (disarankan).
- [ ] Tidak ada berkas `.env` yang ter-commit (cek `git status` dan riwayat commit).
- [ ] `SUPABASE_SERVICE_ROLE_KEY` dan `AI_API_KEY` hanya ada di Vercel, tidak di
      `js/config.js`, tidak di berkas HTML/JS lain, dan tidak di chat/email.
- [ ] Hanya ada satu atau dua super_admin yang dipercaya.
- [ ] Backup JSON pertama sudah diunduh dan disimpan di tempat yang aman.

## Cara menjalankan lokal (Langkah 3 dan 4)

Tidak perlu SQL baru untuk Langkah 3 dan 4, karena tabel anggota dan absensi sudah dibuat di Langkah 2.
Cukup pakai config dan SQL dari Langkah 2, lalu buka menu Data Anggota atau Absensi.

## api/ Admin (Langkah 11)

Folder `api/` berisi Vercel Serverless Functions, dan hanya berjalan setelah deploy ke
Vercel (atau dengan `vercel dev` di komputer). Di server lokal biasa, halaman Kelola Admin
dan tombol Isi Otomatis akan menampilkan pesan itu dengan jelas, bukan gagal diam-diam.

- `api/admin-users.js`: daftar akun, setujui/tolak pendaftar, ubah peran. Hanya admin yang
  sudah disetujui yang boleh memanggilnya (token login diperiksa, lalu peran diperiksa).
  Hanya super_admin yang boleh mengubah peran, admin biasa tidak boleh menyentuh akun
  super_admin, mengubah perannya sendiri, atau menurunkan super_admin terakhir.
- `api/backup.js`: mengunduh seluruh isi tabel utama dalam satu JSON. Hanya admin yang
  sudah disetujui yang boleh memanggilnya.
- `api/ai-autofill.js`: Isi Otomatis untuk formulir anggota. Hanya admin yang sudah
  disetujui yang boleh memanggilnya, dan hanya kolom yang bisa disimpulkan dengan yakin
  (alamat, kode pos, prefektur, kota, wilayah, pekerjaan, status tinggal) yang dikembalikan.
  AI tidak menebak nama, tanggal lahir, atau nomor telepon. Penyedia bawaan adalah API yang
  kompatibel dengan OpenAI; ubah `AI_API_URL` dan `AI_MODEL` di Vercel kalau memakai
  penyedia lain yang kompatibel.
- Halaman Kelola Admin dibuka dari kotak admin di Dashboard (tidak ada di menu samping),
  supaya menu utama tetap 9 menu seperti rencana awal. Di halaman itu admin bisa menyetujui
  pendaftar, mengubah peran (super_admin saja), dan mengunduh backup.
- Tombol Isi Otomatis di Data Anggota kini aktif untuk admin, dan hanya mengisi kolom
  yang masih kosong. Kunci AI dan kunci service_role tidak pernah ada di kode browser;
  keduanya hanya dibaca dari environment variable di server Vercel.
- Menjalankan api/ di komputer: pasang Vercel CLI (`npm i -g vercel`), lalu dari folder
  proyek jalankan `vercel dev` dan ikuti petunjuknya. Environment variable diisi di Vercel
  (Project > Settings > Environment Variables) atau di `.env` lokal untuk `vercel dev` saja
  — jangan pernah commit berkas `.env` asli.

## Import Database (Langkah 10)

Menu khusus admin. Unduh template CSV, isi datanya, lalu unggah berkasnya. Aplikasi
memvalidasi setiap baris sebelum disimpan: Nama wajib, Prefektur harus Tokushima/Kagawa/
Ehime/Kochi, tanggal memakai YYYY-MM-DD atau DD/MM/YYYY, dan Jenis Kelamin memakai
Laki-laki/Perempuan. Baris yang tidak valid ditampilkan alasannya dan tidak ikut diimpor.
Untuk data yang sudah ada, admin memilih: lewati, perbarui, atau tambah semua tanpa cek
duplikat (duplikat dikenali dari email, kalau tidak ada email dari nama). Setiap impor yang
selesai dicatat ke tabel import_log dan ditampilkan sebagai riwayat.

## Operator (Langkah 9)

Menu khusus admin. Halaman ini mengelola daftar pengurus/operator dari tabel operator,
terhubung ke Data Anggota dan menu Wilayah. Menghapus operator tidak menghapus data anggota
maupun akun loginnya. Persetujuan pendaftar dan perubahan peran login (super_admin/admin/
anggota) bukan di sini, melainkan di langkah api/ (kelola akun admin).

## Wilayah (Langkah 8)

Tidak perlu SQL baru, karena tabel wilayah sudah dibuat di Langkah 2. Setiap wilayah bisa
punya tautan Google My Maps sendiri; tautan viewer My Maps akan diubah otomatis menjadi
tautan embed saat ditampilkan. Jumlah anggota per wilayah dihitung dari Data Anggota yang
kolom wilayah-nya sama persis dengan nama wilayah, jadi isi nama wilayah sama dengan yang
dipakai di Data Anggota supaya hitungannya cocok.

## Peta Anggota (Langkah 7)

Tidak perlu SQL baru dan tidak perlu kunci API Google Maps. Alurnya:
1. Admin membuka Peta Anggota, menyaring anggota, lalu menekan “Ekspor CSV untuk My Maps”.
   CSV berisi Nama, Alamat Lengkap, Alamat Jepang, Kota, Prefektur, Wilayah, dan Kode Pos,
   hanya untuk anggota yang sudah punya alamat Jepang.
2. Di Google My Maps, buat peta baru, impor CSV, pilih kolom Alamat Lengkap sebagai lokasi
   pin dan Nama sebagai judul pin.
3. Bagikan peta, salin tautan embed-nya, lalu tempel ke `GOOGLE_MY_MAPS_EMBED_URL` di
   `js/config.js`. Setelah itu peta akan tampil di menu Peta Anggota untuk semua anggota
   yang disetujui. Tombol ekspor tetap hanya untuk admin, karena CSV berisi alamat anggota.

## Forum (Langkah 6)

Tidak perlu SQL baru, karena tabel forum_posts dan forum_comments sudah dibuat di Langkah 2.
Semua anggota yang disetujui boleh membuat topik dan berkomentar; hapus topik/komentar hanya
untuk admin, sesuai RLS. Tidak ada tombol ubah untuk forum, karena RLS memang tidak memberi
izin update untuk forum — kalau nanti mau ada ubah, RLS perlu ditambah dulu.

## Galeri (Langkah 5)

Tabel galeri sudah dibuat di Langkah 2, jadi tidak perlu SQL baru kalau admin hanya menempel tautan foto.
Kalau admin mau mengunggah berkas foto langsung dari HP, jalankan juga `supabase/storage.sql`
(setelah `rls.sql`) untuk membuat bucket "galeri" yang publik dan membatasi unggah/hapus hanya untuk admin.

## Cara menjalankan lokal (Langkah 2)

1. Di Supabase, buat proyek baru, lalu jalankan `supabase/schema.sql`, kemudian `supabase/rls.sql` di SQL Editor.
2. Matikan atau sesuaikan konfirmasi email di Authentication > Providers > Email sesuai kebutuhanmu.
   Kalau konfirmasi email aktif, pendaftar harus klik tautan di email dulu sebelum bisa masuk.
3. Isi `js/config.js` dengan URL proyek dan anon key dari Supabase (Project Settings > API).
4. Jalankan server lokal sederhana dari folder proyek, contoh: `npx serve .` atau `python3 -m http.server 8000`, lalu buka di browser HP/komputer.
5. Daftar akun pertama, lalu jadikan Super Admin dengan SQL di akhir `schema.sql` (ganti emailnya).
6. Akun berikutnya yang mendaftar akan berstatus "menunggu" sampai admin menyetujuinya
   (persetujuan lewat SQL/API admin pada langkah 11; untuk sementara, ubah `status_persetujuan`
   jadi `disetujui` di tabel `profiles` lewat Supabase Table Editor).

## Maskot

Berkas `assets/mascot.png` saat ini hanya placeholder. Ganti berkas itu dengan gambar chibi
yang kamu unggah, dengan nama yang sama, supaya maskot di pojok bawah menampilkan gambarmu.
Maskot diam (tanpa animasi), bisa digeser, dan saat diketuk menampilkan pilihan "Tanya Admin".

## Peta Anggota (nanti, Langkah 7)

Peta memakai Google My Maps, bukan API Google Maps berbayar. Alurnya: ekspor CSV dari
Data Anggota (nama + alamat Jepang) → impor CSV ke Google My Maps → tempel tautan embed
My Maps ke menu Peta Anggota dan Wilayah.

## Catatan keamanan

- Jangan taruh `SUPABASE_SERVICE_ROLE_KEY` atau `AI_API_KEY` di kode frontend.
- Keduanya hanya dipakai di `api/` di Vercel, yang akan dibuat pada langkah 11.
