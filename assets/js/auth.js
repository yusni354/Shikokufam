import { S } from './state.js';
import { h } from './dom.js';
import { $ } from './dom.js';

export function accountForm() {
  const nama = h('input', { placeholder: 'Nama lengkap', autocomplete: 'name' });
  const email = h('input', { placeholder: 'Email', type: 'email', autocomplete: 'email' });
  const password = h('input', { placeholder: 'Password', type: 'password', autocomplete: 'new-password' });
  const role = h('select', {},
    h('option', { value: 'member' }, 'Anggota'),
    h('option', { value: 'admin' }, 'Admin')
  );
  return h('div', { class: 'card auth-card' },
    h('h1', {}, 'Daftar Akun'),
    h('p', { class: 'sub' }, 'Buat akun baru untuk bergabung dengan komunitas Shikoku Family.'),
    h('label', { class: 'lb' }, 'Nama lengkap *', nama),
    h('label', { class: 'lb' }, 'Email *', email),
    h('label', { class: 'lb' }, 'Password *', password),
    h('label', { class: 'lb' }, 'Peran', role),
    h('button', { class: 'btn', onclick: async () => {
      if (!nama.value.trim() || !email.value.trim() || !password.value.trim()) {
        alert('Nama, email, dan password wajib diisi.');
        return;
      }
      try {
        if (!S.supabase) { alert('Supabase belum tersedia'); return }
        const { data, error } = await S.supabase.auth.signUp({
          email: email.value.trim(),
          password: password.value,
          options: { data: { name: nama.value.trim(), role: role.value } }
        });
        if (error) { alert('Gagal mendaftar: ' + error.message); return }
        alert('Pendaftaran berhasil. Silakan tunggu persetujuan admin.');
        nama.value = ''; email.value = ''; password.value = '';
      } catch (e) {
        console.error(e);
        alert('Gagal mendaftar: ' + (e.message || 'periksa koneksi'));
      }
    } }, 'Daftar'),
    h('p', { class: 'warn', style: 'margin-top:10px' }, 'Sudah punya akun? Silakan login.')
  );
}

export function loginForm() {
  const email = h('input', { placeholder: 'Email', type: 'email', autocomplete: 'email' });
  const password = h('input', { placeholder: 'Password', type: 'password', autocomplete: 'current-password' });
  return h('div', { class: 'card auth-card' },
    h('h1', {}, 'Masuk'),
    h('p', { class: 'sub' }, 'Masuk ke akun Shikoku Family Anda.'),
    h('label', { class: 'lb' }, 'Email *', email),
    h('label', { class: 'lb' }, 'Password *', password),
    h('button', { class: 'btn', onclick: async () => {
      if (!email.value.trim() || !password.value.trim()) {
        alert('Email dan password wajib diisi.');
        return;
      }
      try {
        if (!S.supabase) { alert('Supabase belum tersedia'); return }
        const { error } = await S.supabase.auth.signInWithPassword({
          email: email.value.trim(),
          password: password.value
        });
        if (error) { alert('Gagal masuk: ' + error.message); return }
        email.value = ''; password.value = '';
      } catch (e) {
        console.error(e);
        alert('Gagal masuk: ' + (e.message || 'periksa koneksi'));
      }
    } }, 'Masuk'),
    h('p', { class: 'warn', style: 'margin-top:10px' }, 'Belum punya akun? Silakan daftar terlebih dahulu.')
  );
}