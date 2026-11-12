import { S } from './state.js';
import { createSupabaseDb, createLocalDb } from './supabase.js';
import { SUPABASE_CONFIG } from './config.js';
import { loadMessages, subscribeToMessages } from './messages.js';
import { loadMapSettings, loadPendingUsers } from './map.js';
import { startDataSubscriptions, stopDataSubscriptions, render } from './views.js';

(async () => {
  try {
    S.uid = localStorage.getItem('uid');
    if (!S.uid) {
      S.uid = 'u' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem('uid', S.uid);
    }
  } catch (e) {
    S.uid = 'u' + Math.random().toString(36).slice(2);
  }
  try { S.assets = await claude.use('assets') } catch (e) { }
  try { S.legacyDb = await claude.use('db') } catch (error) { console.warn('Database lama aplikasi tidak tersedia untuk impor:', error) }

  if (window.supabase && window.SUPABASE_CONFIG?.url && window.SUPABASE_CONFIG?.anonKey) {
    S.supabase = window.supabase.createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey);
    S.db = createSupabaseDb(S.supabase);
    const applySession = async session => {
      if (!session?.user && S.messageChannel) {
        await S.supabase.removeChannel(S.messageChannel);
        S.messageChannel = null;
      }
      stopDataSubscriptions();
      const nextUid = session?.user?.id || null;
      if (S.uid !== nextUid) {
        S.members = []; S.events = []; S.topics = []; S.cleaningDuties = []; S.musyawarah = []; S.pins = [];
        S.storageErrors = {}; S.memberMediaUrls.clear(); S.memberMediaPending.clear();
        S.memberMediaFailed.clear(); S.legacyMediaPaths.clear(); S.memberMediaError = '';
      }
      S.uid = nextUid;
      S.email = session?.user?.email || '';
      S.admin = false;
      S.mainAdmin = false;
      S.approvalStatus = 'approved';
      if (session?.user) {
        const { data: profile } = await S.supabase.from('profiles').select('name,role,is_main_admin,approval_status').eq('id', session.user.id).maybeSingle();
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
      S.authLoading = false;
      render();
    };
    const { data: { session } } = await S.supabase.auth.getSession();
    await applySession(session);
    S.supabase.auth.onAuthStateChange((_event, next) => { applySession(next) });
    setInterval(() => { if (S.uid) loadMessages(); if (S.mainAdmin) loadPendingUsers() }, 30000);
  } else {
    S.db = S.legacyDb;
    if (!S.db) S.db = createLocalDb();
    S.authLoading = false;
    startDataSubscriptions();
    render();
  }
})();