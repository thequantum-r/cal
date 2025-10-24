-- Add missing columns to shareholders table for Friday demo requirements

ALTER TABLE shareholders 
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS state text,
ADD COLUMN IF NOT EXISTS zip text,
ADD COLUMN IF NOT EXISTS country text DEFAULT 'USA',
ADD COLUMN IF NOT EXISTS email text,
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS date_of_birth date,
ADD COLUMN IF NOT EXISTS ownership_percentage decimal(5,2),
ADD COLUMN IF NOT EXISTS cost_basis decimal(12,2),
ADD COLUMN IF NOT EXISTS issue_name text,
ADD COLUMN IF NOT EXISTS issue_ticker text,
ADD COLUMN IF NOT EXISTS trading_platform text,
ADD COLUMN IF NOT EXISTS security_type text DEFAULT 'Units',
ADD COLUMN IF NOT EXISTS transaction_type text DEFAULT 'IPO',
ADD COLUMN IF NOT EXISTS credit_debit text DEFAULT 'Credit';

-- Update existing records with default values
UPDATE shareholders SET 
  city = COALESCE(city, 'Unknown'),
  state = COALESCE(state, 'Unknown'),
  zip = COALESCE(zip, '00000'),
  country = COALESCE(country, 'USA'),
  issue_name = COALESCE(issue_name, 'Company Shares'),
  security_type = COALESCE(security_type, 'Units'),
  transaction_type = COALESCE(transaction_type, 'IPO'),
  credit_debit = COALESCE(credit_debit, 'Credit');

-- Invitations table: allowed users list managed by admins
create table if not exists invited_users (
  id uuid primary key default uuid_generate_v4(),
  email text unique not null,
  name text,
  role text check (role in ('admin','transfer_team','read_only')) not null default 'read_only',
  invited_at timestamptz default now()
);

alter table invited_users enable row level security;
-- Admins can do anything on invited_users
create policy if not exists invited_admin_full on invited_users
  for all to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- Any authenticated user can select their own invite row (email match)
create policy if not exists invited_self_select on invited_users
  for select to authenticated
  using ((auth.jwt() ->> 'email') = email);

