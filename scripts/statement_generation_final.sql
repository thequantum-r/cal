-- ========== STATEMENT GENERATION SCHEMA (SIMPLIFIED) ==========
-- This schema only adds market values table and functions
-- Uses existing transfer_journal data instead of creating new statement tables

-- ========== MARKET VALUES TABLE ==========
-- Stores market values per CUSIP per date for statement generation
CREATE TABLE IF NOT EXISTS market_values (
  id uuid primary key default uuid_generate_v4(),
  issuer_id uuid references issuers(id) on delete cascade not null,
  cusip text not null,
  valuation_date date not null,
  price_per_share decimal(10,2) not null,
  source text default 'manual' check (source in ('manual', 'api', 'calculated')),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(issuer_id, cusip, valuation_date)
);

-- ========== ENABLE RLS ==========
ALTER TABLE market_values enable row level security;

-- ========== POLICIES ==========
-- Market Values Policies
CREATE POLICY market_values_read_all ON market_values FOR SELECT TO authenticated USING (true);
CREATE POLICY market_values_admin_write ON market_values FOR ALL TO authenticated 
  USING (public.current_user_role() = 'admin') 
  WITH CHECK (public.current_user_role() = 'admin');

-- ========== INDEXES ==========
CREATE INDEX IF NOT EXISTS idx_market_values_issuer_cusip ON market_values(issuer_id, cusip);
CREATE INDEX IF NOT EXISTS idx_market_values_date ON market_values(valuation_date);

-- ========== HELPER FUNCTIONS ==========

-- Function to get market value for a CUSIP as of a specific date
CREATE OR REPLACE FUNCTION get_market_value_as_of_date(
  p_issuer_id uuid,
  p_cusip text,
  p_as_of_date date
)
RETURNS decimal(10,2) AS $$
DECLARE
  v_price decimal(10,2);
BEGIN
  SELECT price_per_share INTO v_price
  FROM market_values
  WHERE issuer_id = p_issuer_id 
    AND cusip = p_cusip 
    AND valuation_date <= p_as_of_date
  ORDER BY valuation_date DESC
  LIMIT 1;
  
  RETURN COALESCE(v_price, 0);
END;
$$ LANGUAGE plpgsql;

-- Function to get shareholder position as of a specific date from transfer_journal
CREATE OR REPLACE FUNCTION get_shareholder_position_as_of_date(
  p_issuer_id uuid,
  p_shareholder_id uuid,
  p_cusip text,
  p_as_of_date date
)
RETURNS bigint AS $$
DECLARE
  v_shares bigint;
BEGIN
  SELECT COALESCE(SUM(
    CASE 
      WHEN tj.credit_debit = 'Credit' THEN tj.share_quantity
      WHEN tj.credit_debit = 'Debit' THEN -tj.share_quantity
    END
  ), 0) INTO v_shares
  FROM transfer_journal tj
  WHERE tj.issuer_id = p_issuer_id 
    AND tj.shareholder_id = p_shareholder_id
    AND tj.cusip = p_cusip 
    AND tj.credit_date <= p_as_of_date
    AND tj.status = 'Active';
  
  RETURN v_shares;
END;
$$ LANGUAGE plpgsql;

-- Function to get recent transactions for statement period
CREATE OR REPLACE FUNCTION get_recent_transactions_for_statement(
  p_issuer_id uuid,
  p_shareholder_id uuid,
  p_cusip text,
  p_statement_date date,
  p_lookback_days integer DEFAULT 90
)
RETURNS TABLE (
  transaction_date date,
  transaction_type text,
  shares_quantity bigint,
  price_per_share decimal(10,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tj.credit_date as transaction_date,
    tj.transaction_type,
    tj.share_quantity as shares_quantity,
    mv.price_per_share
  FROM transfer_journal tj
  LEFT JOIN market_values mv ON 
    mv.issuer_id = tj.issuer_id 
    AND mv.cusip = tj.cusip 
    AND mv.valuation_date = tj.credit_date
  WHERE tj.issuer_id = p_issuer_id
    AND tj.shareholder_id = p_shareholder_id
    AND tj.cusip = p_cusip
    AND tj.credit_date >= (p_statement_date - p_lookback_days)
    AND tj.credit_date <= p_statement_date
    AND tj.status = 'Active'
  ORDER BY tj.credit_date DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get restrictions text for a shareholder
CREATE OR REPLACE FUNCTION get_shareholder_restrictions_text(
  p_issuer_id uuid,
  p_shareholder_id uuid,
  p_cusip text
)
RETURNS text AS $$
DECLARE
  v_restrictions text;
BEGIN
  SELECT string_agg(rt.legend, E'\n\n') INTO v_restrictions
  FROM shareholder_restrictions sr
  JOIN restriction_templates rt ON sr.restriction_id = rt.id
  WHERE sr.issuer_id = p_issuer_id
    AND sr.shareholder_id = p_shareholder_id
    AND sr.cusip = p_cusip
    AND rt.is_active = true;
  
  RETURN COALESCE(v_restrictions, 'No restrictions apply to these shares.');
END;
$$ LANGUAGE plpgsql;

-- Function to get all shareholder positions as of a date
CREATE OR REPLACE FUNCTION get_shareholder_all_positions_as_of_date(
  p_issuer_id uuid,
  p_shareholder_id uuid,
  p_as_of_date date
)
RETURNS TABLE (
  cusip text,
  shares_outstanding bigint,
  market_value_per_share decimal(10,2),
  market_value_total decimal(15,2),
  restrictions_text text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tj.cusip,
    COALESCE(SUM(
      CASE 
        WHEN tj.credit_debit = 'Credit' THEN tj.share_quantity
        WHEN tj.credit_debit = 'Debit' THEN -tj.share_quantity
      END
    ), 0) as shares_outstanding,
    get_market_value_as_of_date(p_issuer_id, tj.cusip, p_as_of_date) as market_value_per_share,
    COALESCE(SUM(
      CASE 
        WHEN tj.credit_debit = 'Credit' THEN tj.share_quantity
        WHEN tj.credit_debit = 'Debit' THEN -tj.share_quantity
      END
    ), 0) * get_market_value_as_of_date(p_issuer_id, tj.cusip, p_as_of_date) as market_value_total,
    get_shareholder_restrictions_text(p_issuer_id, p_shareholder_id, tj.cusip) as restrictions_text
  FROM transfer_journal tj
  WHERE tj.issuer_id = p_issuer_id 
    AND tj.shareholder_id = p_shareholder_id
    AND tj.credit_date <= p_as_of_date
    AND tj.status = 'Active'
  GROUP BY tj.cusip
  HAVING COALESCE(SUM(
    CASE 
      WHEN tj.credit_debit = 'Credit' THEN tj.share_quantity
      WHEN tj.credit_debit = 'Debit' THEN -tj.share_quantity
    END
  ), 0) > 0
  ORDER BY tj.cusip;
END;
$$ LANGUAGE plpgsql;

-- ========== TRIGGERS ==========

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_market_values_updated_at
  BEFORE UPDATE ON market_values
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ========== SAMPLE DATA (OPTIONAL) ==========
-- You can uncomment and modify these to add sample market values

/*
INSERT INTO market_values (issuer_id, cusip, valuation_date, price_per_share, source, notes) VALUES
-- Replace with actual issuer_id and cusip values from your database
('your-issuer-id-here', 'your-cusip-here', '2024-01-01', 10.50, 'manual', 'Initial valuation'),
('your-issuer-id-here', 'your-cusip-here', '2024-02-01', 11.25, 'manual', 'Monthly update'),
('your-issuer-id-here', 'your-cusip-here', '2024-03-01', 12.00, 'manual', 'Monthly update');
*/

-- ========== USAGE EXAMPLES ==========
/*
-- Get all positions for a shareholder as of a specific date
SELECT * FROM get_shareholder_all_positions_as_of_date(
  'your-issuer-id-here', 
  'your-shareholder-id-here', 
  '2024-03-01'
);

-- Get market value for a specific CUSIP as of a date
SELECT get_market_value_as_of_date('your-issuer-id-here', 'your-cusip-here', '2024-03-01');

-- Get recent transactions for a shareholder
SELECT * FROM get_recent_transactions_for_statement(
  'your-issuer-id-here',
  'your-shareholder-id-here', 
  'your-cusip-here',
  '2024-03-01',
  90
);
*/






