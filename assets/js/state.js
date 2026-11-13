export const S = {
  members: [], events: [], topics: [], cleaningDuties: [], musyawarah: [],
  view: 'landing', openConversation: null, messageSignature: '', admin: false,
  mainAdmin: false, adminMenuOpen: false, uid: null, email: '', name: '',
  approvalStatus: 'approved', pendingUsers: [], mapError: '',
  storageErrors: {}, memberMediaUrls: new Map(), memberMediaPending: new Set(),
  memberMediaFailed: new Set(), legacyMediaPaths: new Map(), memberMediaError: '',
  memberUploadState: null, activityScannerStop: null, activityFeedback: null,
  db: null, legacyDb: null, supabase: null, messageChannel: null,
  authLoading: true, unreadMessages: 0
};
try {
  localStorage.removeItem('shikoku-family:visit-consent');
  sessionStorage.removeItem('shikoku-family:visit-location-jp-postal-v1');
<<<<<<< HEAD
} catch (e) { console.warn(e); }
=======
} catch (e) { console.warn(e); }
>>>>>>> 31d1cb3bacd52cac8c712c9427905b1ca6826c39
