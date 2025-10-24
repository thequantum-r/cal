-- ========== RECORD KEEPING BOOK AND CONTROL BOOK SCHEMA ==========
-- Based on spreadsheet screenshots and requirements

-- ========== CUSIP DETAILS TABLE (Master data for securities) ==========
CREATE TABLE IF NOT EXISTS cusip_details (
  id uuid primary key default uuid_generate_v4(),
  issuer_id uuid references issuers(id) on delete cascade not null,
  cusip text not null,
  issue_name text not null,
  issue_ticker text,
  trading_platform text,
  security_type text not null,
  total_authorized_shares bigint, -- For validation checks
  status text default 'active' check (status in ('active', 'inactive')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(issuer_id, cusip)
);

-- ========== SHAREHOLDERS TABLE (Master data for shareholders) ==========
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
-- This is the detailed, per-shareholder ledger
CREATE TABLE IF NOT EXISTS record_keeping_transactions (
  id uuid primary key default uuid_generate_v4(),
  issuer_id uuid references issuers(id) on delete cascade not null,
  cusip text not null,
  shareholder_id uuid references shareholders(id) on delete cascade not null,
  transaction_type text not null check (transaction_type in ('IPO', 'DWAC Withdrawal', 'DWAC Deposit', 'Transfer Credit', 'Transfer Debit', 'Dividend', 'Stock Split', 'Redemption', 'Cancellation')),
  credit_debit text not null check (credit_debit in ('Credit', 'Debit')),
  transaction_date date not null,
  quantity bigint not null, -- Number of shares for this transaction
  certificate_type text default 'Book Entry',
  status text default 'Active' check (status in ('Active', 'Pending', 'Completed', 'Cancelled')),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ========== CONTROL BOOK DAILY SUMMARY TABLE ==========
-- This is the high-level summary ledger required by the SEC
-- Values are automatically calculated and not manually editable
CREATE TABLE IF NOT EXISTS control_book_daily_summary (
  id uuid primary key default uuid_generate_v4(),
  issuer_id uuid references issuers(id) on delete cascade not null,
  cusip text not null,
  summary_date date not null,
  total_outstanding_shares bigint not null, -- Automatically calculated
  total_authorized_shares bigint, -- For validation
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(issuer_id, cusip, summary_date)
);

-- ========== SHAREHOLDER POSITIONS TABLE ==========
-- Tracks current positions for "as of" date querying
CREATE TABLE IF NOT EXISTS shareholder_positions (
  id uuid primary key default uuid_generate_v4(),
  issuer_id uuid references issuers(id) on delete cascade not null,
  cusip text not null,
  shareholder_id uuid references shareholders(id) on delete cascade not null,
  position_date date not null,
  shares_owned bigint not null, -- Running balance for this shareholder on this date
  created_at timestamptz default now(),
  unique(issuer_id, cusip, shareholder_id, position_date)
);

-- ========== ENABLE RLS ==========
ALTER TABLE cusip_details enable row level security;
ALTER TABLE shareholders enable row level security;
ALTER TABLE record_keeping_transactions enable row level security;
ALTER TABLE control_book_daily_summary enable row level security;
ALTER TABLE shareholder_positions enable row level security;

-- ========== POLICIES ==========

-- CUSIP Details Policies
CREATE POLICY cusip_details_read_all ON cusip_details FOR SELECT TO authenticated USING (true);
CREATE POLICY cusip_details_admin_write ON cusip_details FOR ALL TO authenticated 
  USING (public.current_user_role() = 'admin') 
  WITH CHECK (public.current_user_role() = 'admin');

-- Shareholders Policies
CREATE POLICY shareholders_read_all ON shareholders FOR SELECT TO authenticated USING (true);
CREATE POLICY shareholders_admin_write ON shareholders FOR ALL TO authenticated 
  USING (public.current_user_role() = 'admin') 
  WITH CHECK (public.current_user_role() = 'admin');
CREATE POLICY shareholders_transfer_write ON shareholders FOR INSERT, UPDATE TO authenticated 
  USING (public.current_user_role() = 'transfer_team') 
  WITH CHECK (public.current_user_role() = 'transfer_team');

-- Record Keeping Transactions Policies
CREATE POLICY rkt_read_all ON record_keeping_transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY rkt_admin_write ON record_keeping_transactions FOR ALL TO authenticated 
  USING (public.current_user_role() = 'admin') 
  WITH CHECK (public.current_user_role() = 'admin');
CREATE POLICY rkt_transfer_write ON record_keeping_transactions FOR INSERT, UPDATE TO authenticated 
  USING (public.current_user_role() = 'transfer_team') 
  WITH CHECK (public.current_user_role() = 'transfer_team');

-- Control Book Policies (Read-only for most users, admin can manage)
CREATE POLICY cb_read_all ON control_book_daily_summary FOR SELECT TO authenticated USING (true);
CREATE POLICY cb_admin_write ON control_book_daily_summary FOR ALL TO authenticated 
  USING (public.current_user_role() = 'admin') 
  WITH CHECK (public.current_user_role() = 'admin');

-- Shareholder Positions Policies
CREATE POLICY sp_read_all ON shareholder_positions FOR SELECT TO authenticated USING (true);
CREATE POLICY sp_admin_write ON shareholder_positions FOR ALL TO authenticated 
  USING (public.current_user_role() = 'admin') 
  WITH CHECK (public.current_user_role() = 'admin');

-- ========== INDEXES FOR PERFORMANCE ==========
CREATE INDEX IF NOT EXISTS idx_cusip_details_issuer ON cusip_details(issuer_id);
CREATE INDEX IF NOT EXISTS idx_cusip_details_cusip ON cusip_details(cusip);
CREATE INDEX IF NOT EXISTS idx_shareholders_issuer ON shareholders(issuer_id);
CREATE INDEX IF NOT EXISTS idx_shareholders_account ON shareholders(account_number);
CREATE INDEX IF NOT EXISTS idx_rkt_issuer ON record_keeping_transactions(issuer_id);
CREATE INDEX IF NOT EXISTS idx_rkt_cusip ON record_keeping_transactions(cusip);
CREATE INDEX IF NOT EXISTS idx_rkt_shareholder ON record_keeping_transactions(shareholder_id);
CREATE INDEX IF NOT EXISTS idx_rkt_date ON record_keeping_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_rkt_type ON record_keeping_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_cb_issuer ON control_book_daily_summary(issuer_id);
CREATE INDEX IF NOT EXISTS idx_cb_cusip ON control_book_daily_summary(cusip);
CREATE INDEX IF NOT EXISTS idx_cb_date ON control_book_daily_summary(summary_date);
CREATE INDEX IF NOT EXISTS idx_sp_issuer ON shareholder_positions(issuer_id);
CREATE INDEX IF NOT EXISTS idx_sp_cusip ON shareholder_positions(cusip);
CREATE INDEX IF NOT EXISTS idx_sp_shareholder ON shareholder_positions(shareholder_id);
CREATE INDEX IF NOT EXISTS idx_sp_date ON shareholder_positions(position_date);

-- ========== TRIGGERS FOR AUTOMATED UPDATES ==========

-- Function to update control book when transactions are added/modified
CREATE OR REPLACE FUNCTION update_control_book()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert or update control book entry for the transaction date
  INSERT INTO control_book_daily_summary (
    issuer_id, 
    cusip, 
    summary_date, 
    total_outstanding_shares,
    total_authorized_shares
  )
  SELECT 
    NEW.issuer_id,
    NEW.cusip,
    NEW.transaction_date,
    COALESCE(
      (SELECT SUM(
        CASE 
          WHEN rkt.credit_debit = 'Credit' THEN rkt.quantity
          WHEN rkt.credit_debit = 'Debit' THEN -rkt.quantity
        END
      )
      FROM record_keeping_transactions rkt
      WHERE rkt.issuer_id = NEW.issuer_id 
        AND rkt.cusip = NEW.cusip 
        AND rkt.transaction_date <= NEW.transaction_date
        AND rkt.status = 'Active'), 0
    ),
    (SELECT total_authorized_shares FROM cusip_details WHERE issuer_id = NEW.issuer_id AND cusip = NEW.cusip)
  ON CONFLICT (issuer_id, cusip, summary_date) 
  DO UPDATE SET 
    total_outstanding_shares = EXCLUDED.total_outstanding_shares,
    updated_at = now();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update control book
CREATE TRIGGER trigger_update_control_book
  AFTER INSERT OR UPDATE ON record_keeping_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_control_book();

-- Function to update shareholder positions
CREATE OR REPLACE FUNCTION update_shareholder_positions()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert or update shareholder position for the transaction date
  INSERT INTO shareholder_positions (
    issuer_id,
    cusip,
    shareholder_id,
    position_date,
    shares_owned
  )
  SELECT 
    NEW.issuer_id,
    NEW.cusip,
    NEW.shareholder_id,
    NEW.transaction_date,
    COALESCE(
      (SELECT SUM(
        CASE 
          WHEN rkt.credit_debit = 'Credit' THEN rkt.quantity
          WHEN rkt.credit_debit = 'Debit' THEN -rkt.quantity
        END
      )
      FROM record_keeping_transactions rkt
      WHERE rkt.issuer_id = NEW.issuer_id 
        AND rkt.cusip = NEW.cusip 
        AND rkt.shareholder_id = NEW.shareholder_id
        AND rkt.transaction_date <= NEW.transaction_date
        AND rkt.status = 'Active'), 0
    )
  ON CONFLICT (issuer_id, cusip, shareholder_id, position_date) 
  DO UPDATE SET 
    shares_owned = EXCLUDED.shares_owned;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update shareholder positions
CREATE TRIGGER trigger_update_shareholder_positions
  AFTER INSERT OR UPDATE ON record_keeping_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_shareholder_positions();

-- ========== HELPER FUNCTIONS ==========

-- Function to validate total authorized shares
CREATE OR REPLACE FUNCTION validate_authorized_shares(
  p_issuer_id uuid,
  p_cusip text,
  p_quantity bigint
)
RETURNS boolean AS $$
DECLARE
  v_total_authorized bigint;
  v_current_outstanding bigint;
BEGIN
  -- Get total authorized shares
  SELECT total_authorized_shares INTO v_total_authorized
  FROM cusip_details 
  WHERE issuer_id = p_issuer_id AND cusip = p_cusip;
  
  -- If no authorized limit, allow the transaction
  IF v_total_authorized IS NULL THEN
    RETURN true;
  END IF;
  
  -- Get current outstanding shares
  SELECT COALESCE(total_outstanding_shares, 0) INTO v_current_outstanding
  FROM control_book_daily_summary
  WHERE issuer_id = p_issuer_id 
    AND cusip = p_cusip 
    AND summary_date = (
      SELECT MAX(summary_date) 
      FROM control_book_daily_summary 
      WHERE issuer_id = p_issuer_id AND cusip = p_cusip
    );
  
  -- Check if transaction would exceed authorized limit
  RETURN (v_current_outstanding + p_quantity) <= v_total_authorized;
END;
$$ LANGUAGE plpgsql;

-- Function to get shareholder list as of a specific date
CREATE OR REPLACE FUNCTION get_shareholders_as_of_date(
  p_issuer_id uuid,
  p_cusip text,
  p_as_of_date date
)
RETURNS TABLE (
  shareholder_id uuid,
  account_number text,
  last_name text,
  first_name text,
  shares_owned bigint,
  position_date date
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sp.shareholder_id,
    s.account_number,
    s.last_name,
    s.first_name,
    sp.shares_owned,
    sp.position_date
  FROM shareholder_positions sp
  JOIN shareholders s ON sp.shareholder_id = s.id
  WHERE sp.issuer_id = p_issuer_id
    AND sp.cusip = p_cusip
    AND sp.position_date <= p_as_of_date
    AND sp.shares_owned > 0
  ORDER BY sp.shares_owned DESC;
END;
$$ LANGUAGE plpgsql;

-- ========== TRIGGER FOR UPDATED_AT ==========
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_cusip_details_updated_at
  BEFORE UPDATE ON cusip_details
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shareholders_updated_at
  BEFORE UPDATE ON shareholders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_record_keeping_transactions_updated_at
  BEFORE UPDATE ON record_keeping_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_control_book_daily_summary_updated_at
  BEFORE UPDATE ON control_book_daily_summary
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
