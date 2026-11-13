import { S } from './state.js';
import { h } from './dom.js';
import { $ } from './dom.js';
import { icon } from './icons.js';
import { setRender, scheduleRender } from './core.js';
import { WILAYAH, ALL, ADMIN_MENU } from './utils.js';
import { vHome, vDash, vMembers, detailCard, memberFormCard, saveForm, vForum } from './members.js';
import { vActivity, vKegiatan, activityCard, guard } from './activities.js';
import { vPesan } from './messages.js';
import { accountForm } from './auth.js';
import { vPeta, vPetaSettings, vPetaLegacy, vApprovals, loadMapSettings, loadPendingUsers } from './map.js';

export const V = {
  landing: vHome,
  dash: vDash,
  members: vMembers,
  kegiatan: vKegiatan,
  piket: () => [h('h1', {}, 'Jadwal Piket'), h('p', { class: 'sub' }, 'Jadwal kebersihan komunitas.')],
  peta: vPeta,
  forum: vForum,
  'map-settings': vPetaSettings,
  approvals: vApprovals,
  pesan: vPesan,
};

export function renderDrawer() {
  const d = $('#dr');
  if (S.adminMenuOpen) {
    d.replaceChildren(
      h('p', { class: 'sub', style: 'padding:0 14px' }, h('b', { style: 'color:var(--ink)' }, 'PENGATURAN ADMIN'), h('br'), 'Pengelolaan situs'),
      ...ADMIN_MENU.map(([view, label, glyph]) => h('a', { class: S.view === view ? 'on' : '', onclick: () => go(view) }, icon(glyph), h('span', {}, label))),
      h('button', { class: 'menu-logout', onclick: () => go('landing') }, icon('back', 17), h('span', {}, 'Kembali ke menu utama'))
    );
    return;
  }
  d.replaceChildren(h('p', { class: 'sub', style: 'padding:0 14px' }, h('b', { style: 'color:var(--ink)' }, 'KOMUNITAS ID-JP'), h('br'), 'Database Anggota'),
    ...ALL.filter(x => !x[2] || (x[3] ? S.mainAdmin : S.admin)).map(x => h('a', { class: S.view === x[0] ? 'on' : '', onclick: () => go(x[0]), ...(x[0] === 'pesan' ? { 'data-message-nav': 'true' } : {}) },
      icon(x[4], 19), h('span', {}, x[1]), x[0] === 'pesan' && S.unreadMessages > 0 && h('span', { class: 'nav-badge' }, String(S.unreadMessages)))),
    h('button', { class: 'menu-logout', onclick: async () => { await S.supabase.auth.signOut() } }, icon('logout', 17), h('span', {}, 'Keluar')));
}

export function syncAdminTheme() {
  if (S.mainAdmin) document.body.classList.add('admin-dark');
  else document.body.classList.remove('admin-dark');
}

export function render() {
  // Ensure default view on fresh load
  if (S.authLoading || !S.uid) S.view = 'landing';
  if (S.activityScannerStop) S.activityScannerStop();
  if (!S.mainAdmin) S.adminMenuOpen = false;
  syncAdminTheme();
  if (S.authLoading) {
    $('#dr').replaceChildren();
    $('#app').replaceChildren(h('p', { class: 'warn', style: 'text-align:center;padding:40px 16px' }, 'Memeriksa sesi login...'));
    $('#tb').style.display = 'none';
    $('#pet').style.display = 'none';
    $('#sw').style.display = 'none';
    return;
  }
  if (S.supabase && !S.uid) {
    $('#dr').replaceChildren();
    $('#app').replaceChildren(h('div', { class: 'landing' }, h('section', { class: 'hero' },
      h('p', { style: 'font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-bottom:10px' }, 'SHIKOKU FAMILY'),
      h('h1', {}, 'Selamat datang!'),
      h('p', {}, 'Silakan masuk atau buat akun untuk bergabung dan menerima balasan dari admin.'),
      accountForm()
    )));
    $('#tb').style.display = 'none';
    $('#pet').style.display = 'none';
    $('#sw').style.display = 'none';
    document.body.classList.remove('open');
    return;
  }
  if (S.supabase && S.uid && S.approvalStatus !== 'approved' && !S.admin) {
    $('#dr').replaceChildren();
    const status = S.approvalStatus === 'rejected' ? 'Akun ini ditolak admin.' : 'Akun ini belum disetujui admin.';
    $('#app').replaceChildren(h('section', { class: 'card auth-card' }, h('b', {}, status), h('p', { class: 'sub' }, 'Data anggota, kegiatan, dan wilayah hanya dimuat setelah akun disetujui. Hubungi admin utama untuk memeriksa status akun.'), h('button', { class: 'btn', onclick: async () => { await S.supabase.auth.signOut() } }, 'Keluar')));
    $('#tb').style.display = 'none';
    $('#pet').style.display = 'none';
    $('#sw').style.display = 'none';
    document.body.classList.remove('open');
    return;
  }
  renderDrawer();
  $('#sw').style.display = S.mainAdmin ? 'flex' : 'none';
  const approvalBadge = $('#ab');
  if (approvalBadge) {
    approvalBadge.textContent = S.pendingUsers.length ? String(S.pendingUsers.length) : '';
    approvalBadge.style.display = S.pendingUsers.length ? 'inline-grid' : 'none';
  }
  const current = ALL.find(x => x[0] === S.view);
  if (!V[S.view] || (['map-settings', 'approvals'].includes(S.view) && !S.mainAdmin) || (current && current[2] && !S.admin)) S.view = 'landing';
  const content = [];
  const storageErrors = Object.values(S.storageErrors || {});
  if (storageErrors.length) content.push(h('p', { class: 'warn storage-warning' }, 'Database bersama tidak dapat dibaca: ' + storageErrors.join(' · ') + ' Jalankan pembaruan skema Supabase, lalu muat ulang aplikasi.'));
  if (S.memberMediaError) content.push(h('p', { class: 'warn storage-warning' }, 'Media anggota: ' + S.memberMediaError));
  const legacyMediaCount = 0;
  if (S.admin && S.supabase && legacyMediaCount) content.push(h('section', { class: 'card storage-import' }, h('div', {}, h('b', {}, 'Pindahkan media anggota lama'), h('small', {}, legacyMediaCount + ' foto atau lampiran masih tersimpan di lokasi lama. File akan dipindahkan ke Supabase privat.')), h('button', { class: 'btn s', onclick: () => {} }, 'Pindahkan media')));
  content.push(...[].concat(V[S.view] ? V[S.view]() : []).filter(Boolean));
  $('#app').replaceChildren(...content);
  const tb = $('#tb');
  tb.style.display = S.form ? 'none' : 'flex';
  $('#pet').style.display = S.form ? 'none' : 'block';
}

export function go(view) {
  S.view = view;
  S.adminMenuOpen = false;
  render();
}

let dataUnsubscribers = [];
export function stopDataSubscriptions() {
  dataUnsubscribers.forEach(unsubscribe => { try { unsubscribe?.() } catch (error) { console.error('Gagal menghentikan subscription data:', error) } });
  dataUnsubscribers = [];
}

export function startDataSubscriptions() {
  stopDataSubscriptions();
  if (!S.db) return;
  dataUnsubscribers = [];
}

setRender(render);