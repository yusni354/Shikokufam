// Koneksi Supabase untuk frontend. Satu client dipakai semua halaman.
(function () {
  const cfg = window.KOMUNITAS_CONFIG || {};
  if (!window.supabase || !cfg.SUPABASE_URL || cfg.SUPABASE_URL.includes("ISI-")) {
    console.warn("Supabase belum dikonfigurasi. Isi js/config.js dulu.");
    window.db = null;
    return;
  }
  window.db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
})();
