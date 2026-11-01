// Konfigurasi publik frontend.
// Isi dua nilai ini dari Supabase: Project Settings > API.
// PENTING: hanya anon key yang boleh di sini. Jangan pernah taruh service_role key di frontend.
window.KOMUNITAS_CONFIG = {
  SUPABASE_URL: "https://uwshronrpfkypkjqewgw.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3c2hyb25ycGZreXBranFld2d3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwMjU5MTYsImV4cCI6MjEwODYwMTkxNn0.kXCuaWm0E0s3PqGrg-fc0sWo84ozVvt2LiyokG3xJJM",
  // Tautan embed Google My Maps untuk Peta Anggota (Langkah 7).
  // Cara mendapatkannya: di My Maps, Share > Embed on my site, lalu salin src iframe-nya.
  // Kosongkan (tetap "") sampai peta My Maps dibuat, supaya halaman menampilkan panduan.
  GOOGLE_MY_MAPS_EMBED_URL: "<iframe src="https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d757191.71246025!2d132.74284592236697!3d33.78215739548397!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e1!3m2!1sen!2sjp!4v1793542045151!5m2!1sen!2sjp" width="600" height="450" style="border:0;" allowfullscreen="" loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>"
};
