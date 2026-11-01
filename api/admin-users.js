// Kelola akun (admin saja). Dijalankan sebagai Vercel Serverless Function.
// Keamanan: setiap permintaan harus membawa token login pengguna (Authorization: Bearer ...).
// Fungsi ini memeriksa token itu ke Supabase Auth, lalu memeriksa tabel profiles:
// hanya admin / super_admin yang sudah disetujui yang boleh lanjut.
// Kunci service_role HANYA dipakai di server ini, tidak pernah dikirim ke browser.
// Aksi: list (GET), approve, reject, set-role (POST, JSON).
// Aturan tambahan: hanya super_admin yang boleh mengubah peran; admin tidak boleh
// mengubah akun super_admin, mengubah perannya sendiri, atau menurunkan super_admin terakhir.
const { createClient } = require("@supabase/supabase-js");

async function verifyAdmin(req) {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) {
    return { error: "Server belum dikonfigurasi (SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY belum diisi di Vercel).", status: 500 };
  }
  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return { error: "Token login tidak ditemukan.", status: 401 };
  const anon = createClient(url, anonKey);
  const { data: userData, error: userError } = await anon.auth.getUser(token);
  if (userError || !userData.user) return { error: "Token login tidak valid.", status: 401 };
  const service = createClient(url, serviceKey);
  const { data: profile, error: profileError } = await service
    .from("profiles").select("*").eq("id", userData.user.id).single();
  if (profileError || !profile || profile.status_persetujuan !== "disetujui" ||
      !["admin", "super_admin"].includes(profile.peran)) {
    return { error: "Hanya admin yang sudah disetujui yang boleh memakai fungsi ini.", status: 403 };
  }
  return { user: userData.user, profile, service };
}

module.exports = async (req, res) => {
  try {
    const auth = await verifyAdmin(req);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });
    const { profile, service } = auth;

    // GET: daftar akun.
    if (req.method === "GET") {
      const { data, error } = await service.from("profiles")
        .select("id, nama_lengkap, email, peran, status_persetujuan, created_at")
        .order("created_at", { ascending: true });
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ users: data });
    }

    if (req.method !== "POST") return res.status(405).json({ error: "Metode tidak didukung." });
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const { action, userId, peran } = body;
    if (!userId) return res.status(400).json({ error: "userId wajib diisi." });

    const { data: target, error: targetError } = await service
      .from("profiles").select("*").eq("id", userId).single();
    if (targetError || !target) return res.status(404).json({ error: "Akun tidak ditemukan." });

    // Admin biasa tidak boleh menyentuh akun super_admin sama sekali.
    if (target.peran === "super_admin" && profile.peran !== "super_admin") {
      return res.status(403).json({ error: "Hanya super_admin yang boleh mengubah akun super_admin." });
    }

    if (action === "approve") {
      const { error } = await service.from("profiles")
        .update({ status_persetujuan: "disetujui" }).eq("id", userId);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }
    if (action === "reject") {
      const { error } = await service.from("profiles")
        .update({ status_persetujuan: "ditolak" }).eq("id", userId);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }
    if (action === "set-role") {
      if (profile.peran !== "super_admin") {
        return res.status(403).json({ error: "Hanya super_admin yang boleh mengubah peran." });
      }
      if (!["super_admin", "admin", "anggota"].includes(peran)) {
        return res.status(400).json({ error: "Peran tidak valid." });
      }
      if (userId === profile.id) {
        return res.status(403).json({ error: "Peran sendiri tidak boleh diubah lewat fungsi ini." });
      }
      // Jangan sampai tidak ada super_admin yang tersisa.
      if (target.peran === "super_admin" && peran !== "super_admin") {
        const { count } = await service.from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("peran", "super_admin").eq("status_persetujuan", "disetujui");
        if ((count || 0) <= 1) {
          return res.status(403).json({ error: "Tidak bisa menurunkan super_admin terakhir." });
        }
      }
      const { error } = await service.from("profiles").update({ peran }).eq("id", userId);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ error: "Aksi tidak dikenal." });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Terjadi kesalahan di server." });
  }
};
