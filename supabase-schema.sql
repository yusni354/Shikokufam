-- Supabase schema for Shikoku Family messaging and admin access.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  role text not null default 'member'
    check (role in ('admin', 'member')),
  is_main_admin boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists is_main_admin boolean not null default false;

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

create table if not exists public.message_replies (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  message text not null check (char_length(trim(message)) between 1 and 5000),
  created_at timestamptz not null default now()
);

create index if not exists messages_status_created_at_idx
  on public.messages (status, created_at desc);

create index if not exists message_replies_message_created_at_idx
  on public.message_replies (message_id, created_at);

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
grant insert on public.messages to anon, authenticated;
grant select on public.profiles to authenticated;
grant select, update, delete on public.messages to authenticated;
grant select, insert on public.message_replies to authenticated;

alter table public.message_replies enable row level security;

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
