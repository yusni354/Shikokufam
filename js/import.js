// Import Database: menu khusus admin. Membaca CSV anggota, memvalidasi,
// menampilkan pratinjau, lalu mengimpor hanya baris yang valid.
// Riwayat impor dicatat ke tabel import_log.
window.ImportDB = {
  parsed: [],      // Baris valid, siap diimpor.
  fileName: "",
  existingByKey: new Map(),

  HEADERS: ["Nama", "Jenis Kelamin", "Tanggal Lahir", "No Telepon", "Email",
    "Alamat Jepang", "Kode Pos", "Prefektur", "Kota", "Wilayah",
    "Pekerjaan", "Status Tinggal", "Tanggal Bergabung"],

  // Nama kolom di CSV -> kolom di tabel anggota. Pencocokan tidak membedakan
  // huruf besar/kecil dan spasi, supaya variasi judul dari Excel tetap dikenali.
  COLUMN_MAP: {
    "nama": "nama", "nama lengkap": "nama",
    "jenis kelamin": "jenis_kelamin", "jk": "jenis_kelamin",
    "tanggal lahir": "tanggal_lahir",
    "no telepon": "no_telepon", "telepon": "no_telepon", "no hp": "no_telepon", "hp": "no_telepon",
    "email": "email",
    "alamat jepang": "alamat_jepang", "alamat": "alamat_jepang",
    "kode pos": "kode_pos", "kodepos": "kode_pos",
    "prefektur": "prefektur",
    "kota": "kota",
    "wilayah": "wilayah",
    "pekerjaan": "pekerjaan",
    "status tinggal": "status_tinggal",
    "tanggal bergabung": "tanggal_bergabung"
  },

  PREFEKTUR: ["Tokushima", "Kagawa", "Ehime", "Kochi"],

  esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  },

  async init() {
    if (!window.Auth.isAdmin()) {
      document.getElementById("import-history").innerHTML =
        '<p class="muted">Halaman ini hanya bisa diakses admin yang sudah disetujui.</p>';
      return;
    }
    document.getElementById("btn-download-template").onclick = () => this.downloadTemplate();
    document.getElementById("import-file").onchange = (e) => this.handleFile(e.target.files[0]);
    document.getElementById("btn-cancel-import").onclick = () => this.resetPreview();
    document.getElementById("btn-do-import").onclick = () => this.doImport();
    await this.loadHistory();
  },

  downloadTemplate() {
    const blob = new Blob(["\ufeff" + this.HEADERS.join(",") + "\r\n"], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "template-anggota-shikoku.csv";
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  },

  // Parser CSV sederhana tapi benar: mendukung nilai dalam tanda kutip ganda,
  // koma dan baris baru di dalam kutip, serta kutip ganda yang digandakan.
  parseCsv(text) {
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // Buang BOM.
    const rows = [];
    let row = [], field = "", inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else inQuotes = false;
        } else field += ch;
      } else if (ch === '"') inQuotes = true;
      else if (ch === ",") { row.push(field); field = ""; }
      else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(field); field = "";
        if (row.some((v) => v.trim() !== "")) rows.push(row);
        row = [];
      } else field += ch;
    }
    if (field !== "" || row.length) {
      row.push(field);
      if (row.some((v) => v.trim() !== "")) rows.push(row);
    }
    return rows;
  },

  // Terima YYYY-MM-DD apa adanya; ubah DD/MM/YYYY dan DD-MM-YYYY menjadi YYYY-MM-DD.
  // Kembalikan null kalau formatnya tidak dikenali atau tanggalnya tidak valid.
  parseDate(value) {
    if (!value) return null;
    const v = value.trim();
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
    if (iso) {
      const d = new Date(v + "T00:00:00Z");
      return isNaN(d.getTime()) ? null : v;
    }
    const dmy = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/.exec(v);
    if (dmy) {
      const isoDate = dmy[3] + "-" + dmy[2].padStart(2, "0") + "-" + dmy[1].padStart(2, "0");
      const d = new Date(isoDate + "T00:00:00Z");
      return isNaN(d.getTime()) ? null : isoDate;
    }
    return null;
  },

  normalizeGender(value) {
    if (!value) return null;
    const v = value.trim().toLowerCase();
    if (v === "laki-laki" || v === "l" || v === "laki laki") return "Laki-laki";
    if (v === "perempuan" || v === "p") return "Perempuan";
    return null; // Nilai lain dianggap tidak valid, bukan ditebak.
  },

  normalizePrefektur(value) {
    if (!value) return null;
    const v = value.trim().toLowerCase().replace(/-ken$/, "").replace(/\s+/g, "");
    const found = this.PREFEKTUR.find((p) => p.toLowerCase() === v);
    return found || null;
  },

  // Kunci duplikat: email kalau ada, kalau tidak ada email pakai nama.
  dupKey(payload) {
    return (payload.email || payload.nama || "").trim().toLowerCase();
  },

  async handleFile(file) {
    if (!file) return;
    this.fileName = file.name;
    const text = await file.text();
    const rows = this.parseCsv(text);
    const msg = document.getElementById("import-msg");
    if (rows.length < 2) {
      msg.textContent = "Berkas CSV kosong atau hanya berisi judul kolom. Isi dulu datanya di bawah judul kolom.";
      msg.className = "error";
      msg.classList.remove("hidden");
      return;
    }
    // Petakan kolom dari baris judul.
    const headerMap = {};
    rows[0].forEach((h, idx) => {
      const key = this.COLUMN_MAP[h.trim().toLowerCase()];
      if (key && !(key in headerMap)) headerMap[key] = idx;
    });
    if (!("nama" in headerMap)) {
      msg.textContent = "Kolom Nama tidak ditemukan di baris judul CSV. Unduh template dulu supaya judul kolomnya sesuai.";
      msg.className = "error";
      msg.classList.remove("hidden");
      return;
    }

    // Muat data anggota yang sudah ada untuk cek duplikat.
    const { data: existing } = await window.db.from("anggota").select("id, nama, email");
    this.existingByKey = new Map();
    (existing || []).forEach((m) => this.existingByKey.set(this.dupKey(m), m.id));

    this.parsed = [];
    const errors = [];
    rows.slice(1).forEach((row, idx) => {
      const lineNo = idx + 2; // Baris 1 adalah judul.
      const get = (field) => {
        const col = headerMap[field];
        return col == null ? "" : (row[col] || "").trim();
      };
      const rowErrors = [];
      const nama = get("nama");
      if (!nama) rowErrors.push("Nama kosong");
      let jenisKelamin = null, tanggalLahir = null, tanggalBergabung = null, prefektur = null;
      if (get("jenis_kelamin")) {
        jenisKelamin = this.normalizeGender(get("jenis_kelamin"));
        if (!jenisKelamin) rowErrors.push('Jenis Kelamin "' + get("jenis_kelamin") + '" tidak dikenali');
      }
      if (get("tanggal_lahir")) {
        tanggalLahir = this.parseDate(get("tanggal_lahir"));
        if (!tanggalLahir) rowErrors.push('Tanggal Lahir "' + get("tanggal_lahir") + '" tidak dikenali');
      }
      if (get("tanggal_bergabung")) {
        tanggalBergabung = this.parseDate(get("tanggal_bergabung"));
        if (!tanggalBergabung) rowErrors.push('Tanggal Bergabung "' + get("tanggal_bergabung") + '" tidak dikenali');
      }
      if (get("prefektur")) {
        prefektur = this.normalizePrefektur(get("prefektur"));
        if (!prefektur) rowErrors.push('Prefektur "' + get("prefektur") + '" harus Tokushima, Kagawa, Ehime, atau Kochi');
      }
      if (rowErrors.length) {
        errors.push("Baris " + lineNo + " (" + (nama || "tanpa nama") + "): " + rowErrors.join("; "));
        return;
      }
      this.parsed.push({
        nama: nama, jenis_kelamin: jenisKelamin, tanggal_lahir: tanggalLahir,
        no_telepon: get("no_telepon") || null, email: get("email") || null,
        alamat_jepang: get("alamat_jepang") || null, kode_pos: get("kode_pos") || null,
        prefektur: prefektur, kota: get("kota") || null, wilayah: get("wilayah") || null,
        pekerjaan: get("pekerjaan") || null, status_tinggal: get("status_tinggal") || null,
        tanggal_bergabung: tanggalBergabung
      });
    });

    msg.classList.add("hidden");
    document.getElementById("import-preview").classList.remove("hidden");
    document.getElementById("import-summary").textContent =
      "Berkas: " + this.fileName + " — " + rows.length + " baris data (di luar judul), " +
      this.parsed.length + " baris valid, " + errors.length + " baris tidak valid dan tidak akan diimpor.";
    document.getElementById("import-errors").innerHTML = errors.length
      ? '<p class="error">' + errors.map((e) => this.esc(e)).join("<br>") + '</p>'
      : '<p class="success">Semua baris valid.</p>';
    const preview = this.parsed.slice(0, 20);
    document.getElementById("import-rows").innerHTML =
      '<p class="muted">Pratinjau ' + preview.length + ' baris pertama yang valid:</p>' +
      '<ul>' + preview.map((p) =>
        '<li>' + this.esc(p.nama) + (p.prefektur ? ' — ' + this.esc(p.prefektur) : "") +
        (p.kota ? ', ' + this.esc(p.kota) : "") + '</li>').join("") + '</ul>' +
      (this.parsed.length > 20 ? '<p class="muted">…dan ' + (this.parsed.length - 20) + ' baris valid lainnya.</p>' : '');
    document.getElementById("btn-do-import").disabled = this.parsed.length === 0;
  },

  resetPreview() {
    this.parsed = [];
    document.getElementById("import-preview").classList.add("hidden");
    document.getElementById("import-file").value = "";
    document.getElementById("import-progress").classList.add("hidden");
  },

  async doImport() {
    if (!window.Auth.isAdmin() || !this.parsed.length) return;
    const mode = document.getElementById("import-mode").value;
    const progress = document.getElementById("import-progress");
    const msg = document.getElementById("import-msg");
    progress.classList.remove("hidden");
    let added = 0, updated = 0, skipped = 0, failed = 0;
    const failedNames = [];
    // Impor satu per satu supaya kesalahan satu baris tidak menggagalkan semuanya,
    // dan supaya admin bisa melihat baris mana yang gagal.
    for (let i = 0; i < this.parsed.length; i++) {
      const payload = this.parsed[i];
      progress.textContent = "Mengimpor " + (i + 1) + " dari " + this.parsed.length + " baris…";
      try {
        const existingId = this.existingByKey.get(this.dupKey(payload));
        if (existingId && mode === "skip") { skipped++; continue; }
        let error;
        if (existingId && mode === "update") {
          ({ error } = await window.db.from("anggota").update(payload).eq("id", existingId));
          if (!error) updated++;
        } else {
          ({ error } = await window.db.from("anggota").insert(payload));
          if (!error) added++;
        }
        if (error) throw error;
      } catch (e) {
        failed++;
        failedNames.push(payload.nama + ": " + e.message);
      }
    }
    progress.classList.add("hidden");
    const totalImported = added + updated;
    // Catat riwayat impor (usaha terbaik; kalau gagal, hasil impor tetap dilaporkan).
    try {
      await window.db.from("import_log").insert({
        diunggah_oleh: window.Auth.profile.id,
        nama_file: this.fileName,
        jumlah_data: totalImported
      });
    } catch (e) { /* riwayat gagal dicatat, tapi impor sudah terjadi */ }
    msg.textContent = "Impor selesai: " + added + " ditambah, " + updated + " diperbarui, " +
      skipped + " dilewati (sudah ada), " + failed + " gagal." +
      (failedNames.length ? " Yang gagal: " + failedNames.slice(0, 5).join("; ") : "");
    msg.className = failed ? "error" : "success";
    msg.classList.remove("hidden");
    this.resetPreview();
    await this.loadHistory();
  },

  async loadHistory() {
    try {
      const { data, error } = await window.db.from("import_log")
        .select("*, profiles(nama_lengkap)")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      const box = document.getElementById("import-history");
      if (!data || !data.length) {
        box.innerHTML = '<p class="muted">Belum ada riwayat impor.</p>';
        return;
      }
      box.innerHTML = '<ul>' + data.map((h) => {
        const uploader = (h.profiles && h.profiles.nama_lengkap) || "";
        return '<li>' + this.esc((h.created_at || "").slice(0, 10)) + ' — ' +
          this.esc(h.nama_file || "tanpa nama") + ' (' + h.jumlah_data + ' data)' +
          (uploader ? ' oleh ' + this.esc(uploader) : "") + '</li>';
      }).join("") + '</ul>';
    } catch (e) {
      document.getElementById("import-history").innerHTML = '<p class="muted">Riwayat impor belum bisa dimuat.</p>';
    }
  }
};
