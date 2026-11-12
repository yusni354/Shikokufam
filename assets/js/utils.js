import { S } from './state.js';
import { h } from './dom.js';
import { uploadPrivateMemberMedia } from './supabase.js';
import { scheduleRender } from './core.js';

export const WILAYAH = [
  ['Provinsi Kagawa', 'KAGAWA'],
  ['Provinsi Ehime', 'EHIME'],
  ['Provinsi Tokushima', 'TOKUSHIMA'],
  ['Provinsi Kochi', 'KOCHI'],
  ['Provinsi Okayama', 'OKAYAMA']
];

export const ALL = [
  ['landing', 'home', 'Beranda', false, 'home'],
  ['dash', 'chart', 'Ringkasan', false, 'chart'],
  ['members', 'users', 'Anggota', false, 'users'],
  ['kegiatan', 'calendar', 'Kegiatan', false, 'calendar'],
  ['piket', 'brush', 'Piket', false, 'brush'],
  ['forum', 'messages', 'Forum', false, 'messages'],
  ['musyawarah', 'musyawarah', 'Musyawarah', false, 'musyawarah'],
  ['pesan', 'inbox', 'Pesan Admin', true, 'inbox'],
  ['map', 'map', 'Peta Wilayah', false, 'map']
];

export const ADMIN_MENU = [
  ['map-settings', 'Pengaturan Peta', 'map'],
  ['approvals', 'Persetujuan Akun', 'users']
];

export const STATUS = ['aktif', 'nonaktif'];
export const PERAN = ['Anggota', 'Pengurus'];
export const BLN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
export const PROV = ['Aceh', 'Sumatera Utara', 'Sumatera Barat', 'Riau', 'Kepulauan Riau', 'Jambi', 'Sumatera Selatan', 'Bengkulu', 'Lampung', 'Kepulauan Bangka Belitung', 'DKI Jakarta', 'Jawa Barat', 'Banten', 'Jawa Tengah', 'Daerah Istimewa Yogyakarta', 'Jawa Timur', 'Bali', 'Nusa Tenggara Barat', 'Nusa Tenggara Timur', 'Kalimantan Barat', 'Kalimantan Tengah', 'Kalimantan Selatan', 'Kalimantan Timur', 'Kalimantan Utara', 'Sulawesi Utara', 'Sulawesi Tengah', 'Sulawesi Selatan', 'Sulawesi Tenggara', 'Gorontalo', 'Sulawesi Barat', 'Maluku Utara', 'Maluku', 'Papua Barat', 'Papua'];
export const TGL = ['Specified Skilled Worker (Tokutei Ginou)', 'Technical Intern (Ginou Jisshu)', 'Permanent Resident', 'Spouse or Child of Japanese National', 'Long Term Resident', 'Student', 'Other'];
export const PREF = ['Kagawa', 'Ehime', 'Tokushima', 'Kochi', 'Okayama'];

export function regionColor(area) {
  const colors = {
    KAGAWA: '#2f8fc1',
    EHIME: '#4caf50',
    TOKUSHIMA: '#ff9800',
    KOCHI: '#e91e63',
    OKAYAMA: '#9c27b0'
  };
  return colors[area] || '#6f7b86';
}

export function memberRegion(member) {
  return member.wilayah || 'Belum dipilih';
}

export function wilayah() {
  const m = {};
  S.members.forEach(member => {
    const r = memberRegion(member);
    if (!m[r]) m[r] = [];
    m[r].push(member);
  });
  return m;
}

export function openMember(member) {
  S.openMember = member;
  render();
}

export function whatsappUrl(member) {
  const wa = (member.wa || '').replace(/\D/g, '');
  if (!wa) return '#';
  if (!wa.startsWith('62')) return 'https://wa.me/62' + wa;
  return 'https://wa.me/' + wa;
}

export function socialUrl(member, platform) {
  const v = member[platform] || '';

export function cleanMemberValue(value) {
  if (value == null) return '';
  return String(value).trim();
}

export function normalizeImportLabel(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function importDate(value) {
  const match = value.trim().match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (!match) return '';
  const [, day, month, year] = match;
  const iso = year + '-' + month.padStart(2, '0') + '-' + day.padStart(2, '0');
  const date = new Date(iso + 'T00:00:00');
  return date.getFullYear() === Number(year) && date.getMonth() + 1 === Number(month) && date.getDate() === Number(day) ? iso : '';
}

export function cleanIndonesiaPlace(value, key) {
  if (!value) return value;
  const v = String(value).trim();
  if (key === 'kelompok') return v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
  if (key === 'desa' || key === 'daerah') return v.charAt(0).toUpperCase() + v.slice(1);
  return v;
}

export function inferJapanLocation(alamatJp, kota, kecJp, kodepos, pref, wilayah) {
  if (!alamatJp && !kota && !kecJp && !kodepos && !pref && !wilayah) return null;
  const result = {};
  if (pref) result.pref = pref;
  if (wilayah) result.wilayah = wilayah;
  if (kota) result.kota = kota;
  return Object.keys(result).length ? result : null;
}

export function fld(l, k, o) {
  o = o || {};
  const f = S.form;
  let e;
  if (o.opts) {
    e = h('select', {}, h('option', { value: '' }, o.ph || 'Pilih'), ...o.opts.map(x => h('option', { value: x }, x)));
  } else if (o.area) {
    e = h('textarea', { rows: 3, placeholder: o.ph || '' });
  } else {
    e = h('input', { placeholder: o.ph || '', type: o.type || 'text' });
  }
  if (o.opts) {
    const option = o.opts.find(value => value.toUpperCase() === String(f[k] || '').toUpperCase());
    if (f[k] && !option) e.append(h('option', { value: String(f[k]).toUpperCase() }, String(f[k]).toUpperCase()));

export function parseMemberPaste(text) {
  const aliases = [
    [['nama lengkap'], 'nama'],
    [['jenis kelamin'], 'kelamin'],
    [['tgl bln thn lahir', 'tanggal lahir'], 'lahir'],
    [['umur', 'usia'], 'umur'],
    [['kelompok desa daerah di indonesia'], 'wilayah_indonesia'],
    [['kelompok'], 'kelompok'],
    [['desa', 'desa kelurahan'], 'desa'],
    [['daerah'], 'daerah'],
    [['no hp pengurus daerah nama', 'no hp pengurus daerah'], 'pengurus_contact'],
    [['status lajang menikah', 'status lajang menikah cerai'], 'nikah'],
    [['mt iya bukan', 'mt'], 'mt'],
    [['mulai tinggal di jepang'], 'mulai_jp'],
    [['alamat tinggal di jepang'], 'alamat_jp'],
    [['status visa'], 'tinggal'],
    [['no hp wa', 'nomor hp wa'], 'wa'],
    [['facebook'], 'facebook'],
    [['no hp orang tua nama', 'no hp orang tua'], 'ortu_contact']
  ];
  const values = {};
  let current = '';
  text.split(/\r?\n/).forEach(line => {
    const match = line.match(/^\s*(?:\d+\s*[.)]\s*)?([^:：]+?)\s*[:：]\s*(.*)$/);
    if (match) {
      current = normalizeImportLabel(match[1]);
      values[current] = cleanMemberValue(match[2]);
    } else if (current && line.trim()) {
      values[current] = cleanMemberValue(values[current] + ' ' + line);
    }
  });
  const data = {};
  const recognized = [];
  aliases.forEach(([labels, key]) => {
    const label = Object.keys(values).find(candidate => labels.includes(candidate));
    if (label && values[label]) {
      data[key] = values[label];
      recognized.push(key);
    }
  });
  if (data.nama) data.nama = data.nama.trim();
  if (data.kelamin) {
    const gender = normalizeImportLabel(data.kelamin);
    if (gender.includes('laki laki')) data.kelamin = 'Laki-laki';
    else if (gender.includes('perempuan')) data.kelamin = 'Perempuan';
  }
  if (data.lahir) {
    const converted = importDate(data.lahir);
    if (converted) data.lahir = converted;
    else delete data.lahir;
  }
  if (data.umur) data.umur = data.umur.match(/\d+/) ? [0] || data.umur;
  if (data.wilayah_indonesia) {
    const [kelompok, desa, daerah] = data.wilayah_indonesia.split(',');
    if (kelompok && !data.kelompok) data.kelompok = kelompok;
    if (desa && !data.desa) data.desa = desa;
    if (daerah && !data.daerah) data.daerah = daerah;
    delete data.wilayah_indonesia;
  }
  for (const key of ['kelompok', 'desa', 'daerah']) if (data[key]) data[key] = cleanIndonesiaPlace(data[key], key);
  const splitContact = (value, nameKey, phoneKey) => {
    if (!value) return;
    const matches = [...value.matchAll(/(?:\+|00)?\d[\d\s().-]*\d/g)]
      .filter(match => match[0].replace(/\D/g, '').length >= 7 && match[0].replace(/\D/g, '').length <= 15)
      .sort((a, b) => b[0].replace(/\D/g, '').length - a[0].replace(/\D/g, '').length);
    const phone = matches[0];
    if (!phone) {
      data[nameKey] = cleanMemberValue(value);
      return;
    }
    data[phoneKey] = phone[0].replace(/[()（）]/g, '').replace(/\s+/g, ' ').replace(/^[\s+,:;-]+|[\s+,:;-]+$/g, '').trim();
    const name = value.slice(0, phone.index) + ' ' + value.slice(phone.index + phone[0].length);
    const cleanedName = cleanMemberValue(name)
      .replace(/^[\s+,:;|\\-]+|[\s+,:;|\\-]+$/g, '')
      .replace(/^(?:nama|name)\s*[:：-]\s*/i, '')
      .trim();
    if (cleanedName) data[nameKey] = cleanedName;
  };
  splitContact(values[normalizeImportLabel('No. Hp Pengurus Daerah + Nama')], 'pengurus', 'hp_pengurus');

export function autoFill(txt) {
  if (!S.admin) return;
  if (!txt.trim()) { alert('Tempel data diri terlebih dahulu.'); return }
  const { data, recognized } = parseMemberPaste(txt);
  if (!recognized.length) { alert('Data belum dikenali. Pastikan setiap baris memakai format "Nama Kolom : Isi".'); return }
  Object.entries(data).forEach(([key, value]) => { if (value !== null && value !== undefined && value !== '') S.form[key] = cleanMemberValue(value).toUpperCase(); });
  const location = inferJapanLocation(data.alamat_jp, S.form.alamat_jp, data.kota, S.form.kota, data.kec_jp, S.form.kec_jp, data.kodepos, S.form.kodepos, data.pref, S.form.pref, data.wilayah, S.form.wilayah);
  if (location) {
    if (!S.form.pref) S.form.pref = location.pref.toUpperCase();
    if (!S.form.wilayah) S.form.wilayah = location.wilayah.toUpperCase();
    if (!S.form.kota && location.kota) S.form.kota = location.kota.toUpperCase();
  }
  render();
  const invalidDate = recognized.includes('lahir') && !data.lahir;
  alert('Data berhasil dibaca (' + recognized.length + ' kolom). Periksa kembali isian sebelum disimpan.' +
    (invalidDate ? ' Format tanggal lahir tidak dikenali; isi tanggal lahir secara manual.' : '') +
    ((!S.form.pref || !S.form.wilayah) ? ' Prefektur/wilayah belum dapat dikenali dari alamat. Pilih wilayah di Shikoku atau Okayama dan lengkapi alamat Jepang.' : ''));
}

export async function up(file, key, multi) {
  if (!file) return;
  if (!S.admin) { alert('Hanya admin yang dapat mengunggah foto dan dokumen anggota.'); return }
  if (!S.supabase && !S.assets) { alert('Layanan penyimpanan belum tersedia. Muat ulang aplikasi atau periksa koneksi.'); return }
  if (S.memberUploadState?.form === S.form && S.memberUploadState.status === 'uploading') return;
  const targetForm = S.form;
  S.memberUploadState = { form: targetForm, status: 'uploading', message: 'Mengunggah file ke penyimpanan bersama...' };
  render();
  try {
    const id = S.supabase ? await uploadPrivateMemberMedia(file) : (await S.assets.upload(file)).id;
    targetForm[key] = multi ? [...(targetForm[key] || []), id] : id;
    S.memberUploadState = { form: targetForm, status: 'success', message: 'File berhasil diunggah. Simpan profil untuk menyimpan perubahan.' };
    render();
  } catch (error) {
    console.error('Unggah media anggota gagal:', error);
    const detail = [error.message, error.error_description, error.statusCode, error.code].filter(Boolean).join(' · ');
    const lower = detail.toLowerCase();
    let message = detail || 'Kesalahan tidak diketahui';
    if (lower.includes('bucket') && (lower.includes('not found') || lower.includes('does not exist'))) {
      message = 'Bucket member-files belum tersedia. Jalankan ulang supabase-schema.sql di Supabase SQL Editor.';
    } else if (lower.includes('row-level security') || lower.includes('unauthorized') || lower.includes('not authorized') || String(error.statusCode) === '403') {
      message = 'Supabase menolak unggahan. Pastikan akun ini berstatus admin dan kebijakan Storage dari supabase-schema.sql sudah dijalankan.';
    } else if (lower.includes('too large') || lower.includes('payload') || lower.includes('size limit')) {
      message = 'File terlalu besar untuk batas unggah Supabase. Pilih file yang lebih kecil.';
    }
    S.memberUploadState = { form: targetForm, status: 'error', message: message };
    render();
  }
}

export function pick(label, accept, multiple, onPick) {
  const input = h('input', { type: 'file', accept, multiple: multiple ? 'multiple' : null, style: 'display:none' });
  input.onchange = () => {
    const files = Array.from(input.files || []);
    if (files.length) files.forEach(onPick);
    input.value = '';
  };
  return h('button', { class: 'btn s', onclick: () => input.click() }, label);
}

export function memberCode(member) {
  return member.kode || 'IJCCS-0000';
}

export function memberQrValue(member) {
  return (member.kode || '').toUpperCase();
}

export function dateLabel(event) {
  if (!event.tanggal) return '';
  const d = new Date(event.tanggal + 'T00:00:00');
  return d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}
  if (!data.pengurus && !data.hp_pengurus) splitContact(data.pengurus_contact, 'pengurus', 'hp_pengurus');
  splitContact(values[normalizeImportLabel('No. HP Orang Tua + Nama')], 'ortu', 'hp_ortu');
  if (!data.ortu && !data.hp_ortu) splitContact(data.ortu_contact, 'ortu', 'hp_ortu');
  delete data.pengurus_contact;
  delete data.ortu_contact;
  if (data.nikah) {
    const status = normalizeImportLabel(data.nikah);
    if (status.includes('lajang') || status.includes('belum')) data.nikah = 'Belum menikah';
    else if (status.includes('menikah')) data.nikah = 'Menikah';
    else if (status.includes('cerai')) data.nikah = 'Cerai';
  }
  if (data.mt) data.mt = data.mt.trim();
  if (data.mulai_jp) data.mulai_jp = data.mulai_jp.trim();
  if (data.alamat_jp) {
    const address = data.alamat_jp.trim();
    const location = inferJapanLocation(address);
    if (location) {
      data.pref = location.pref;
      data.wilayah = location.wilayah;
      if (location.kota) data.kota = location.kota;
    }
    data.alamat_jp = address;
  }
  if (data.tinggal) {
    const visa = normalizeImportLabel(data.tinggal);
    if (visa.includes('tokutei ginou') || visa.includes('tokuteginou')) data.tinggal = 'Specified Skilled Worker (Tokutei Ginou)';
    else if (visa.includes('ginou jisshu') || visa.includes('technical intern')) data.tinggal = 'Technical Intern (Ginou Jisshu)';
    else if (!TGL.includes(data.tinggal)) data.tinggal = data.tinggal.trim();
  }
  return { data, recognized };
}
    e.value = option || String(f[k] || '').toUpperCase();
    e.onchange = () => { f[k] = e.value.toUpperCase(); };
  } else {
    e.value = String(f[k] || '').toUpperCase();
    e.oninput = () => {
      const start = e.selectionStart;
      e.value = e.value.toUpperCase();
      f[k] = e.value;
      if (start !== null && typeof e.setSelectionRange === 'function' && (['text', 'search', 'tel', 'url', 'password'].includes(e.type) || e.tagName === 'TEXTAREA')) {
        e.setSelectionRange(start, start);
      }
    };
  }
  return h('label', { class: 'lb' }, l, e);
}

export const box = (...k) => h('div', { class: 'card', style: 'display:block' }, ...k);
  if (!v) return '#';
  if (platform === 'instagram' || platform === 'tiktok') return 'https://' + platform + '.com/' + v.replace(/^@/, '');
  if (platform === 'facebook') return 'https://facebook.com/' + v;
  return '#';
}

export function memberValue(member, key) {
  return member[key] || '-';
}