// Forum: baca, buat topik, dan berkomentar untuk semua anggota yang disetujui.
// Hapus hanya untuk admin (sesuai RLS). Tidak ada ubah, karena RLS tidak memberi
// izin update untuk forum_posts dan forum_comments.
window.Forum = {
  all: [],
  openPostId: null,

  esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  },

  async init() {
    document.getElementById("btn-add-forum").onclick = () => {
      document.getElementById("forum-form").classList.remove("hidden");
      document.getElementById("forum-form").scrollIntoView({ behavior: "auto", block: "start" });
    };
    document.getElementById("btn-forum-cancel").onclick = () =>
      document.getElementById("forum-form").classList.add("hidden");
    document.getElementById("forum-form").onsubmit = (e) => { e.preventDefault(); this.createPost(); };
    document.getElementById("comment-form").onsubmit = (e) => { e.preventDefault(); this.createComment(); };
    document.getElementById("forum-search").oninput = () => this.render();
    await this.load();
  },

  async load() {
    try {
      // Ambil topik beserta nama pembuat dan jumlah komentarnya.
      const { data, error } = await window.db.from("forum_posts")
        .select("*, profiles(nama_lengkap), forum_comments(id)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      this.all = data || [];
      this.render();
      // Kalau detail sedang dibuka, segarkan juga komentarnya.
      if (this.openPostId) await this.openPost(this.openPostId, false);
    } catch (e) {
      document.getElementById("forum-count").textContent = "Forum belum bisa dimuat.";
      document.getElementById("forum-list").innerHTML =
        '<div class="card"><p class="muted">Pastikan tabel forum sudah dibuat (supabase/schema.sql) dan kamu sudah login sebagai anggota yang disetujui.</p></div>';
    }
  },

  render() {
    const keyword = document.getElementById("forum-search").value.trim().toLowerCase();
    const isAdmin = window.Auth.isAdmin();
    const filtered = this.all.filter((p) =>
      !keyword || [p.judul, p.isi].join(" ").toLowerCase().includes(keyword));
    document.getElementById("forum-count").textContent =
      "Menampilkan " + filtered.length + " dari " + this.all.length + " topik.";
    const listEl = document.getElementById("forum-list");
    if (!filtered.length) {
      listEl.innerHTML = '<div class="card"><p class="muted">Belum ada topik yang cocok. Buat topik baru lewat tombol di atas.</p></div>';
      return;
    }
    listEl.innerHTML = filtered.map((p) => {
      const author = (p.profiles && p.profiles.nama_lengkap) || "";
      const count = (p.forum_comments && p.forum_comments.length) || 0;
      const snippet = p.isi.length > 140 ? p.isi.slice(0, 140) + "…" : p.isi;
      return '<div class="card">' +
        '<strong>' + this.esc(p.judul) + '</strong>' +
        '<p>' + this.esc(snippet) + '</p>' +
        '<p class="muted small">' + this.esc((p.created_at || "").slice(0, 10)) +
        (author ? " &middot; " + this.esc(author) : "") +
        " &middot; " + count + " komentar</p>" +
        '<p><button type="button" class="secondary" data-open="' + p.id + '">Buka Diskusi</button>' +
        (isAdmin ? ' <button type="button" class="secondary" data-delete-post="' + p.id + '">Hapus Topik</button>' : "") +
        '</p></div>';
    }).join("");
    listEl.querySelectorAll("[data-open]").forEach((b) => b.onclick = () => this.openPost(b.dataset.open, true));
    listEl.querySelectorAll("[data-delete-post]").forEach((b) => b.onclick = () => this.removePost(b.dataset.deletePost));
  },

  async openPost(id, scroll) {
    this.openPostId = id;
    const post = this.all.find((p) => p.id === id);
    if (!post) return;
    const detail = document.getElementById("forum-detail");
    const author = (post.profiles && post.profiles.nama_lengkap) || "";
    detail.innerHTML = '<h2>' + this.esc(post.judul) + '</h2>' +
      '<p class="muted small">' + this.esc((post.created_at || "").slice(0, 10)) +
      (author ? " &middot; " + this.esc(author) : "") + '</p>' +
      '<p>' + this.esc(post.isi) + '</p>' +
      '<div id="forum-comments">Memuat komentar…</div>' +
      '<p><button type="button" class="secondary" id="btn-close-forum-detail">Tutup Diskusi</button></p>';
    detail.classList.remove("hidden");
    document.getElementById("comment-form").classList.remove("hidden");
    document.getElementById("btn-close-forum-detail").onclick = () => {
      detail.classList.add("hidden");
      document.getElementById("comment-form").classList.add("hidden");
      this.openPostId = null;
    };
    if (scroll) detail.scrollIntoView({ behavior: "auto", block: "start" });

    // Komentar diurut dari yang paling lama, supaya diskusi enak dibaca berurutan.
    const { data, error } = await window.db.from("forum_comments")
      .select("*, profiles(nama_lengkap)")
      .eq("post_id", id)
      .order("created_at", { ascending: true });
    const box = document.getElementById("forum-comments");
    if (error) { box.innerHTML = '<p class="error">Komentar gagal dimuat: ' + this.esc(error.message) + '</p>'; return; }
    const isAdmin = window.Auth.isAdmin();
    if (!data || !data.length) {
      box.innerHTML = '<p class="muted">Belum ada komentar. Jadilah yang pertama berkomentar.</p>';
      return;
    }
    box.innerHTML = '<h3>Komentar</h3>' + data.map((c) => {
      const cauthor = (c.profiles && c.profiles.nama_lengkap) || "";
      return '<div class="comment">' +
        '<p>' + this.esc(c.isi) + '</p>' +
        '<p class="muted small">' + this.esc((c.created_at || "").slice(0, 10)) +
        (cauthor ? " &middot; " + this.esc(cauthor) : "") + '</p>' +
        (isAdmin ? '<p><button type="button" class="secondary" data-delete-comment="' + c.id + '">Hapus Komentar</button></p>' : "") +
        '</div>';
    }).join("");
    box.querySelectorAll("[data-delete-comment]").forEach((b) =>
      b.onclick = () => this.removeComment(b.dataset.deleteComment));
  },

  async createPost() {
    const errEl = document.getElementById("forum-form-error");
    const judul = document.getElementById("fp-judul").value.trim();
    const isi = document.getElementById("fp-isi").value.trim();
    if (!judul || !isi) {
      errEl.textContent = "Judul dan isi topik wajib diisi.";
      errEl.classList.remove("hidden");
      return;
    }
    const msg = document.getElementById("forum-msg");
    const { error } = await window.db.from("forum_posts").insert({
      judul: judul, isi: isi, dibuat_oleh: window.Auth.profile.id
    });
    if (error) {
      msg.textContent = "Gagal mengirim topik: " + error.message;
      msg.className = "error";
    } else {
      document.getElementById("fp-judul").value = "";
      document.getElementById("fp-isi").value = "";
      document.getElementById("forum-form").classList.add("hidden");
      msg.textContent = "Topik berhasil dikirim.";
      msg.className = "success";
      await this.load();
    }
    msg.classList.remove("hidden");
  },

  async createComment() {
    if (!this.openPostId) return;
    const errEl = document.getElementById("comment-form-error");
    const isi = document.getElementById("fc-isi").value.trim();
    if (!isi) {
      errEl.textContent = "Komentar wajib diisi.";
      errEl.classList.remove("hidden");
      return;
    }
    const msg = document.getElementById("forum-msg");
    const { error } = await window.db.from("forum_comments").insert({
      post_id: this.openPostId, isi: isi, dibuat_oleh: window.Auth.profile.id
    });
    if (error) {
      msg.textContent = "Gagal mengirim komentar: " + error.message;
      msg.className = "error";
    } else {
      document.getElementById("fc-isi").value = "";
      msg.textContent = "Komentar berhasil dikirim.";
      msg.className = "success";
      await this.load();
    }
    msg.classList.remove("hidden");
  },

  async removePost(id) {
    if (!window.Auth.isAdmin()) return;
    const post = this.all.find((p) => p.id === id);
    if (!post || !confirm("Hapus topik \"" + post.judul + "\" beserta semua komentarnya?")) return;
    const { error } = await window.db.from("forum_posts").delete().eq("id", id);
    if (error) { alert("Gagal menghapus: " + error.message); return; }
    if (this.openPostId === id) {
      document.getElementById("forum-detail").classList.add("hidden");
      document.getElementById("comment-form").classList.add("hidden");
      this.openPostId = null;
    }
    await this.load();
  },

  async removeComment(id) {
    if (!window.Auth.isAdmin()) return;
    if (!confirm("Hapus komentar ini?")) return;
    const { error } = await window.db.from("forum_comments").delete().eq("id", id);
    if (error) { alert("Gagal menghapus: " + error.message); return; }
    await this.load();
  }
};
