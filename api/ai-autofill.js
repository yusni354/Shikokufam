// Isi Otomatis (AI) untuk formulir anggota, khusus admin.
// Dijalankan sebagai Vercel Serverless Function, supaya kunci AI tidak pernah
// ada di kode browser. Frontend hanya mengirim data formulir yang sudah diisi
// sebagian, dan server mengembalikan kolom yang bisa disimpulkan dengan yakin.
// Kolom yang diizinkan dikembalikan sengaja dibatasi: AI tidak boleh menebak
// nama, tanggal lahir, atau nomor telepon.
// Penyedia AI bawaan: API yang kompatibel dengan OpenAI (AI_API_URL, AI_MODEL).
// Ubah dua variabel itu di Vercel kalau memakai penyedia lain yang kompatibel.
const { createClient } = require("@supabase/supabase-js");

const ALLOWED = ["alamat_jepang", "kode_pos", "prefektur", "kota", "wilayah", "pekerjaan", "status_tinggal"];

module.exports = async (req, res) => {
  try {
    const url = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const aiKey = process.env.AI_API_KEY;
    if (!url || !anonKey || !serviceKey) {
      return res.status(500).json({ error: "Server belum dikonfigurasi (kunci Supabase belum diisi di Vercel)." });
    }
    if (!aiKey) {
      return res.status(503).json({ error: "AI_API_KEY belum diatur di Vercel, jadi Isi Otomatis belum bisa dipakai." });
    }
    if (req.method !== "POST") return res.status(405).json({ error: "Metode tidak didukung." });
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
      return res.status(403).json({ error: "Hanya admin yang sudah disetujui yang boleh memakai Isi Otomatis." });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const input = body.data || {};
    // Hanya teruskan kolom yang dikenal, supaya data lain tidak terkirim ke AI.
    const cleanInput = {};
    ["nama", "alamat_jepang", "kode_pos", "prefektur", "kota", "wilayah", "pekerjaan", "status_tinggal"]
      .forEach((k) => { if (input[k]) cleanInput[k] = String(input[k]); });

    const apiUrl = process.env.AI_API_URL || "https://api.openai.com/v1/chat/completions";
    const model = process.env.AI_MODEL || "gpt-4o-mini";
    const aiRes = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + aiKey },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        temperature: 0,
        messages: [
          {
            role: "system",
            content: "Kamu membantu melengkapi data anggota komunitas Indonesia di Shikoku, Jepang. " +
              "Dari data yang diberikan, isi HANYA kolom yang bisa disimpulkan dengan yakin, " +
              "misalnya kota, prefektur, wilayah, dan kode pos dari alamat Jepang. " +
              "Jangan menebak nama, tanggal lahir, atau nomor telepon. " +
              "Kembalikan JSON saja, tanpa penjelasan, dengan kunci hanya dari daftar ini: " +
              ALLOWED.join(", ") + ". Kosongkan atau hilangkan kolom yang tidak yakin."
          },
          { role: "user", content: JSON.stringify(cleanInput) }
        ]
      })
    });
    if (!aiRes.ok) {
      const text = await aiRes.text();
      return res.status(502).json({ error: "Penyedia AI menolak permintaan (" + aiRes.status + "). Periksa AI_API_KEY dan AI_MODEL di Vercel. " + text.slice(0, 200) });
    }
    const aiData = await aiRes.json();
    const content = (aiData.choices && aiData.choices[0] && aiData.choices[0].message && aiData.choices[0].message.content) || "{}";
    let parsed = {};
    try { parsed = JSON.parse(content); } catch (e) { parsed = {}; }
    // Saring lagi di server: hanya kolom yang diizinkan dan bernilai teks yang dikembalikan.
    const filtered = {};
    ALLOWED.forEach((k) => {
      if (parsed[k] && typeof parsed[k] === "string" && parsed[k].trim()) filtered[k] = parsed[k].trim();
    });
    // Prefektur hasil AI harus salah satu dari empat prefektur Shikoku, kalau tidak, buang.
    if (filtered.prefektur && !["Tokushima", "Kagawa", "Ehime", "Kochi"].includes(filtered.prefektur)) {
      delete filtered.prefektur;
    }
    return res.status(200).json({ data: filtered });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Terjadi kesalahan di server." });
  }
};
