// Data Anggota: baca untuk semua anggota yang disetujui,
// tambah/ubah/hapus hanya untuk admin yang disetujui (juga dijaga RLS di Supabase).
window.Members = {
  all: [],
  editingId: null,
  step: 1,

  // Lindungi tampilan dari data yang berisi karakter HTML.
  esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  },

  async init() {
    const isAdmin = window.Auth.isAdmin();
    // Tombol tambah + tombol Isi Otomatis hanya untuk admin.
    document.getElementById("members-admin-actions").classList.toggle("hidden", !isAdmin);
    document.getElementById("ai-row").classList.toggle("hidden", !isAdmin);

    await this.load();

    document.getElementById("members-search").oninput = () => this.render();
    document.getElementById("members-filter-prefektur").onchange = () => this.render();
    document.getElementById("members-filter-wilayah").onchange = () => this.render();
    document.getElementById("btn-add-member").onclick = () => this.openForm(null);
    document.getElementById("btn-form-cancel").onclick = () => this.closeForm();
    document.getElementById("btn-form-prev").onclick = () => this.goStep(this.step - 1);
    document.getElementById("btn-form-next").onclick = () => this.goStep(this.step + 1);
    document.getElementById("member-form").onsubmit = (e) => { e.preventDefault(); this.save(); };
    // Isi Otomatis (AI) hanya untuk admin; memanggil api/ai-autofill.js di Vercel.
    if (isAdmin) document.getElementById("btn-ai-autofill").onclick = () => this.autofill();
  },

  // Isi Otomatis: kirim data formulir yang sudah diisi ke api/ai-autofill.js,
  // lalu isi HANYA kolom yang masih kosong dengan hasil AI.
  async autofill() {
    const msg = document.getElementById("members-msg");
    const get = (id) => document.getElementById(id).value.trim();
    const input = {
      nama: get("f-nama"), alamat_jepang: get("f-alamat-jepang"),
      kode_pos: get("f-kode-pos"), prefektur: get("f-prefektur"),
      kota: get("f-kota"), wilayah: get("f-wilayah"),
      pekerjaan: get("f-pekerjaan"), status_tinggal: get("f-status-tinggal")
    };
    if (!input.alamat_jepang && !input.kota && !input.pekerjaan) {
      msg.textContent = "Isi dulu alamat Jepang, kota, atau pekerjaan supaya AI punya bahan untuk melengkapi.";
      msg.className = "error";
      msg.classList.remove("hidden");
      return;
    }
    try {
      const res = await fetch("/api/ai-autofill", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + (window.Auth.session && window.Auth.session.access_token)
        },
        body: JSON.stringify({ data: input })
      });
      let data = {};
      try { data = await res.json(); } catch (e) { data = {}; }
      if (!res.ok) throw new Error(data.error || ("Isi Otomatis gagal (" + res.status + ")."));
      const fieldMap = {
        alamat_jepang: "f-alamat-jepang", kode_pos: "f-kode-pos", prefektur: "f-prefektur",
        kota: "f-kota", wilayah: "f-wilayah", pekerjaan: "f-pekerjaan", status_tinggal: "f-status-tinggal"
      };
      let filled = 0;
      Object.entries(data.data || {}).forEach(([key, value]) => {
        const elId = fieldMap[key];
        if (elId && !document.getElementById(elId).value.trim() && value) {
          document.getElementById(elId).value = value;
          filled++;
        }
      });
      msg.textContent = filled
        ? "Isi Otomatis berhasil mengisi " + filled + " kolom yang masih kosong. Periksa dulu sebelum menyimpan."
        : "AI tidak menemukan kolom baru yang bisa diisi dengan yakin dari data yang ada.";
      msg.className = "success";
      msg.classList.remove("hidden");
    } catch (e) {
      msg.textContent = "Isi Otomatis gagal: " + e.message +
        " Pastikan proyek sudah di-deploy ke Vercel (atau dijalankan dengan vercel dev) dan AI_API_KEY sudah diisi.";
      msg.className = "error";
      msg.classList.remove("hidden");
    }
  },

  async load() {
    const listEl = document.getElementById("members-list");
    try {
      const { data, error } = await window.db.from("anggota").select("*").order("nama", { ascending: true });
      if (error) throw error;
      this.all = data || [];
      this.buildWilayahFilter();
      this.render();
    } catch (e) {
      document.getElementById("members-count").textContent = "Data anggota belum bisa dimuat.";
      listEl.innerHTML = '<div class="card"><p class="muted">Pastikan tabel anggota sudah dibuat (supabase/schema.sql) dan kamu sudah login sebagai anggota yang disetujui.</p></div>';
    }
  },

  // Isi dropdown wilayah dari data yang ada, supaya saringan selalu sesuai isi database.
  buildWilayahFilter() {
    const select = document.getElementById("members-filter-wilayah");
    const current = select.value;
    const values = [...new Set(this.all.map((m) => m.wilayah).filter(Boolean))].sort();
    select.innerHTML = '<option value="">Semua wilayah</option>' +
      values.map((v) => '<option>' + this.esc(v) + '</option>').join("");
    if (values.includes(current)) select.value = current;
  },

  // Terapkan cari + saring, lalu gambar daftarnya.
  render() {
    const keyword = document.getElementById("members-search").value.trim().toLowerCase();
    const prefektur = document.getElementById("members-filter-prefektur").value;
    const wilayah = document.getElementById("members-filter-wilayah").value;
    const isAdmin = window.Auth.isAdmin();
    const filtered = this.all.filter((m) => {
      const hay = [m.nama, m.kota, m.wilayah, m.email, m.prefektur].join(" ").toLowerCase();
      if (keyword && !hay.includes(keyword)) return false;
      if (prefektur && m.prefektur !== prefektur) return false;
      if (wilayah && m.wilayah !== wilayah) return false;
      return true;
    });

    document.getElementById("members-count").textContent =
      "Menampilkan " + filtered.length + " dari " + this.all.length + " anggota.";
    const listEl = document.getElementById("members-list");
    if (!filtered.length) {
      listEl.innerHTML = '<div class="card"><p class="muted">Belum ada anggota yang cocok. Coba ubah kata kunci atau saringan.</p></div>';
      return;
    }
    listEl.innerHTML = filtered.map((m) => {
      const tempat = [m.kota, m.prefektur].filter(Boolean).join(", ");
      return '<div class="card member-card">' +
        '<strong>' + this.esc(m.nama) + '</strong>' +
        '<p class="muted">' + this.esc(tempat || "Alamat belum diisi") +
        (m.wilayah ? " &middot; " + this.esc(m.wilayah) : "") + '</p>' +
        (m.pekerjaan ? '<p>' + this.esc(m.pekerjaan) + '</p>' : "") +
        '<p><button type="button" class="secondary" data-detail="' + m.id + '">Lihat Detail</button>' +
        (isAdmin
          ? ' <button type="button" class="secondary" data-edit="' + m.id + '">Ubah</button>' +
            ' <button type="button" class="secondary" data-delete="' + m.id + '">Hapus</button>'
          : "") + '</p></div>';
    }).join("");

    listEl.querySelectorAll("[data-detail]").forEach((b) => b.onclick = () => this.showDetail(b.dataset.detail));
    listEl.querySelectorAll("[data-edit]").forEach((b) => b.onclick = () => this.openForm(b.dataset.edit));
    listEl.querySelectorAll("[data-delete]").forEach((b) => b.onclick = () => this.remove(b.dataset.delete));
  },

  showDetail(id) {
    const m = this.all.find((x) => x.id === id);
    if (!m) return;
    const rows = [
      ["Nama", m.nama], ["Jenis kelamin", m.jenis_kelamin], ["Tanggal lahir", m.tanggal_lahir],
      ["No telepon", m.no_telepon], ["Email", m.email], ["Alamat Jepang", m.alamat_jepang],
      ["Kode pos", m.kode_pos], ["Prefektur", m.prefektur], ["Kota", m.kota],
      ["Wilayah", m.wilayah], ["Pekerjaan", m.pekerjaan], ["Status tinggal", m.status_tinggal],
      ["Tanggal bergabung", m.tanggal_bergabung]
    ];
    const detail = document.getElementById("member-detail");
    detail.innerHTML = '<h2>' + this.esc(m.nama) + '</h2>' +
      rows.filter((r) => r[1]).map((r) =>
        '<p><b>' + r[0] + ':</b> ' + this.esc(r[1]) + '</p>').join("") +
      '<p><button type="button" class="secondary" id="btn-close-detail">Tutup Detail</button></p>';
    detail.classList.remove("hidden");
    document.getElementById("btn-close-detail").onclick = () => detail.classList.add("hidden");
    detail.scrollIntoView({ behavior: "auto", block: "start" });
  },

  openForm(id) {
    this.editingId = id || null;
    const m = id ? this.all.find((x) => x.id === id) : null;
    document.getElementById("member-form-title").textContent = m ? "Ubah Anggota" : "Tambah Anggota";
    const set = (field, value) => { document.getElementById(field).value = value || ""; };
    set("f-nama", m && m.nama); set("f-jenis-kelamin", m && m.jenis_kelamin);
    set("f-tanggal-lahir", m && m.tanggal_lahir); set("f-no-telepon", m && m.no_telepon);
    set("f-email", m && m.email); set("f-alamat-jepang", m && m.alamat_jepang);
    set("f-kode-pos", m && m.kode_pos); set("f-prefektur", m && m.prefektur);
    set("f-kota", m && m.kota); set("f-wilayah", m && m.wilayah);
    set("f-pekerjaan", m && m.pekerjaan); set("f-status-tinggal", m && m.status_tinggal);
    set("f-tanggal-bergabung", m && m.tanggal_bergabung);
    document.getElementById("member-form-error").classList.add("hidden");
    document.getElementById("member-form").classList.remove("hidden");
    this.goStep(1);
    document.getElementById("member-form").scrollIntoView({ behavior: "auto", block: "start" });
  },

  closeForm() {
    document.getElementById("member-form").classList.add("hidden");
    this.editingId = null;
  },

  // Pindah langkah; nama wajib diisi sebelum lanjut dari langkah 1.
  goStep(next) {
    if (next < 1 || next > 3) return;
    if (next > this.step && this.step === 1 && !document.getElementById("f-nama").value.trim()) {
      const err = document.getElementById("member-form-error");
      err.textContent = "Nama lengkap wajib diisi sebelum lanjut.";
      err.classList.remove("hidden");
      return;
    }
    document.getElementById("member-form-error").classList.add("hidden");
    this.step = next;
    const labels = { 1: "Langkah 1 dari 3: Identitas", 2: "Langkah 2 dari 3: Identitas + Wilayah", 3: "Langkah 3 dari 3: Pekerjaan dan Keanggotaan" };
    document.getElementById("member-step-label").textContent = labels[next];
    document.querySelectorAll(".form-step").forEach((el) =>
      el.classList.toggle("hidden", Number(el.dataset.step) !== next));
    document.getElementById("btn-form-prev").classList.toggle("hidden", next === 1);
    document.getElementById("btn-form-next").classList.toggle("hidden", next === 3);
    document.getElementById("btn-form-save").classList.toggle("hidden", next !== 3);
  },

  async save() {
    if (!window.Auth.isAdmin()) return; // Pengaman kedua, selain RLS.
    const val = (id) => document.getElementById(id).value.trim() || null;
    const payload = {
      nama: val("f-nama"), jenis_kelamin: val("f-jenis-kelamin"),
      tanggal_lahir: val("f-tanggal-lahir"), no_telepon: val("f-no-telepon"),
      email: val("f-email"), alamat_jepang: val("f-alamat-jepang"),
      kode_pos: val("f-kode-pos"), prefektur: val("f-prefektur"),
      kota: val("f-kota"), wilayah: val("f-wilayah"),
      pekerjaan: val("f-pekerjaan"), status_tinggal: val("f-status-tinggal"),
      tanggal_bergabung: val("f-tanggal-bergabung")
    };
    if (!payload.nama) {
      const err = document.getElementById("member-form-error");
      err.textContent = "Nama lengkap wajib diisi.";
      err.classList.remove("hidden");
      return;
    }
    const msg = document.getElementById("members-msg");
    try {
      let error;
      if (this.editingId) {
        ({ error } = await window.db.from("anggota").update(payload).eq("id", this.editingId));
      } else {
        ({ error } = await window.db.from("anggota").insert(payload));
      }
      if (error) throw error;
      this.closeForm();
      msg.textContent = "Data anggota berhasil disimpan.";
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
    const m = this.all.find((x) => x.id === id);
    if (!m || !confirm("Hapus anggota " + m.nama + "? Tindakan ini tidak bisa dibatalkan.")) return;
    const { error } = await window.db.from("anggota").delete().eq("id", id);
    if (error) { alert("Gagal menghapus: " + error.message); return; }
    await this.load();
  }
};
