import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function fixSchema() {
  console.log('Updating schema...')
  
  const { error } = await supabase.rpc('exec', { 
    sql: `
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
    `
  })
  
  if (error) console.error('Schema error:', error)
  else console.log('✅ Schema updated')
}

async function seedData() {
  await fixSchema()
  
  const { data: shareholders, error: shareholdersError } = await supabase
    .from('shareholders')
    .insert([
      {
        name: 'John Smith', address: '123 Main St', city: 'New York', state: 'NY', zip: '10001', country: 'USA',
        email: 'john@example.com', phone: '555-0123', tax_id: '123-45-6789', account_number: 'ACC001',
        shares_owned: 1000, acquisition_date: '2023-01-15', cusip: 'CUSIP001', issue_name: 'TechCorp Units',
        issue_ticker: 'TECH', trading_platform: 'NASDAQ', security_type: 'Units', transaction_type: 'IPO',
        credit_debit: 'Credit', ownership_percentage: 25.5, cost_basis: 50000
      }
    ])
    .select()

  if (shareholdersError) throw shareholdersError
  console.log('✅ Test data seeded')
}

seedData().catch(console.error)

