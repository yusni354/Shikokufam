// Konfigurasi publik frontend.
// Isi dua nilai ini dari Supabase: Project Settings > API.
// PENTING: hanya anon key yang boleh di sini. Jangan pernah taruh service_role key di frontend.
window.KOMUNITAS_CONFIG = {
  SUPABASE_URL: "https://uwshronrpfkypkjqewgw.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3c2hyb25ycGZreXBranFld2d3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwMjU5MTYsImV4cCI6MjEwODYwMTkxNn0.kXCuaWm0E0s3PqGrg-fc0sWo84ozVvt2LiyokG3xJJM",
  // Tautan embed Google My Maps untuk Peta Anggota (Langkah 7).
  // Cara mendapatkannya: di My Maps, Share > Embed on my site, lalu salin src iframe-nya.
  // Kosongkan (tetap "") sampai peta My Maps dibuat, supaya halaman menampilkan panduan.
  GOOGLE_MY_MAPS_EMBED_URL: ""
};
