/* Titik awal aplikasi: siapkan Supabase, baca sesi login, lalu gambar halaman */
/* Batas waktu untuk langkah jaringan saat aplikasi dibuka: janji yang
   dibungkus fungsi ini TIDAK PERNAH menggantung selamanya — bila dalam
   ms milidetik belum selesai (atau gagal), hasilnya dianggap kosong
   (null) dan pemanggil melanjutkan dengan keadaan cadangannya. Tanpa
   batas ini, satu permintaan yang macet — mis. penyegaran token sesi
   lewat koneksi HP yang setengah terbuka sesudah aplikasi ditutup —
   membuat layar 'Memeriksa sesi login...' bertahan selamanya, karena
   S.authLoading tidak pernah dicabut. */
function denganBatasWaktu(janji, ms) {
  let timer = null;
  const batas = new Promise(resolve => { timer = setTimeout(() => resolve(null), ms); });
  return Promise.race([Promise.resolve(janji).catch(() => null), batas])
    .then(hasil => { clearTimeout(timer); return hasil; });
}
render();
(async () => {
  /* Pengawas terakhir muatan awal: apa pun yang terjadi pada langkah
     pemeriksaan sesi di bawah, layar 'Memeriksa sesi login...' tidak
     boleh bertahan lebih dari 20 detik. Bila batas ini tercapai,
     halaman digambar dengan keadaan sesi yang sudah sempat terbaca
     (masuk -> Home, belum -> formulir masuk); langkah yang masih
     berjalan di latar tetap menyelesaikan gambarannya sendiri lewat
     render() di akhir applySession. */
  setTimeout(() => {
    if (!S.authLoading) return;
    console.error('Pemeriksaan sesi login melewati batas 20 detik; halaman ditampilkan dengan keadaan sesi yang sudah ada.');
    S.authLoading = false;
    render();
  }, 20000);
  // ID sementara bila belum login (dipakai mode lokal saja)
  try {
    S.uid = localStorage.getItem('uid');
    if (!S.uid) { S.uid = 'u' + Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('uid', S.uid); }
  } catch (e) { S.uid = 'u' + Math.random().toString(36).slice(2); }

  // Mode lokal sudah dihapus: flag lama 'shikoku-family:force-local' yang
  // mungkin tertinggal di peramban selalu dibersihkan dan diabaikan.
  // Selama konfigurasi Supabase ada, aplikasi SELALU memakai jalur online.
  try { localStorage.removeItem('shikoku-family:force-local'); } catch (e) {}
  // Bersihkan sisa pintu masuk lokal lama SEKALI per perangkat — id
  // sesi lokal tersimpan dibuang, catatan kata sandi pintu lama dan
  // akun khusus pintu itu dihapus (lihat auth.js). Sesudah ini tidak
  // ada sesi lokal lama yang bisa mendahului sesi Supabase.
  try { bersihkanWarisanPintuLama(); } catch (e) { console.error('Pembersihan warisan pintu lama gagal (diabaikan):', e); }
  const supabaseReady = Boolean(window.supabase && window.SUPABASE_CONFIG?.url && window.SUPABASE_CONFIG?.anonKey);
  const hasSupabase = supabaseReady;
  // SESI SUPABASE SELALU DIDAHULUKAN: sesi lokal TIDAK dipulihkan di
  // awal pada jalur online — pemulihan sesi lokal hanya terjadi pada
  // jalur TANPA Supabase di bawah, tidak pernah mendahului sesi
  // Supabase yang sah.
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
          /* Penutupan kanal realtime diberi batas waktu: soket yang
             sedang bermasalah bisa membuat removeChannel tidak pernah
             selesai, dan itu tidak boleh menahan pemeriksaan sesi. */
          await denganBatasWaktu(S.supabase.removeChannel(S.messageChannel), 3000);
          S.messageChannel = null;
        }
        stopDataSubscriptions();
        const nextUid = session?.user?.id || null;
        if (S.uid !== nextUid) {
          S.members = []; S.events = []; S.topics = []; S.cleaningDuties = []; S.pins = [];
          S.keuangan = []; S.kategoriCustom = []; S.financeForm = null; S.financePhoto = null;
          S.inventaris = []; S.inventarisForm = null; S.inventarisPhoto = null; S.inventarisDetail = null; S.inventarisConfirm = null;
          S.tanya = []; S.replies = []; S.messageSignature = ''; S.unreadMessages = 0;
          S.openConversation = null; S.newChat = null; S.userDirectory = []; S.directoryLoaded = false;
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
            /* Tiap percobaan dibatasi 6 detik: permintaan profil yang
               macet dihitung sebagai bacaan gagal (lalu dicoba sekali
               lagi), bukan menggantungkan pemeriksaan sesi selamanya. */
            const res = await denganBatasWaktu(S.supabase.from('profiles').select('name,role,is_main_admin,approval_status').eq('id', session.user.id).maybeSingle(), 6000);
            if (res) { profile = res.data; profileError = res.error; }
            else { profile = null; profileError = { message: 'Batas waktu membaca profil tercapai' }; }
            if (!profileError) break;
            console.error('Profil tidak dapat dibaca:', profileError);
            await new Promise(r => setTimeout(r, 700));
          }
          S.admin = profile?.role === 'admin';
          S.name = profile?.name || session.user.email || '';
          S.mainAdmin = S.admin && profile?.is_main_admin === true;
          S.approvalStatus = profile?.approval_status || 'pending';
          /* Pesan & langganan realtime BUKAN syarat masuk: keduanya
             diberi batas waktu supaya muatan pesan yang macet tidak
             menahan dibukanya aplikasi; pesan tetap tiba belakangan
             lewat kejadian realtime / pemuatan berikutnya. */
          await denganBatasWaktu(loadMessages(), 8000);
          await denganBatasWaktu(subscribeToMessages(), 5000);
          /* Langganan notifikasi push (admin & pengurus): bila izin
             SUDAH pernah diberikan, langganannya diperbarui otomatis
             di latar — tidak ditunggu dan tidak pernah meminta izin,
             jadi tidak bisa menahan pemeriksaan sesi. */
          if (typeof pushPerbaruiLanggananOtomatis === 'function') void pushPerbaruiLanggananOtomatis();
        }
        await denganBatasWaktu(loadPendingUsers(), 8000);
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
    /* getSession() diberi batas waktu 6 detik: bila token tersimpan
       harus disegarkan dan permintaan penyegarannya macet di jaringan
       (kejadian khas saat aplikasi dibuka lagi di HP), getSession
       tidak pernah selesai — dahulu inilah yang membuat aplikasi
       berhenti di 'Memeriksa sesi login...' setiap dibuka lagi. Bila
       batas tercapai, sesi dianggap belum terbaca dan sumber
       pemulihan kedua (INITIAL_SESSION) yang memutuskan; bila sesi
       akhirnya tiba belakangan, pendengar sesi di atas tetap
       menerapkannya (jalur TOKEN_REFRESHED / SIGNED_IN). */
    const hasilSesi = await denganBatasWaktu(S.supabase.auth.getSession(), 6000);
    const session = hasilSesi?.data?.session || null;
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
