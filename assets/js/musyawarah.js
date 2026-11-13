// ===== Musyawarah (meeting record) page =====
// Complete implementation for meeting recording, notes, decisions, action items.

function musyawarahView() {
  // ===== State =====
  const infoForm = {
    id: null,
    judul: '',
    tanggal: '',
    waktu_mulai: '',
    waktu_selesai: '',
    lokasi: '',
    pemimpin: '',
    notulis: '',
    status: 'terjadwal'
  };
  const peserta = [];
  const agenda = [];
  const keputusan = [];
  const tindakLanjut = [];
  const catatanPembahasan = [];
  const tabs = ['info', 'peserta', 'agenda', 'keputusan', 'tindak_lanjut'];
  let activeTab = 'info';
  let searchQuery = '';

  const allMeetings = [...S.musyawarah].sort((a, b) => (b.at || 0) - (a.at || 0));
  const members = S.members || [];

  function findMeeting(id) { return allMeetings.find(m => m.id === id); }
  function fmtDate(d) { if (!d) return '-'; const x = new Date(d + 'T00:00:00'); return isNaN(x) ? d : x.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }); }
  function fmtTime(t) { return t || '-'; }
  function fmtStatus(s) { return (s || 'terjadwal').toUpperCase(); }
  function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c])); }
  function newId() { return (crypto || window.crypto).randomUUID(); }

  // ===== Persist =====
  async function saveMeeting() {
    if (!infoForm.judul.trim()) { alert('Judul rapat wajib diisi.'); return false; }
    if (!infoForm.tanggal) { alert('Tanggal rapat wajib diisi.'); return false; }
    const data = { ...infoForm, peserta, agenda, keputusan, tindakLanjut, catatanPembahasan, updatedAt: Date.now() };
    try {
      if (infoForm.id) await S.db.collection('musyawarah').doc(infoForm.id).set(data);
      else await S.db.collection('musyawarah').add(data);
      return true;
    } catch (e) { alert('Gagal menyimpan: ' + (e.message || 'periksa koneksi')); return false; }
  }

  async function deleteMeeting(id) {
    if (!confirm('Hapus rapat ini?')) return;
    try { await S.db.collection('musyawarah').doc(id).delete(); }
    catch (e) { alert('Gagal menghapus: ' + (e.message || 'periksa koneksi')); }
  }

  function memberName(id) { const m = members.find(x => String(x.id) === String(id)); return m ? (m.nama || 'Anggota #' + id) : ('Anggota #' + id); }
  function kehadiranLabel(k) { const labels = { hadir: 'Hadir', izin: 'Izin', tidak_hadir: 'Tidak Hadir' }; return labels[k] || k; }

  // ===== Render pieces =====
  function renderInfo() {
    return h('div', { class: 'musyawarah-form-section' },
      h('label', { class: 'lb' }, 'Judul rapat', h('input', { value: infoForm.judul, oninput: (e) => { infoForm.judul = e.target.value; } })),
      h('div', { class: 'activity-create-grid' },
        h('label', { class: 'lb' }, 'Tanggal', h('input', { type: 'date', value: infoForm.tanggal, oninput: (e) => { infoForm.tanggal = e.target.value; } })),
        h('label', { class: 'lb' }, 'Waktu mulai', h('input', { type: 'time', value: infoForm.waktu_mulai, oninput: (e) => { infoForm.waktu_mulai = e.target.value; } }))
      ),
      h('div', { class: 'activity-create-grid' },
        h('label', { class: 'lb' }, 'Waktu selesai', h('input', { type: 'time', value: infoForm.waktu_selesai, oninput: (e) => { infoForm.waktu_selesai = e.target.value; } })),
        h('label', { class: 'lb' }, 'Lokasi', h('input', { value: infoForm.lokasi, oninput: (e) => { infoForm.lokasi = e.target.value; } }))
      ),
      h('label', { class: 'lb' }, 'Pemimpin rapat', h('input', { value: infoForm.pemimpin, oninput: (e) => { infoForm.pemimpin = e.target.value; } })),
      h('label', { class: 'lb' }, 'Notulis', h('input', { value: infoForm.notulis, oninput: (e) => { infoForm.notulis = e.target.value; } })),
      h('label', { class: 'lb' }, 'Status rapat', h('select', { onchange: (e) => { infoForm.status = e.target.value; } },
        ...[ 'terjadwal', 'berlangsung', 'selesai' ].map(s => h('option', { value: s }, fmtStatus(s)))))
    );
  }

  function renderPeserta() {
    const filtered = peserta.filter(p => {
      if (searchQuery) {
        if (!memberName(p.id).toLowerCase().includes(searchQuery.toLowerCase())) return false;
      }
      return true;
    });
    const attnOptions = [ 'hadir', 'izin', 'tidak_hadir' ].map(s => h('option', { value: s }, kehadiranLabel(s)));
    return h('div', { class: 'musyawarah-form-section' },
      h('p', { class: 'sub' }, 'Daftar peserta (' + filtered.length + ' dipilih)'),
      h('div', { class: 'mrow' },
        h('label', { class: 'lb', style: 'flex:1' }, 'Pilih anggota', h('select', { multiple: true, size: 5, onchange: (e) => {
            const selected = Array.from(e.target.selectedOptions || []).map(o => o.value);
            const existingIds = new Set(peserta.map(p => p.id));
            selected.forEach(id => { if (!existingIds.has(id)) peserta.push({ id, kehadiran: 'hadir' }); });
            e.target.selectedIndex = -1;
          } }),
          ...members.map(m => h('option', { value: m.id }, m.nama || 'Anggota #' + m.id))
        )
      ),
      h('div', { class: 'musyawarah-list' },
        ...filtered.map(p => {
          const curr = peserta.find(x => x.id === p.id);
          const attnSelect = h('select', { value: curr ? curr.kehadiran : 'hadir', onchange: (e) => {
              const idx = peserta.findIndex(x => x.id === p.id);
              if (idx >= 0) peserta[idx].kehadiran = e.target.value;
            } }, ...attnOptions);
          return h('div', { class: 'musyawarah-item' },
            h('span', { style: 'flex:1;min-width:0' }, memberName(p.id)),
            attnSelect,
            h('button', { class: 'btn s', onclick: () => { peserta.splice(peserta.findIndex(x => x.id === p.id), 1); } }, 'Hapus')
          );
        })
      )
    );
  }

  function renderAgenda() {
    return h('div', { class: 'musyawarah-form-section' },
      h('div', { class: 'mrow' },
        h('div', { style: 'flex:1' },
          h('div', { class: 'musyawarah-item' },
            h('span', {}, 'Poin agenda'),
            h('input', { value: '', placeholder: 'Ketik poin baru...', oninput: (e) => {
                const v = e.target.value;
                if (v.trim()) {
                  agenda.push({ id: newId(), poin: v.trim(), waktu: '', catatan: '' });
                  e.target.value = '';
                  render();
                }
              } })
          )
        )
      ),
      h('div', { class: 'musyawarah-list' },
        ...agenda.map(a =>
          h('div', { class: 'musyawarah-item' },
            h('div', { style: 'flex:1.4;min-width:0' },
              h('span', { style: 'font-weight:700' }, a.poin || '(belum diisi)'),
              h('textarea', { rows: 2, placeholder: 'Catatan pembahasan (format sederhana: **tebal**, poin #1, #2)', oninput: (e) => {
                  const idx = agenda.findIndex(x => x.id === a.id);
                  if (idx >= 0) agenda[idx].catatan = e.target.value;
                } })
            ),
            h('div', { style: 'flex:0.6;min-width:0;text-align:right', class: '' },
              h('span', { style: 'display:block;font-size:12px;color:var(--mut);margin-bottom:4px' }, 'Waktu: ' + (a.waktu || '-')),
              h('button', { class: 'btn s', onclick: () => {
                  const idx = agenda.findIndex(x => x.id === a.id);
                  if (idx >= 0) agenda.splice(idx, 1);
                } }, 'Hapus')
            )
          )
        )
      )
    );
  }

  function renderKeputusan() {
    const filtered = keputusan.filter(k => {
      if (searchQuery) {
        if (!k.teks.toLowerCase().includes(searchQuery.toLowerCase()) && !((k.agendaId || '').toString().includes(searchQuery.toLowerCase()))) return false;
      }
      return true;
    });
    return h('div', { class: 'musyawarah-form-section' },
      h('p', { class: 'sub' }, 'Keputusan yang disepakati (terhubung ke agenda terkait)'),
      h('div', { class: 'mrow' },
        h('label', { class: 'lb', style: 'flex:1' }, 'Pilih agenda', h('select', { onchange: (e) => {
            const v = e.target.value;
            if (v) {
              keputusan.push({ id: newId(), agendaId: v, teks: '' });
              e.target.value = '';
              render();
            }
          } }),
          ...agenda.map(a => h('option', { value: a.id, disabled: !a.poin }, a.poin || '(belum diisi)'))
        )
      ),
      h('div', { class: 'musyawarah-list' },
        ...filtered.map(k => {
          const a = agenda.find(x => x.id === k.agendaId);
          const agName = a ? a.poin : '(tidak terhubung)';
          return h('div', { class: 'mrow' },
            h('div', { style: 'flex:1;min-width:0' },
              h('input', { value: k.teks || '', placeholder: 'Teks keputusan', oninput: (e) => {
                  const idx = keputusan.findIndex(x => x.id === k.id);
                  if (idx >= 0) keputusan[idx].teks = e.target.value;
                } })
            ),
            h('small', { style: 'color:var(--mut)' }, '→ ' + (agName || 'tidak terhubung')),
            h('button', { class: 'btn s', onclick: () => {
                const idx = keputusan.findIndex(x => x.id === k.id);
                if (idx >= 0) keputusan.splice(idx, 1);
              } }, 'Hapus')
          );
        })
      )
    );
  }

  function renderTindakLanjut() {
    let filtered = tindakLanjut.filter(t => {
      if (searchQuery) {
        if (!t.tugas.toLowerCase().includes(searchQuery.toLowerCase()) && !memberName(t.penanggungJawab || '').toLowerCase().includes(searchQuery.toLowerCase()) && !(t.tenggat || '').toLowerCase().includes(searchQuery.toLowerCase())) return false;
      }
      return true;
    });
    const statusFilter = S.musyawarahStatus || 'semua';
    const byOwner = S.musyawarahOwner || '';
    filtered = filtered.filter(it => {
      if (statusFilter !== 'semua' && it.status !== statusFilter) return false;
      if (byOwner && it.penanggungJawab !== byOwner) return false;
      return true;
    });
    return h('div', { class: 'musyawarah-form-section' },
      h('div', { class: 'fl' },
        h('label', { class: 'lb', style: 'flex:0 0 auto' }, 'Cari:'),
        h('input', { value: searchQuery, oninput: (e) => { searchQuery = e.target.value; render(); } }),
        h('label', { class: 'lb', style: 'flex:0 0 auto;margin-left:8px' }, 'Filter status:'),
        h('select', { value: statusFilter, onChange: (e) => { S.musyawarahStatus = e.target.value; render(); } },
          ...[ ['semua', 'Semua'], ['belum', 'Belum'], ['proses', 'Proses'], ['selesai', 'Selesai'] ].map(s => h('option', { value: s[0], disabled: s[0] === 'semua' ? false : null }, s[1])))
      ),
      h('div', { class: 'mrow' },
        h('label', { class: 'lb', style: 'flex:1' }, 'Tugas'),
        h('label', { class: 'lb', style: 'flex:0 0 120px' }, 'Tanggal tenggat', h('input', { type: 'date', value: '', oninput: (e) => {
            const v = e.target.value;
            tindakLanjut.push({ id: newId(), agendaId: '', tugas: '', penanggungJawab: '', tenggat: v, status: 'belum' });
          } })),
        h('label', { class: 'lb', style: 'flex:0 0 120px' }, 'Status', h('select', { onchange: (e) => {
            const v = e.target.value;
            tindakLanjut.push({ id: newId(), agendaId: '', tugas: '', penanggungJawab: '', tenggat: '', status: v });
          } },
          ...[ 'belum', 'proses', 'selesai' ].map(s => h('option', { value: s }, s)))
        ),
        h('label', { class: 'lb', style: 'flex:0 0 120px' }, 'Penanggung jawab', h('input', { value: '', placeholder: 'Nama', oninput: (e) => {
            const v = e.target.value;
            tindakLanjut.push({ id: newId(), agendaId: '', tugas: '', penanggungJawab: v, tenggat: '', status: 'belum' });
          } }))
      ),
      h('div', { class: 'musyawarah-list' },
        ...filtered.map(t => {
          const a = agenda.find(x => x.id === t.agendaId);
          const agName = a ? a.poin : '(tidak terhubung)';
          return h('div', { class: 'mrow' },
            h('div', { style: 'flex:1;min-width:0' },
              h('b', {}, t.tugas || '(belum diisi)'),
              h('small', { style: 'color:var(--mut)' }, agName + ' · ' + (t.penanggungJawab || '-') + ' · ' + (t.tenggat ? fmtDate(t.tenggat) : '-')),
              h('small', { style: 'color:var(--mut);margin-top:4px' }, 'Status: ' + fmtStatus(t.status))
            ),
            h('div', { style: 'flex:0 0 120px;text-align:right', class: '' },
              h('button', { class: 'btn s', onclick: () => {
                  const idx = tindakLanjut.findIndex(x => x.id === t.id);
                  if (idx >= 0) tindakLanjut.splice(idx, 1);
                } }, 'Hapus')
            )
          );
        })
      )
    );
  }

  function renderSummary() {
    let meeting = null;
    if (infoForm.id) {
      meeting = findMeeting(infoForm.id);
      if (!meeting) {
        infoForm.id = null;
        infoForm.judul = '';
        infoForm.tanggal = '';
        infoForm.waktu_mulai = '';
        infoForm.waktu_selesai = '';
        infoForm.lokasi = '';
        infoForm.pemimpin = '';
        infoForm.notulis = '';
        infoForm.status = 'terjadwal';
        peserta.length = 0;
        agenda.length = 0;
        keputusan.length = 0;
        tindakLanjut.length = 0;
        catatanPembahasan.length = 0;
        meeting = null;
      }
    }

    if (!meeting) {
      return h('div', { class: 'musyawarah-summary-empty' }, h('p', { class: 'warn' }, 'Pilih rapat dari daftar atau klik "Rapat Baru" untuk membuat yang baru.'));
    }

    return h('div', { class: 'musyawarah-summary-side' },
      h('div', { class: 'musyawarah-summary-header' },
        h('div', {},
          h('h2', {}, esc(meeting.judul || 'Rapat Belum Berjudul')),
          h('p', { class: 'sub' },
            'Tanggal: ' + fmtDate(meeting.tanggal) + ' · ' + fmtTime(meeting.waktu_mulai || '-') + ' - ' + fmtTime(meeting.waktu_selesai || '-') + ' · ' + (meeting.lokasi || '-')
          )
        ),
        h('div', { class: 'musyawarah-summary-actions' },
          h('span', { class: 'tag', style: 'background:' + (meeting.status === 'berlangsung' ? '#fff3cd' : meeting.status === 'selesai' ? '#c8e6c9' : 'var(--line)') + ';color:' + (meeting.status === 'berlangsung' ? '#ff9800' : meeting.status === 'selesai' ? '#4caf50' : 'var(--mut)') }, fmtStatus(meeting.status))
        )
      ),
      h('div', { class: 'musyawarah-row' },
        h('b', {}, 'Pemimpin: '),
        h('span', {}, meeting.pemimpin || '-'),
        h('span', { style: 'flex:1' }),
        h('b', {}, 'Notulis: '),
        h('span', {}, meeting.notulis || '-')
      ),
      h('h3', { style: 'margin-top:8px' }, 'Daftar Peserta'),
      h('div', { class: 'musyawarah-list' },
        (meeting.peserta || []).map(p => {
          const curr = peserta.find(x => x.id === p.id);
          const had = curr ? curr.kehadiran : (p.kehadiran || 'hadir');
          return h('div', { class: 'musyawarah-item' },
            h('span', {}, memberName(p.id)),
            h('span', { class: 'tag', style: 'background:var(--line)' }, kehadiranLabel(had))
          );
        }) || [h('p', { class: 'warn' }, 'Belum ada peserta.')]
      ),
      h('h3', { style: 'margin-top:8px' }, 'Agenda'),
      h('div', { class: 'musyawarah-list' },
        (meeting.agenda || []).map(a =>
          h('div', { class: 'musyawarah-item' },
            h('span', { style: 'flex:1;min-width:0' }, a.poin || '(belum diisi)'),
            h('small', { style: 'color:var(--mut)' }, 'Waktu: ' + (a.waktu || '-'))
          )
        ) || [h('p', { class: 'warn' }, 'Belum ada agenda.')]
      ),
      h('h3', { style: 'margin-top:8px' }, 'Keputusan'),
      h('div', { class: 'musyawarah-list' },
        (meeting.keputusan || []).map(k =>
          h('div', { class: 'musyawarah-item' },
            h('span', { style: 'flex:1;min-width:0' }, k.teks || '(belum diisi)'),
            h('small', { style: 'color:var(--mut)' }, '→ ' + ((meeting.agenda || []).find(x => x.id === k.agendaId)?.poin) || 'tidak terhubung')
          )
        ) || [h('p', { class: 'warn' }, 'Belum ada keputusan.')]
      ),
      h('h3', { style: 'margin-top:8px' }, 'Tindak Lanjut'),
      h('div', { class: 'musyawarah-list' },
        (meeting.tindakLanjut || []).map(t =>
          h('div', { class: 'musyawarah-item' },
            h('span', { style: 'flex:1.2;min-width:0' },
              h('b', {}, t.tugas || '(belum diisi)'),
              h('small', { style: 'color:var(--mut)' }, (t.penanggungJawab || '-') + ' · ' + (t.tenggat ? fmtDate(t.tenggat) : '-')),
              h('small', { style: 'color:var(--mut);margin-top:4px' }, 'Status: ' + fmtStatus(t.status))
            ),
            h('small', { style: 'color:var(--mut)' }, '-')
          )
        ) || [h('p', { class: 'warn' }, 'Belum ada tindak lanjut.')]
      )
    );
  }

  function renderRiwayat() {
    const filtered = allMeetings.filter(m => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const match = m.judul.toLowerCase().includes(q) || (m.tanggal || '').toLowerCase().includes(q) || [...(m.agenda || []), ...(m.peserta || []), ...(m.keputusan || []), ...(m.tindakLanjut || [])].some(x => String(x).toLowerCase().includes(q));
        if (!match) return false;
      }
      return true;
    });
    return h('div', { class: 'musyawarah-riwayat' },
      h('div', { style: 'margin-bottom:12px' },
        h('input', { type: 'search', placeholder: 'Cari berdasarkan judul, tanggal, atau kata kunci...', value: searchQuery, oninput: (e) => { searchQuery = e.target.value; render(); } })
      ),
      h('h2', { style: 'margin:0 0 8px' }, 'Riwayat Rapat'),
      filtered.length ? h('div', { class: 'musyawarah-riwayat-list' },
        ...filtered.map(m => {
          return h('div', { class: 'musyawarah-riwayat-item' },
            h('div', { style: 'flex:1;min-width:0' },
              h('b', {}, m.judul || '(belum diisi)'),
              h('small', { style: 'color:var(--mut)' },
                fmtDate(m.tanggal) + ' · ' + fmtTime(m.waktu_mulai || '-') + ' - ' + fmtTime(m.waktu_selesai || '-') + ' · ' + fmtStatus(m.status)
              )
            ),
            h('div', { class: 'musyawarah-riwayat-actions' },
              h('button', { class: 'btn s', onclick: () => {
                  infoForm.id = m.id;
                  infoForm.judul = m.judul || '';
                  infoForm.tanggal = m.tanggal || '';
                  infoForm.waktu_mulai = m.waktu_mulai || '';
                  infoForm.waktu_selesai = m.waktu_selesai || '';
                  infoForm.lokasi = m.lokasi || '';
                  infoForm.pemimpin = m.pemimpin || '';
                  infoForm.notulis = m.notulis || '';
                  infoForm.status = m.status || 'terjadwal';
                  peserta.length = 0;
                  (m.peserta || []).forEach(p => { peserta.push({ id: p.id, kehadiran: p.kehadiran || 'hadir' }); });
                  agenda.length = 0;
                  (m.agenda || []).forEach(a => { agenda.push({ id: a.id, poin: a.poin || '', waktu: a.waktu || '', catatan: a.catatan || '' }); });
                  keputusan.length = 0;
                  (m.keputusan || []).forEach(k => { keputusan.push({ id: k.id, agendaId: k.agendaId || '', teks: k.teks || '' }); });
                  tindakLanjut.length = 0;
                  (m.tindakLanjut || []).forEach(t => { tindakLanjut.push({ id: t.id, agendaId: t.agendaId || '', tugas: t.tugas || '', penanggungJawab: t.penanggungJawab || '', tenggat: t.tenggat || '', status: t.status || 'belum' }); });
                  catatanPembahasan.length = 0;
                  activeTab = 'info';
                  searchQuery = '';
                  meeting = m;
                  render();
                } }, 'Lihat'),
              h('button', { class: 'btn s', onclick: () => {
                  infoForm.id = null;
                  peserta.length = 0;
                  agenda.length = 0;
                  keputusan.length = 0;
                  tindakLanjut.length = 0;
                  catatanPembahasan.length = 0;
                  activeTab = 'info';
                  searchQuery = '';
                  meeting = null;
                  render();
                } }, 'Ubah'),
              h('button', { class: 'btn s', style: 'color:#b45353', onclick: () => deleteMeeting(m.id) }, 'Hapus')
            )
          );
        })
      ) : [h('p', { class: 'warn' }, 'Belum ada rapat. Tambahkan rapat pertama di atas.')]
    );
  }

  function render() {
    let meeting = null;
    if (infoForm.id) {
      meeting = findMeeting(infoForm.id);
      if (!meeting) {
        infoForm.id = null;
        infoForm.judul = '';
        infoForm.tanggal = '';
        infoForm.waktu_mulai = '';
        infoForm.waktu_selesai = '';
        infoForm.lokasi = '';
        infoForm.pemimpin = '';
        infoForm.notulis = '';
        infoForm.status = 'terjadwal';
        peserta.length = 0;
        agenda.length = 0;
        keputusan.length = 0;
        tindakLanjut.length = 0;
        catatanPembahasan.length = 0;
        meeting = null;
      }
    }

    function getActiveTabContent() {
      if (!meeting) {
        return h('div', { class: 'musyawarah-form-section' },
          h('p', { class: 'warn' }, 'Pilih rapat dari daftar atau klik "Rapat Baru" untuk membuat yang baru.')
        );
      }
      if (activeTab === 'info') return renderInfo();
      if (activeTab === 'peserta') return renderPeserta();
      if (activeTab === 'agenda') return renderAgenda();
      if (activeTab === 'keputusan') return renderKeputusan();
      if (activeTab === 'tindak_lanjut') return renderTindakLanjut();
      return renderInfo();
    }

    const topbar = h('div', { class: 'musyawarah-topbar' },
      h('div', { style: 'flex:1' },
        h('h1', {}, 'Musyawarah'),
        h('p', { class: 'sub' }, 'Catatan lengkap hasil musyawarah komunitas.')
      ),
      h('div', { class: 'musyawarah-topbar-actions' },
        h('input', { type: 'search', placeholder: 'Cari rapat (judul/tanggal/kata kunci)', value: searchQuery, oninput: (e) => { searchQuery = e.target.value; render(); } }),
        h('button', { class: 'btn', onclick: () => {
            infoForm.id = null;
            peserta.length = 0;
            agenda.length = 0;
            keputusan.length = 0;
            tindakLanjut.length = 0;
            catatanPembahasan.length = 0;
            activeTab = 'info';
            searchQuery = '';
            meeting = null;
            render();
          } }, 'Rapat Baru')
      )
    );

    const formSide = h('div', { class: 'musyawarah-form-side' },
      h('div', { class: 'musyawarah-tab-bar' },
        ...[ 'info', 'peserta', 'agenda', 'keputusan', 'tindak_lanjut' ].map(t => h('button', { class: 'musyawarah-tab' + (activeTab === t ? ' on' : ''), onclick: () => { activeTab = t; render(); } },
          t === 'tindak_lanjut' ? 'Tindak Lanjut' : t === 'keputusan' ? 'Keputusan' : t === 'agenda' ? 'Agenda' : t === 'peserta' ? 'Peserta' : 'Info'
        ))
      ),
      h('div', { class: 'musyawarah-form' }, getActiveTabContent())
    );

    const summarySide = renderSummary();

    const exportRow = h('div', { class: 'musyawarah-export' },
      h('button', { class: 'btn s', onclick: () => {
          let text = 'NOTULEN RAPAAT\n=================\n';
          text += 'Judul: ' + (meeting ? meeting.judul : '') + '\n';
          text += 'Tanggal: ' + (meeting ? fmtDate(meeting.tanggal) : '') + '\n';
          text += 'Waktu: ' + (meeting ? fmtTime(meeting.waktu_mulai || '') + ' - ' + fmtTime(meeting.waktu_selesai || '') : '') + '\n';
          text += 'Lokasi: ' + (meeting ? (meeting.lokasi || '-') : '') + '\n';
          text += 'Pemimpin: ' + (meeting ? (meeting.pemimpin || '-') : '') + '\n';
          text += 'Notulis: ' + (meeting ? (meeting.notulis || '-') : '') + '\n';
          text += 'Status: ' + (meeting ? fmtStatus(meeting.status) : '') + '\n\n';
          text += 'PESERTA:\n';
          (meeting ? meeting.peserta : []).forEach(p => {
            const curr = peserta.find(x => x.id === p.id);
            const had = curr ? curr.kehadiran : (p.kehadiran || 'hadir');
            text += ' - ' + (memberName(p.id)) + ' [' + kehadiranLabel(had) + ']\n';
          });
          text += '\nAGENDA:\n';
          (meeting ? meeting.agenda : []).forEach(a => {
            text += ' - ' + (a.poin || '(belum diisi)') + ' [' + (a.waktu || '') + ']\n';
          });
          text += '\nKEPUTUSAN:\n';
          (meeting ? meeting.keputusan : []).forEach(k => {
            text += ' - ' + (k.teks || '') + ' (agenda: ' + ((meeting.agenda || []).find(x => x.id === k.agendaId)?.poin) + ')\n';
          });
          text += '\nTINDAK LANJUT:\n';
          (meeting ? meeting.tindakLanjut : []).forEach(t => {
            text += ' - ' + (t.tugas || '') + ' [' + (t.penanggungJawab || '') + ', ' + (t.tenggat ? fmtDate(t.tenggat) : '') + ', ' + fmtStatus(t.status) + ']\n';
          });
          const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = h('a');
          a.href = url;
          a.download = (meeting ? meeting.judul : 'notulen') + '.txt';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } }, 'Salin sebagai teks'),
      h('button', { class: 'btn s', onclick: () => { window.print(); } }, 'Cetak'),
      h('button', { class: 'btn s', onclick: () => { window.print(); } }, 'Unduh PDF')
    );

    const riwayat = renderRiwayat();

    return [topbar,
      h('div', { class: 'musyawarah-grid' },
        formSide,
        summarySide
      ),
      exportRow,
      riwayat
    ];
  }

  // Initial render
  return render();
}

// Expose globally
window.musyawarahView = musyawarahView;
