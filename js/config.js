// Konfigurasi publik frontend.
// Isi dua nilai ini dari Supabase: Project Settings > API.
// PENTING: hanya anon key yang boleh di sini. Jangan pernah taruh service_role key di frontend.
window.KOMUNITAS_CONFIG = {
  SUPABASE_URL: "https://ISI-PROJECT-REF.supabase.co",
  SUPABASE_ANON_KEY: "ISI-ANON-KEY-DI-SINI",
  // Tautan embed Google My Maps untuk Peta Anggota (Langkah 7).
  // Cara mendapatkannya: di My Maps, Share > Embed on my site, lalu salin src iframe-nya.
  // Kosongkan (tetap "") sampai peta My Maps dibuat, supaya halaman menampilkan panduan.
  GOOGLE_MY_MAPS_EMBED_URL: ""
};
