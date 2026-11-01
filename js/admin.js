// Kelola Admin: memanggil api/ di Vercel dengan token login pengguna.
// Halaman ini hanya untuk admin yang sudah disetujui (dikunci juga di js/app.js).
window.AdminPage = {
  esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  },

  token() {
    return window.Auth.session && window.Auth.session.access_token;
  },

  async callApi(path, options) {
    const res = await fetch(path, {
      ...(options || {}),
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + this.token(),
        ...((options && options.headers) || {})
      }
    });
    let data = {};
    try { data = await res.json(); } catch (e) { data = {}; }
    if (!res.ok) throw new Error(data.error || ("Permintaan gagal (" + res.status + ")."));
    return data;
  },

  async init() {
    if (!window.Auth.isAdmin()) {
      document.getElementById("admin-users").innerHTML =
        '<p class="muted">Halaman ini hanya bisa diakses admin yang sudah disetujui.</p>';
      return;
    }
    document.getElementById("btn-backup").onclick = () => this.downloadBackup();
    await this.loadUsers();
  },

  async loadUsers() {
    const box = document.getElementById("admin-users");
    const msg = document.getElementById("admin-msg");
    try {
      const { users } = await this.callApi("/api/admin-users?action=list");
      const isSuper = window.Auth.isSuperAdmin();
      if (!users || !users.length) {
        box.innerHTML = '<p class="muted">Belum ada akun.</p>';
        return;
      }
      box.innerHTML = users.map((u) => {
        const isMe = u.id === window.Auth.profile.id;
        return '<div class="card">' +
          '<strong>' + this.esc(u.nama_lengkap) + '</strong>' +
          '<p class="muted">' + this.esc(u.email) + '</p>' +
          '<p>Peran: <span class="badge">' + this.esc(u.peran) + '</span> &middot; Status: <span class="badge">' + this.esc(u.status_persetujuan) + '</span></p>' +
          (u.status_persetujuan === "menunggu"
            ? '<p><button type="button" data-approve="' + u.id + '">Setujui</button> ' +
              '<button type="button" class="secondary" data-reject="' + u.id + '">Tolak</button></p>'
            : "") +
          (isSuper && !isMe
            ? '<p><label>Ubah peran</label><select data-role="' + u.id + '">' +
              ["super_admin", "admin", "anggota"].map((r) =>
                '<option value="' + r + '"' + (r === u.peran ? " selected" : "") + '>' + r + '</option>').join("") +
              '</select> <button type="button" class="secondary" data-set-role="' + u.id + '">Simpan Peran</button></p>'
            : (isMe ? '<p class="muted small">Peran sendiri tidak bisa diubah dari sini.</p>' : "")) +
          '</div>';
      }).join("");
      box.querySelectorAll("[data-approve]").forEach((b) => b.onclick = () => this.act("approve", b.dataset.approve));
      box.querySelectorAll("[data-reject]").forEach((b) => b.onclick = () => this.act("reject", b.dataset.reject));
      box.querySelectorAll("[data-set-role]").forEach((b) => b.onclick = () => {
        const select = box.querySelector('[data-role="' + b.dataset.setRole + '"]');
        this.act("set-role", b.dataset.setRole, select.value);
      });
    } catch (e) {
      msg.textContent = "Kelola akun belum bisa dimuat: " + e.message +
        " Pastikan proyek sudah di-deploy ke Vercel (atau dijalankan dengan vercel dev) dan environment variable Supabase sudah diisi.";
      msg.className = "error";
      msg.classList.remove("hidden");
    }
  },

  async act(action, userId, peran) {
    const msg = document.getElementById("admin-msg");
    try {
      await this.callApi("/api/admin-users", {
        method: "POST",
        body: JSON.stringify({ action, userId, peran })
      });
      msg.textContent = "Berhasil.";
      msg.className = "success";
      msg.classList.remove("hidden");
      await this.loadUsers();
    } catch (e) {
      msg.textContent = "Gagal: " + e.message;
      msg.className = "error";
      msg.classList.remove("hidden");
    }
  },

  async downloadBackup() {
    const msg = document.getElementById("admin-msg");
    const summary = document.getElementById("backup-summary");
    try {
      const data = await this.callApi("/api/backup");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
      a.href = url;
      a.download = "backup-shikoku-" + today + ".json";
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      const counts = Object.entries(data.counts || {}).map(([k, v]) => k + ": " + v).join(", ");
      summary.textContent = "Backup berhasil diunduh (" + (data.exported_at || "").slice(0, 10) + "). Isi: " + counts + ".";
      msg.classList.add("hidden");
    } catch (e) {
      msg.textContent = "Backup gagal: " + e.message +
        " Pastikan proyek sudah di-deploy ke Vercel (atau dijalankan dengan vercel dev) dan environment variable Supabase sudah diisi.";
      msg.className = "error";
      msg.classList.remove("hidden");
    }
  }
};
