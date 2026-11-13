# Fix Guide: Shikoku Family Application

## Problem
Halaman tidak bisa dibuka semua (all pages not opening) karena:
1. Storage bucket `member-files` belum dibuat di Supabase
2. Database schema belum lengkap dengan policies yang benar
3. Admin user belum diatur

## Solution Steps

### Step 1: Apply Schema to Supabase
1. Buka Supabase Dashboard: https://supabase.com/dashboard
2. Project: `uwshronrpfkypkjqewgw`
3. Menu: **SQL Editor**
4. Copy dan jalankan seluruh isi file `Schema.sql`

### Step 2: Create Admin User
1. Buka **Authentication > Users**
2. Buat user baru atau gunakan user yang ada
3. Jalankan di SQL Editor:
```sql
insert into public.profiles (id, name, role)
values ('UUID_USER_ADMIN', 'Nama Admin', 'admin');
update public.profiles set is_main_admin = true where id = 'UUID_USER_ADMIN';
```

### Step 3: Restart Application
1. Bersihkan localStorage browser (tekan `Ctrl+Shift+Delete`, pilih "Cached images and files")
2. Muat ulang halaman browser (F5 atau Ctrl+R)

## What Was Fixed in Schema.sql

### Added `member-files` Storage Bucket
The application requires a `member-files` bucket for member photos and media. This was missing:

```sql
insert into storage.buckets (id, name, public)
values ('member-files', 'member-files', false)
on conflict (id) do update set public = false;

-- Allow members to upload their own photo
drop policy if exists "Members can upload their own photo" on storage.objects;
create policy "Members can upload their own photo"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'member-files');

-- Allow anyone to read member files (for displaying photos)
drop policy if exists "Anyone can read member files" on storage.objects;
create policy "Anyone can read member files"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'member-files');

-- Allow owners to delete their own files
drop policy if exists "Owners can delete their member files" on storage.objects;
create policy "Owners can delete their member files"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'member-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
```

### Existing Features (Already in Schema)
- `message-attachments` storage bucket with policies
- `profiles` table with `approval_status` column
- RLS policies for messages, topics, events, cleaning_duties
- Storage policies for message attachments
- Admin user setup instructions

## After Applying Schema
- Member photos will load properly
- Data subscriptions will work with proper RLS policies
- Admin features (approving users, managing members) will function
- All pages (Home, Members, Events, Schedule, Map, Forum, Messages) will open correctly