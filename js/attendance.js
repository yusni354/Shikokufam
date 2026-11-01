// Absensi: baca untuk semua anggota yang disetujui,
// tambah/ubah/hapus hanya untuk admin yang disetujui (juga dijaga RLS).
// Satu catatan = satu anggota pada satu tanggal untuk satu kegiatan.
window.Attendance = {
  all: [],        // Semua catatan absensi, lengkap dengan nama anggota.
  members: [],    // Daftar anggota untuk dropdown formulir.
  editingId: null,

  esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  },

  // Tanggal hari ini di Jepang, format YYYY-MM-DD untuk input date.
  todayTokyo() {
    return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
  },

  async init() {
    const isAdmin = window.Auth.isAdmin();
    document.getElementById("attendance-admin-actions").classList.toggle("hidden", !isAdmin);
    if (isAdmin) {
      document.getElementById("btn-add-attendance").onclick = () => this.openForm(null);
      document.getElementById("btn-att-cancel").onclick = () => this.closeForm();
      document.getElementById("attendance-form").onsubmit = (e) => { e.preventDefault(); this.save(); };
    }
    document.getElementById("att-filter-tanggal").onchange = () => this.render();
    document.getElementById("att-filter-status").onchange = () => this.render();
    document.getElementById("att-search").oninput = () => this.render();
    document.getElementById("btn-clear-filter").onclick = () => {
      document.getElementById("att-filter-tanggal").value = "";
      document.getElementById("att-filter-status").value = "";
      document.getElementById("att-search").value = "";
      this.render();
    };
    await this.load();
  },

  async load() {
    try {
      // Ambil anggota dulu untuk dropdown, lalu absensi beserta nama anggotanya.
      const membersRes = await window.db.from("anggota").select("id, nama").order("nama", { ascending: true });
      if (membersRes.error) throw membersRes.error;
      this.members = membersRes.data || [];
      const select = document.getElementById("a-anggota");
      if (select) {
        select.innerHTML = '<option value="">— Pilih anggota —</option>' +
          this.members.map((m) => '<option value="' + m.id + '">' + this.esc(m.nama) + '</option>').join("");
      }

      const { data, error } = await window.db.from("absensi")
        .select("*, anggota(nama)")
        .order("tanggal", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      this.all = data || [];
      this.render();
    } catch (e) {
      document.getElementById("attendance-count").textContent = "Absensi belum bisa dimuat.";
      document.getElementById("attendance-list").innerHTML =
        '<div class="card"><p class="muted">Pastikan tabel absensi sudah dibuat (supabase/schema.sql) dan kamu sudah login sebagai anggota yang disetujui.</p></div>';
    }
  },

  render() {
    const tanggal = document.getElementById("att-filter-tanggal").value;
    const status = document.getElementById("att-filter-status").value;
    const keyword = document.getElementById("att-search").value.trim().toLowerCase();
    const isAdmin = window.Auth.isAdmin();
    const filtered = this.all.filter((r) => {
      const nama = (r.anggota && r.anggota.nama) || "";
      if (tanggal && r.tanggal !== tanggal) return false;
      if (status && r.status !== status) return false;
      if (keyword && ![nama, r.kegiatan || ""].join(" ").toLowerCase().includes(keyword)) return false;
      return true;
    });

    // Ringkasan dihitung dari data yang sedang ditampilkan, bukan dari semua data.
    const count = (s) => filtered.filter((r) => r.status === s).length;
    const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
    set("sum-hadir", count("hadir")); set("sum-izin", count("izin"));
    set("sum-alpa", count("alpa")); set("sum-total", filtered.length);
    document.getElementById("attendance-count").textContent =
      "Menampilkan " + filtered.length + " dari " + this.all.length + " catatan absensi.";

    const listEl = document.getElementById("attendance-list");
    if (!filtered.length) {
      listEl.innerHTML = '<div class="card"><p class="muted">Belum ada absensi yang cocok. Coba ubah saringan, atau catat absensi baru (admin).</p></div>';
      return;
    }
    listEl.innerHTML = filtered.map((r) => {
      const nama = (r.anggota && r.anggota.nama) || "Anggota tidak ditemukan";
      return '<div class="card member-card">' +
        '<strong>' + this.esc(nama) + '</strong> ' +
        '<span class="badge badge-' + this.esc(r.status) + '">' + this.esc(r.status) + '</span>' +
        '<p class="muted">' + this.esc(r.tanggal) + (r.kegiatan ? " &middot; " + this.esc(r.kegiatan) : "") + '</p>' +
        (r.keterangan ? '<p>' + this.esc(r.keterangan) + '</p>' : "") +
        (isAdmin
          ? '<p><button type="button" class="secondary" data-edit="' + r.id + '">Ubah</button> ' +
            '<button type="button" class="secondary" data-delete="' + r.id + '">Hapus</button></p>'
          : "") + '</div>';
    }).join("");
    listEl.querySelectorAll("[data-edit]").forEach((b) => b.onclick = () => this.openForm(b.dataset.edit));
    listEl.querySelectorAll("[data-delete]").forEach((b) => b.onclick = () => this.remove(b.dataset.delete));
  },

  openForm(id) {
    this.editingId = id || null;
    const r = id ? this.all.find((x) => x.id === id) : null;
    document.getElementById("attendance-form-title").textContent = r ? "Ubah Absensi" : "Catat Absensi";
    document.getElementById("a-anggota").value = (r && r.anggota_id) || "";
    document.getElementById("a-tanggal").value = (r && r.tanggal) || this.todayTokyo();
    document.getElementById("a-status").value = (r && r.status) || "";
    document.getElementById("a-kegiatan").value = (r && r.kegiatan) || "";
    document.getElementById("a-keterangan").value = (r && r.keterangan) || "";
    document.getElementById("attendance-form-error").classList.add("hidden");
    document.getElementById("attendance-form").classList.remove("hidden");
    document.getElementById("attendance-form").scrollIntoView({ behavior: "auto", block: "start" });
  },

  closeForm() {
    document.getElementById("attendance-form").classList.add("hidden");
    this.editingId = null;
  },

  async save() {
    if (!window.Auth.isAdmin()) return;
    const errEl = document.getElementById("attendance-form-error");
    const anggotaId = document.getElementById("a-anggota").value;
    const tanggal = document.getElementById("a-tanggal").value;
    const status = document.getElementById("a-status").value;
    if (!anggotaId || !tanggal || !status) {
      errEl.textContent = "Anggota, tanggal, dan status wajib diisi.";
      errEl.classList.remove("hidden");
      return;
    }
    const payload = {
      anggota_id: anggotaId, tanggal: tanggal, status: status,
      kegiatan: document.getElementById("a-kegiatan").value.trim() || null,
      keterangan: document.getElementById("a-keterangan").value.trim() || null
    };
    const msg = document.getElementById("attendance-msg");
    try {
      let error;
      if (this.editingId) {
        ({ error } = await window.db.from("absensi").update(payload).eq("id", this.editingId));
      } else {
        ({ error } = await window.db.from("absensi").insert(payload));
      }
      if (error) throw error;
      this.closeForm();
      msg.textContent = "Absensi berhasil disimpan.";
      msg.className = "success";
      msg.classList.remove("hidden");
      await this.load();
    } catch (e) {
      msg.textContent = "Gagal menyimpan: " + e.message;
      msg.className = "error";
      msg.classList.remove("hidden");
    }
  },

  async remove(id) {
    if (!window.Auth.isAdmin()) return;
    const r = this.all.find((x) => x.id === id);
    const nama = (r && r.anggota && r.anggota.nama) || "catatan ini";
    if (!confirm("Hapus absensi " + nama + " pada " + (r ? r.tanggal : "") + "?")) return;
    const { error } = await window.db.from("absensi").delete().eq("id", id);
    if (error) { alert("Gagal menghapus: " + error.message); return; }
    await this.load();
  }
};
