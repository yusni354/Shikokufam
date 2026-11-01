// Cadangan data (admin saja). Dijalankan sebagai Vercel Serverless Function.
// Mengembalikan seluruh isi tabel utama dalam satu JSON, supaya admin bisa
// mengunduhnya dari halaman Kelola Admin dan menyimpannya sendiri.
// Keamanan sama seperti admin-users.js: token login diperiksa, lalu peran diperiksa.
// Kunci service_role HANYA dipakai di server ini.
const { createClient } = require("@supabase/supabase-js");

module.exports = async (req, res) => {
  try {
    const url = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !anonKey || !serviceKey) {
      return res.status(500).json({ error: "Server belum dikonfigurasi (SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY belum diisi di Vercel)." });
    }
    if (req.method !== "GET") return res.status(405).json({ error: "Metode tidak didukung." });
    const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!token) return res.status(401).json({ error: "Token login tidak ditemukan." });
    const anon = createClient(url, anonKey);
    const { data: userData, error: userError } = await anon.auth.getUser(token);
    if (userError || !userData.user) return res.status(401).json({ error: "Token login tidak valid." });
    const service = createClient(url, serviceKey);
    const { data: profile, error: profileError } = await service
      .from("profiles").select("*").eq("id", userData.user.id).single();
    if (profileError || !profile || profile.status_persetujuan !== "disetujui" ||
        !["admin", "super_admin"].includes(profile.peran)) {
      return res.status(403).json({ error: "Hanya admin yang sudah disetujui yang boleh mengunduh cadangan." });
    }

    const tables = ["profiles", "anggota", "absensi", "galeri", "forum_posts",
      "forum_comments", "wilayah", "operator", "import_log"];
    const result = {};
    const counts = {};
    for (const table of tables) {
      const { data, error } = await service.from(table).select("*");
      if (error) return res.status(500).json({ error: "Gagal membaca tabel " + table + ": " + error.message });
      result[table] = data || [];
      counts[table] = (data || []).length;
    }
    return res.status(200).json({
      exported_at: new Date().toISOString(),
      exported_by: profile.email,
      counts,
      tables: result
    });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Terjadi kesalahan di server." });
  }
};
