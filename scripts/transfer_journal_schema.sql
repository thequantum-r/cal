-- ========== TRANSFER JOURNAL RECORDS SCHEMA ==========

-- Create transfer_journal_records table for comprehensive record keeping
create table if not exists transfer_journal_records (
  id uuid primary key default uuid_generate_v4(),
  
  -- Basic Issue Information
  issue_name text not null,
  issue_ticker text not null,
  trading_platform text not null,
  issue_cusip text not null,
  security_type text not null,
  
  -- Transaction Details
  type_of_transaction text not null check (type_of_transaction in ('IPO', 'DWAC Withdrawal', 'DWAC Deposit')),
  credit_debit text not null check (credit_debit in ('Credit', 'Debit')),
  credit_date date,
  debit_date date,
  total_securities_issued integer not null,
  
  -- Certificate and Status
  certificates text default 'Book Entry',
  status text default 'Active',
  
  -- Account and Shareholder Information
  account_number text not null,
  shareholder_entity_last_name text not null,
  holder_type text,
  
  -- Address Information
  address_city text,
  address_state text,
  address_zip text,
  address_country text default 'USA',
  
  -- Tax Information
  taxpayer_id text,
  tin_status text,
  
  -- Metadata
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table transfer_journal_records enable row level security;

-- ========== TRANSFER JOURNAL RECORDS POLICIES ==========
-- Drop existing policies if they exist
drop policy if exists tjr_read_all on transfer_journal_records;
drop policy if exists tjr_admin_insert on transfer_journal_records;
drop policy if exists tjr_admin_update on transfer_journal_records;
drop policy if exists tjr_admin_delete on transfer_journal_records;
drop policy if exists tjr_transfer_insert on transfer_journal_records;
drop policy if exists tjr_transfer_update on transfer_journal_records;

-- Everyone can view transfer journal records
create policy tjr_read_all
on transfer_journal_records for select
to authenticated
using ( true );

-- Admin policies (separate for each operation)
create policy tjr_admin_insert
on transfer_journal_records for insert
to authenticated
with check ( public.current_user_role() = 'admin' );

create policy tjr_admin_update
on transfer_journal_records for update
to authenticated
using ( public.current_user_role() = 'admin' )
with check ( public.current_user_role() = 'admin' );

create policy tjr_admin_delete
on transfer_journal_records for delete
to authenticated
using ( public.current_user_role() = 'admin' );

-- Transfer team policies (insert and update only, no delete)
create policy tjr_transfer_insert
on transfer_journal_records for insert
to authenticated
with check ( public.current_user_role() = 'transfer_team' );

create policy tjr_transfer_update
on transfer_journal_records for update
to authenticated
using ( public.current_user_role() = 'transfer_team' )
with check ( public.current_user_role() = 'transfer_team' );

-- ========== INDEXES FOR PERFORMANCE ==========
create index if not exists idx_tjr_issue_cusip on transfer_journal_records(issue_cusip);
create index if not exists idx_tjr_transaction_type on transfer_journal_records(type_of_transaction);
create index if not exists idx_tjr_credit_date on transfer_journal_records(credit_date);
create index if not exists idx_tjr_debit_date on transfer_journal_records(debit_date);
create index if not exists idx_tjr_shareholder_name on transfer_journal_records(shareholder_entity_last_name);
create index if not exists idx_tjr_created_at on transfer_journal_records(created_at desc);

-- ========== TRIGGER FOR UPDATED_AT ==========
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Drop existing trigger if it exists
drop trigger if exists update_transfer_journal_records_updated_at on transfer_journal_records;

create trigger update_transfer_journal_records_updated_at
  before update on transfer_journal_records
  for each row
  execute function update_updated_at_column();

-- ========== HELPER FUNCTIONS ==========
-- Function to get security type based on CUSIP
create or replace function get_security_type_by_cusip(cusip_input text)
returns text
language sql
stable
as $$
  select 
    case 
      when cusip_input ~ '^[0-9]{9}$' then 'Common Stock'
      when cusip_input ~ '^[0-9]{6}[A-Z]{2}[0-9]$' then 'Preferred Stock'
      when cusip_input ~ '^[0-9]{6}[A-Z]{3}$' then 'Units'
      else 'Unknown'
    end;
$$;

-- Function to get credit/debit based on transaction type
create or replace function get_credit_debit_by_transaction(transaction_type_input text)
returns text
language sql
stable
as $$
  select 
    case 
      when transaction_type_input = 'IPO' then 'Credit'
      when transaction_type_input = 'DWAC Withdrawal' then 'Debit'
      when transaction_type_input = 'DWAC Deposit' then 'Credit'
      else 'Credit'
    end;
$$;

-- ========== SAMPLE DATA ==========
-- Insert sample records (run this after creating the table)
insert into transfer_journal_records (
  issue_name, issue_ticker, trading_platform, issue_cusip, security_type,
  type_of_transaction, credit_debit, credit_date, debit_date, total_securities_issued,
  certificates, status, account_number, shareholder_entity_last_name, holder_type,
  address_city, address_state, address_zip, address_country, taxpayer_id, tin_status
) values 
(
  'Cal Redwood Acquisition Corp Units',
  'CRAU',
  'NASDAQ',
  'G17564124',
  'Units',
  'IPO',
  'Credit',
  '2025-05-27',
  null,
  23000000,
  'Book Entry',
  'Active',
  'ACC001',
  'Sample Shareholder',
  'Individual',
  'New York',
  'NY',
  '10001',
  'USA',
  '123456789',
  'Valid'
),
(
  'Cal Redwood Acquisition Corp Units',
  'CRAU',
  'NASDAQ',
  'G17564124',
  'Units',
  'DWAC Withdrawal',
  'Debit',
  null,
  '2025-06-23',
  -255190,
  'Book Entry',
  'Active',
  'ACC002',
  'Sample Shareholder 2',
  'Institution',
  'Los Angeles',
  'CA',
  '90210',
  'USA',
  '987654321',
  'Valid'
);
