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

async function applyStatementSchema() {
  console.log('Applying Statement Generation schema...')
  
  const sql = `
    -- ========== STATEMENT GENERATION SCHEMA ==========
    -- Based on spreadsheet reference and user requirements

    -- ========== MARKET VALUES TABLE ==========
    -- Stores market values per CUSIP per date for statement generation
    CREATE TABLE IF NOT EXISTS market_values (
      id uuid primary key default uuid_generate_v4(),
      issuer_id uuid references issuers(id) on delete cascade not null,
      cusip text not null,
      valuation_date date not null,
      price_per_share decimal(10,2) not null,
      market_value_total decimal(15,2), -- Calculated field for convenience
      source text default 'manual' check (source in ('manual', 'api', 'calculated')),
      notes text,
      created_by uuid references auth.users(id) on delete set null,
      created_at timestamptz default now(),
      updated_at timestamptz default now(),
      unique(issuer_id, cusip, valuation_date)
    );

    -- ========== SHAREHOLDER STATEMENTS TABLE ==========
    -- Stores generated statements for shareholders
    CREATE TABLE IF NOT EXISTS shareholder_statements (
      id uuid primary key default uuid_generate_v4(),
      issuer_id uuid references issuers(id) on delete cascade not null,
      shareholder_id uuid references shareholders(id) on delete cascade not null,
      statement_date date not null,
      statement_number text not null, -- Auto-generated statement number
      status text default 'draft' check (status in ('draft', 'final', 'sent')),
      generated_by uuid references auth.users(id) on delete set null,
      generated_at timestamptz default now(),
      sent_at timestamptz,
      notes text,
      unique(issuer_id, shareholder_id, statement_date)
    );

    -- ========== STATEMENT DETAILS TABLE ==========
    -- Stores the actual statement data (holdings, transactions, restrictions)
    CREATE TABLE IF NOT EXISTS statement_details (
      id uuid primary key default uuid_generate_v4(),
      statement_id uuid references shareholder_statements(id) on delete cascade not null,
      cusip text not null,
      shares_outstanding bigint not null,
      market_value_per_share decimal(10,2),
      market_value_total decimal(15,2),
      restrictions_text text, -- Full text of restrictions
      created_at timestamptz default now()
    );

    -- ========== STATEMENT TRANSACTIONS TABLE ==========
    -- Stores recent transactions for the statement period
    CREATE TABLE IF NOT EXISTS statement_transactions (
      id uuid primary key default uuid_generate_v4(),
      statement_id uuid references shareholder_statements(id) on delete cascade not null,
      transaction_date date not null,
      transaction_type text not null,
      shares_quantity bigint not null,
      price_per_share decimal(10,2),
      total_value decimal(15,2),
      created_at timestamptz default now()
    );

    -- ========== ENABLE RLS ==========
    ALTER TABLE market_values enable row level security;
    ALTER TABLE shareholder_statements enable row level security;
    ALTER TABLE statement_details enable row level security;
    ALTER TABLE statement_transactions enable row level security;

    -- ========== POLICIES ==========

    -- Market Values Policies
    CREATE POLICY IF NOT EXISTS market_values_read_all ON market_values FOR SELECT TO authenticated USING (true);
    CREATE POLICY IF NOT EXISTS market_values_admin_write ON market_values FOR ALL TO authenticated 
      USING (public.current_user_role() = 'admin') 
      WITH CHECK (public.current_user_role() = 'admin');

    -- Shareholder Statements Policies
    CREATE POLICY IF NOT EXISTS statements_read_all ON shareholder_statements FOR SELECT TO authenticated USING (true);
    CREATE POLICY IF NOT EXISTS statements_admin_write ON shareholder_statements FOR ALL TO authenticated 
      USING (public.current_user_role() = 'admin') 
      WITH CHECK (public.current_user_role() = 'admin');

    -- Statement Details Policies
    CREATE POLICY IF NOT EXISTS statement_details_read_all ON statement_details FOR SELECT TO authenticated USING (true);
    CREATE POLICY IF NOT EXISTS statement_details_admin_write ON statement_details FOR ALL TO authenticated 
      USING (public.current_user_role() = 'admin') 
      WITH CHECK (public.current_user_role() = 'admin');

    -- Statement Transactions Policies
    CREATE POLICY IF NOT EXISTS statement_transactions_read_all ON statement_transactions FOR SELECT TO authenticated USING (true);
    CREATE POLICY IF NOT EXISTS statement_transactions_admin_write ON statement_transactions FOR ALL TO authenticated 
      USING (public.current_user_role() = 'admin') 
      WITH CHECK (public.current_user_role() = 'admin');

    -- ========== INDEXES ==========
    CREATE INDEX IF NOT EXISTS idx_market_values_issuer_cusip ON market_values(issuer_id, cusip);
    CREATE INDEX IF NOT EXISTS idx_market_values_date ON market_values(valuation_date);
    CREATE INDEX IF NOT EXISTS idx_statements_issuer ON shareholder_statements(issuer_id);
    CREATE INDEX IF NOT EXISTS idx_statements_shareholder ON shareholder_statements(shareholder_id);
    CREATE INDEX IF NOT EXISTS idx_statements_date ON shareholder_statements(statement_date);
    CREATE INDEX IF NOT EXISTS idx_statement_details_statement ON statement_details(statement_id);
    CREATE INDEX IF NOT EXISTS idx_statement_transactions_statement ON statement_transactions(statement_id);
  `
  
  const { error } = await supabase.rpc('exec', { sql })
  
  if (error) {
    console.error('Schema error:', error)
    return
  }
  
  console.log('✅ Statement Generation schema applied successfully')
}

async function createHelperFunctions() {
  console.log('Creating helper functions...')
  
  const functions = [
    // Function to get market value for a CUSIP as of a specific date
    `
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
    `,
    
    // Function to get shareholder position as of a specific date
    `
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
      SELECT shares_owned INTO v_shares
      FROM shareholder_positions
      WHERE issuer_id = p_issuer_id 
        AND shareholder_id = p_shareholder_id
        AND cusip = p_cusip 
        AND position_date <= p_as_of_date
      ORDER BY position_date DESC
      LIMIT 1;
      
      RETURN COALESCE(v_shares, 0);
    END;
    $$ LANGUAGE plpgsql;
    `,
    
    // Function to get recent transactions for statement period
    `
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
        rkt.transaction_date,
        rkt.transaction_type,
        rkt.quantity as shares_quantity,
        mv.price_per_share
      FROM record_keeping_transactions rkt
      LEFT JOIN market_values mv ON 
        mv.issuer_id = rkt.issuer_id 
        AND mv.cusip = rkt.cusip 
        AND mv.valuation_date = rkt.transaction_date
      WHERE rkt.issuer_id = p_issuer_id
        AND rkt.shareholder_id = p_shareholder_id
        AND rkt.cusip = p_cusip
        AND rkt.transaction_date >= (p_statement_date - p_lookback_days)
        AND rkt.transaction_date <= p_statement_date
        AND rkt.status = 'Active'
      ORDER BY rkt.transaction_date DESC;
    END;
    $$ LANGUAGE plpgsql;
    `,
    
    // Function to get restrictions text for a shareholder
    `
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
    `,
    
    // Function to generate statement number
    `
    CREATE OR REPLACE FUNCTION generate_statement_number(
      p_issuer_id uuid,
      p_shareholder_id uuid,
      p_statement_date date
    )
    RETURNS text AS $$
    DECLARE
      v_issuer_code text;
      v_shareholder_code text;
      v_date_code text;
      v_statement_number text;
    BEGIN
      -- Get issuer code (first 3 letters of display name)
      SELECT UPPER(LEFT(REPLACE(display_name, ' ', ''), 3)) INTO v_issuer_code
      FROM issuers WHERE id = p_issuer_id;
      
      -- Get shareholder code (first 3 letters of last name)
      SELECT UPPER(LEFT(REPLACE(last_name, ' ', ''), 3)) INTO v_shareholder_code
      FROM shareholders WHERE id = p_shareholder_id;
      
      -- Get date code (YYYYMMDD)
      v_date_code := to_char(p_statement_date, 'YYYYMMDD');
      
      -- Combine to create statement number
      v_statement_number := v_issuer_code || '-' || v_shareholder_code || '-' || v_date_code;
      
      RETURN v_statement_number;
    END;
    $$ LANGUAGE plpgsql;
    `,
    
    // Function to generate complete statement
    `
    CREATE OR REPLACE FUNCTION generate_shareholder_statement(
      p_issuer_id uuid,
      p_shareholder_id uuid,
      p_statement_date date,
      p_generated_by uuid
    )
    RETURNS uuid AS $$
    DECLARE
      v_statement_id uuid;
      v_statement_number text;
      v_cusip text;
      v_shares_outstanding bigint;
      v_market_value_per_share decimal(10,2);
      v_market_value_total decimal(15,2);
      v_restrictions_text text;
      v_transaction_record record;
    BEGIN
      -- Generate statement number
      v_statement_number := generate_statement_number(p_issuer_id, p_shareholder_id, p_statement_date);
      
      -- Create main statement record
      INSERT INTO shareholder_statements (
        issuer_id,
        shareholder_id,
        statement_date,
        statement_number,
        generated_by
      ) VALUES (
        p_issuer_id,
        p_shareholder_id,
        p_statement_date,
        v_statement_number,
        p_generated_by
      ) RETURNING id INTO v_statement_id;
      
      -- Get all CUSIPs for this shareholder as of the statement date
      FOR v_cusip IN 
        SELECT DISTINCT cusip 
        FROM shareholder_positions 
        WHERE issuer_id = p_issuer_id 
          AND shareholder_id = p_shareholder_id
          AND position_date <= p_statement_date
          AND shares_owned > 0
      LOOP
        -- Get shares outstanding
        v_shares_outstanding := get_shareholder_position_as_of_date(p_issuer_id, p_shareholder_id, v_cusip, p_statement_date);
        
        -- Get market value per share
        v_market_value_per_share := get_market_value_as_of_date(p_issuer_id, v_cusip, p_statement_date);
        
        -- Calculate total market value
        v_market_value_total := v_shares_outstanding * v_market_value_per_share;
        
        -- Get restrictions text
        v_restrictions_text := get_shareholder_restrictions_text(p_issuer_id, p_shareholder_id, v_cusip);
        
        -- Insert statement detail
        INSERT INTO statement_details (
          statement_id,
          cusip,
          shares_outstanding,
          market_value_per_share,
          market_value_total,
          restrictions_text
        ) VALUES (
          v_statement_id,
          v_cusip,
          v_shares_outstanding,
          v_market_value_per_share,
          v_market_value_total,
          v_restrictions_text
        );
        
        -- Insert recent transactions
        FOR v_transaction_record IN 
          SELECT * FROM get_recent_transactions_for_statement(p_issuer_id, p_shareholder_id, v_cusip, p_statement_date)
        LOOP
          INSERT INTO statement_transactions (
            statement_id,
            transaction_date,
            transaction_type,
            shares_quantity,
            price_per_share,
            total_value
          ) VALUES (
            v_statement_id,
            v_transaction_record.transaction_date,
            v_transaction_record.transaction_type,
            v_transaction_record.shares_quantity,
            v_transaction_record.price_per_share,
            v_transaction_record.shares_quantity * COALESCE(v_transaction_record.price_per_share, 0)
          );
        END LOOP;
      END LOOP;
      
      RETURN v_statement_id;
    END;
    $$ LANGUAGE plpgsql;
    `
  ]
  
  for (const func of functions) {
    const { error } = await supabase.rpc('exec', { sql: func })
    if (error) {
      console.error('Function creation error:', error)
      return
    }
  }
  
  console.log('✅ Helper functions created successfully')
}

async function createTriggers() {
  console.log('Creating triggers...')
  
  const triggers = [
    // Trigger for updated_at
    `
    CREATE TRIGGER IF NOT EXISTS update_market_values_updated_at
      BEFORE UPDATE ON market_values
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
    `,
    
    `
    CREATE TRIGGER IF NOT EXISTS update_shareholder_statements_updated_at
      BEFORE UPDATE ON shareholder_statements
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
    `
  ]
  
  for (const trigger of triggers) {
    const { error } = await supabase.rpc('exec', { sql: trigger })
    if (error) {
      console.error('Trigger creation error:', error)
      return
    }
  }
  
  console.log('✅ Triggers created successfully')
}

async function main() {
  try {
    await applyStatementSchema()
    await createHelperFunctions()
    await createTriggers()
    console.log('🎉 Statement Generation setup completed successfully!')
  } catch (error) {
    console.error('Error during setup:', error)
  }
}

main()






