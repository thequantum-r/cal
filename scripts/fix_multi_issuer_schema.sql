-- ========== FIX MULTI-ISSUER SCHEMA (SAFE VERSION) ==========
-- This script safely fixes the multi-issuer schema without conflicts

-- First, let's disable RLS temporarily to fix the policies
alter table issuers disable row level security;
alter table issuer_users disable row level security;
alter table securities disable row level security;

-- Drop all existing policies to start fresh
drop policy if exists issuers_super_admin_read on issuers;
drop policy if exists issuers_issuer_admin_read on issuers;
drop policy if exists issuers_super_admin_write on issuers;

drop policy if exists issuer_users_super_admin_read on issuer_users;
drop policy if exists issuer_users_self_read on issuer_users;
drop policy if exists issuer_users_issuer_admin_read on issuer_users;
drop policy if exists issuer_users_super_admin_write on issuer_users;
drop policy if exists issuer_users_issuer_admin_write on issuer_users;

drop policy if exists securities_super_admin_read on securities;
drop policy if exists securities_issuer_read on securities;
drop policy if exists securities_super_admin_write on securities;
drop policy if exists securities_issuer_admin_write on securities;

-- Now create simple, safe policies without circular references
-- Enable RLS again
alter table issuers enable row level security;
alter table issuer_users enable row level security;
alter table securities enable row level security;

-- Simple policies for issuers
create policy issuers_admin_access
on issuers for all
to authenticated
using ( public.current_user_role() = 'admin' )
with check ( public.current_user_role() = 'admin' );

-- Simple policies for issuer_users
create policy issuer_users_admin_access
on issuer_users for all
to authenticated
using ( public.current_user_role() = 'admin' )
with check ( public.current_user_role() = 'admin' );

-- Simple policies for securities
create policy securities_admin_access
on securities for all
to authenticated
using ( public.current_user_role() = 'admin' )
with check ( public.current_user_role() = 'admin' );

-- Update existing table policies to be simpler
drop policy if exists sh_read_all on shareholders;
create policy sh_read_all
on shareholders for select
to authenticated
using ( public.current_user_role() = 'admin' );

drop policy if exists tjr_read_all on transfer_journal_records;
create policy tjr_read_all
on transfer_journal_records for select
to authenticated
using ( public.current_user_role() = 'admin' );

drop policy if exists tr_read_all on transfers;
create policy tr_read_all
on transfers for select
to authenticated
using ( public.current_user_role() = 'admin' );

drop policy if exists ds_read_all on daily_snapshots;
create policy ds_read_all
on daily_snapshots for select
to authenticated
using ( public.current_user_role() = 'admin' );

-- Add issuer_admin role if it doesn't exist
insert into roles (name, display_name, description, is_system_role, permissions) values
  ('issuer_admin', 'Issuer Admin', 'Company-specific administrator with user and data management capabilities', true, '{"users": "issuer", "shareholders": "full", "transfers": "full", "snapshots": "full", "roles": "issuer", "securities": "full"}')
on conflict (name) do nothing;

-- Ensure default issuer exists
insert into issuers (name, display_name, description) values
  ('cal_redwood', 'Cal Redwood Acquisition Corp', 'Default issuer for existing data')
on conflict (name) do nothing;

-- Update existing records to use the default issuer
update shareholders set issuer_id = (select id from issuers where name = 'cal_redwood') where issuer_id is null;
update transfer_journal_records set issuer_id = (select id from issuers where name = 'cal_redwood') where issuer_id is null;
update transfers set issuer_id = (select id from issuers where name = 'cal_redwood') where issuer_id is null;
update daily_snapshots set issuer_id = (select id from issuers where name = 'cal_redwood') where issuer_id is null;

-- Insert default securities for Cal Redwood if they don't exist
insert into securities (issuer_id, cusip, issue_name, issue_ticker, trading_platform, security_type) values
  ((select id from issuers where name = 'cal_redwood'), 'G17564124', 'Cal Redwood Acquisition Corp Units', 'CRAU', 'NASDAQ', 'Units'),
  ((select id from issuers where name = 'cal_redwood'), 'G17564108', 'Cal Redwood Acquisition Corp Class A', 'CRA', 'NASDAQ', 'Class A Ordinary Stock'),
  ((select id from issuers where name = 'cal_redwood'), 'G17564116', 'Cal Redwood Acquisition Corp Rights', 'CRAR', 'NASDAQ', 'Rights'),
  ((select id from issuers where name = 'cal_redwood'), 'NA', 'Cal Redwood Acquisition Corp Class B', 'NA', 'NA', 'Class B Ordinary Stock')
on conflict (issuer_id, cusip) do nothing;

-- Create indexes for performance
create index if not exists idx_shareholders_issuer_id on shareholders(issuer_id);
create index if not exists idx_transfer_journal_records_issuer_id on transfer_journal_records(issuer_id);
create index if not exists idx_transfers_issuer_id on transfers(issuer_id);
create index if not exists idx_daily_snapshots_issuer_id on daily_snapshots(issuer_id);
create index if not exists idx_issuer_users_user_id on issuer_users(user_id);
create index if not exists idx_issuer_users_issuer_id on issuer_users(issuer_id);
create index if not exists idx_securities_issuer_id on securities(issuer_id);
create index if not exists idx_securities_cusip on securities(cusip);

-- Add triggers for updated_at (drop if exists first)
drop trigger if exists update_issuers_updated_at on issuers;
create trigger update_issuers_updated_at
  before update on issuers
  for each row execute function update_updated_at_column();

drop trigger if exists update_issuer_users_updated_at on issuer_users;
create trigger update_issuer_users_updated_at
  before update on issuer_users
  for each row execute function update_updated_at_column();

drop trigger if exists update_securities_updated_at on securities;
create trigger update_securities_updated_at
  before update on securities
  for each row execute function update_updated_at_column();
