/* Titik awal aplikasi: siapkan Supabase, baca sesi login, lalu gambar halaman */
render();
(async () => {
  // ID sementara bila belum login (dipakai mode lokal saja)
  try {
    S.uid = localStorage.getItem('uid');
    if (!S.uid) { S.uid = 'u' + Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('uid', S.uid); }
  } catch (e) { S.uid = 'u' + Math.random().toString(36).slice(2); }

  const hasSupabase = window.supabase && window.SUPABASE_CONFIG?.url && window.SUPABASE_CONFIG?.anonKey;
  if (!hasSupabase) {
    // Tanpa Supabase: pakai penyimpanan lokal di perangkat (mode uji coba)
    S.db = createLocalDb();
    S.authLoading = false;
    startDataSubscriptions();
    render();
    return;
  }

  try {
    S.supabase = window.supabase.createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey);
    S.db = createSupabaseDb(S.supabase);

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
          S.tanya = []; S.replies = []; S.messageSignature = ''; S.unreadMessages = 0;
          S.storageErrors = {}; S.memberMediaUrls.clear(); S.memberMediaPending.clear();
          S.memberMediaFailed.clear(); S.legacyMediaPaths.clear(); S.memberMediaError = '';
        }
        S.uid = nextUid; S.email = session?.user?.email || '';
        S.admin = false; S.mainAdmin = false; S.approvalStatus = 'approved';
        if (session?.user) {
          const { data: profile, error } = await S.supabase.from('profiles').select('name,role,is_main_admin,approval_status').eq('id', session.user.id).maybeSingle();
          if (error) console.error('Profil tidak dapat dibaca:', error);
          S.admin = profile?.role === 'admin';
          S.name = profile?.name || session.user.email || '';
          S.mainAdmin = S.admin && profile?.is_main_admin === true;
          S.approvalStatus = profile?.approval_status || 'pending';
          await loadMessages();
          await subscribeToMessages();
        }
        await loadMapSettings();
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

    const { data: { session } } = await S.supabase.auth.getSession();
    await applySession(session);
    // Abaikan kejadian yang tidak mengubah siapa yang login (hindari muat ulang data berulang)
    S.supabase.auth.onAuthStateChange((event, next) => {
      if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return;
      applySession(next);
    });
    // Daftar pendaftar baru diperiksa berkala; pesan memakai realtime (tanpa polling)
    setInterval(() => { if (S.mainAdmin) loadPendingUsers().then(render); }, 60000);
  } catch (error) {
    console.error('Supabase gagal diinisialisasi, memakai penyimpanan lokal:', error);
    S.supabase = null;
    S.db = createLocalDb();
    S.authLoading = false;
    startDataSubscriptions();
    render();
  }
})();
