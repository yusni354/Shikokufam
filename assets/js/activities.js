import { S } from './state.js';
import { h } from './dom.js';
import { $ } from './dom.js';
import { icon } from './icons.js';
import {
  WILAYAH, memberRegion, memberCode, wilayah, scheduleRender, memberQrValue
} from './utils.js';

export function guard() {
  if (!S.uid) return h('p', { class: 'warn', style: 'text-align:center;padding:20px' }, 'Silakan masuk terlebih dahulu.');
  if (S.approvalStatus !== 'approved' && !S.admin) return h('p', { class: 'warn', style: 'text-align:center;padding:20px' }, 'Akun Anda belum disetujui admin.');
  return null;
}

export function eventParticipantCount(event) {
  return (event.peserta_anggota || []).length;
}

export function eventAttendanceCount(event) {
  return (event.hadir_anggota || []).length;
}

export function activityMemberIds(event) {
  return new Set((event.hadir_anggota || []).map(String));
}

export async function updateActivityMember(eventId, memberId, action) {
  if (!S.db) throw new Error('Database tidak tersedia');
  const events = S.events.find(e => e.id === eventId);
  if (!events) throw new Error('Kegiatan tidak ditemukan');
  const participants = events.peserta_anggota || [];
  const attendees = events.hadir_anggota || [];
  if (action === 'add') {
    if (!participants.includes(String(memberId))) participants.push(String(memberId));
  } else if (action === 'present') {
    if (!participants.includes(String(memberId))) participants.push(String(memberId));
    if (!attendees.includes(String(memberId))) attendees.push(String(memberId));
  }
  await S.db.collection('events').doc(eventId).set({ peserta_anggota: participants, hadir_anggota: attendees });

export function activityCard(event) {
  const participants = (event.peserta_anggota || []).map(id => {
    const member = S.members.find(m => String(m.id) === String(id));
    return member || { id, nama: 'Anggota #' + id };
  });
  const attendees = activityMemberIds(event);
  const participantsByRegion = new Map();
  const unassignedParticipants = [];
  participants.forEach(member => {
    const region = memberRegion(member);
    if (!participantsByRegion.has(region)) participantsByRegion.set(region, []);
    participantsByRegion.get(region).push(member);
  });
  const registeredMembers = S.members;
  let legacyCount = 0;
  const status = h('div', { class: 'activity-feedback' }, S.activityFeedback?.eventId === event.id ? S.activityFeedback.message : '');
  const dateLabel = (event.tanggal ? new Date(event.tanggal + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '');
  const regionSection = (region, membersInRegion) => {
    const contents = [];
    if (S.admin) {
      const eligible = registeredMembers.filter(member => memberRegion(member) === region && !participants.includes(String(member.id)));
      const select = h('select', { class: 'activity-member-select' }, h('option', { value: '' }, eligible.length ? 'Pilih anggota wilayah ini' : 'Tidak ada anggota lain di wilayah ini'), ...eligible.map(member => h('option', { value: member.id }, (member.nama || 'Tanpa nama') + ' · ' + memberCode(member))));
      const addButton = h('button', { class: 'btn s', onclick: async () => {
        if (!select.value) { status.textContent = 'Pilih anggota dari wilayah ' + region + '.'; return }
        try { await updateActivityMember(event.id, select.value, 'add') } catch (error) { console.error(error); alert('Gagal menambahkan peserta: ' + (error.message || 'periksa koneksi')) }
      } }, 'Tambah peserta');
      addButton.disabled = !eligible.length;
      contents.push(h('div', { class: 'activity-add-row' }, select, addButton));
    }
    return h('section', { class: 'activity-region-section' }, ...contents);
  };
  const regionSections = WILAYAH.map(([region]) => regionSection(region, participantsByRegion.get(region)));
  if (unassignedParticipants.length) regionSections.push(regionSection('Wilayah belum ditentukan', unassignedParticipants));
  const content = [
    h('div', { class: 'activity-heading' }, h('div', {}, h('h2', {}, event.judul || 'Kegiatan komunitas'), h('p', { class: 'activity-meta' }, icon('calendar', 15), h('span', {}, dateLabel + (event.waktu ? ' · ' + event.waktu : '')), event.lokasi && h('p', { class: 'activity-meta' }, icon('pin', 15), h('span', {}, event.lokasi)))), S.admin && h('button', { class: 'btn s', onclick: async () => {
      if (!confirm('Hapus kegiatan "' + (event.judul || 'ini') + '"?')) return;
      try { await S.db.collection('events').doc(event.id).delete() } catch (error) { console.error(error); alert('Gagal menghapus kegiatan: ' + (error.message || 'periksa koneksi')) }
    } }, 'Hapus kegiatan')),
    event.deskripsi && h('p', { class: 'activity-description' }, event.deskripsi),
    h('div', { class: 'activity-counts' }, h('b', {}, participants.length + ' peserta'), h('b', {}, attendees.size + ' hadir')),
    legacyCount > 0 && h('p', { class: 'warn' }, legacyCount + ' catatan absensi lama belum terhubung dengan data anggota.'),
    h('h3', {}, 'Absensi per wilayah'),
    h('p', { class: 'activity-help' }, 'Peserta dikelompokkan sesuai wilayah pada profil anggota.'),
    h('div', { class: 'activity-region-list' }, ...regionSections)
  ];
  if (S.admin) {
    const barcodeInput = h('input', { class: 'activity-barcode-input', placeholder: 'Pindai QR / masukkan ID anggota', autocomplete: 'off' });
    const scanButton = h('button', { class: 'btn s', type: 'button' }, icon('camera', 16), h('span', {}, 'Buka kamera'));
    const scannerVideo = h('video', { class: 'activity-scanner-video', autoplay: '', muted: '', playsinline: 'true', style: 'display:none' });
    const processBarcode = async value => {
      const code = String(value || '').trim().replace(/^\*|\*$/g, '').toUpperCase();
      if (!code) { status.textContent = 'Barcode kosong.'; return }
      const matches = registeredMembers.filter(member => memberQrValue(member) === code);
      if (matches.length === 0) { status.textContent = 'Barcode tidak cocok dengan anggota terdaftar.'; return }
      if (matches.length > 1) { status.textContent = 'Barcode cocok dengan beberapa anggota. Periksa nomor kartu terlebih dahulu.'; return }
      const member = matches[0];
      if (attendees.has(String(member.id))) { status.textContent = (member.nama || 'Anggota') + ' sudah tercatat hadir.'; return }
      try {
        await updateActivityMember(event.id, member.id, 'present');
        S.activityFeedback = { eventId: event.id, message: (member.nama || 'Anggota') + ' berhasil ditambahkan dan dicatat hadir.' };
        scheduleRender();
      } catch (error) { console.error(error); status.textContent = 'Gagal mencatat kehadiran: ' + (error.message || 'periksa koneksi') }
    };
    const submitBarcode = async () => {
      const value = barcodeInput.value;
      barcodeInput.value = '';
      await processBarcode(value);
    };
    barcodeInput.onkeydown = event => { if (event.key === 'Enter') { event.preventDefault(); submitBarcode() } };
    scanButton.onclick = async () => {
      if (S.activityScannerStop) { S.activityScannerStop(); return }
      if (!window.BarcodeDetector || typeof window.BarcodeDetector.getSupportedFormats !== 'function' || !navigator.mediaDevices?.getUserMedia) {
        status.textContent = 'Pemindaian QR lewat kamera tidak didukung browser ini. Gunakan aplikasi pemindai QR dan ketik/pindai ID ke kolom.';
        return;
      }
      let stream = null, active = false, frame = 0, stopScanner = () => {};
      try {
        const formats = await window.BarcodeDetector.getSupportedFormats();
        if (!formats.includes('qr_code')) {
          status.textContent = 'Browser ini belum mendukung pembacaan QR. Gunakan aplikasi pemindai QR dan ketik/pindai ID ke kolom.';
          return;
        }
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        active = true;
        scannerVideo.srcObject = stream;
        scannerVideo.style.display = 'block';
        scanButton.replaceChildren(icon('close', 16), h('span', {}, 'Berhenti memindai'));
        stopScanner = () => {
          active = false;
          if (frame) cancelAnimationFrame(frame);
          stream.getTracks().forEach(track => track.stop());
          scannerVideo.srcObject = null;
          scannerVideo.style.display = 'none';
          scanButton.replaceChildren(icon('camera', 16), h('span', {}, 'Buka kamera'));
          if (S.activityScannerStop === stopScanner) S.activityScannerStop = null;
        };
        S.activityScannerStop = stopScanner;
        await scannerVideo.play();
        const detect = async () => {
          if (!active) return;
          try {
            const codes = await detector.detect(scannerVideo);
            if (codes.length && codes[0].rawValue) {
              const value = codes[0].rawValue;
              stopScanner();
              await processBarcode(value);
              return;
            }
          } catch (error) {
            stopScanner();
            console.error(error);
            status.textContent = 'Gagal membaca QR melalui kamera: ' + (error.message || 'coba lagi atau masukkan ID anggota secara manual');
            return;
          }
          if (active) frame = requestAnimationFrame(detect);
        };
        detect();
      } catch (error) {
        stopScanner();
        if (stream) stream.getTracks().forEach(track => track.stop());
        scannerVideo.srcObject = null;
        scannerVideo.style.display = 'none';
        scanButton.replaceChildren(icon('camera', 16), h('span', {}, 'Buka kamera'));
        console.error(error);
        status.textContent = 'Kamera tidak dapat dibuka: ' + (error.message || 'periksa izin kamera atau masukkan ID anggota secara manual');
      }
    };
    content.push(
      h('h3', {}, 'Pemindaian QR'),
      h('p', { class: 'activity-help' }, 'QR berisi ID anggota. Pemindaian akan mencatat kehadiran dan menempatkan anggota di wilayah profilnya.'),
      h('div', { class: 'activity-scanner-row' }, barcodeInput, h('button', { class: 'btn s', onclick: submitBarcode }, 'Catat hadir')),
      h('div', { class: 'activity-scanner-row' }, scanButton),
      scannerVideo, status
    );
  }
  return h('article', { class: 'card activity-card' }, ...content);
}

export function vActivity() {
  const events = [...S.events].sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || '') || (b.at || 0) - (a.at || 0));
  return [h('h1', {}, 'Kegiatan'), h('p', { class: 'sub' }, 'Rencanakan kegiatan, daftarkan anggota, dan catat kehadiran.'), guard(),
    events.length ? h('div', { class: 'activity-list' }, ...events.map(activityCard)) : h('p', { class: 'warn' }, 'Belum ada kegiatan.')];
}

export function vKegiatan() {
  const title = h('input', { placeholder: 'Nama kegiatan', maxlength: '150' });
  const date = h('input', { type: 'date' });
  const time = h('input', { type: 'time' });
  const location = h('input', { placeholder: 'Lokasi kegiatan', maxlength: '180' });
  const description = h('textarea', { placeholder: 'Deskripsi atau informasi kegiatan', maxlength: '1000', rows: '3' });
  const events = [...S.events].sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || '') || (b.at || 0) - (a.at || 0));
  const createForm = S.admin && h('section', { class: 'card activity-create' }, h('h2', {}, 'Buat kegiatan'),
    h('label', { class: 'activity-field' }, 'Nama kegiatan *', title),
    h('div', { class: 'activity-create-grid' }, h('label', { class: 'activity-field' }, 'Tanggal *', date), h('label', { class: 'activity-field' }, 'Waktu', time)),
    h('label', { class: 'activity-field' }, 'Lokasi', location),
    h('label', { class: 'activity-field' }, 'Deskripsi', description),
    h('button', { class: 'btn', onclick: async () => {
      const judul = title.value.trim();
      if (!judul || !date.value) { alert('Isi nama dan tanggal kegiatan.'); return }
      try {
        await S.db.collection('events').add({ judul, tanggal: date.value, waktu: time.value, lokasi: location.value.trim(), deskripsi: description.value.trim(), peserta_anggota: [], hadir_anggota: [], at: Date.now() });
        title.value = ''; date.value = ''; time.value = ''; location.value = ''; description.value = '';
      } catch (error) { console.error(error); alert('Gagal membuat kegiatan: ' + (error.message || 'periksa koneksi')) }
    } }, 'Buat kegiatan'));
  return [
    h('h1', {}, 'Kegiatan'),
    h('p', { class: 'sub' }, 'Rencanakan kegiatan, daftarkan anggota, dan catat kehadiran.'),
    guard(),
    createForm,
    events.length ? h('div', { class: 'activity-list' }, ...events.map(activityCard)) : h('p', { class: 'warn' }, 'Belum ada kegiatan.')
  ];
}