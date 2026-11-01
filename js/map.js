// Peta Anggota: peta embed dari Google My Maps + ekspor CSV untuk membuat pin.
// Tidak ada API Google Maps di sini, jadi tidak perlu kunci API berbayar.
// Ekspor CSV hanya untuk admin, karena berisi alamat anggota.
window.MemberMap = {
  all: [],

  esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  },

  // Gabungkan alamat Jepang + kota + prefektur + kode pos jadi satu kolom,
  // supaya My Maps bisa menemukan lokasinya sebagai pin.
  fullAddress(m) {
    return [m.alamat_jepang, m.kota, m.prefektur, m.kode_pos].filter(Boolean).join(", ");
  },

  async init() {
    // Tampilkan peta embed kalau tautannya sudah diisi di js/config.js.
    const cfg = window.KOMUNITAS_CONFIG || {};
    const embedUrl = (cfg.GOOGLE_MY_MAPS_EMBED_URL || "").trim();
    const isEmbedReady = embedUrl && !embedUrl.includes("ISI-") && embedUrl.startsWith("https://");
    document.getElementById("map-embed-card").classList.toggle("hidden", !isEmbedReady);
    document.getElementById("map-empty-card").classList.toggle("hidden", isEmbedReady);
    if (isEmbedReady) document.getElementById("map-iframe").src = embedUrl;

    // Kartu langkah admin + tombol ekspor hanya untuk admin.
    const isAdmin = window.Auth.isAdmin();
    document.getElementById("map-admin-card").classList.toggle("hidden", !isAdmin);
    if (isAdmin) document.getElementById("btn-export-csv").onclick = () => this.exportCsv();

    document.getElementById("map-search").oninput = () => this.render();
    document.getElementById("map-filter-prefektur").onchange = () => this.render();
    await this.load();
  },

  async load() {
    try {
      const { data, error } = await window.db.from("anggota")
        .select("*").order("nama", { ascending: true });
      if (error) throw error;
      this.all = data || [];
      const withAddress = this.all.filter((m) => m.alamat_jepang && m.alamat_jepang.trim()).length;
      const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
      set("map-total", this.all.length);
      set("map-with-address", withAddress);
      set("map-without-address", this.all.length - withAddress);
      this.render();
    } catch (e) {
      document.getElementById("map-preview-count").textContent = "Data anggota belum bisa dimuat.";
      document.getElementById("map-list").innerHTML =
        '<div class="card"><p class="muted">Pastikan tabel anggota sudah dibuat (supabase/schema.sql) dan kamu sudah login sebagai anggota yang disetujui.</p></div>';
    }
  },

  filtered() {
    const keyword = document.getElementById("map-search").value.trim().toLowerCase();
    const prefektur = document.getElementById("map-filter-prefektur").value;
    return this.all.filter((m) => {
      if (prefektur && m.prefektur !== prefektur) return false;
      if (keyword && ![m.nama, m.kota || "", m.wilayah || ""].join(" ").toLowerCase().includes(keyword)) return false;
      return true;
    });
  },

  render() {
    const filtered = this.filtered();
    const withAddress = filtered.filter((m) => m.alamat_jepang && m.alamat_jepang.trim());
    document.getElementById("map-preview-count").textContent =
      "Menampilkan " + filtered.length + " anggota, " + withAddress.length + " di antaranya punya alamat Jepang dan akan ikut diekspor.";
    const listEl = document.getElementById("map-list");
    if (!filtered.length) {
      listEl.innerHTML = '<div class="card"><p class="muted">Belum ada anggota yang cocok dengan saringan.</p></div>';
      return;
    }
    listEl.innerHTML = filtered.map((m) => {
      const address = this.fullAddress(m);
      return '<div class="card member-card">' +
        '<strong>' + this.esc(m.nama) + '</strong>' +
        '<p>' + (address ? this.esc(address) : '<span class="muted">Alamat Jepang belum diisi</span>') + '</p>' +
        '<p class="muted small">' + this.esc([m.wilayah, m.prefektur].filter(Boolean).join(" · ")) + '</p>' +
        '</div>';
    }).join("");
  },

  // Satu nilai CSV: dibungkus tanda kutip ganda, dan kutip ganda di dalamnya digandakan.
  // Ini penting supaya alamat yang mengandung koma tidak memecah kolom di My Maps.
  csvCell(value) {
    return '"' + String(value == null ? "" : value).replace(/"/g, '""') + '"';
  },

  exportCsv() {
    if (!window.Auth.isAdmin()) return;
    const rows = this.filtered().filter((m) => m.alamat_jepang && m.alamat_jepang.trim());
    if (!rows.length) {
      const msg = document.getElementById("map-msg");
      msg.textContent = "Tidak ada anggota dengan alamat Jepang pada saringan ini, jadi tidak ada CSV yang diekspor.";
      msg.className = "error";
      msg.classList.remove("hidden");
      return;
    }
    const header = ["Nama", "Alamat Lengkap", "Alamat Jepang", "Kota", "Prefektur", "Wilayah", "Kode Pos"];
    const lines = [header.map((h) => this.csvCell(h)).join(",")];
    rows.forEach((m) => {
      lines.push([
        m.nama, this.fullAddress(m), m.alamat_jepang, m.kota, m.prefektur, m.wilayah, m.kode_pos
      ].map((v) => this.csvCell(v)).join(","));
    });
    // \ufeff = BOM, supaya Excel di Windows membuka CSV beraksen/Jepang dengan benar.
    const blob = new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
    a.href = url;
    a.download = "anggota-shikoku-" + today + ".csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    const msg = document.getElementById("map-msg");
    msg.textContent = "CSV berhasil diunduh: " + rows.length + " anggota dengan alamat Jepang.";
    msg.className = "success";
    msg.classList.remove("hidden");
  }
};
