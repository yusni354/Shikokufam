// Operator: menu khusus admin yang sudah disetujui (dikunci di js/app.js).
// Mengelola daftar pengurus dari tabel operator, terhubung ke Data Anggota.
// Menghapus operator TIDAK menghapus anggota maupun akun loginnya.
window.Operators = {
  all: [],
  members: [],
  wilayahList: [],
  editingId: null,

  esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  },

  async init() {
    // Pengaman kedua: kalau bukan admin, jangan jalankan apa pun di halaman ini.
    if (!window.Auth.isAdmin()) {
      document.getElementById("operators-list").innerHTML =
        '<div class="card"><p class="muted">Halaman ini hanya bisa diakses admin yang sudah disetujui.</p></div>';
      return;
    }
    document.getElementById("btn-add-operator").onclick = () => this.openForm(null);
    document.getElementById("btn-operator-cancel").onclick = () => this.closeForm();
    document.getElementById("operator-form").onsubmit = (e) => { e.preventDefault(); this.save(); };
    document.getElementById("operators-search").oninput = () => this.render();
    document.getElementById("operators-filter-wilayah").onchange = () => this.render();
    await this.load();
  },

  async load() {
    try {
      const operatorsRes = await window.db.from("operator")
        .select("*, anggota(nama, kota, prefektur)")
        .order("jabatan", { ascending: true });
      if (operatorsRes.error) throw operatorsRes.error;
      this.all = operatorsRes.data || [];

      const membersRes = await window.db.from("anggota").select("id, nama").order("nama", { ascending: true });
      if (membersRes.error) throw membersRes.error;
      this.members = membersRes.data || [];
      document.getElementById("o-anggota").innerHTML =
        '<option value="">— Pilih anggota —</option>' +
        this.members.map((m) => '<option value="' + m.id + '">' + this.esc(m.nama) + '</option>').join("");

      const wilayahRes = await window.db.from("wilayah").select("nama").order("nama", { ascending: true });
      if (wilayahRes.error) throw wilayahRes.error;
      this.wilayahList = (wilayahRes.data || []).map((w) => w.nama);
      this.buildWilayahFilter();
      this.buildWilayahOptions(null);
      this.render();
    } catch (e) {
      document.getElementById("operators-count").textContent = "Operator belum bisa dimuat.";
      document.getElementById("operators-list").innerHTML =
        '<div class="card"><p class="muted">Pastikan tabel operator sudah dibuat (supabase/schema.sql) dan kamu sudah login sebagai admin yang disetujui.</p></div>';
    }
  },

  // Saringan wilayah diisi dari wilayah yang dipakai operator, supaya selalu sesuai data.
  buildWilayahFilter() {
    const select = document.getElementById("operators-filter-wilayah");
    const current = select.value;
    const values = [...new Set(this.all.map((o) => o.wilayah).filter(Boolean))].sort();
    select.innerHTML = '<option value="">Semua wilayah</option>' +
      values.map((v) => '<option>' + this.esc(v) + '</option>').join("");
    if (values.includes(current)) select.value = current;
  },

  // Dropdown wilayah di formulir diisi dari menu Wilayah; kalau nilai lama tidak ada
  // di daftar itu (misalnya wilayahnya sudah dihapus), tetap tampilkan sebagai pilihan
  // supaya data lama tidak hilang saat diubah.
  buildWilayahOptions(existingValue) {
    const values = [...this.wilayahList];
    if (existingValue && !values.includes(existingValue)) values.push(existingValue);
    values.sort();
    document.getElementById("o-wilayah").innerHTML =
      '<option value="">— Pilih wilayah (dari menu Wilayah) —</option>' +
      values.map((v) => '<option>' + this.esc(v) + '</option>').join("");
    if (existingValue) document.getElementById("o-wilayah").value = existingValue;
  },

  render() {
    const keyword = document.getElementById("operators-search").value.trim().toLowerCase();
    const wilayah = document.getElementById("operators-filter-wilayah").value;
    const filtered = this.all.filter((o) => {
      const nama = (o.anggota && o.anggota.nama) || "";
      if (wilayah && o.wilayah !== wilayah) return false;
      if (keyword && ![nama, o.jabatan, o.wilayah || ""].join(" ").toLowerCase().includes(keyword)) return false;
      return true;
    });
    document.getElementById("operators-count").textContent =
      "Menampilkan " + filtered.length + " dari " + this.all.length + " operator.";
    const listEl = document.getElementById("operators-list");
    if (!filtered.length) {
      listEl.innerHTML = '<div class="card"><p class="muted">Belum ada operator yang cocok. Tambahkan operator lewat tombol di atas.</p></div>';
      return;
    }
    listEl.innerHTML = filtered.map((o) => {
      const nama = (o.anggota && o.anggota.nama) || "Anggota tidak ditemukan";
      const tempat = o.anggota ? [o.anggota.kota, o.anggota.prefektur].filter(Boolean).join(", ") : "";
      return '<div class="card">' +
        '<strong>' + this.esc(nama) + '</strong>' +
        ' <span class="badge">' + this.esc(o.jabatan) + '</span>' +
        (o.wilayah ? '<p>Wilayah: ' + this.esc(o.wilayah) + '</p>' : "") +
        (tempat ? '<p class="muted">' + this.esc(tempat) + '</p>' : "") +
        (o.kontak ? '<p>Kontak: ' + this.esc(o.kontak) + '</p>' : "") +
        '<p><button type="button" class="secondary" data-edit="' + o.id + '">Ubah</button> ' +
        '<button type="button" class="secondary" data-delete="' + o.id + '">Hapus</button></p></div>';
    }).join("");
    listEl.querySelectorAll("[data-edit]").forEach((b) => b.onclick = () => this.openForm(b.dataset.edit));
    listEl.querySelectorAll("[data-delete]").forEach((b) => b.onclick = () => this.remove(b.dataset.delete));
  },

  openForm(id) {
    this.editingId = id || null;
    const o = id ? this.all.find((x) => x.id === id) : null;
    document.getElementById("operator-form-title").textContent = o ? "Ubah Operator" : "Tambah Operator";
    document.getElementById("o-anggota").value = (o && o.anggota_id) || "";
    document.getElementById("o-jabatan").value = (o && o.jabatan) || "";
    this.buildWilayahOptions(o ? o.wilayah : null);
    document.getElementById("o-kontak").value = (o && o.kontak) || "";
    document.getElementById("operator-form-error").classList.add("hidden");
    document.getElementById("operator-form").classList.remove("hidden");
    document.getElementById("operator-form").scrollIntoView({ behavior: "auto", block: "start" });
  },

  closeForm() {
    document.getElementById("operator-form").classList.add("hidden");
    this.editingId = null;
  },

  async save() {
    if (!window.Auth.isAdmin()) return;
    const errEl = document.getElementById("operator-form-error");
    const anggotaId = document.getElementById("o-anggota").value;
    const jabatan = document.getElementById("o-jabatan").value.trim();
    if (!anggotaId || !jabatan) {
      errEl.textContent = "Anggota dan jabatan wajib diisi.";
      errEl.classList.remove("hidden");
      return;
    }
    const payload = {
      anggota_id: anggotaId,
      jabatan: jabatan,
      wilayah: document.getElementById("o-wilayah").value || null,
      kontak: document.getElementById("o-kontak").value.trim() || null
    };
    const msg = document.getElementById("operators-msg");
    try {
      let error;
      if (this.editingId) {
        ({ error } = await window.db.from("operator").update(payload).eq("id", this.editingId));
      } else {
        ({ error } = await window.db.from("operator").insert(payload));
      }
      if (error) throw error;
      this.closeForm();
      msg.textContent = "Operator berhasil disimpan.";
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
    const o = this.all.find((x) => x.id === id);
    const nama = (o && o.anggota && o.anggota.nama) || "operator ini";
    if (!o || !confirm("Hapus operator " + nama + " (" + o.jabatan + ")? Data anggota dan akunnya tidak ikut terhapus.")) return;
    const { error } = await window.db.from("operator").delete().eq("id", id);
    if (error) { alert("Gagal menghapus: " + error.message); return; }
    await this.load();
  }
};
