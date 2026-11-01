-- Aturan keamanan (RLS). Jalankan SETELAH schema.sql.
-- Prinsip: pendaftar "menunggu" hanya melihat profilnya sendiri.
-- Anggota yang disetujui bisa membaca data komunitas.
-- Tulis/hapus data hanya untuk admin yang disetujui, kecuali forum yang
-- boleh ditulis anggota yang disetujui. Perubahan peran/status hanya lewat api/.

alter table profiles enable row level security;
alter table anggota enable row level security;
alter table absensi enable row level security;
alter table galeri enable row level security;
alter table forum_posts enable row level security;
alter table forum_comments enable row level security;
alter table wilayah enable row level security;
alter table operator enable row level security;
alter table import_log enable row level security;

-- Fungsi bantu: apakah pengguna ini admin yang sudah disetujui?
create or replace function is_admin() returns boolean as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
      and status_persetujuan = 'disetujui'
      and peran in ('admin', 'super_admin')
  );
$$ language sql security definer stable;

create or replace function is_approved() returns boolean as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and status_persetujuan = 'disetujui'
  );
$$ language sql security definer stable;

-- profiles: lihat profil sendiri + semua profil untuk admin; daftar (insert) untuk diri sendiri.
create policy "profil sendiri bisa dibaca" on profiles for select
  using (id = auth.uid() or is_admin());
create policy "daftar bisa membuat profil sendiri" on profiles for insert
  with check (id = auth.uid());
create policy "admin bisa mengubah profil" on profiles for update using (is_admin());

-- anggota, absensi, galeri, wilayah, operator: baca untuk yang disetujui, tulis untuk admin.
create policy "anggota dibaca yang disetujui" on anggota for select using (is_approved());
create policy "anggota ditulis admin" on anggota for all using (is_admin()) with check (is_admin());
create policy "absensi dibaca yang disetujui" on absensi for select using (is_approved());
create policy "absensi ditulis admin" on absensi for all using (is_admin()) with check (is_admin());
create policy "galeri dibaca yang disetujui" on galeri for select using (is_approved());
create policy "galeri ditulis admin" on galeri for all using (is_admin()) with check (is_admin());
create policy "wilayah dibaca yang disetujui" on wilayah for select using (is_approved());
create policy "wilayah ditulis admin" on wilayah for all using (is_admin()) with check (is_admin());
create policy "operator dibaca yang disetujui" on operator for select using (is_approved());
create policy "operator ditulis admin" on operator for all using (is_admin()) with check (is_admin());

-- Forum: baca untuk yang disetujui, tulis untuk yang disetujui, hapus untuk admin.
create policy "forum dibaca yang disetujui" on forum_posts for select using (is_approved());
create policy "forum ditulis yang disetujui" on forum_posts for insert with check (is_approved());
create policy "forum dihapus admin" on forum_posts for delete using (is_admin());
create policy "komentar dibaca yang disetujui" on forum_comments for select using (is_approved());
create policy "komentar ditulis yang disetujui" on forum_comments for insert with check (is_approved());
create policy "komentar dihapus admin" on forum_comments for delete using (is_admin());

-- import_log: hanya admin yang bisa membaca dan menulis.
create policy "import hanya admin" on import_log for all using (is_admin()) with check (is_admin());
