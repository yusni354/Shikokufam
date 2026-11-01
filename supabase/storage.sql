-- Bucket foto Galeri. Jalankan di Supabase SQL Editor.
-- Hanya perlu dijalankan kalau admin memakai unggah berkas di menu Galeri.
-- Kalau admin hanya menempel tautan foto, berkas ini boleh dilewati.
insert into storage.buckets (id, name, public)
values ('galeri', 'galeri', true)
on conflict (id) do update set public = true;

-- Foto boleh dilihat siapa saja yang punya tautannya (bucket publik).
-- Unggah dan hapus hanya untuk admin yang sudah disetujui (memakai fungsi is_admin()
-- dari supabase/rls.sql, jadi jalankan rls.sql dulu).
-- Baris DROP di bawah supaya berkas ini aman dijalankan ulang.
drop policy if exists "galeri dibaca publik" on storage.objects;
drop policy if exists "galeri diunggah admin" on storage.objects;
drop policy if exists "galeri dihapus admin" on storage.objects;
create policy "galeri dibaca publik" on storage.objects for select
  using (bucket_id = 'galeri');
create policy "galeri diunggah admin" on storage.objects for insert
  with check (bucket_id = 'galeri' and is_admin());
create policy "galeri dihapus admin" on storage.objects for delete
  using (bucket_id = 'galeri' and is_admin());
