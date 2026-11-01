-- Skema KOMUNITAS ID-JP — jalankan di Supabase: SQL Editor, urut dari atas ke bawah.
-- Tabel profiles terhubung ke auth.users; akun Super Admin pertama dibuat lewat
-- pendaftaran biasa, lalu perannya diubah jadi super_admin oleh pemilik proyek di SQL.

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nama_lengkap text not null,
  email text not null,
  peran text not null default 'anggota'
    check (peran in ('super_admin', 'admin', 'anggota')),
  status_persetujuan text not null default 'menunggu'
    check (status_persetujuan in ('menunggu', 'disetujui', 'ditolak')),
  created_at timestamptz default now()
);

create table if not exists anggota (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete set null,
  nama text not null,
  jenis_kelamin text check (jenis_kelamin in ('Laki-laki', 'Perempuan')),
  tanggal_lahir date,
  no_telepon text,
  email text,
  alamat_jepang text,
  kode_pos text,
  prefektur text check (prefektur in ('Tokushima', 'Kagawa', 'Ehime', 'Kochi')),
  kota text,
  wilayah text,
  pekerjaan text,
  status_tinggal text,
  tanggal_bergabung date,
  created_at timestamptz default now()
);

create table if not exists absensi (
  id uuid primary key default gen_random_uuid(),
  anggota_id uuid references anggota(id) on delete cascade,
  tanggal date not null,
  status text check (status in ('hadir', 'izin', 'alpa')),
  kegiatan text,
  keterangan text,
  created_at timestamptz default now()
);

create table if not exists galeri (
  id uuid primary key default gen_random_uuid(),
  judul text not null,
  deskripsi text,
  url_foto text not null,
  diunggah_oleh uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists forum_posts (
  id uuid primary key default gen_random_uuid(),
  judul text not null,
  isi text not null,
  dibuat_oleh uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists forum_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references forum_posts(id) on delete cascade,
  isi text not null,
  dibuat_oleh uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists wilayah (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  prefektur text check (prefektur in ('Tokushima', 'Kagawa', 'Ehime', 'Kochi')),
  keterangan text,
  link_my_maps text
);

create table if not exists operator (
  id uuid primary key default gen_random_uuid(),
  anggota_id uuid references anggota(id) on delete cascade,
  jabatan text not null,
  wilayah text,
  kontak text
);

create table if not exists import_log (
  id uuid primary key default gen_random_uuid(),
  diunggah_oleh uuid references profiles(id) on delete set null,
  nama_file text,
  jumlah_data int default 0,
  created_at timestamptz default now()
);

-- Contoh: jadikan satu akun sebagai Super Admin setelah ia mendaftar.
-- Ganti emailnya, lalu jalankan baris ini saja:
-- update profiles set peran = 'super_admin', status_persetujuan = 'disetujui'
-- where email = 'email-super-admin@contoh.com';
