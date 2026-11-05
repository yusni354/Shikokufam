-- Supabase schema for Shikoku Family messaging and admin access.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  role text not null default 'member'
    check (role in ('admin', 'member')),
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  message text not null check (char_length(trim(message)) between 1 and 5000),
  sender_id uuid references auth.users(id) on delete set null,
  status text not null default 'unread'
    check (status in ('unread', 'read', 'replied')),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  replied_at timestamptz
);

create index if not exists messages_status_created_at_idx
  on public.messages (status, created_at desc);

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

alter table public.profiles enable row level security;
alter table public.messages enable row level security;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()) or public.is_admin());

drop policy if exists "Anyone can submit a message" on public.messages;
create policy "Anyone can submit a message"
  on public.messages for insert
  to anon, authenticated
  with check (
    sender_id is null
    or sender_id = (select auth.uid())
  );

drop policy if exists "Admins can read messages" on public.messages;
create policy "Admins can read messages"
  on public.messages for select
  to authenticated
  using (public.is_admin());

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
grant insert on public.messages to anon, authenticated;
grant select on public.profiles to authenticated;
grant select, update, delete on public.messages to authenticated;

-- Jalankan setelah membuat akun admin di Authentication > Users:
-- insert into public.profiles (id, name, role)
-- values ('UUID_USER_ADMIN', 'Nama Admin', 'admin');
