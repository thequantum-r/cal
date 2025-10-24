-- ========== ROLES MANAGEMENT - FINAL FIXED VERSION ==========

-- Create roles table with user tracking (if not exists)
create table if not exists roles (
  id uuid primary key default uuid_generate_v4(),
  name text unique not null,
  display_name text not null,
  description text,
  permissions jsonb default '{}',
  is_system_role boolean default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Insert default system roles (ignore if already exist)
insert into roles (name, display_name, description, is_system_role, permissions) values
  ('admin', 'Admin', 'Full system access with user management capabilities', true, '{"users": "full", "shareholders": "full", "transfers": "full", "snapshots": "full", "roles": "full"}'),
  ('transfer_team', 'Transfer Team', 'Can manage transfers and shareholders, limited user access', true, '{"users": "read", "shareholders": "write", "transfers": "write", "snapshots": "write", "roles": "none"}'),
  ('read_only', 'Read Only', 'View-only access to all data', true, '{"users": "read", "shareholders": "read", "transfers": "read", "snapshots": "read", "roles": "none"}')
on conflict (name) do nothing;

-- Add role_id column to users table (if not exists)
alter table users 
add column if not exists role_id uuid references roles(id) on delete restrict;

-- Update role_id based on existing role column
update users set role_id = (
  select id from roles where name = users.role
) where role_id is null and role is not null;

-- Set default role_id for users without it
update users set role_id = (
  select id from roles where name = 'read_only'
) where role_id is null;

-- Make sure you're admin
update users set role = 'admin', role_id = (select id from roles where name = 'admin') 
where email = 'devtheta@zemuria.com';

-- Enable RLS on roles table
alter table roles enable row level security;

-- ========== ROLES POLICIES ==========
-- Drop existing policies if they exist
drop policy if exists roles_read_all on roles;
drop policy if exists roles_admin_insert on roles;
drop policy if exists roles_admin_update on roles;
drop policy if exists roles_admin_delete on roles;

-- Create new policies
create policy roles_read_all
on roles for select
to authenticated
using ( true );

create policy roles_admin_insert
on roles for insert
to authenticated
with check ( public.current_user_role() = 'admin' );

create policy roles_admin_update
on roles for update
to authenticated
using ( public.current_user_role() = 'admin' )
with check ( public.current_user_role() = 'admin' );

create policy roles_admin_delete
on roles for delete
to authenticated
using ( public.current_user_role() = 'admin' );

-- ========== UPDATE CURRENT_USER_ROLE FUNCTION ==========
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.users where id = auth.uid();
$$;

-- ========== VIEW FOR USERS WITH ROLES ==========
create or replace view users_with_roles as
select 
  u.id,
  u.email,
  u.created_at,
  u.role,
  u.role_id,
  r.name as role_name,
  r.display_name as role_display_name,
  r.description as role_description,
  r.permissions as role_permissions,
  r.is_system_role
from public.users u
left join public.roles r on u.role_id = r.id;

-- Grant access to the view
grant select on users_with_roles to authenticated;

-- ========== TRIGGER TO UPDATE UPDATED_AT ==========
create or replace function update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists update_roles_updated_at on roles;
create trigger update_roles_updated_at
  before update on roles
  for each row execute procedure update_updated_at_column();






















