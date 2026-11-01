// Dashboard: hitung ringkasan dari tabel Supabase.
// Kalau tabel masih kosong atau query gagal, tampilkan 0 dan keterangan, bukan error mentah.
window.Dashboard = {
  async init() {
    const profile = window.Auth.profile || {};
    const greet = document.getElementById("dashboard-greeting");
    if (greet) greet.textContent = "Selamat datang, " + (profile.nama_lengkap || "anggota") +
      " (" + (profile.peran || "anggota") + ").";

    // Tombol menu cepat di Dashboard memakai router yang sama dengan menu samping.
    document.querySelectorAll("[data-go]").forEach((btn) => {
      btn.onclick = (e) => { e.preventDefault(); window.loadPage(btn.dataset.go); };
    });

    // Kotak admin hanya untuk admin; anggota biasa tidak perlu melihatnya.
    const adminBox = document.getElementById("admin-box");
    if (adminBox && !window.Auth.isAdmin()) adminBox.classList.add("hidden");

    const set = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    };
    try {
      // Total anggota dari tabel anggota.
      const anggota = await window.db.from("anggota").select("id", { count: "exact", head: true });
      set("stat-anggota", anggota.count ?? 0);

      // Hadir hari ini: tanggal hari ini dalam format YYYY-MM-DD (waktu Jepang).
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
      const hadir = await window.db.from("absensi")
        .select("id", { count: "exact", head: true })
        .eq("tanggal", today).eq("status", "hadir");
      set("stat-hadir", hadir.count ?? 0);

      const wilayah = await window.db.from("wilayah").select("id", { count: "exact", head: true });
      set("stat-wilayah", wilayah.count ?? 0);

      // Menunggu persetujuan hanya bermakna untuk admin; anggota melihat 0 supaya tidak bocor.
      if (window.Auth.isAdmin()) {
        const menunggu = await window.db.from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("status_persetujuan", "menunggu");
        set("stat-menunggu", menunggu.count ?? 0);
      } else {
        set("stat-menunggu", "–");
      }
    } catch (e) {
      const note = document.getElementById("dashboard-note");
      if (note) note.textContent = "Angka belum bisa dimuat. Pastikan SQL di supabase/ sudah dijalankan dan kamu sudah login.";
      ["stat-anggota", "stat-hadir", "stat-wilayah", "stat-menunggu"].forEach((id) => set(id, 0));
    }
  }
};
