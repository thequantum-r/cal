import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'

// Load environment variables
dotenv.config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function applyMultiIssuerSchema() {
  console.log('Applying multi-issuer schema...')
  
  try {
    // Read the SQL file
    const sqlPath = path.join(process.cwd(), 'scripts', 'multi_issuer_schema.sql')
    const sqlContent = fs.readFileSync(sqlPath, 'utf8')
    
    // Execute the SQL
    const { error } = await supabase.rpc('exec', { sql: sqlContent })
    
    if (error) {
      console.error('Schema application error:', error)
      return
    }
    
    console.log('✅ Multi-issuer schema applied successfully!')
    console.log('')
    console.log('📋 What was added:')
    console.log('  • issuers table - for managing companies/organizations')
    console.log('  • issuer_users table - many-to-many relationship between users and issuers')
    console.log('  • securities table - for CUSIP management per issuer')
    console.log('  • issuer_id columns added to existing tables')
    console.log('  • Updated RLS policies for issuer-based access control')
    console.log('  • New issuer_admin role')
    console.log('  • Helper functions for issuer management')
    console.log('')
    console.log('🔧 Next steps:')
    console.log('  1. Create issuers using the new Issuer Management page')
    console.log('  2. Assign users to issuers with appropriate roles')
    console.log('  3. Add securities (CUSIPs) for each issuer')
    console.log('  4. Test the multi-issuer functionality')
    
  } catch (error) {
    console.error('Error applying schema:', error)
  }
}

// Run the script
applyMultiIssuerSchema()

