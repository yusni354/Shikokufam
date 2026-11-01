// Galeri: baca untuk semua anggota yang disetujui,
// tambah/ubah/hapus hanya untuk admin yang disetujui (juga dijaga RLS).
// Foto disimpan di Supabase Storage bucket "galeri" (publik, hanya-baca untuk umum),
// atau cukup memakai URL foto yang ditempel admin.
window.Gallery = {
  all: [],
  editingId: null,
  editingOldUrl: null,

  esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  },

  async init() {
    const isAdmin = window.Auth.isAdmin();
    document.getElementById("gallery-admin-actions").classList.toggle("hidden", !isAdmin);
    if (isAdmin) {
      document.getElementById("btn-add-gallery").onclick = () => this.openForm(null);
      document.getElementById("btn-gallery-cancel").onclick = () => this.closeForm();
      document.getElementById("gallery-form").onsubmit = (e) => { e.preventDefault(); this.save(); };
    }
    document.getElementById("gallery-search").oninput = () => this.render();
    await this.load();
  },

  async load() {
    try {
      const { data, error } = await window.db.from("galeri")
        .select("*, profiles(nama_lengkap)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      this.all = data || [];
      this.render();
    } catch (e) {
      document.getElementById("gallery-count").textContent = "Galeri belum bisa dimuat.";
      document.getElementById("gallery-list").innerHTML =
        '<div class="card"><p class="muted">Pastikan tabel galeri sudah dibuat (supabase/schema.sql) dan kamu sudah login sebagai anggota yang disetujui.</p></div>';
    }
  },

  render() {
    const keyword = document.getElementById("gallery-search").value.trim().toLowerCase();
    const isAdmin = window.Auth.isAdmin();
    const filtered = this.all.filter((g) =>
      !keyword || [g.judul, g.deskripsi || ""].join(" ").toLowerCase().includes(keyword));
    document.getElementById("gallery-count").textContent =
      "Menampilkan " + filtered.length + " dari " + this.all.length + " foto.";
    const listEl = document.getElementById("gallery-list");
    if (!filtered.length) {
      listEl.innerHTML = '<div class="card"><p class="muted">Belum ada foto yang cocok. Admin bisa menambah foto lewat tombol di atas.</p></div>';
      return;
    }
    listEl.innerHTML = filtered.map((g) => {
      const uploader = (g.profiles && g.profiles.nama_lengkap) || "";
      return '<div class="card gallery-card">' +
        '<img src="' + this.esc(g.url_foto) + '" alt="' + this.esc(g.judul) + '" loading="lazy" />' +
        '<strong>' + this.esc(g.judul) + '</strong>' +
        (g.deskripsi ? '<p>' + this.esc(g.deskripsi) + '</p>' : "") +
        '<p class="muted small">' + this.esc((g.created_at || "").slice(0, 10)) +
        (uploader ? " &middot; " + this.esc(uploader) : "") + '</p>' +
        '<p><button type="button" class="secondary" data-view="' + g.id + '">Lihat</button>' +
        (isAdmin
          ? ' <button type="button" class="secondary" data-edit="' + g.id + '">Ubah</button>' +
            ' <button type="button" class="secondary" data-delete="' + g.id + '">Hapus</button>'
          : "") + '</p></div>';
    }).join("");
    listEl.querySelectorAll("[data-view]").forEach((b) => b.onclick = () => this.showDetail(b.dataset.view));
    listEl.querySelectorAll("[data-edit]").forEach((b) => b.onclick = () => this.openForm(b.dataset.edit));
    listEl.querySelectorAll("[data-delete]").forEach((b) => b.onclick = () => this.remove(b.dataset.delete));
  },

  showDetail(id) {
    const g = this.all.find((x) => x.id === id);
    if (!g) return;
    const detail = document.getElementById("gallery-detail");
    detail.innerHTML = '<img src="' + this.esc(g.url_foto) + '" alt="' + this.esc(g.judul) + '" class="gallery-detail-img" />' +
      '<h2>' + this.esc(g.judul) + '</h2>' +
      (g.deskripsi ? '<p>' + this.esc(g.deskripsi) + '</p>' : "") +
      '<p><button type="button" class="secondary" id="btn-close-gallery-detail">Tutup</button></p>';
    detail.classList.remove("hidden");
    document.getElementById("btn-close-gallery-detail").onclick = () => detail.classList.add("hidden");
    detail.scrollIntoView({ behavior: "auto", block: "start" });
  },

  openForm(id) {
    this.editingId = id || null;
    const g = id ? this.all.find((x) => x.id === id) : null;
    this.editingOldUrl = g ? g.url_foto : null;
    document.getElementById("gallery-form-title").textContent = g ? "Ubah Foto" : "Tambah Foto";
    document.getElementById("g-judul").value = (g && g.judul) || "";
    document.getElementById("g-deskripsi").value = (g && g.deskripsi) || "";
    document.getElementById("g-url").value = (g && g.url_foto) || "";
    document.getElementById("g-file").value = "";
    document.getElementById("gallery-form-error").classList.add("hidden");
    document.getElementById("gallery-form").classList.remove("hidden");
    document.getElementById("gallery-form").scrollIntoView({ behavior: "auto", block: "start" });
  },

  closeForm() {
    document.getElementById("gallery-form").classList.add("hidden");
    this.editingId = null;
    this.editingOldUrl = null;
  },

  // Unggah berkas ke bucket "galeri" dan kembalikan URL publiknya.
  // Nama berkas dibuat unik supaya tidak menimpa foto lain.
  async uploadFile(file) {
    if (file.size > 5 * 1024 * 1024) throw new Error("Ukuran foto maksimal 5 MB.");
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = Date.now() + "-" + Math.random().toString(36).slice(2) + "." + ext;
    const { error } = await window.db.storage.from("galeri").upload(path, file);
    if (error) throw new Error("Unggahan gagal: " + error.message +
      " (pastikan supabase/storage.sql sudah dijalankan).");
    const { data } = window.db.storage.from("galeri").getPublicUrl(path);
    return { url: data.publicUrl, path: path };
  },

  // Ambil jalur Storage dari URL publik, untuk menghapus berkas lama saat foto dihapus/diubah.
  storagePathFromUrl(url) {
    const marker = "/galeri/";
    const idx = url.indexOf(marker);
    return idx >= 0 ? url.slice(idx + marker.length) : null;
  },

  async save() {
    if (!window.Auth.isAdmin()) return;
    const errEl = document.getElementById("gallery-form-error");
    const judul = document.getElementById("g-judul").value.trim();
    if (!judul) {
      errEl.textContent = "Judul foto wajib diisi.";
      errEl.classList.remove("hidden");
      return;
    }
    const msg = document.getElementById("gallery-msg");
    try {
      let url = document.getElementById("g-url").value.trim() || null;
      const file = document.getElementById("g-file").files[0];
      let newPath = null;
      if (file) {
        const uploaded = await this.uploadFile(file);
        url = uploaded.url;
        newPath = uploaded.path;
      }
      if (!url) {
        errEl.textContent = "Pilih berkas foto atau tempel tautan foto.";
        errEl.classList.remove("hidden");
        return;
      }
      const payload = {
        judul: judul,
        deskripsi: document.getElementById("g-deskripsi").value.trim() || null,
        url_foto: url,
        diunggah_oleh: window.Auth.profile.id
      };
      let error;
      if (this.editingId) {
        ({ error } = await window.db.from("galeri").update(payload).eq("id", this.editingId));
      } else {
        ({ error } = await window.db.from("galeri").insert(payload));
      }
      if (error) throw error;
      // Berkas lama di Storage dihapus kalau foto diubah ke berkas baru (usaha terbaik, abaikan gagal).
      if (this.editingOldUrl && newPath) {
        const oldPath = this.storagePathFromUrl(this.editingOldUrl);
        if (oldPath) await window.db.storage.from("galeri").remove([oldPath]).catch(() => {});
      }
      this.closeForm();
      msg.textContent = "Foto berhasil disimpan.";
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
    const g = this.all.find((x) => x.id === id);
    if (!g || !confirm("Hapus foto \"" + g.judul + "\"?")) return;
    const { error } = await window.db.from("galeri").delete().eq("id", id);
    if (error) { alert("Gagal menghapus: " + error.message); return; }
    const path = this.storagePathFromUrl(g.url_foto);
    if (path) await window.db.storage.from("galeri").remove([path]).catch(() => {});
    await this.load();
  }
};
