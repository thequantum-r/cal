import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function applyTransferJournalSchema() {
  console.log('Applying transfer journal schema...')
  
  const { error } = await supabase.rpc('exec', { 
    sql: `
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
      -- Everyone can view transfer journal records
      create policy if not exists tjr_read_all
      on transfer_journal_records for select
      to authenticated
      using ( true );

      -- Admin full write
      create policy if not exists tjr_admin_write
      on transfer_journal_records for insert, update, delete
      to authenticated
      using ( public.current_user_role() = 'admin' )
      with check ( public.current_user_role() = 'admin' );

      -- Transfer team can insert/update (no delete)
      create policy if not exists tjr_transfer_rw
      on transfer_journal_records for insert, update
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

      create trigger if not exists update_transfer_journal_records_updated_at
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
    `
  })
  
  if (error) {
    console.error('Schema error:', error)
    return
  }
  
  console.log('✅ Transfer journal schema applied successfully')
}

async function seedSampleData() {
  console.log('Seeding sample transfer journal records...')
  
  try {
    // Get some shareholders to reference
    const { data: shareholders } = await supabase
      .from('shareholders')
      .select('id, name, account_number, tax_id, city, state, zip, country, issue_name, issue_ticker, trading_platform')
      .limit(5)

    if (!shareholders || shareholders.length === 0) {
      console.log('No shareholders found, skipping sample data')
      return
    }

    const sampleRecords = [
      {
        issue_name: "Cal Redwood Acquisition Corp Units",
        issue_ticker: "CRAU",
        trading_platform: "NASDAQ",
        issue_cusip: "G17564124",
        security_type: "Units",
        type_of_transaction: "IPO",
        credit_debit: "Credit",
        credit_date: "2025-05-27",
        debit_date: null,
        total_securities_issued: 23000000,
        certificates: "Book Entry",
        status: "Active",
        account_number: shareholders[0]?.account_number || "ACC001",
        shareholder_entity_last_name: shareholders[0]?.name || "Sample Shareholder",
        holder_type: "Individual",
        address_city: shareholders[0]?.city || "New York",
        address_state: shareholders[0]?.state || "NY",
        address_zip: shareholders[0]?.zip || "10001",
        address_country: shareholders[0]?.country || "USA",
        taxpayer_id: shareholders[0]?.tax_id || "123456789",
        tin_status: "Valid"
      },
      {
        issue_name: "Cal Redwood Acquisition Corp Units",
        issue_ticker: "CRAU",
        trading_platform: "NASDAQ",
        issue_cusip: "G17564124",
        security_type: "Units",
        type_of_transaction: "DWAC Withdrawal",
        credit_debit: "Debit",
        credit_date: null,
        debit_date: "2025-06-23",
        total_securities_issued: -255190,
        certificates: "Book Entry",
        status: "Active",
        account_number: shareholders[1]?.account_number || "ACC002",
        shareholder_entity_last_name: shareholders[1]?.name || "Sample Shareholder 2",
        holder_type: "Institution",
        address_city: shareholders[1]?.city || "Los Angeles",
        address_state: shareholders[1]?.state || "CA",
        address_zip: shareholders[1]?.zip || "90210",
        address_country: shareholders[1]?.country || "USA",
        taxpayer_id: shareholders[1]?.tax_id || "987654321",
        tin_status: "Valid"
      }
    ]

    const { error } = await supabase
      .from('transfer_journal_records')
      .insert(sampleRecords)

    if (error) {
      console.error('Sample data error:', error)
      return
    }

    console.log('✅ Sample transfer journal records seeded successfully')
  } catch (error) {
    console.error('Error seeding sample data:', error)
  }
}

async function main() {
  await applyTransferJournalSchema()
  await seedSampleData()
  console.log('🎉 Transfer journal setup completed!')
}

main().catch(console.error)
