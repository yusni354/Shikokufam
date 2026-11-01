// Router sederhana: memuat pages/*.html ke <main>, lalu menjalankan init halaman itu.
// Tidak memakai framework, supaya ringan dan mudah diedit.
(function () {
  const app = document.getElementById("app");
  const drawer = document.getElementById("drawer");
  const backdrop = document.getElementById("drawer-backdrop");
  const btnLogout = document.getElementById("btn-logout");

  // Halaman yang hanya boleh dibuka admin yang sudah disetujui.
  // "admin" tidak ada di menu samping; dibuka dari kotak admin di Dashboard.
  const ADMIN_PAGES = ["operators", "import", "admin"];

  function openDrawer(open) {
    drawer.classList.toggle("open", open);
    backdrop.classList.toggle("hidden", !open);
  }
  document.getElementById("btn-menu").onclick = () => openDrawer(true);
  document.getElementById("btn-close-menu").onclick = () => openDrawer(false);
  backdrop.onclick = () => openDrawer(false);

  // Pindah halaman dari menu samping.
  drawer.querySelectorAll("a[data-page]").forEach((link) => {
    link.onclick = (e) => {
      e.preventDefault();
      openDrawer(false);
      loadPage(link.dataset.page);
    };
  });

  btnLogout.onclick = async () => {
    await window.Auth.logout();
    loadPage("dashboard");
  };

  // Tampilkan/sembunyikan menu admin sesuai peran.
  function applyMenuVisibility() {
    drawer.querySelectorAll("[data-admin-only]").forEach((el) => {
      el.classList.toggle("hidden", !window.Auth.isAdmin());
    });
    btnLogout.classList.toggle("hidden", !window.Auth.isLoggedIn());
  }

  // Maskot: bisa digeser (pointer), tanpa animasi. Ketuk = buka menu, bukan geser.
  (function setupMascot() {
    const mascot = document.getElementById("mascot");
    const menu = document.getElementById("mascot-menu");
    let startX = 0, startY = 0, baseX = 0, baseY = 0, moved = 0, dragging = false;

    mascot.addEventListener("pointerdown", (e) => {
      dragging = true; moved = 0;
      startX = e.clientX; startY = e.clientY;
      const rect = mascot.getBoundingClientRect();
      baseX = rect.left; baseY = rect.top;
      mascot.setPointerCapture(e.pointerId);
    });
    mascot.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX, dy = e.clientY - startY;
      moved = Math.max(moved, Math.abs(dx) + Math.abs(dy));
      mascot.style.left = (baseX + dx) + "px";
      mascot.style.top = (baseY + dy) + "px";
      mascot.style.right = "auto";
      mascot.style.bottom = "auto";
    });
    mascot.addEventListener("pointerup", () => {
      dragging = false;
      // Hanya dianggap ketukan kalau hampir tidak digeser.
      if (moved < 8) menu.classList.toggle("hidden");
    });
    // "Tanya Admin" sekarang membuka Forum, karena Forum sudah jadi di Langkah 6.
    document.getElementById("btn-ask-admin").onclick = () => {
      menu.classList.add("hidden");
      if (window.loadPage) window.loadPage("forum");
      else document.getElementById("ask-admin-note").classList.remove("hidden");
    };
  })();

  // Fungsi utama pemuat halaman.
  async function loadPage(page) {
    // Belum ada koneksi Supabase -> arahkan ke halaman login dengan pesan jelas.
    if (!window.db) {
      app.innerHTML = '<div class="card"><h2>Supabase belum dikonfigurasi</h2>' +
        '<p class="muted">Isi <code>js/config.js</code> dengan URL dan anon key dari Supabase, ' +
        'lalu jalankan SQL di <code>supabase/schema.sql</code> dan <code>supabase/rls.sql</code>.</p></div>';
      return;
    }
    await window.Auth.load();
    applyMenuVisibility();

    // Belum login -> tampilkan login.
    if (!window.Auth.isLoggedIn()) {
      const res = await fetch("pages/login.html");
      app.innerHTML = await res.text();
      bindLoginForm();
      return;
    }

    // Masih menunggu persetujuan -> kunci semua menu, tampilkan status saja.
    if (window.Auth.isWaiting()) {
      app.innerHTML = '<div class="card"><h2>⏳ Menunggu persetujuan admin</h2>' +
        '<p>Halo, <b>' + (window.Auth.profile.nama_lengkap || "") + '</b>.</p>' +
        '<p class="muted">Pendaftaranmu sudah diterima. Kamu bisa membuka data komunitas ' +
        'setelah admin menyetujuinya. Silakan cek lagi nanti.</p></div>';
      return;
    }

    // Admin saja untuk Operator dan Import.
    if (ADMIN_PAGES.includes(page) && !window.Auth.isAdmin()) {
      app.innerHTML = '<div class="card"><h2>Halaman admin</h2>' +
        '<p class="muted">Halaman ini hanya bisa diakses admin yang sudah disetujui.</p></div>';
      return;
    }

    // Muat halaman yang diminta; kalau belum dibuat (langkah berikutnya),
    // tampilkan pesan "menyusul" supaya aplikasi tidak rusak.
    try {
      const res = await fetch("pages/" + page + ".html");
      if (!res.ok) throw new Error("belum ada");
      app.innerHTML = await res.text();
      document.querySelectorAll(".drawer a").forEach((a) =>
        a.classList.toggle("active", a.dataset.page === page));
      if (page === "dashboard" && window.Dashboard) window.Dashboard.init();
      if (page === "members" && window.Members) window.Members.init();
      if (page === "attendance" && window.Attendance) window.Attendance.init();
      if (page === "gallery" && window.Gallery) window.Gallery.init();
      if (page === "forum" && window.Forum) window.Forum.init();
      if (page === "map" && window.MemberMap) window.MemberMap.init();
      if (page === "regions" && window.Regions) window.Regions.init();
      if (page === "operators" && window.Operators) window.Operators.init();
      if (page === "import" && window.ImportDB) window.ImportDB.init();
      if (page === "admin" && window.AdminPage) window.AdminPage.init();
    } catch (e) {
      app.innerHTML = '<div class="card"><h2>Menu ini menyusul</h2>' +
        '<p class="muted">Halaman ini akan dibuat pada langkah berikutnya, satu menu per langkah.</p>' +
        '<a class="btn secondary" href="#" onclick="event.preventDefault();">Kembali ke Dashboard</a></div>';
    }
    window.scrollTo(0, 0);
  }

  // Formulir login/daftar di pages/login.html.
  function bindLoginForm() {
    const formLogin = document.getElementById("form-login");
    const formRegister = document.getElementById("form-register");
    const msg = document.getElementById("auth-msg");
    const showMsg = (text, ok) => {
      msg.textContent = text;
      msg.className = ok ? "success" : "error";
      msg.classList.remove("hidden");
    };
    document.getElementById("show-register").onclick = () => {
      formLogin.classList.add("hidden");
      formRegister.classList.remove("hidden");
    };
    document.getElementById("show-login").onclick = () => {
      formRegister.classList.add("hidden");
      formLogin.classList.remove("hidden");
    };
    formLogin.onsubmit = async (e) => {
      e.preventDefault();
      try {
        await window.Auth.login(
          document.getElementById("login-email").value.trim(),
          document.getElementById("login-password").value
        );
        loadPage("dashboard");
      } catch (err) { showMsg("Login gagal: " + err.message, false); }
    };
    formRegister.onsubmit = async (e) => {
      e.preventDefault();
      try {
        await window.Auth.register(
          document.getElementById("reg-nama").value.trim(),
          document.getElementById("reg-email").value.trim(),
          document.getElementById("reg-password").value
        );
        showMsg("Pendaftaran berhasil. Statusmu: menunggu persetujuan admin.", true);
      } catch (err) { showMsg("Pendaftaran gagal: " + err.message, false); }
    };
  }

  // Halaman pertama saat aplikasi dibuka.
  loadPage("dashboard");
  // Supaya tombol "Kembali ke Dashboard" di pesan menyusul bisa dipakai dari HTML lain.
  window.loadPage = loadPage;
})();
