// Membuat assets/config.js dari file .env (tanpa library tambahan).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

if (!existsSync('.env')) {
  console.error('File .env belum ada. Salin dulu: cp .env.example .env lalu isi nilainya.');
  process.exit(1);
}
const env = {};
for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m && !line.trim().startsWith('#')) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const { SUPABASE_URL: url, SUPABASE_ANON_KEY: anonKey } = env;
if (!url || !/^https:\/\/.+\.supabase\.co$/.test(url)) {
  console.error('SUPABASE_URL belum diisi dengan benar (contoh: https://abcd.supabase.co).');
  process.exit(1);
}
if (!anonKey || /KUNCI_PUBLIK_ANDA/.test(anonKey) || /service_role/i.test(anonKey)) {
  console.error('SUPABASE_ANON_KEY belum diisi dengan kunci PUBLIK yang benar.');
  process.exit(1);
}
writeFileSync('assets/config.js',
`window.SUPABASE_CONFIG = Object.freeze({
  url: ${JSON.stringify(url)},
  anonKey: ${JSON.stringify(anonKey)}
});
`);
console.log('assets/config.js berhasil dibuat.');
