-- ========== MULTI-ISSUER ARCHITECTURE SCHEMA ==========

-- Create issuers table (companies/organizations)
create table if not exists issuers (
  id uuid primary key default uuid_generate_v4(),
  name text unique not null,
  display_name text not null,
  description text,
  status text default 'active' check (status in ('active', 'inactive', 'suspended')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create issuer_users table (many-to-many relationship between users and issuers)
create table if not exists issuer_users (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  issuer_id uuid references issuers(id) on delete cascade,
  role_id uuid references roles(id) on delete restrict,
  is_primary boolean default false, -- Primary issuer for the user
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, issuer_id)
);

-- Add issuer_id to existing tables
alter table shareholders 
add column if not exists issuer_id uuid references issuers(id) on delete cascade;

alter table transfer_journal_records 
add column if not exists issuer_id uuid references issuers(id) on delete cascade;

alter table transfers 
add column if not exists issuer_id uuid references issuers(id) on delete cascade;

alter table daily_snapshots 
add column if not exists issuer_id uuid references issuers(id) on delete cascade;

-- Create securities table for CUSIP management per issuer
create table if not exists securities (
  id uuid primary key default uuid_generate_v4(),
  issuer_id uuid references issuers(id) on delete cascade,
  cusip text not null,
  issue_name text not null,
  issue_ticker text,
  trading_platform text,
  security_type text not null,
  status text default 'active' check (status in ('active', 'inactive')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(issuer_id, cusip)
);

-- Enable RLS on new tables
alter table issuers enable row level security;
alter table issuer_users enable row level security;
alter table securities enable row level security;

-- ========== ISSUERS POLICIES ==========
-- Drop existing policies if they exist
drop policy if exists issuers_super_admin_read on issuers;
drop policy if exists issuers_issuer_admin_read on issuers;
drop policy if exists issuers_super_admin_write on issuers;

-- Super admins can see all issuers
create policy issuers_super_admin_read
on issuers for select
to authenticated
using ( public.current_user_role() = 'admin' );

-- Issuer admins can see their own issuer
create policy issuers_issuer_admin_read
on issuers for select
to authenticated
using ( 
  exists (
    select 1 from issuer_users iu 
    join roles r on iu.role_id = r.id 
    where iu.user_id = auth.uid() 
    and iu.issuer_id = issuers.id 
    and r.name = 'issuer_admin'
  )
);

-- Only super admins can create/update/delete issuers
create policy issuers_super_admin_write
on issuers for all
to authenticated
using ( public.current_user_role() = 'admin' )
with check ( public.current_user_role() = 'admin' );

-- ========== ISSUER_USERS POLICIES ==========
-- Drop existing policies if they exist
drop policy if exists issuer_users_super_admin_read on issuer_users;
drop policy if exists issuer_users_self_read on issuer_users;
drop policy if exists issuer_users_issuer_admin_read on issuer_users;
drop policy if exists issuer_users_super_admin_write on issuer_users;
drop policy if exists issuer_users_issuer_admin_write on issuer_users;

-- Super admins can see all issuer-user relationships
create policy issuer_users_super_admin_read
on issuer_users for select
to authenticated
using ( public.current_user_role() = 'admin' );

-- Users can see their own issuer relationships
create policy issuer_users_self_read
on issuer_users for select
to authenticated
using ( user_id = auth.uid() );

-- Issuer admins can see users in their issuer
create policy issuer_users_issuer_admin_read
on issuer_users for select
to authenticated
using ( 
  exists (
    select 1 from issuer_users iu 
    join roles r on iu.role_id = r.id 
    where iu.user_id = auth.uid() 
    and iu.issuer_id = issuer_users.issuer_id 
    and r.name = 'issuer_admin'
  )
);

-- Super admins can manage all issuer-user relationships
create policy issuer_users_super_admin_write
on issuer_users for all
to authenticated
using ( public.current_user_role() = 'admin' )
with check ( public.current_user_role() = 'admin' );

-- Issuer admins can manage users in their issuer (except super admin role)
create policy issuer_users_issuer_admin_write
on issuer_users for all
to authenticated
using ( 
  exists (
    select 1 from issuer_users iu 
    join roles r on iu.role_id = r.id 
    where iu.user_id = auth.uid() 
    and iu.issuer_id = issuer_users.issuer_id 
    and r.name = 'issuer_admin'
  )
  and not exists (
    select 1 from roles r 
    where r.id = issuer_users.role_id 
    and r.name = 'admin'
  )
)
with check ( 
  exists (
    select 1 from issuer_users iu 
    join roles r on iu.role_id = r.id 
    where iu.user_id = auth.uid() 
    and iu.issuer_id = issuer_users.issuer_id 
    and r.name = 'issuer_admin'
  )
  and not exists (
    select 1 from roles r 
    where r.id = issuer_users.role_id 
    and r.name = 'admin'
  )
);

-- ========== SECURITIES POLICIES ==========
-- Drop existing policies if they exist
drop policy if exists securities_super_admin_read on securities;
drop policy if exists securities_issuer_read on securities;
drop policy if exists securities_super_admin_write on securities;
drop policy if exists securities_issuer_admin_write on securities;

-- Super admins can see all securities
create policy securities_super_admin_read
on securities for select
to authenticated
using ( public.current_user_role() = 'admin' );

-- Issuer users can see securities for their issuers
create policy securities_issuer_read
on securities for select
to authenticated
using ( 
  exists (
    select 1 from issuer_users iu 
    where iu.user_id = auth.uid() 
    and iu.issuer_id = securities.issuer_id
  )
);

-- Super admins can manage all securities
create policy securities_super_admin_write
on securities for all
to authenticated
using ( public.current_user_role() = 'admin' )
with check ( public.current_user_role() = 'admin' );

-- Issuer admins can manage securities for their issuer
create policy securities_issuer_admin_write
on securities for all
to authenticated
using ( 
  exists (
    select 1 from issuer_users iu 
    join roles r on iu.role_id = r.id 
    where iu.user_id = auth.uid() 
    and iu.issuer_id = securities.issuer_id 
    and r.name = 'issuer_admin'
  )
)
with check ( 
  exists (
    select 1 from issuer_users iu 
    join roles r on iu.role_id = r.id 
    where iu.user_id = auth.uid() 
    and iu.issuer_id = securities.issuer_id 
    and r.name = 'issuer_admin'
  )
);

-- ========== UPDATE EXISTING TABLE POLICIES ==========

-- Update shareholders policies to include issuer filtering
drop policy if exists sh_read_all on shareholders;
create policy sh_read_all
on shareholders for select
to authenticated
using ( 
  public.current_user_role() = 'admin' 
  or exists (
    select 1 from issuer_users iu 
    where iu.user_id = auth.uid() 
    and iu.issuer_id = shareholders.issuer_id
  )
);

-- Update transfer_journal_records policies
drop policy if exists tjr_read_all on transfer_journal_records;
create policy tjr_read_all
on transfer_journal_records for select
to authenticated
using ( 
  public.current_user_role() = 'admin' 
  or exists (
    select 1 from issuer_users iu 
    where iu.user_id = auth.uid() 
    and iu.issuer_id = transfer_journal_records.issuer_id
  )
);

-- Update transfers policies
drop policy if exists tr_read_all on transfers;
create policy tr_read_all
on transfers for select
to authenticated
using ( 
  public.current_user_role() = 'admin' 
  or exists (
    select 1 from issuer_users iu 
    where iu.user_id = auth.uid() 
    and iu.issuer_id = transfers.issuer_id
  )
);

-- Update daily_snapshots policies
drop policy if exists ds_read_all on daily_snapshots;
create policy ds_read_all
on daily_snapshots for select
to authenticated
using ( 
  public.current_user_role() = 'admin' 
  or exists (
    select 1 from issuer_users iu 
    where iu.user_id = auth.uid() 
    and iu.issuer_id = daily_snapshots.issuer_id
  )
);

-- ========== ADD NEW ROLES ==========
-- Insert issuer_admin role
insert into roles (name, display_name, description, is_system_role, permissions) values
  ('issuer_admin', 'Issuer Admin', 'Company-specific administrator with user and data management capabilities', true, '{"users": "issuer", "shareholders": "full", "transfers": "full", "snapshots": "full", "roles": "issuer", "securities": "full"}')
on conflict (name) do nothing;

-- ========== HELPER FUNCTIONS ==========

-- Function to get current user's primary issuer
create or replace function public.current_user_primary_issuer()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select issuer_id
  from issuer_users
  where user_id = auth.uid() and is_primary = true
  limit 1;
$$;

-- Function to get current user's issuer role
create or replace function public.current_user_issuer_role(issuer_uuid uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select r.name
  from issuer_users iu
  join roles r on iu.role_id = r.id
  where iu.user_id = auth.uid() and iu.issuer_id = issuer_uuid;
$$;

-- Function to check if user has access to issuer
create or replace function public.user_has_issuer_access(issuer_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from issuer_users
    where user_id = auth.uid() and issuer_id = issuer_uuid
  ) or public.current_user_role() = 'admin';
$$;

-- ========== INDEXES FOR PERFORMANCE ==========
create index if not exists idx_shareholders_issuer_id on shareholders(issuer_id);
create index if not exists idx_transfer_journal_records_issuer_id on transfer_journal_records(issuer_id);
create index if not exists idx_transfers_issuer_id on transfers(issuer_id);
create index if not exists idx_daily_snapshots_issuer_id on daily_snapshots(issuer_id);
create index if not exists idx_issuer_users_user_id on issuer_users(user_id);
create index if not exists idx_issuer_users_issuer_id on issuer_users(issuer_id);
create index if not exists idx_securities_issuer_id on securities(issuer_id);
create index if not exists idx_securities_cusip on securities(cusip);

-- ========== TRIGGERS ==========
create trigger update_issuers_updated_at
  before update on issuers
  for each row execute function update_updated_at_column();

create trigger update_issuer_users_updated_at
  before update on issuer_users
  for each row execute function update_updated_at_column();

create trigger update_securities_updated_at
  before update on securities
  for each row execute function update_updated_at_column();

-- ========== DEFAULT DATA ==========
-- Insert default issuer for existing data
insert into issuers (name, display_name, description) values
  ('cal_redwood', 'Cal Redwood Acquisition Corp', 'Default issuer for existing data')
on conflict (name) do nothing;

-- Update existing records to use the default issuer
update shareholders set issuer_id = (select id from issuers where name = 'cal_redwood') where issuer_id is null;
update transfer_journal_records set issuer_id = (select id from issuers where name = 'cal_redwood') where issuer_id is null;
update transfers set issuer_id = (select id from issuers where name = 'cal_redwood') where issuer_id is null;
update daily_snapshots set issuer_id = (select id from issuers where name = 'cal_redwood') where issuer_id is null;

-- Insert default securities for Cal Redwood
insert into securities (issuer_id, cusip, issue_name, issue_ticker, trading_platform, security_type) values
  ((select id from issuers where name = 'cal_redwood'), 'G17564124', 'Cal Redwood Acquisition Corp Units', 'CRAU', 'NASDAQ', 'Units'),
  ((select id from issuers where name = 'cal_redwood'), 'G17564108', 'Cal Redwood Acquisition Corp Class A', 'CRA', 'NASDAQ', 'Class A Ordinary Stock'),
  ((select id from issuers where name = 'cal_redwood'), 'G17564116', 'Cal Redwood Acquisition Corp Rights', 'CRAR', 'NASDAQ', 'Rights'),
  ((select id from issuers where name = 'cal_redwood'), 'NA', 'Cal Redwood Acquisition Corp Class B', 'NA', 'NA', 'Class B Ordinary Stock')
on conflict (issuer_id, cusip) do nothing;
