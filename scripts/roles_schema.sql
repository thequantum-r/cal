-- ========== ROLES MANAGEMENT ==========

-- Create roles table
create table if not exists roles (
  id uuid primary key default uuid_generate_v4(),
  name text unique not null,
  display_name text not null,
  description text,
  permissions jsonb default '{}',
  is_system_role boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Insert default system roles
insert into roles (name, display_name, description, is_system_role, permissions) values
  ('admin', 'Admin', 'Full system access with user management capabilities', true, '{"users": "full", "shareholders": "full", "transfers": "full", "snapshots": "full", "roles": "full"}'),
  ('transfer_team', 'Transfer Team', 'Can manage transfers and shareholders, limited user access', true, '{"users": "read", "shareholders": "write", "transfers": "write", "snapshots": "write", "roles": "none"}'),
  ('read_only', 'Read Only', 'View-only access to all data', true, '{"users": "read", "shareholders": "read", "transfers": "read", "snapshots": "read", "roles": "none"}')
on conflict (name) do nothing;

-- Update users table to reference roles
alter table users 
add column if not exists role_id uuid references roles(id) on delete restrict;

-- Update existing users to use role_id instead of role text
update users set role_id = (
  select id from roles where name = users.role
) where role_id is null and role is not null;

-- Make role_id not null after migration
alter table users 
alter column role_id set not null;

-- Drop the old role column and constraint
alter table users drop column if exists role;

-- Enable RLS on roles table
alter table roles enable row level security;

-- ========== ROLES POLICIES ==========
-- Everyone can read roles (needed for dropdowns)
create policy roles_read_all
on roles for select
to authenticated
using ( true );

-- Only admins can manage roles
create policy roles_admin_write
on roles for insert, update, delete
to authenticated
using ( public.current_user_role() = 'admin' )
with check ( public.current_user_role() = 'admin' );

-- ========== UPDATE CURRENT_USER_ROLE FUNCTION ==========
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select r.name
  from public.users u
  join public.roles r on u.role_id = r.id
  where u.id = auth.uid();
$$;

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

create trigger update_roles_updated_at
  before update on roles
  for each row execute procedure update_updated_at_column();






















