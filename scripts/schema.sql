-- ========== CORE TABLES ==========
create extension if not exists "uuid-ossp";

create table if not exists users (
  id uuid primary key default uuid_generate_v4(),
  email text unique not null,
  role text check (role in ('admin','transfer_team','read_only')) not null default 'read_only',
  created_at timestamptz default now()
);

create table if not exists shareholders (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  address text not null,
  tax_id text not null,
  account_number text not null,
  shares_owned integer not null,
  acquisition_date date not null,
  cusip text not null,
  created_at timestamptz default now()
);

create table if not exists transfers (
  id uuid primary key default uuid_generate_v4(),
  from_shareholder_id uuid references shareholders(id) on delete cascade,
  to_shareholder_id uuid references shareholders(id) on delete cascade,
  shares_transferred integer not null,
  transfer_date date not null,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists daily_snapshots (
  id uuid primary key default uuid_generate_v4(),
  date date not null,
  shareholder_id uuid references shareholders(id) on delete cascade,
  shares_owned integer not null,
  created_at timestamptz default now()
);

-- ========== RLS ON ==========
alter table users enable row level security;
alter table shareholders enable row level security;
alter table transfers enable row level security;
alter table daily_snapshots enable row level security;

-- ========== HELPERS ==========
-- Get current user's app role (from public.users mapped by auth.uid())
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.users
  where id = auth.uid();
$$;

-- ========== POLICIES: USERS ==========
-- 1) A logged-in user can see their own users row
create policy users_self_read
on users for select
to authenticated
using ( id = auth.uid() );

-- 2) Only admins can list all users
create policy users_admin_read_all
on users for select
to authenticated
using ( public.current_user_role() = 'admin' );

-- 3) Only admins can update roles / manage users
create policy users_admin_write
on users for insert, update, delete
to authenticated
using ( public.current_user_role() = 'admin' )
with check ( public.current_user_role() = 'admin' );

-- ========== POLICIES: SHAREHOLDERS ==========
-- Everyone logged in can view (read-only role included)
create policy sh_read_all
on shareholders for select
to authenticated
using ( true );

-- Admin full write
create policy sh_admin_write
on shareholders for insert, update, delete
to authenticated
using ( public.current_user_role() = 'admin' )
with check ( public.current_user_role() = 'admin' );

-- Transfer team can insert/update (no delete)
create policy sh_transfer_rw
on shareholders for insert, update
to authenticated
using ( public.current_user_role() = 'transfer_team' )
with check ( public.current_user_role() = 'transfer_team' );

-- ========== POLICIES: TRANSFERS ==========
-- Everyone can view transfers
create policy tr_read_all
on transfers for select
to authenticated
using ( true );

-- Admin full write
create policy tr_admin_write
on transfers for insert, update, delete
to authenticated
using ( public.current_user_role() = 'admin' )
with check ( public.current_user_role() = 'admin' );

-- Transfer team can insert/update (no delete)
create policy tr_transfer_rw
on transfers for insert, update
to authenticated
using ( public.current_user_role() = 'transfer_team' )
with check ( public.current_user_role() = 'transfer_team' );

-- ========== POLICIES: DAILY_SNAPSHOTS ==========
-- Everyone can view snapshots
create policy ds_read_all
on daily_snapshots for select
to authenticated
using ( true );

-- Admin full write
create policy ds_admin_write
on daily_snapshots for insert, update, delete
to authenticated
using ( public.current_user_role() = 'admin' )
with check ( public.current_user_role() = 'admin' );

-- Transfer team can insert/update (no delete)
create policy ds_transfer_rw
on daily_snapshots for insert, update
to authenticated
using ( public.current_user_role() = 'transfer_team' )
with check ( public.current_user_role() = 'transfer_team' );

-- ========== AUTH → USERS SYNC ==========
-- On new auth.user, create corresponding public.users row with default role 'read_only'
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, role)
  values (new.id, new.email, 'read_only')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ========== QUALITY OF LIFE ==========
-- Seed a default admin (optional): Replace with your own auth user UUID & email
-- insert into public.users (id, email, role) values
-- ('00000000-0000-0000-0000-000000000000','you@usefficiency.com','admin')
-- on conflict (id) do nothing;

-- NOTE: The Supabase service_role key bypasses RLS (for seeds/scripts). Normal client keys obey RLS.
