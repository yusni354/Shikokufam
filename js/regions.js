// Wilayah: baca untuk semua anggota yang disetujui,
// tambah/ubah/hapus hanya untuk admin yang disetujui (juga dijaga RLS).
// Jumlah anggota dihitung dari Data Anggota yang kolom wilayah-nya sama persis
// dengan nama wilayah ini; jadi isi nama wilayah sama dengan yang dipakai di Data Anggota.
window.Regions = {
  all: [],
  members: [],
  editingId: null,

  esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  },

  // Ubah tautan My Maps apa pun menjadi tautan embed yang bisa dipasang di iframe.
  // Kalau tautan sudah embed, dipakai apa adanya. Kalau tidak ada mid, kembalikan null
  // supaya halaman menampilkan tombol tautan saja, bukan iframe kosong.
  embedUrl(link) {
    if (!link) return null;
    if (link.includes("/maps/d/embed")) return link;
    try {
      const url = new URL(link);
      const mid = url.searchParams.get("mid");
      if (mid) return "https://www.google.com/maps/d/embed?mid=" + encodeURIComponent(mid);
    } catch (e) { /* tautan tidak valid, ditangani pemanggil */ }
    return null;
  },

  async init() {
    const isAdmin = window.Auth.isAdmin();
    document.getElementById("regions-admin-actions").classList.toggle("hidden", !isAdmin);
    if (isAdmin) {
      document.getElementById("btn-add-region").onclick = () => this.openForm(null);
      document.getElementById("btn-region-cancel").onclick = () => this.closeForm();
      document.getElementById("region-form").onsubmit = (e) => { e.preventDefault(); this.save(); };
    }
    document.getElementById("regions-search").oninput = () => this.render();
    document.getElementById("regions-filter-prefektur").onchange = () => this.render();
    await this.load();
  },

  async load() {
    try {
      const wilayahRes = await window.db.from("wilayah").select("*").order("nama", { ascending: true });
      if (wilayahRes.error) throw wilayahRes.error;
      this.all = wilayahRes.data || [];
      // Anggota hanya dipakai untuk menghitung dan menampilkan anggota per wilayah.
      const membersRes = await window.db.from("anggota").select("id, nama, kota, wilayah").order("nama", { ascending: true });
      if (membersRes.error) throw membersRes.error;
      this.members = membersRes.data || [];
      this.render();
    } catch (e) {
      document.getElementById("regions-count").textContent = "Wilayah belum bisa dimuat.";
      document.getElementById("regions-list").innerHTML =
        '<div class="card"><p class="muted">Pastikan tabel wilayah sudah dibuat (supabase/schema.sql) dan kamu sudah login sebagai anggota yang disetujui.</p></div>';
    }
  },

  membersIn(namaWilayah) {
    return this.members.filter((m) => m.wilayah === namaWilayah);
  },

  render() {
    const keyword = document.getElementById("regions-search").value.trim().toLowerCase();
    const prefektur = document.getElementById("regions-filter-prefektur").value;
    const isAdmin = window.Auth.isAdmin();
    const filtered = this.all.filter((w) => {
      if (prefektur && w.prefektur !== prefektur) return false;
      if (keyword && ![w.nama, w.keterangan || ""].join(" ").toLowerCase().includes(keyword)) return false;
      return true;
    });
    document.getElementById("regions-count").textContent =
      "Menampilkan " + filtered.length + " dari " + this.all.length + " wilayah.";
    const listEl = document.getElementById("regions-list");
    if (!filtered.length) {
      listEl.innerHTML = '<div class="card"><p class="muted">Belum ada wilayah yang cocok. Admin bisa menambah wilayah lewat tombol di atas.</p></div>';
      return;
    }
    listEl.innerHTML = filtered.map((w) => {
      const count = this.membersIn(w.nama).length;
      return '<div class="card">' +
        '<strong>' + this.esc(w.nama) + '</strong>' +
        (w.prefektur ? ' <span class="badge">' + this.esc(w.prefektur) + '</span>' : "") +
        '<p class="muted">' + count + ' anggota memakai wilayah ini di Data Anggota</p>' +
        (w.keterangan ? '<p>' + this.esc(w.keterangan) + '</p>' : "") +
        '<p><button type="button" class="secondary" data-view="' + w.id + '">Lihat Detail &amp; Peta</button>' +
        (isAdmin
          ? ' <button type="button" class="secondary" data-edit="' + w.id + '">Ubah</button>' +
            ' <button type="button" class="secondary" data-delete="' + w.id + '">Hapus</button>'
          : "") + '</p></div>';
    }).join("");
    listEl.querySelectorAll("[data-view]").forEach((b) => b.onclick = () => this.showDetail(b.dataset.view));
    listEl.querySelectorAll("[data-edit]").forEach((b) => b.onclick = () => this.openForm(b.dataset.edit));
    listEl.querySelectorAll("[data-delete]").forEach((b) => b.onclick = () => this.remove(b.dataset.delete));
  },

  showDetail(id) {
    const w = this.all.find((x) => x.id === id);
    if (!w) return;
    const members = this.membersIn(w.nama);
    const embed = this.embedUrl(w.link_my_maps);
    const detail = document.getElementById("region-detail");
    detail.innerHTML = '<h2>' + this.esc(w.nama) + '</h2>' +
      (w.prefektur ? '<p class="muted">Prefektur: ' + this.esc(w.prefektur) + '</p>' : "") +
      (w.keterangan ? '<p>' + this.esc(w.keterangan) + '</p>' : "") +
      (embed
        ? '<iframe title="Peta wilayah ' + this.esc(w.nama) + '" src="' + this.esc(embed) + '" width="100%" height="400" style="border:0; border-radius:10px;" loading="lazy" allowfullscreen></iframe>'
        : (w.link_my_maps
          ? '<p><a class="btn secondary" href="' + this.esc(w.link_my_maps) + '" target="_blank" rel="noopener">Buka Peta Wilayah di My Maps</a></p>'
          : '<p class="muted">Wilayah ini belum punya peta sendiri. Peta utama ada di menu Peta Anggota.</p>')) +
      '<h3>Anggota di wilayah ini (' + members.length + ')</h3>' +
      (members.length
        ? '<ul>' + members.map((m) => '<li>' + this.esc(m.nama) + (m.kota ? ' — ' + this.esc(m.kota) : "") + '</li>').join("") + '</ul>'
        : '<p class="muted">Belum ada anggota yang memakai nama wilayah ini di Data Anggota. Pastikan nama wilayah sama persis dengan kolom wilayah di Data Anggota.</p>') +
      '<p><button type="button" class="secondary" id="btn-close-region-detail">Tutup Detail</button></p>';
    detail.classList.remove("hidden");
    document.getElementById("btn-close-region-detail").onclick = () => detail.classList.add("hidden");
    detail.scrollIntoView({ behavior: "auto", block: "start" });
  },

  openForm(id) {
    this.editingId = id || null;
    const w = id ? this.all.find((x) => x.id === id) : null;
    document.getElementById("region-form-title").textContent = w ? "Ubah Wilayah" : "Tambah Wilayah";
    document.getElementById("r-nama").value = (w && w.nama) || "";
    document.getElementById("r-prefektur").value = (w && w.prefektur) || "";
    document.getElementById("r-keterangan").value = (w && w.keterangan) || "";
    document.getElementById("r-link").value = (w && w.link_my_maps) || "";
    document.getElementById("region-form-error").classList.add("hidden");
    document.getElementById("region-form").classList.remove("hidden");
    document.getElementById("region-form").scrollIntoView({ behavior: "auto", block: "start" });
  },

  closeForm() {
    document.getElementById("region-form").classList.add("hidden");
    this.editingId = null;
  },

  async save() {
    if (!window.Auth.isAdmin()) return;
    const errEl = document.getElementById("region-form-error");
    const nama = document.getElementById("r-nama").value.trim();
    if (!nama) {
      errEl.textContent = "Nama wilayah wajib diisi.";
      errEl.classList.remove("hidden");
      return;
    }
    const payload = {
      nama: nama,
      prefektur: document.getElementById("r-prefektur").value || null,
      keterangan: document.getElementById("r-keterangan").value.trim() || null,
      link_my_maps: document.getElementById("r-link").value.trim() || null
    };
    const msg = document.getElementById("regions-msg");
    try {
      let error;
      if (this.editingId) {
        ({ error } = await window.db.from("wilayah").update(payload).eq("id", this.editingId));
      } else {
        ({ error } = await window.db.from("wilayah").insert(payload));
      }
      if (error) throw error;
      this.closeForm();
      msg.textContent = "Wilayah berhasil disimpan.";
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
    const w = this.all.find((x) => x.id === id);
    if (!w || !confirm("Hapus wilayah \"" + w.nama + "\"? Data anggota tidak ikut terhapus.")) return;
    const { error } = await window.db.from("wilayah").delete().eq("id", id);
    if (error) { alert("Gagal menghapus: " + error.message); return; }
    await this.load();
  }
};
