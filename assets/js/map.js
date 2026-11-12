import { S } from './state.js';
import { h } from './dom.js';
import { $ } from './dom.js';
import { icon } from './icons.js';
import { scheduleRender, box, memberRegion } from './utils.js';
import { accountForm } from './auth.js';

export function alamatJp(m, det) {
  return [det ? m.alamat_jp : '', m.kec_jp, m.kota, m.pref || m.wilayah, m.kodepos, 'Japan'].filter(Boolean).join(', ');
}

export function mapMid() {
  const d = (S.pengaturan || []).find(x => x.id === 'peta');
  return d && d.mid;
}

export function mapEmbedUrl(mid) {
  return 'https://www.google.com/maps/d/embed?mid=' + encodeURIComponent(mid);
}

export async function loadMapSettings() {
  if (!S.supabase) return;
  const { data, error } = await S.supabase.from('map_settings').select('map_mid').eq('id', 'main').maybeSingle();
  if (error) { console.error(error); S.mapError = error.message || 'Konfigurasi peta tidak dapat dibaca'; S.pengaturan = []; return }
  S.mapError = '';
  S.pengaturan = data ? [{ id: 'peta', mid: data.map_mid }] : [];
}

export async function loadPendingUsers() {
  if (!S.supabase || !S.mainAdmin) { S.pendingUsers = []; return }
  const { data, error } = await S.supabase.from('profiles').select('id,name,email,created_at,approval_status').eq('approval_status', 'pending').order('created_at', { ascending: true });
  if (error) { console.error(error); S.pendingUsers = []; return }
  S.pendingUsers = data || [];
}

export function csvEsc(v) {
  v = String(v == null ? '' : v);
  return (v.includes(',') || v.includes('"') || v.includes(String.fromCharCode(10))) ? '"' + v.split('"').join('""') + '"' : v;
}

export async function exportMyMaps(det) {
  const dl = await claude.use('downloads');
  if (!dl) { alert('Fitur unduh belum tersedia'); return }
  const rows = [['Nama', 'Wilayah', 'Alamat', 'Status', 'Kode']].concat(S.members.map((m, i) => [m.panggilan || m.nama, m.wilayah || m.pref || '', alamatJp(m, det), m.status || 'aktif', m.kode || 'MEM-' + String(i + 1).padStart(5, '0')]).filter(
    row => row[2] && row[2] !== 'Japan'
  ));
  const csv = rows.map(r => r.map(csvEsc).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'shikoku-family-members.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

export async function saveMid(inp) {
  if (!S.supabase || !S.mainAdmin) return;
  const mid = inp.value.trim();
  if (!mid) { clearMap(); return }
  const { error } = await S.supabase.from('map_settings').upsert({ id: 'main', map_mid: mid });
  if (error) { alert('Gagal menyimpan peta: ' + error.message); return }
  await loadMapSettings();
  scheduleRender();
}

export async function clearMap() {
  if (!S.supabase || !S.mainAdmin) return;
  const { error } = await S.supabase.from('map_settings').delete().eq('id', 'main');
  if (error) { alert('Gagal menghapus peta: ' + error.message); return }
  S.pengaturan = [];
  S.mapError = '';
  scheduleRender();
}

export async function setApproval(id, status) {
  if (!S.supabase || !S.mainAdmin) return;
  const { error } = await S.supabase.from('profiles').update({
    approval_status: status,
    approved_at: status === 'approved' ? new Date().toISOString() : null
  }).eq('id', id);
  if (error) { alert('Gagal memperbarui persetujuan: ' + error.message); return }
  await loadPendingUsers();
  scheduleRender();
}

export function vApprovals() {
  if (!S.mainAdmin) return [h('p', { class: 'warn' }, 'Halaman ini hanya dapat diakses admin utama.')];
  const rows = S.pendingUsers.map(user => h('div', { class: 'card approval-row' },
    h('div', { style: 'flex:1;min-width:0' }, h('b', {}, user.name || 'Nama belum diisi'), h('small', {}, user.email || '-'), h('small', {}, new Date(user.created_at).toLocaleString('id-ID'))),
    h('div', { class: 'fl' }, h('button', { class: 'btn', onclick: () => setApproval(user.id, 'approved') }, 'Setujui'), h('button', { class: 'btn s', onclick: () => setApproval(user.id, 'rejected') }, 'Tolak'))));
  return [h('h1', {}, 'Persetujuan Akun'), h('p', { class: 'sub' }, 'Pendaftar baru menunggu persetujuan admin.'), ...(rows.length ? rows : [h('p', { class: 'warn' }, 'Tidak ada pendaftar yang menunggu persetujuan.')])];
}

export function vPetaSettings() {
  const mid = mapMid();
  const det = h('input', { type: 'checkbox' });
  const inp = h('textarea', { rows: 4, placeholder: 'Tempel kode embed (iframe) dari Google My Maps' });
  inp.value = mid ? mapEmbedUrl(mid) : '';
  const ready = S.members.filter(m => { const a = alamatJp(m, false); return a && a !== 'Japan' }).length;
  return [h('h1', {}, 'Peta Wilayah'), h('p', { class: 'sub' }, ready + ' dari ' + S.members.length + ' anggota punya alamat Jepang untuk dijadikan pin'),
    S.mainAdmin && box(h('b', {}, 'Pasang & perbarui peta'),
      h('p', { class: 'warn' }, '1) Unduh CSV. 2) Buka mymaps.google.com, buat peta baru, pilih Impor, lalu unggah CSV. 3) Pilih kolom Alamat untuk posisi pin dan kolom Nama untuk judul. 4) Atur peta agar bisa dilihat publik. 5) Di My Maps klik menu titik tiga di samping judul peta, pilih "Sematkan di situs saya", salin kode HTML-nya, lalu tempel di kotak di bawah.'),
      h('label', { class: 'warn', style: 'display:block;margin:8px 0' }, det, ' Sertakan alamat jalan/gedung (lebih tepat, tetapi lebih sensitif)'),
      h('button', { class: 'btn', style: 'margin-bottom:10px', onclick: () => exportMyMaps(det.checked) }, '⬇️ Unduh CSV untuk My Maps (' + ready + ' pin)'),
      inp, h('div', { class: 'fl' }, h('button', { class: 'btn', onclick: () => saveMid(inp) }, 'Simpan peta'), h('button', { class: 'btn s', onclick: clearMap }, 'Hapus peta dari Beranda'))),
    h('b', { style: 'display:block;margin:6px 4px 10px' }, 'Sebaran per wilayah'), ...sebaran()];
}

export function sebaran() {
  const byRegion = {};
  S.members.forEach(m => {
    const r = memberRegion(m);
    if (!byRegion[r]) byRegion[r] = 0;
    byRegion[r]++;
  });
  return Object.entries(byRegion).map(([region, count]) => h('div', { class: 'sebaran-item' },
    h('span', {}, region), h('span', { class: 'sebaran-count' }, count + ' anggota')));
}

export const ISL = ['141.9,45.5 142.9,44.7 144.7,44 145.3,44.35 144.9,43.6 145.8,43.35 144.4,42.95 143.25,41.93 141.7,42.6 140.97,42.3 140.6,42.55 140.4,42.1 140.1,41.4 140.3,42.9 140.35,43.35 141,43.2 141.6,43.9 141.7,45.4', '140.9,41.5 141.4,41.4 141.5,40.5 142,39.6 141.6,38.9 141.5,38.3 141,38.2 141,37 140.6,36.4 140.87,35.7 140.1,35.5 139.8,35.6 139.65,35.4 139.6,35.15 139.15,35.25 138.85,34.6 138.85,35.1 138.2,34.6 137.7,34.65 137,34.6 136.9,35 136.8,34.5 136.9,34.3 136.2,33.45 135.77,33.43 135.15,33.85 135.4,34.6 134.7,34.75 133.95,34.55 132.4,34.3 131.4,33.95 130.9,33.95 131.4,34.4 132.1,34.9 133,35.5 134.2,35.55 135.3,35.5 136.1,35.65 136.1,36.1 136.6,36.6 137.35,37.5 137.2,36.8 138.2,37.2 139.05,37.95 139.8,38.95 140,39.7 139.7,39.95 140,40.2 139.9,40.8 140.35,41.25', '134.65,34.2 134,34.35 133,34.1 132.7,33.85 132.4,33.45 132,33.35 132.5,33.2 132.7,32.95 133,32.72 133.3,33.4 133.55,33.5 134.18,33.25 134.35,33.6 134.6,34.05', '130.95,33.95 131.65,33.25 131.9,32.95 131.45,31.9 130.65,31 130.2,31.15 130.2,32 130,32.3 130.5,32.75 129.85,32.75 129.7,33.15 129.9,33.5 130.4,33.6'];

export function px(o, a) {
  return [(o - 128) * 31.7, (46 - a) * 40];
}

export function sv(t, p, ...k) {
  const e = document.createElementNS('http://www.w3.org/2000/svg', t);
  for (const a in p) e.setAttribute(a, p[a]);
  k.forEach(c => e.append(c));
  return e;
}

export async function geo(txt, b, full) {
  const sm = await claude.use('sample');
  if (!sm) { alert('Fitur otomatis belum tersedia. Ketuk peta untuk menaruh pin.'); return }
  if (!(txt || '').trim()) return;
  b.disabled = true;
  b.textContent = 'Memproses...';
  try {
    const r = await sm.json('Dari teks berikut, tentukan lokasi di Jepang. Balas HANYA JSON: {\"nama\":\"\",\"alamat\":\"alamat lengkap rapi\",\"lat\":angka,\"lng\":angka}. lat/lng = perkiraan koordinat terbaik (desimal) dari alamat/kode pos/kota. Kosongkan nama jika tidak ada.\n\nTeks:\n' + txt);
    const d = S.dp;
    if (full && r.nama) d.nama = r.nama;
    if (full && r.alamat) d.alamat = r.alamat;
    if (isFinite(r.lat) && isFinite(r.lng) && r.lat !== null) { d.lat = String(r.lat); d.lng = String(r.lng) } else alert('Posisi tidak ditemukan. Ketuk peta untuk menaruh pin.');
  } catch (e) { alert('Gagal memproses') }
  scheduleRender();
}

export function vPetaLegacy() {
  const d = S.dp = S.dp || { nama: '', alamat: '', lat: '', lng: '' };
  const vb = S.vb = S.vb || [0, 0, 572, 640];
  const pins = S.pins || [];
  const svg = sv('svg', { viewBox: vb.join(' '), style: 'width:100%;height:min(70vh,560px);background:#dcecf5;border-radius:18px;touch-action:none;display:block' });
  ISL.forEach(s => svg.append(sv('path', { d: 'M' + s.split(' ').map(q => px(...q.split(',').map(Number)).join(',')).join('L') + 'Z', fill: '#f5f1e6', stroke: '#8fb4c9', 'stroke-width': 1.5, 'pointer-events': 'none' })));
  const r = 7 * vb[2] / 572;
  const dot = (la, ln, c, id, t) => {
    const [x, y] = px(+ln, +la);
    const e = sv('circle', { cx: x, cy: y, r: r, fill: c, stroke: '#fff', 'stroke-width': r / 4 });
    if (id) e.dataset.id = id;
    if (t) e.append(sv('title', {}, t));
    svg.append(e);
  };
  pins.forEach(p => isFinite(p.lat) && dot(p.lat, p.lng, S.sp === p.id ? '#17324d' : '#d9455f', p.id, p.nama));
  if (d.lat !== '' && d.lng !== '' && isFinite(d.lat) && isFinite(d.lng)) dot(d.lat, d.lng, '#f59e0b', null, 'Posisi baru');
  let dn = null;
  svg.onpointerdown = e => { dn = { x: e.clientX, y: e.clientY, m: false } };
  svg.onpointermove = e => {
    if (!dn) return;
    const dx = e.clientX - dn.x, dy = e.clientY - dn.y;
    if (!dn.m && Math.hypot(dx, dy) < 6) return;
    dn.m = true;
    const k = vb[2] / svg.clientWidth;
    vb[0] -= dx * k;
    vb[1] -= dy * k;
    dn.x = e.clientX;
    dn.y = e.clientY;
    svg.setAttribute('viewBox', vb.join(' '));
  };
  svg.onpointerup = e => {
    const m = dn && dn.m;
    dn = null;
    if (m) return;
    const id = e.target.dataset && e.target.dataset.id;
    if (id) { S.sp = id; scheduleRender(); return }
    const q = svg.createSVGPoint();
    q.x = e.clientX;
    q.y = e.clientY;
    const z = q.matrixTransform(svg.getScreenCTM().inverse());
    d.lng = (z.x / 31.7 + 128).toFixed(4);
    d.lat = (46 - z.y / 40).toFixed(4);
    scheduleRender();
  };
  svg.onpointerleave = () => { dn = null };
  const zoom = f => {
    const cx = vb[0] + vb[2] / 2, cy = vb[1] + vb[3] / 2;
    vb[2] *= f;
    vb[3] *= f;
    vb[0] = cx - vb[2] / 2;
    vb[1] = cy - vb[3] / 2;
    scheduleRender();
  };
  const bind = (k, e) => {
    e.value = d[k];
    e.oninput = () => { d[k] = e.value };
    return e;
  };
  const ta = h('textarea', { rows: 3, placeholder: 'Tempel teks apa saja: alamat Jepang, nama tempat, kode pos...' });
  const ab = h('button', { class: 'btn s', style: 'margin-top:8px', onclick: () => geo(ta.value, ab, true) }, 'Isi otomatis');
  const cb = h('button', { class: 'btn s', onclick: () => geo(d.alamat, cb, false) }, 'Cari posisi dari alamat');
  const sp = pins.find(p => p.id === S.sp);
  return [h('h1', {}, 'Peta Wilayah'), h('p', { class: 'sub' }, pins.length + ' pin. Geser untuk menggeser peta, ketuk untuk menaruh pin baru.'), guard(),
    h('div', { class: 'card', style: 'display:block;padding:8px' }, svg,
      h('div', { class: 'fl' }, h('button', { class: 'btn s', onclick: () => zoom(0.6) }, '+'), h('button', { class: 'btn s', onclick: () => zoom(1 / 0.6) }, '\\u2212'), h('button', { class: 'btn s', onclick: () => { S.vb = null; scheduleRender() } }, 'Seluruh Jepang'), h('button', { class: 'btn s', onclick: () => { S.vb = [190, 330, 180, 200]; scheduleRender() } }, 'Shikoku')),
      sp && h('p', { class: 'warn' }, h('b', {}, sp.nama), ' \\u00b7 ', sp.alamat || '')),
    S.admin && box(h('b', {}, 'Alamat otomatis'), ta, ab, cb)];
}

export function vPeta() {
  const mid = mapMid();
  return [h('h1', {}, 'Peta Wilayah'), h('p', { class: 'sub' }, 'Lihat sebaran anggota komunitas di peta.'),
    mid ? h('iframe', { src: mapEmbedUrl(mid), style: 'width:100%;height:500px;border:0;border-radius:16px', allowFullScreen: '' }) : h('p', { class: 'warn' }, 'Peta belum dikonfigurasi. Silakan atur di Pengaturan Peta.')];
}