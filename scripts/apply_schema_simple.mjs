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

async function applySchema() {
  console.log('Applying Record Keeping Book and Control Book schema...')
  
  const sql = `
    -- ========== RECORD KEEPING BOOK AND CONTROL BOOK SCHEMA ==========
    
    -- ========== CUSIP DETAILS TABLE ==========
    CREATE TABLE IF NOT EXISTS cusip_details (
      id uuid primary key default uuid_generate_v4(),
      issuer_id uuid references issuers(id) on delete cascade not null,
      cusip text not null,
      issue_name text not null,
      issue_ticker text,
      trading_platform text,
      security_type text not null,
      total_authorized_shares bigint,
      status text default 'active' check (status in ('active', 'inactive')),
      created_by uuid references auth.users(id) on delete set null,
      created_at timestamptz default now(),
      updated_at timestamptz default now(),
      unique(issuer_id, cusip)
    );

    -- ========== SHAREHOLDERS TABLE ==========
    CREATE TABLE IF NOT EXISTS shareholders (
      id uuid primary key default uuid_generate_v4(),
      issuer_id uuid references issuers(id) on delete cascade not null,
      account_number text not null,
      last_name text not null,
      first_name text,
      address text,
      city text,
      state text,
      zip_code text,
      country text default 'USA',
      tax_id text,
      email text,
      phone text,
      status text default 'active' check (status in ('active', 'inactive')),
      created_by uuid references auth.users(id) on delete set null,
      created_at timestamptz default now(),
      updated_at timestamptz default now(),
      unique(issuer_id, account_number)
    );

    -- ========== RECORD KEEPING BOOK TRANSACTIONS TABLE ==========
    CREATE TABLE IF NOT EXISTS record_keeping_transactions (
      id uuid primary key default uuid_generate_v4(),
      issuer_id uuid references issuers(id) on delete cascade not null,
      cusip text not null,
      shareholder_id uuid references shareholders(id) on delete cascade not null,
      transaction_type text not null check (transaction_type in ('IPO', 'DWAC Withdrawal', 'DWAC Deposit', 'Transfer Credit', 'Transfer Debit', 'Dividend', 'Stock Split', 'Redemption', 'Cancellation')),
      credit_debit text not null check (credit_debit in ('Credit', 'Debit')),
      transaction_date date not null,
      quantity bigint not null,
      certificate_type text default 'Book Entry',
      status text default 'Active' check (status in ('Active', 'Pending', 'Completed', 'Cancelled')),
      notes text,
      created_by uuid references auth.users(id) on delete set null,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    );

    -- ========== CONTROL BOOK DAILY SUMMARY TABLE ==========
    CREATE TABLE IF NOT EXISTS control_book_daily_summary (
      id uuid primary key default uuid_generate_v4(),
      issuer_id uuid references issuers(id) on delete cascade not null,
      cusip text not null,
      summary_date date not null,
      total_outstanding_shares bigint not null,
      total_authorized_shares bigint,
      created_at timestamptz default now(),
      updated_at timestamptz default now(),
      unique(issuer_id, cusip, summary_date)
    );

    -- ========== SHAREHOLDER POSITIONS TABLE ==========
    CREATE TABLE IF NOT EXISTS shareholder_positions (
      id uuid primary key default uuid_generate_v4(),
      issuer_id uuid references issuers(id) on delete cascade not null,
      cusip text not null,
      shareholder_id uuid references shareholders(id) on delete cascade not null,
      position_date date not null,
      shares_owned bigint not null,
      created_at timestamptz default now(),
      unique(issuer_id, cusip, shareholder_id, position_date)
    );

    -- ========== ENABLE RLS ==========
    ALTER TABLE cusip_details enable row level security;
    ALTER TABLE shareholders enable row level security;
    ALTER TABLE record_keeping_transactions enable row level security;
    ALTER TABLE control_book_daily_summary enable row level security;
    ALTER TABLE shareholder_positions enable row level security;

    -- ========== BASIC POLICIES ==========
    CREATE POLICY IF NOT EXISTS cusip_details_read_all ON cusip_details FOR SELECT TO authenticated USING (true);
    CREATE POLICY IF NOT EXISTS shareholders_read_all ON shareholders FOR SELECT TO authenticated USING (true);
    CREATE POLICY IF NOT EXISTS rkt_read_all ON record_keeping_transactions FOR SELECT TO authenticated USING (true);
    CREATE POLICY IF NOT EXISTS cb_read_all ON control_book_daily_summary FOR SELECT TO authenticated USING (true);
    CREATE POLICY IF NOT EXISTS sp_read_all ON shareholder_positions FOR SELECT TO authenticated USING (true);

    -- ========== INDEXES ==========
    CREATE INDEX IF NOT EXISTS idx_cusip_details_issuer ON cusip_details(issuer_id);
    CREATE INDEX IF NOT EXISTS idx_shareholders_issuer ON shareholders(issuer_id);
    CREATE INDEX IF NOT EXISTS idx_rkt_issuer ON record_keeping_transactions(issuer_id);
    CREATE INDEX IF NOT EXISTS idx_rkt_cusip ON record_keeping_transactions(cusip);
    CREATE INDEX IF NOT EXISTS idx_rkt_date ON record_keeping_transactions(transaction_date);
    CREATE INDEX IF NOT EXISTS idx_cb_issuer ON control_book_daily_summary(issuer_id);
    CREATE INDEX IF NOT EXISTS idx_cb_cusip ON control_book_daily_summary(cusip);
    CREATE INDEX IF NOT EXISTS idx_cb_date ON control_book_daily_summary(summary_date);
  `
  
  const { error } = await supabase.rpc('exec', { sql })
  
  if (error) {
    console.error('Schema error:', error)
    return
  }
  
  console.log('✅ Record Keeping Book and Control Book schema applied successfully')
}

async function seedSampleData() {
  console.log('Seeding sample data...')
  
  // Get the first issuer
  const { data: issuers } = await supabase
    .from('issuers')
    .select('id, name')
    .limit(1)
  
  if (!issuers || issuers.length === 0) {
    console.log('No issuers found. Please create an issuer first.')
    return
  }
  
  const issuerId = issuers[0].id
  console.log(`Using issuer: ${issuers[0].name} (${issuerId})`)
  
  // Insert sample CUSIP details
  const { error: cusipError } = await supabase
    .from('cusip_details')
    .insert([
      {
        issuer_id: issuerId,
        cusip: 'G17564124',
        issue_name: 'Cal Redwood Acquisition Corp Units',
        issue_ticker: 'CRAU',
        trading_platform: 'NASDAQ',
        security_type: 'Units',
        total_authorized_shares: null
      },
      {
        issuer_id: issuerId,
        cusip: 'G17564108',
        issue_name: 'Cal Redwood Acquisition Corp',
        issue_ticker: 'CRA',
        trading_platform: 'NASDAQ',
        security_type: 'Class A Ordinary',
        total_authorized_shares: 500000000
      }
    ])
  
  if (cusipError) {
    console.error('Error inserting CUSIP details:', cusipError)
  } else {
    console.log('✅ Sample CUSIP details inserted')
  }
  
  // Insert sample shareholders
  const { error: shareholderError } = await supabase
    .from('shareholders')
    .insert([
      {
        issuer_id: issuerId,
        account_number: '1',
        last_name: 'Cede & Co.',
        first_name: '',
        address: '55 Water Street, New York, NY 10041',
        city: 'New York',
        state: 'NY',
        zip_code: '10041',
        country: 'USA',
        tax_id: '13-5163942',
        status: 'active'
      }
    ])
  
  if (shareholderError) {
    console.error('Error inserting shareholders:', shareholderError)
  } else {
    console.log('✅ Sample shareholders inserted')
  }
  
  // Get the inserted data for transactions
  const { data: shareholderData } = await supabase
    .from('shareholders')
    .select('id')
    .eq('issuer_id', issuerId)
    .limit(1)
  
  if (shareholderData && shareholderData.length > 0) {
    // Insert sample transactions
    const { error: transactionError } = await supabase
      .from('record_keeping_transactions')
      .insert([
        {
          issuer_id: issuerId,
          cusip: 'G17564124',
          shareholder_id: shareholderData[0].id,
          transaction_type: 'IPO',
          credit_debit: 'Credit',
          transaction_date: '2025-05-27',
          quantity: 23000000,
          certificate_type: 'Book Entry',
          status: 'Active',
          notes: 'Initial public offering'
        },
        {
          issuer_id: issuerId,
          cusip: 'G17564124',
          shareholder_id: shareholderData[0].id,
          transaction_type: 'IPO',
          credit_debit: 'Credit',
          transaction_date: '2025-05-27',
          quantity: 660000,
          certificate_type: 'Book Entry',
          status: 'Active',
          notes: 'Additional IPO shares'
        },
        {
          issuer_id: issuerId,
          cusip: 'G17564124',
          shareholder_id: shareholderData[0].id,
          transaction_type: 'DWAC Withdrawal',
          credit_debit: 'Debit',
          transaction_date: '2025-06-23',
          quantity: 1237151,
          certificate_type: 'Book Entry',
          status: 'Active',
          notes: 'DWAC withdrawal'
        },
        {
          issuer_id: issuerId,
          cusip: 'G17564108',
          shareholder_id: shareholderData[0].id,
          transaction_type: 'DWAC Deposit',
          credit_debit: 'Credit',
          transaction_date: '2025-06-23',
          quantity: 1237151,
          certificate_type: 'Book Entry',
          status: 'Active',
          notes: 'DWAC deposit'
        }
      ])
    
    if (transactionError) {
      console.error('Error inserting transactions:', transactionError)
    } else {
      console.log('✅ Sample transactions inserted')
    }
  }
}

async function main() {
  try {
    await applySchema()
    await seedSampleData()
    console.log('🎉 Record Keeping Book and Control Book setup completed!')
  } catch (error) {
    console.error('Error during setup:', error)
  }
}

main()
