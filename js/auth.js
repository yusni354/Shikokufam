// Aturan login dan akses, sesuai kesepakatan:
// - Pendaftar baru statusnya "menunggu" sampai disetujui admin.
// - Halaman admin hanya untuk admin / super_admin yang sudah disetujui.
// - Anggota biasa tidak melihat menu Operator dan Import.
window.Auth = {
  session: null,
  profile: null,

  // Ambil sesi + profil. Dipanggil setiap ganti halaman.
  async load() {
    if (!window.db) return null;
    const { data } = await window.db.auth.getSession();
    this.session = data.session;
    if (!this.session) { this.profile = null; return null; }
    const { data: profile } = await window.db
      .from("profiles")
      .select("*")
      .eq("id", this.session.user.id)
      .single();
    this.profile = profile || null;
    return this.profile;
  },

  isLoggedIn() { return !!this.session; },
  // Disetujui = boleh membuka data komunitas.
  isApproved() { return this.profile && this.profile.status_persetujuan === "disetujui"; },
  isWaiting() { return this.profile && this.profile.status_persetujuan === "menunggu"; },
  isAdmin() {
    return this.isApproved() &&
      (this.profile.peran === "admin" || this.profile.peran === "super_admin");
  },
  isSuperAdmin() {
    return this.isApproved() && this.profile.peran === "super_admin";
  },

  // Daftar: buat akun auth, lalu buat profil dengan status menunggu.
  async register(nama, email, password) {
    const { data, error } = await window.db.auth.signUp({ email, password });
    if (error) throw error;
    const userId = data.user && data.user.id;
    // Jika verifikasi email aktif, userId tetap ada; profil dibuat saat login pertama
    // bila baris ini gagal karena sesi belum aktif, app.js akan mencoba lagi.
    if (userId) {
      await window.db.from("profiles").insert({
        id: userId, nama_lengkap: nama, email: email,
        peran: "anggota", status_persetujuan: "menunggu"
      });
    }
    return data;
  },

  async login(email, password) {
    const { data, error } = await window.db.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await this.load();
    // Jaga-jaga: akun lama yang belum punya profil dibuatkan profil menunggu.
    if (this.session && !this.profile) {
      await window.db.from("profiles").insert({
        id: this.session.user.id,
        nama_lengkap: this.session.user.email,
        email: this.session.user.email,
        peran: "anggota", status_persetujuan: "menunggu"
      });
      await this.load();
    }
    return data;
  },

  async logout() {
    await window.db.auth.signOut();
    this.session = null;
    this.profile = null;
  }
};
