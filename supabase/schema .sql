-- =====================================================================
-- SHIKOKU FAMILY - SKEMA DATABASE TUNGGAL (jalankan SELURUH file ini)
-- Aman dijalankan berulang kali. Menggantikan Schema.sql dan migrasi lama.
-- Cara: Supabase Dashboard > SQL Editor > tempel semua > Run.
-- =====================================================================

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  avatar_url text,
  email text,
  role text not null default 'member'
    check (role in ('admin', 'member')),
  is_main_admin boolean not null default false,
  approval_status text not null default 'pending'
    check (approval_status in ('pending', 'approved', 'rejected')),
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists is_main_admin boolean not null default false;
alter table public.profiles
  add column if not exists name text;
alter table public.profiles
  add column if not exists avatar_url text;
alter table public.profiles
  add column if not exists email text;
alter table public.profiles
  add column if not exists approval_status text not null default 'pending';
alter table public.profiles
  add column if not exists approved_at timestamptz;
alter table public.profiles
  add column if not exists created_at timestamptz not null default now();

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'region'
  ) then
    alter table public.profiles alter column region drop not null;
  end if;
end $$;

do $$
begin
  alter table public.profiles
    add constraint profiles_approval_status_check
    check (approval_status in ('pending', 'approved', 'rejected'));
exception
  when duplicate_object then null;
end $$;

update public.profiles
set approval_status = 'approved'
where role = 'admin' or approval_status is null;

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  message text not null check (char_length(trim(message)) between 1 and 5000),
  sender_id uuid references auth.users(id) on delete set null,
  status text not null default 'unread'
    check (status in ('unread', 'read', 'replied')),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  replied_at timestamptz,
  attachments jsonb not null default '[]'::jsonb
);
alter table public.messages add column if not exists attachments jsonb not null default '[]'::jsonb;

create table if not exists public.message_replies (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  message text not null check (char_length(trim(message)) between 1 and 5000),
  created_at timestamptz not null default now(),
  attachments jsonb not null default '[]'::jsonb
);
alter table public.message_replies add column if not exists attachments jsonb not null default '[]'::jsonb;

create index if not exists messages_status_created_at_idx
  on public.messages (status, created_at desc);

create index if not exists message_replies_message_created_at_idx
  on public.message_replies (message_id, created_at);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'message_replies'
  ) then
    alter publication supabase_realtime add table public.message_replies;
  end if;
end $$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

create or replace function public.is_main_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
      and is_main_admin = true
  );
$$;

revoke all on function public.is_main_admin() from public;
grant execute on function public.is_main_admin() to anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, approval_status)
  values (
    new.id,
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    new.email,
    'pending'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.confirm_auth_user_after_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.approval_status = 'approved' and tg_op = 'INSERT' then
    update auth.users
    set email_confirmed_at = coalesce(email_confirmed_at, now())
    where id = new.id
      and email_confirmed_at is null;
  elsif new.approval_status = 'approved'
    and tg_op = 'UPDATE'
    and old.approval_status is distinct from new.approval_status then
    update auth.users
    set email_confirmed_at = coalesce(email_confirmed_at, now())
    where id = new.id
      and email_confirmed_at is null;
  end if;
  return new;
end;
$$;

revoke all on function public.confirm_auth_user_after_approval() from public;

drop trigger if exists on_profile_approved on public.profiles;
create trigger on_profile_approved
  after insert or update of approval_status on public.profiles
  for each row execute procedure public.confirm_auth_user_after_approval();

update auth.users as u
set email_confirmed_at = coalesce(u.email_confirmed_at, now())
from public.profiles as p
where p.id = u.id
  and p.approval_status = 'approved'
  and u.email_confirmed_at is null;

grant usage on schema public to supabase_auth_admin;
grant insert on public.profiles to supabase_auth_admin;

create table if not exists public.map_settings (
  id text primary key check (id = 'main'),
  map_mid text not null check (char_length(trim(map_mid)) > 0),
  updated_at timestamptz not null default now()
);

alter table public.map_settings enable row level security;

drop policy if exists "Anyone can read map settings" on public.map_settings;
create policy "Anyone can read map settings"
  on public.map_settings for select
  to anon, authenticated
  using (true);

drop policy if exists "Admins can create map settings" on public.map_settings;
create policy "Admins can create map settings"
  on public.map_settings for insert
  to authenticated
  with check (public.is_main_admin());

drop policy if exists "Admins can update map settings" on public.map_settings;
create policy "Admins can update map settings"
  on public.map_settings for update
  to authenticated
  using (public.is_main_admin())
  with check (public.is_main_admin());

drop policy if exists "Admins can delete map settings" on public.map_settings;
create policy "Admins can delete map settings"
  on public.map_settings for delete
  to authenticated
  using (public.is_main_admin());

alter table public.profiles enable row level security;
alter table public.messages enable row level security;

drop policy if exists "Auth service can create profiles" on public.profiles;
create policy "Auth service can create profiles"
  on public.profiles for insert
  to supabase_auth_admin
  with check (true);

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()) or public.is_admin());

drop policy if exists "Main admins can approve profiles" on public.profiles;
create policy "Main admins can approve profiles"
  on public.profiles for update
  to authenticated
  using (public.is_main_admin())
  with check (public.is_main_admin());

drop policy if exists "Admins can read messages" on public.messages;
create policy "Admins can read messages"
  on public.messages for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Users can read their own messages" on public.messages;
create policy "Users can read their own messages"
  on public.messages for select
  to authenticated
  using (sender_id = (select auth.uid()));

drop policy if exists "Admins can update messages" on public.messages;
create policy "Admins can update messages"
  on public.messages for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can delete messages" on public.messages;
create policy "Admins can delete messages"
  on public.messages for delete
  to authenticated
  using (public.is_admin());

grant usage on schema public to anon, authenticated;
grant select on public.map_settings to anon, authenticated;
grant insert, update, delete on public.map_settings to authenticated;
grant insert on public.messages to authenticated;
revoke insert on public.messages from anon;
grant select on public.profiles to authenticated;
grant update on public.profiles to authenticated;
grant select, update, delete on public.messages to authenticated;
grant select, insert on public.message_replies to authenticated;

alter table public.message_replies enable row level security;

insert into storage.buckets (id, name, public)
values ('message-attachments', 'message-attachments', true)
on conflict (id) do update set public = true;

drop policy if exists "Message participants can upload attachments" on storage.objects;
create policy "Message participants can upload attachments"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'message-attachments'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Anyone can read message attachments" on storage.objects;
create policy "Anyone can read message attachments"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'message-attachments');

drop policy if exists "Owners can delete message attachments" on storage.objects;
create policy "Owners can delete message attachments"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'message-attachments'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Message participants can read replies" on public.message_replies;
create policy "Message participants can read replies"
  on public.message_replies for select
  to authenticated
  using (
    public.is_admin()
    or sender_id = (select auth.uid())
    or exists (
      select 1
      from public.messages
      where messages.id = message_replies.message_id
        and messages.sender_id = (select auth.uid())
    )
  );

drop policy if exists "Message participants can send replies" on public.message_replies;
create policy "Message participants can send replies"
  on public.message_replies for insert
  to authenticated
  with check (
    sender_id = (select auth.uid())
    and (
      public.is_admin()
      or exists (
        select 1
        from public.messages
        where messages.id = message_replies.message_id
          and messages.sender_id = (select auth.uid())
      )
    )
  );

-- Jalankan setelah membuat akun admin di Authentication > Users:
-- insert into public.profiles (id, name, role)
-- values ('UUID_USER_ADMIN', 'Nama Admin', 'admin');
-- Tandai akun admin utama:
-- update public.profiles set is_main_admin = true where id = 'UUID_USER_ADMIN';

-- Shared application data for members, events, forum topics, duties, and map pins.
create table if not exists public.app_data (
  collection text not null
    check (collection in ('members', 'events', 'topics', 'cleaning_duties', 'pin')),
  id text not null,
  data jsonb not null
    check (jsonb_typeof(data) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (collection, id)
);

create index if not exists app_data_collection_updated_at_idx
  on public.app_data (collection, updated_at desc);

alter table public.app_data enable row level security;
alter table public.app_data replica identity full;

create or replace function public.is_approved_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and (approval_status = 'approved' or role = 'admin')
  );
$$;

revoke all on function public.is_approved_member() from public;
grant execute on function public.is_approved_member() to authenticated;

create or replace function public.merge_app_data(
  p_collection text,
  p_id text,
  p_patch jsonb
)
returns void
language plpgsql
set search_path = public
as $$
begin
  if jsonb_typeof(p_patch) is distinct from 'object' then
    raise exception 'Data patch must be a JSON object';
  end if;

  update public.app_data
  set data = data || p_patch,
      updated_at = now()
  where collection = p_collection
    and id = p_id;

  if not found then
    raise exception 'Application data row not found';
  end if;
end;
$$;

revoke all on function public.merge_app_data(text, text, jsonb) from public;
grant execute on function public.merge_app_data(text, text, jsonb) to authenticated;

drop policy if exists "Approved members can read application data" on public.app_data;
create policy "Approved members can read application data"
  on public.app_data for select
  to authenticated
  using (public.is_approved_member());

drop policy if exists "Members can create forum topics and admins can create data" on public.app_data;
create policy "Members can create forum topics and admins can create data"
  on public.app_data for insert
  to authenticated
  with check (
    public.is_approved_member()
    and (
      public.is_admin()
      or (
        collection = 'topics'
        and data->>'by' = (select auth.uid())::text
      )
    )
  );

drop policy if exists "Admins can update application data" on public.app_data;
create policy "Admins can update application data"
  on public.app_data for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can delete application data" on public.app_data;
create policy "Admins can delete application data"
  on public.app_data for delete
  to authenticated
  using (public.is_admin());

grant select, insert, update, delete on public.app_data to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'app_data'
  ) then
    alter publication supabase_realtime add table public.app_data;
  end if;
end $$;

-- Private storage for member profile photos and documents.
insert into storage.buckets (id, name, public)
values ('member-files', 'member-files', false)
on conflict (id) do update set public = false;

drop policy if exists "Approved members can read member files" on storage.objects;
create policy "Approved members can read member files"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'member-files'
    and public.is_approved_member()
  );

drop policy if exists "Admins can upload member files" on storage.objects;
create policy "Admins can upload member files"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'member-files'
    and public.is_admin()
  );

drop policy if exists "Admins can update member files" on storage.objects;
create policy "Admins can update member files"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'member-files'
    and public.is_admin()
  )
  with check (
    bucket_id = 'member-files'
    and public.is_admin()
  );

drop policy if exists "Admins can delete member files" on storage.objects;
create policy "Admins can delete member files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'member-files'
    and public.is_admin()
  );


-- ---------------------------------------------------------------------
-- PERBAIKAN KEAMANAN
-- ---------------------------------------------------------------------

-- Pesan ke admin: hanya akun yang sudah login dan disetujui (bukan anonim).
drop policy if exists "Anyone can submit a message" on public.messages;
drop policy if exists "Approved members can submit a message" on public.messages;
create policy "Approved members can submit a message"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.is_approved_member()
  );

-- Hapus kebijakan storage lama yang terlalu longgar (dari Schema.sql versi lama):
-- tadinya SIAPA PUN (tanpa login) bisa membaca foto/dokumen anggota.
drop policy if exists "Members can upload their own photo" on storage.objects;
drop policy if exists "Anyone can read member files" on storage.objects;
drop policy if exists "Owners can delete their member files" on storage.objects;

-- Tabel kunjungan situs dari versi lama tidak dipakai lagi oleh aplikasi.
-- Datanya TIDAK dihapus otomatis. Bila yakin tidak perlu, jalankan manual:
--   drop table if exists public.site_visit_summaries cascade;
--   drop function if exists public.record_site_visit(text, text, text, text, double precision, double precision, text, text);

-- ---------------------------------------------------------------------
-- LANGKAH MANUAL SETELAH SKEMA (sekali saja):
-- 1) Authentication > Users: buat/pilih akun admin, salin UUID-nya.
-- 2) Jalankan (ganti UUID dan nama):
--    insert into public.profiles (id, name, role, approval_status)
--    values ('UUID_USER_ADMIN', 'Nama Admin', 'admin', 'approved')
--    on conflict (id) do update set role = 'admin', approval_status = 'approved';
--    update public.profiles set is_main_admin = true where id = 'UUID_USER_ADMIN';
-- ---------------------------------------------------------------------
