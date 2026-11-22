/* Titik awal aplikasi: siapkan Supabase, baca sesi login, lalu gambar halaman */
render();
(async () => {
  // ID sementara bila belum login (dipakai mode lokal saja)
  try {
    S.uid = localStorage.getItem('uid');
    if (!S.uid) { S.uid = 'u' + Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('uid', S.uid); }
  } catch (e) { S.uid = 'u' + Math.random().toString(36).slice(2); }

  // Mode lokal sudah dihapus: flag lama 'shikoku-family:force-local' yang
  // mungkin tertinggal di peramban selalu dibersihkan dan diabaikan.
  // Selama konfigurasi Supabase ada, aplikasi SELALU memakai jalur online.
  try { localStorage.removeItem('shikoku-family:force-local'); } catch (e) {}
  const supabaseReady = Boolean(window.supabase && window.SUPABASE_CONFIG?.url && window.SUPABASE_CONFIG?.anonKey);
  const hasSupabase = supabaseReady;
  // Sesi lokal (jalan pintas admin utama perangkat ini) yang masih tersimpan
  // dipulihkan lebih dulu, sebelum jalur online disiapkan: muat ulang
  // halaman TIDAK mengembalikan pengguna ke pintu masuk, dan render()
  // membuka lagi halaman terakhir yang tersimpan. Tanpa pemulihan ini,
  // sesi lokal hanya hidup di ingatan sehingga setiap muat ulang selalu
  // berakhir di halaman masuk. Sesi Supabase tidak disentuh jalur ini —
  // ia hanya berjalan bila id sesi lokal memang ada di perangkat.
  if (restoreLocalSession()) {
    S.localMode = true;
    S.db = createLocalDb();
    S.authLoading = false;
    startDataSubscriptions();
    try { await loadPendingUsers(); } catch (e) { console.error('Daftar persetujuan lokal gagal dimuat:', e); }
    try { await loadMessages(); } catch (e) { console.error('Pesan lokal gagal dimuat:', e); }
    render();
    return;
  }
  if (!hasSupabase) {
    // Tanpa Supabase: pakai penyimpanan lokal di perangkat (mode uji coba),
    // dengan sesi akun lokal agar alur masuk/persetujuan tetap berjalan penuh
    S.db = createLocalDb();
    S.uid = null;
    restoreLocalSession();
    S.authLoading = false;
    startDataSubscriptions();
    await loadPendingUsers();
    if (S.uid) await loadMessages();
    render();
    return;
  }

  try {
    S.supabase = window.supabase.createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey);
    S.db = createSupabaseDb(S.supabase);

    /* Id pengguna dari sesi yang SUDAH diterapkan pada muatan halaman ini
       (undefined = belum ada sesi yang diterapkan, null = keadaan belum
       masuk sudah diterapkan). Pendengar sesi memakainya untuk membedakan
       kejadian yang benar-benar mengubah siapa yang masuk dari kejadian
       pengulangan / penyegaran token yang tidak mengubah apa pun. */
    let appliedUid;
    /* Sesi awal dari kejadian INITIAL_SESSION: sumber pemulihan KEDUA di
       samping getSession(). Keduanya membaca penyimpanan sesi yang sama,
       tetapi getSession() bisa sesaat mengembalikan sesi kosong ketika
       token tersimpan sedang diperbarui (balapan penyegaran token — mis.
       situs yang sama terbuka di tab/jendela lain pada peramban laptop),
       sementara INITIAL_SESSION membawa sesi hasil pemulihan yang benar.
       Muat ulang tidak boleh menyimpulkan "belum masuk" hanya dari satu
       sumber yang sedang kosong sesaat. */
    let bootSessionSettled = false, bootSessionValue = null, settleBootSession = () => {};
    const bootSessionPromise = new Promise(resolve => {
      settleBootSession = session => {
        if (bootSessionSettled) return;
        bootSessionSettled = true; bootSessionValue = session; resolve(session);
      };
    });

    // Dipanggil setiap kali status login berubah (masuk / keluar)
    const applySession = async session => {
      try {
        if (!session?.user && S.messageChannel) {
          await S.supabase.removeChannel(S.messageChannel);
          S.messageChannel = null;
        }
        stopDataSubscriptions();
        const nextUid = session?.user?.id || null;
        if (S.uid !== nextUid) {
          S.members = []; S.events = []; S.topics = []; S.cleaningDuties = []; S.pins = [];
          S.keuangan = []; S.kategoriCustom = []; S.financeForm = null; S.financePhoto = null;
          S.tanya = []; S.replies = []; S.messageSignature = ''; S.unreadMessages = 0;
          S.storageErrors = {}; S.memberMediaUrls.clear(); S.memberMediaPending.clear();
          S.memberMediaFailed.clear(); S.legacyMediaPaths.clear(); S.memberMediaError = '';
        }
        S.uid = nextUid; appliedUid = nextUid; S.email = session?.user?.email || '';
        S.admin = false; S.mainAdmin = false; S.approvalStatus = 'approved';
        if (session?.user) {
          /* Baca profil dengan satu kali pengulangan bila bacaan pertama
             gagal (jaringan/token sesaat): kegagalan baca TIDAK boleh
             menurunkan pengguna yang sebenarnya sudah disetujui ke
             layar menunggu hanya karena satu permintaan gagal. */
          let profile = null, profileError = null;
          for (let attempt = 0; attempt < 2; attempt++) {
            const res = await S.supabase.from('profiles').select('name,role,is_main_admin,approval_status').eq('id', session.user.id).maybeSingle();
            profile = res.data; profileError = res.error;
            if (!profileError) break;
            console.error('Profil tidak dapat dibaca:', profileError);
            await new Promise(r => setTimeout(r, 700));
          }
          S.admin = profile?.role === 'admin';
          S.name = profile?.name || session.user.email || '';
          S.mainAdmin = S.admin && profile?.is_main_admin === true;
          S.approvalStatus = profile?.approval_status || 'pending';
          await loadMessages();
          await subscribeToMessages();
        }
        await loadPendingUsers();
        if (session?.user && (S.approvalStatus === 'approved' || S.admin)) startDataSubscriptions();
      } catch (error) {
        console.error('Gagal menyiapkan sesi login:', error);
        S.storageErrors.session = error.message || 'Sesi login tidak dapat disiapkan';
      } finally {
        S.authLoading = false;
        render();
      }
    };

    /* Pendengar sesi dipasang SEBELUM sesi awal dibaca, supaya tidak ada
       kejadian sesi yang terlewat selama pembacaan awal berjalan. */
    S.supabase.auth.onAuthStateChange((event, next) => {
      if (event === 'INITIAL_SESSION') { settleBootSession(next); return; }
      if (event === 'TOKEN_REFRESHED') {
        /* Penyegaran token untuk pengguna yang sama tidak mengubah apa
           pun. Tetapi bila aplikasi sedang berada di gerbang masuk (belum
           ada sesi yang diterapkan) dan penyegaran token di latar
           menghasilkan sesi — keadaan yang sebelumnya membuat pengguna
           terkunci di gerbang masuk walau sesinya masih berlaku — sesi
           itulah yang memulihkannya. */
        if (next?.user && appliedUid === null) applySession(next);
        return;
      }
      if (event === 'SIGNED_OUT') { applySession(null); return; }
      if (next?.user) {
        /* SIGNED_IN / pemulihan sesi untuk pengguna yang belum diterapkan */
        if (appliedUid !== next.user.id) applySession(next);
        return;
      }
      /* Kejadian tanpa sesi selain SIGNED_OUT tidak meruntuhkan sesi yang
         sedang berjalan; keadaan belum masuk hanya diterapkan dari
         pembacaan awal di bawah. */
      if (appliedUid === undefined) applySession(null);
    });
    const { data: { session } } = await S.supabase.auth.getSession();
    /* Ambil sesi pertama yang tidak kosong dari kedua sumber pemulihan
       (getSession + INITIAL_SESSION). Hanya bila keduanya kosong pengguna
       benar-benar belum masuk. Batas tunggu 6 detik hanya berjalan bila
       INITIAL_SESSION belum juga tiba; biasanya ia tiba seketika. */
    let initialSession = session;
    if (!initialSession) {
      initialSession = bootSessionSettled ? bootSessionValue
        : await Promise.race([bootSessionPromise, new Promise(resolve => setTimeout(() => resolve(null), 6000))]);
    }
    await applySession(initialSession || null);
    // Daftar pendaftar baru diperiksa berkala; pesan memakai realtime (tanpa polling)
    setInterval(() => { if (S.admin) loadPendingUsers().then(() => renderDariData()); }, 60000);
  } catch (error) {
    console.error('Supabase gagal diinisialisasi, memakai penyimpanan lokal:', error);
    S.supabase = null;
    S.db = createLocalDb();
    S.uid = null;
    restoreLocalSession();
    S.authLoading = false;
    startDataSubscriptions();
    await loadPendingUsers();
    if (S.uid) await loadMessages();
    render();
  }
})();
