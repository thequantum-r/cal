-- ========== UPDATED TRANSFER JOURNAL SCHEMA ==========
-- Based on user requirements and spreadsheet examples

-- Drop existing tables if they exist (in correct order due to foreign key dependencies)
DROP TABLE IF EXISTS transfer_journal_records CASCADE;
DROP TABLE IF EXISTS shareholder_restrictions CASCADE;
DROP TABLE IF EXISTS transfer_journal CASCADE;
DROP TABLE IF EXISTS restriction_templates CASCADE;

-- Create restriction_templates table FIRST (since transfer_journal references it)
CREATE TABLE IF NOT EXISTS restriction_templates (
  id uuid primary key default uuid_generate_v4(),
  issuer_id uuid references issuers(id) on delete cascade not null,
  code text not null,
  legend text not null,
  description text,
  is_active boolean default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(issuer_id, code)
);

-- Create updated transfer_journal table with new structure
CREATE TABLE IF NOT EXISTS transfer_journal (
  id uuid primary key default uuid_generate_v4(),
  
  -- Core transaction fields (as requested by user)
  issuer_id uuid references issuers(id) on delete cascade not null,
  cusip text not null,
  transaction_type text not null,
  share_quantity integer not null,
  created_by uuid references auth.users(id) on delete set null,
  shareholder_id uuid references shareholders(id) on delete cascade not null,
  restriction_id uuid references restriction_templates(id) on delete set null,
  
  -- Derived fields from transaction_type
  credit_debit text not null check (credit_debit in ('Credit', 'Debit')),
  credit_date date,
  debit_date date,
  
  -- Additional metadata
  status text default 'Active' check (status in ('Active', 'Pending', 'Completed', 'Cancelled')),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create shareholder_restrictions table (for actual restrictions on shareholders)
CREATE TABLE IF NOT EXISTS shareholder_restrictions (
  id uuid primary key default uuid_generate_v4(),
  shareholder_id uuid references shareholders(id) on delete cascade not null,
  restriction_id uuid references restriction_templates(id) on delete cascade not null,
  cusip text not null,
  share_balance integer not null default 0,
  issuer_id uuid references issuers(id) on delete cascade not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(shareholder_id, restriction_id, cusip)
);

-- Create shareholder_position view (as requested - should be a view, not table)
CREATE OR REPLACE VIEW shareholder_position AS
SELECT 
  sr.shareholder_id,
  sr.restriction_id,
  sr.cusip,
  sr.share_balance,
  sr.issuer_id,
  s.first_name,
  s.last_name,
  s.account_number,
  rt.code as restriction_code,
  rt.legend as restriction_legend,
  i.display_name as issuer_name
FROM shareholder_restrictions sr
JOIN shareholders s ON sr.shareholder_id = s.id
JOIN restriction_templates rt ON sr.restriction_id = rt.id
JOIN issuers i ON sr.issuer_id = i.id
WHERE rt.is_active = true;

-- Enable RLS on all tables
ALTER TABLE transfer_journal ENABLE ROW LEVEL SECURITY;
ALTER TABLE restriction_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE shareholder_restrictions ENABLE ROW LEVEL SECURITY;

-- ========== TRANSFER JOURNAL POLICIES ==========
-- Drop existing policies if they exist
DROP POLICY IF EXISTS tj_read_all ON transfer_journal;
DROP POLICY IF EXISTS tj_admin_write ON transfer_journal;
DROP POLICY IF EXISTS tj_transfer_insert ON transfer_journal;
DROP POLICY IF EXISTS tj_transfer_update ON transfer_journal;

-- Everyone can view transfer journal records for their issuers
CREATE POLICY tj_read_all
ON transfer_journal FOR SELECT
TO authenticated
USING ( 
  public.current_user_role() = 'admin' 
  OR EXISTS (
    SELECT 1 FROM issuer_users iu 
    WHERE iu.user_id = auth.uid() 
    AND iu.issuer_id = transfer_journal.issuer_id
  )
);

-- Admin can do everything
CREATE POLICY tj_admin_write
ON transfer_journal FOR ALL
TO authenticated
USING ( public.current_user_role() = 'admin' )
WITH CHECK ( public.current_user_role() = 'admin' );

-- Transfer team can insert for their issuers
CREATE POLICY tj_transfer_insert
ON transfer_journal FOR INSERT
TO authenticated
WITH CHECK ( 
  EXISTS (
    SELECT 1 FROM issuer_users iu 
    JOIN roles r ON iu.role_id = r.id 
    WHERE iu.user_id = auth.uid() 
    AND iu.issuer_id = transfer_journal.issuer_id 
    AND r.name IN ('admin', 'transfer_team')
  )
);

-- Transfer team can update for their issuers
CREATE POLICY tj_transfer_update
ON transfer_journal FOR UPDATE
TO authenticated
USING ( 
  EXISTS (
    SELECT 1 FROM issuer_users iu 
    JOIN roles r ON iu.role_id = r.id 
    WHERE iu.user_id = auth.uid() 
    AND iu.issuer_id = transfer_journal.issuer_id 
    AND r.name IN ('admin', 'transfer_team')
  )
)
WITH CHECK ( 
  EXISTS (
    SELECT 1 FROM issuer_users iu 
    JOIN roles r ON iu.role_id = r.id 
    WHERE iu.user_id = auth.uid() 
    AND iu.issuer_id = transfer_journal.issuer_id 
    AND r.name IN ('admin', 'transfer_team')
  )
);

-- ========== RESTRICTION TEMPLATES POLICIES ==========
-- Drop existing policies if they exist
DROP POLICY IF EXISTS rt_read_all ON restriction_templates;
DROP POLICY IF EXISTS rt_admin_write ON restriction_templates;

-- Everyone can view restriction templates for their issuers
CREATE POLICY rt_read_all
ON restriction_templates FOR SELECT
TO authenticated
USING ( 
  public.current_user_role() = 'admin' 
  OR EXISTS (
    SELECT 1 FROM issuer_users iu 
    WHERE iu.user_id = auth.uid() 
    AND iu.issuer_id = restriction_templates.issuer_id
  )
);

-- Only admins can manage restriction templates
CREATE POLICY rt_admin_write
ON restriction_templates FOR ALL
TO authenticated
USING ( 
  EXISTS (
    SELECT 1 FROM issuer_users iu 
    JOIN roles r ON iu.role_id = r.id 
    WHERE iu.user_id = auth.uid() 
    AND iu.issuer_id = restriction_templates.issuer_id 
    AND r.name = 'admin'
  )
)
WITH CHECK ( 
  EXISTS (
    SELECT 1 FROM issuer_users iu 
    JOIN roles r ON iu.role_id = r.id 
    WHERE iu.user_id = auth.uid() 
    AND iu.issuer_id = restriction_templates.issuer_id 
    AND r.name = 'admin'
  )
);

-- ========== SHAREHOLDER RESTRICTIONS POLICIES ==========
-- Drop existing policies if they exist
DROP POLICY IF EXISTS sr_read_all ON shareholder_restrictions;
DROP POLICY IF EXISTS sr_admin_write ON shareholder_restrictions;

-- Everyone can view shareholder restrictions for their issuers
CREATE POLICY sr_read_all
ON shareholder_restrictions FOR SELECT
TO authenticated
USING ( 
  public.current_user_role() = 'admin' 
  OR EXISTS (
    SELECT 1 FROM issuer_users iu 
    WHERE iu.user_id = auth.uid() 
    AND iu.issuer_id = shareholder_restrictions.issuer_id
  )
);

-- Only admins can manage shareholder restrictions
CREATE POLICY sr_admin_write
ON shareholder_restrictions FOR ALL
TO authenticated
USING ( 
  EXISTS (
    SELECT 1 FROM issuer_users iu 
    JOIN roles r ON iu.role_id = r.id 
    WHERE iu.user_id = auth.uid() 
    AND iu.issuer_id = shareholder_restrictions.issuer_id 
    AND r.name = 'admin'
  )
)
WITH CHECK ( 
  EXISTS (
    SELECT 1 FROM issuer_users iu 
    JOIN roles r ON iu.role_id = r.id 
    WHERE iu.user_id = auth.uid() 
    AND iu.issuer_id = shareholder_restrictions.issuer_id 
    AND r.name = 'admin'
  )
);

-- ========== INDEXES FOR PERFORMANCE ==========
CREATE INDEX IF NOT EXISTS idx_transfer_journal_issuer_id ON transfer_journal(issuer_id);
CREATE INDEX IF NOT EXISTS idx_transfer_journal_cusip ON transfer_journal(cusip);
CREATE INDEX IF NOT EXISTS idx_transfer_journal_transaction_type ON transfer_journal(transaction_type);
CREATE INDEX IF NOT EXISTS idx_transfer_journal_shareholder_id ON transfer_journal(shareholder_id);
CREATE INDEX IF NOT EXISTS idx_transfer_journal_created_at ON transfer_journal(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_restriction_templates_issuer_id ON restriction_templates(issuer_id);
CREATE INDEX IF NOT EXISTS idx_restriction_templates_code ON restriction_templates(code);

CREATE INDEX IF NOT EXISTS idx_shareholder_restrictions_shareholder_id ON shareholder_restrictions(shareholder_id);
CREATE INDEX IF NOT EXISTS idx_shareholder_restrictions_restriction_id ON shareholder_restrictions(restriction_id);
CREATE INDEX IF NOT EXISTS idx_shareholder_restrictions_cusip ON shareholder_restrictions(cusip);
CREATE INDEX IF NOT EXISTS idx_shareholder_restrictions_issuer_id ON shareholder_restrictions(issuer_id);

-- ========== TRIGGERS FOR UPDATED_AT ==========
-- Create or replace the update_updated_at_column function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_transfer_journal_updated_at
  BEFORE UPDATE ON transfer_journal
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_restriction_templates_updated_at
  BEFORE UPDATE ON restriction_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shareholder_restrictions_updated_at
  BEFORE UPDATE ON shareholder_restrictions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ========== HELPER FUNCTIONS ==========
-- Function to get credit/debit based on transaction type
CREATE OR REPLACE FUNCTION get_credit_debit_by_transaction(transaction_type_input text)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT 
    CASE 
      WHEN transaction_type_input IN ('IPO', 'DWAC Deposit', 'Transfer Credit', 'Dividend', 'Stock Split') THEN 'Credit'
      WHEN transaction_type_input IN ('DWAC Withdrawal', 'Transfer Debit', 'Redemption', 'Cancellation') THEN 'Debit'
      ELSE 'Credit'
    END;
$$;

-- Function to check if shareholder has restrictions
CREATE OR REPLACE FUNCTION check_shareholder_restrictions(
  p_shareholder_id uuid,
  p_cusip text,
  p_issuer_id uuid
)
RETURNS TABLE(
  has_restrictions boolean,
  restriction_codes text[],
  restriction_legends text[]
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    COUNT(*) > 0 as has_restrictions,
    ARRAY_AGG(rt.code) as restriction_codes,
    ARRAY_AGG(rt.legend) as restriction_legends
  FROM shareholder_restrictions sr
  JOIN restriction_templates rt ON sr.restriction_id = rt.id
  WHERE sr.shareholder_id = p_shareholder_id
    AND sr.cusip = p_cusip
    AND sr.issuer_id = p_issuer_id
    AND rt.is_active = true;
$$;

-- ========== COMMENTS ==========
COMMENT ON TABLE transfer_journal IS 'Transfer journal records at CUSIP level for tracking share movements';
COMMENT ON TABLE restriction_templates IS 'Templates for different types of transfer restrictions';
COMMENT ON TABLE shareholder_restrictions IS 'Actual restrictions applied to specific shareholders for specific CUSIPs';
COMMENT ON VIEW shareholder_position IS 'View showing current shareholder positions with restrictions';
