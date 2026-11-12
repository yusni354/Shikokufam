import { S } from './state.js';
import { h } from './dom.js';
import { $ } from './dom.js';
import { icon } from './icons.js';
import {
  WILAYAH, ALL, STATUS, PERAN, BLN, PROV, TGL, PREF,
  regionColor, memberRegion, wilayah, openMember, whatsappUrl, socialUrl,
  memberValue, cleanMemberValue, fld, box, autoFill, up, pick,
  memberCode, memberQrValue, dateLabel, scheduleRender, inferJapanLocation
} from './utils.js';
import { createSupabaseDb, isPrivateMemberMedia, memberMediaAttributes, hydrateMemberMedia, uploadPrivateMemberMedia } from './supabase.js';
import { accountForm, loginForm } from './auth.js';
import { guard } from './activities.js';

export function vHome() {
  return [h('h1', {}, 'Beranda'), h('p', { class: 'sub' }, 'Selamat datang di Shikoku Family.')];
}

export function vDash() {
  return [h('h1', {}, 'Ringkasan'), h('p', { class: 'sub' }, 'Statistik komunitas.')];
}

export function vMembers() {
  if (S.form) return [memberFormCard()];
  const search = h('input', { type: 'search', placeholder: 'Cari nama, WhatsApp, kota, wilayah, atau nomor anggota' });
  const region = h('select', {});
  const status = h('select', {});
  const regions = WILAYAH.map(([name]) => name);
  if (S.members.some(member => memberRegion(member) === 'Belum dipilih')) regions.push('Belum dipilih');
  region.replaceChildren(h('option', { value: '' }, 'Semua wilayah'), ...regions.map(value => h('option', { value }, value)));
  status.replaceChildren(h('option', { value: '' }, 'Semua status'), ...STATUS.map(value => h('option', { value }, value)));
  search.value = S.memberQuery || '';
  region.value = S.memberRegion || '';
  status.value = S.memberStatus || '';
  const count = h('p', { class: 'member-results-count' });
  const list = h('div', { class: 'member-grid' });
  function draw() {
    const query = (S.memberQuery || '').trim().toLowerCase();
    const rows = S.members.filter(member =>
      (!query || [member.nama, member.panggilan, member.wa, member.kota, member.wilayah, member.pref, member.kode].some(value => String(value || '').toLowerCase().includes(query))) &&
      (!S.memberRegion || memberRegion(member) === S.memberRegion) &&
      (!S.memberStatus || (member.status || 'aktif').toLowerCase() === S.memberStatus)
    ).sort((a, b) => (a.nama || '').localeCompare(b.nama || '', 'id'));
    count.textContent = 'Menampilkan ' + rows.length + ' dari ' + S.members.length + ' anggota';
    list.replaceChildren(...(rows.length ? rows.map(member => {
      const code = memberCode(member);
      const area = memberRegion(member);
      const location = [member.kota, member.pref].filter(Boolean).join(', ');
      return h('article', { class: 'member-card', style: '--region-color:' + regionColor(area) },
        member.foto ? h('img', { class: 'member-avatar', ...memberMediaAttributes(member.foto, 'src'), alt: 'Foto ' + (member.nama || 'anggota') }) : h('div', { class: 'member-avatar member-avatar-placeholder' }, (member.nama || '?').trim().slice(0, 1).toUpperCase()),
        h('div', { class: 'member-info' },
          h('b', {}, member.nama || '-'),
          h('small', {}, code),
          h('small', {}, area),
          location && h('small', {}, location)
        ),
        h('button', { class: 'btn s', onclick: () => openMember(member) }, 'Detail')
      );
    }) : [h('p', { class: 'warn' }, 'Tidak ada anggota yang cocok.')]));
  }
  search.oninput = () => { S.memberQuery = search.value; draw(); };
  region.onchange = () => { S.memberRegion = region.value; draw(); };
  status.onchange = () => { S.memberStatus = status.value; draw(); };
  draw();
  return [h('h1', {}, 'Daftar Anggota'), h('p', { class: 'sub' }, 'Kelola data anggota komunitas.'),
    h('div', { class: 'member-filter' }, search, region, status),
    count, list,
    S.admin && h('button', { class: 'btn', onclick: () => { S.form = { id: null }; scheduleRender(); } }, '+ Tambah Anggota')];
}

export function detailCard(member) {
  return h('div', { class: 'member-detail' },
    h('button', { class: 'btn s', onclick: () => { S.openMember = null; scheduleRender(); } }, '← Kembali'),
    h('h1', {}, member.nama || 'Anggota'),
    h('p', { class: 'sub' }, memberCode(member) + ' · ' + memberRegion(member)),
    member.foto ? h('img', { class: 'member-avatar', ...memberMediaAttributes(member.foto, 'src'), style: 'width:120px;height:120px;border-radius:50%;object-fit:cover;display:block;margin:16px auto' }) : null,
    h('table', { class: 'member-table' },
      ...[
        ['Nama panggilan', member.panggilan],
        ['WhatsApp', member.wa],
        ['Email', member.email],
        ['Wilayah', member.wilayah],
        ['Prefektur', member.pref],
        ['Kota', member.kota],
        ['Kode pos', member.kodepos],
        ['Status visa', member.tinggal],
        ['Status pernikahan', member.nikah],
        ['MT', member.mt],
        ['Mulai tinggal di Jepang', member.mulai_jp],
        ['Alamat di Jepang', member.alamat_jp],
        ['Bidang pekerjaan', member.bidang],
        ['Perusahaan', member.perusahaan],
        ['Pengurus daerah', member.pengurus],
        ['Nomor HP pengurus', member.hp_pengurus],
        ['Orang tua', member.ortu],
        ['Nomor HP orang tua', member.hp_ortu],
        ['Instagram', member.instagram],
        ['TikTok', member.tiktok],
        ['Facebook', member.facebook],
        ['Alamat Indonesia', member.alamat_id],
        ['Kelompok', member.kelompok],
        ['Desa', member.desa],
        ['Daerah', member.daerah],
        ['Provinsi', member.prov],
        ['Kabupaten/Kota', member.kab],
        ['Kecamatan', member.kec],
        ['Catatan', member.catatan]
      ].filter(([, v]) => v).map(([label, value]) => h('tr',
        h('td', {}, label),
        h('td', {}, value)
      ))
    ),
    member.surat && member.surat.length && h('div', {},
      h('b', {}, 'Dokumen'),
      ...member.surat.map((id, i) => h('div', { class: 'member-file-row' },
        h('a', { ...memberMediaAttributes(id, 'href'), target: '_blank' }, icon('attachment', 16), h('span', {}, 'Lampiran ' + (i + 1))))
      ))
  );
}

export function memberFormCard() {
  const f = S.form;
  if (!f.id && !f.kode) {
    const n = Math.max(S.members.length, ...S.members.map(member => parseInt(String(member.kode || '').split('-').pop()) || 0)) + 1;
    f.kode = 'IJCCS-' + String(n).padStart(4, '0');
  }
  const years = Array.from({ length: 12 }, (_, index) => String(new Date().getFullYear() - index));
  const fieldGrid = (...fields) => h('div', { class: 'member-form-grid' }, ...fields);
  const auto = () => {
    const text = h('textarea', { rows: 8, placeholder: '1. Nama Lengkap : Nama Anda\n2. Jenis Kelamin : laki-laki\n3. Tgl/bln/thn lahir : 20-04-1987\n4. Umur : 40\n5. Kelompok, Desa, Daerah di Indonesia : kelompok, desa, daerah\n6. No. Hp Pengurus Daerah + Nama : nomor + nama\n7. Status (lajang/menikah) : menikah\n8. MT (iya/bukan) : bukan\n9. Mulai Tinggal di Jepang : 22-09-2026\n10. Alamat Tinggal di Jepang : jotocho marugame\n11. Status Visa : tokuteginou 1\n12. No. HP/WA : nomor WhatsApp\n13. Facebook : nama akun\n14. No. HP Orang Tua + Nama : nomor + nama\n15. Foto Surat Sambung :\n16. Foto Setengah Badan (terbaru) :' });
    return box(h('div', { class: 'member-section-heading' }, h('div', {}, h('b', {}, 'Isi dari teks salinan'), h('small', {}, 'Tempel data diri untuk mengisi kolom secara otomatis.')), icon('sparkles', 20)),
      text, h('button', { class: 'btn s', onclick: () => autoFill(text.value) }, 'Isi Otomatis'),
      h('p', { class: 'warn' }, 'Data diproses langsung di perangkat ini. Foto dan Surat Sambung diunggah terpisah. Periksa kembali hasilnya sebelum menyimpan.'));
  };
  const photoBox = () => box(h('b', {}, 'Foto Setengah Badan (terbaru)'),
    f.foto && h('img', { ...memberMediaAttributes(f.foto, 'src'), style: 'width:88px;height:88px;border-radius:18px;object-fit:cover;display:block;margin:10px 0' }),
    S.memberUploadState?.form === f && h('p', { class: 'warn ' + (S.memberUploadState.status === 'error' ? 'storage-warning' : '') }, S.memberUploadState.message),
    h('div', { class: 'fl' }, pick('Ambil foto', 'image/jpeg,image/png,image/webp', 1, file => up(file, 'foto')), pick('Pilih foto', 'image/jpeg,image/png,image/webp', 0, file => up(file, 'foto'))));
  const documentBox = () => box(h('b', {}, 'Foto Surat Sambung'),
    ...(f.surat || []).map((id, index) => h('div', { class: 'member-file-row' },
      h('a', { ...memberMediaAttributes(id, 'href'), target: '_blank' }, icon('attachment', 16), h('span', {}, 'Lampiran ' + (index + 1))),
      h('button', { class: 'btn s', onclick: () => { f.surat = f.surat.filter(value => value !== id); scheduleRender(); } }, 'Hapus'))),
    h('div', { class: 'fl' }, pick('Ambil / foto dokumen', 'image/*,application/pdf', 1, file => up(file, 'surat', 1)), pick('Pilih dokumen', 'image/*,application/pdf', 0, file => up(file, 'surat', 1))),
    h('small', { class: 'member-help' }, 'Bisa menambahkan lebih dari satu foto atau PDF.'));
  return h('div', { class: 'member-editor' },
    h('div', { class: 'member-editor-heading' },
      h('button', { class: 'btn s', onclick: () => { S.form = null; scheduleRender(); } }, '← Kembali'),
      h('div', {}, h('p', { class: 'member-eyebrow' }, 'DATA KOMUNITAS'), h('h1', {}, f.id ? 'Edit data anggota' : 'Anggota baru'), h('p', { class: 'sub' }, 'Lengkapi profil dalam satu halaman. Kolom bertanda * wajib diisi.'))),
    S.admin && auto(),
    box(h('div', { class: 'member-section-heading' }, h('div', {}, h('b', {}, 'Profil anggota'), h('small', {}, 'Identitas dan keanggotaan'))),
      fieldGrid(fld('Nama lengkap *', 'nama'), fld('Nomor HP / WhatsApp', 'wa', { type: 'tel' }), fld('Nama panggilan', 'panggilan'), fld('Nomor anggota', 'kode'), fld('Wilayah anggota *', 'wilayah', { opts: WILAYAH.map(([name]) => name), ph: 'Pilih wilayah' }), fld('Jenis kelamin', 'kelamin', { opts: ['Laki-laki', 'Perempuan'] }), fld('Tanggal lahir', 'lahir', { type: 'date' }), fld('Umur', 'umur', { type: 'number' }), fld('Status anggota', 'status', { opts: STATUS }), fld('Peran', 'peran', { opts: PERAN }), fld('Status pernikahan', 'nikah', { opts: ['Belum menikah', 'Menikah', 'Cerai'] }), fld('MT', 'mt'), fld('Bulan kedatangan', 'bln', { opts: BLN }), fld('Tahun kedatangan', 'thn', { opts: years }), fld('Mulai tinggal di Jepang', 'mulai_jp', { ph: 'Contoh: 22-09-2026' }))),
    box(h('div', { class: 'member-section-heading' }, h('div', {}, h('b', {}, 'Kontak & keluarga'), h('small', {}, 'Nomor telepon, orang tua, dan media sosial'))),
      fieldGrid(fld('Email', 'email', { type: 'email' }), fld('Nama orang tua', 'ortu'), fld('Nomor HP orang tua', 'hp_ortu', { type: 'tel' }), fld('Instagram', 'instagram', { ph: '@username' }), fld('TikTok', 'tiktok', { ph: '@username' }), fld('Facebook', 'facebook'))),
    box(h('div', { class: 'member-section-heading' }, h('div', {}, h('b', {}, 'Asal di Indonesia'), h('small', {}, 'Wilayah, kelompok, dan alamat asal'))),
      fieldGrid(fld('Kelompok', 'kelompok'), fld('Desa / Kelurahan', 'desa'), fld('Daerah', 'daerah'), fld('Provinsi', 'prov', { opts: PROV, ph: 'Pilih provinsi' }), fld('Kabupaten / Kota', 'kab'), fld('Kecamatan', 'kec'), fld('Alamat lengkap Indonesia', 'alamat_id', { area: 1 }))),
    box(h('div', { class: 'member-section-heading' }, h('div', {}, h('b', {}, 'Alamat & pekerjaan di Jepang'), h('small', {}, 'Informasi tempat tinggal saat ini'))),
      h('p', { class: 'member-help' }, 'Prefektur dan wilayah dapat dikenali otomatis dari alamat atau kode pos. Cakupan dibatasi untuk Shikoku dan Okayama.'),
      fieldGrid(fld('Prefektur', 'pref', { opts: PREF, ph: 'Pilih prefektur' }), fld('Kota', 'kota'), fld('Kecamatan (romaji)', 'kec_jp'), fld('Kode pos', 'kodepos', { inputmode: 'numeric' }), fld('Stasiun terdekat', 'stasiun'), fld('Alamat jalan / gedung', 'alamat_jp', { area: 1 }), fld('Status visa', 'tinggal', { opts: TGL, ph: 'Pilih status visa' }), fld('Bidang pekerjaan', 'bidang'), fld('Nama perusahaan', 'perusahaan'), fld('Nama pengurus daerah', 'pengurus'), fld('Nomor HP pengurus daerah', 'hp_pengurus', { type: 'tel' }))),
    photoBox(), documentBox(),
    box(h('div', { class: 'member-section-heading' }, h('div', {}, h('b', {}, 'Catatan tambahan'))), fld('Catatan', 'catatan', { area: 1 })),
    h('div', { class: 'member-editor-actions' }, h('button', { class: 'btn s', onclick: () => { S.form = null; scheduleRender(); } }, 'Batal'), h('button', { class: 'btn', onclick: saveForm }, f.id ? 'Simpan perubahan' : 'Simpan anggota'))
  );
}

export async function saveForm() {
  const f = S.form;
  if (S.memberUploadState?.form === f && S.memberUploadState.status === 'uploading') { alert('Tunggu sampai unggah file selesai sebelum menyimpan profil.'); return }
  if (!(f.nama || '').trim()) { alert('Nama lengkap wajib diisi.'); return }
  const inferredLocation = inferJapanLocation(f.alamat_jp, f.kota, f.kec_jp, f.kodepos, f.pref, f.wilayah);
  if (inferredLocation) {
    if (!f.pref) f.pref = inferredLocation.pref;
    if (!f.wilayah) f.wilayah = inferredLocation.wilayah;
    if (!f.kota && inferredLocation.kota) f.kota = inferredLocation.kota;
  }
  if (!f.pref || !f.wilayah) {
    alert('Prefektur dan wilayah belum terisi. Lengkapi alamat Jepang yang mencantumkan prefektur, kota, atau kode pos di Shikoku/Okayama, atau pilih secara manual.');
    return;
  }
  const allowedPref = PREF.find(pref => pref.toLowerCase() === String(f.pref).trim().toLowerCase());
  const allowedRegion = WILAYAH.some(([name]) => name.toLowerCase() === String(f.wilayah).trim().toLowerCase());
  if (!allowedPref || !allowedRegion) {
    alert('Data anggota dibatasi untuk prefektur Shikoku dan Okayama. Periksa kembali prefektur dan wilayah.');
    return;
  }
  f.pref = allowedPref;
  const d = { ...f };
  delete d.id;
  Object.keys(d).forEach(key => { if (typeof d[key] === 'string' && !['foto'].includes(key)) d[key] = cleanMemberValue(d[key]).toUpperCase(); });
  d.peran = d.peran || 'ANGGOTA';
  d.status = d.status || 'AKTIF';
  try {
    if (f.id) await S.db.collection('members').doc(f.id).set(d);
    else await S.db.collection('members').add({ ...d, at: Date.now() });
    S.form = null;
    S.memberUploadState = null;
    scheduleRender();
  } catch (e) {
    console.error(e);
    alert('Tidak bisa menyimpan: ' + (e.message || 'periksa koneksi dan izin database'));
  }
}

export function vForum() {
  const t = h('input', { placeholder: 'Judul topik' });
  const b = h('textarea', { placeholder: 'Isi diskusi', rows: 3 });
  const list = S.topics.map(x => h('div', { class: 'card', style: 'display:block' }, h('b', {}, x.judul), h('p', { class: 'warn' }, x.isi || ''),
    S.admin && h('button', { class: 'btn s', onclick: () => S.db.collection('topics').doc(x.id).delete() }, 'Hapus')));
  return [h('h1', {}, 'Forum'), h('p', { class: 'sub' }, 'Diskusi anggota'), guard(),
    h('div', { class: 'card', style: 'display:block' }, t, b, h('button', { class: 'btn', onclick: async () => { if (!t.value.trim() || !S.db) return; await S.db.collection('topics').add({ judul: t.value.trim(), isi: b.value.trim(), by: S.uid, at: Date.now() }); t.value = ''; b.value = '' } }, 'Kirim')),
    list.length ? list : h('p', { class: 'warn' }, 'Belum ada topik.')];
}