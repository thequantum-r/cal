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

async function applyTransferJournalUpdatedSchema() {
  console.log('Applying updated transfer journal schema...')
  
  try {
    // Read the SQL file
    const sqlFilePath = path.join(process.cwd(), 'scripts', 'transfer_journal_updated_schema.sql')
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8')
    
    // Execute the SQL
    const { error } = await supabase.rpc('exec', { 
      sql: sqlContent
    })
    
    if (error) {
      console.error('Schema error:', error)
      return
    }
    
    console.log('✅ Updated transfer journal schema applied successfully')
    
    // Verify the tables were created
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .in('table_name', ['transfer_journal', 'restriction_templates', 'shareholder_restrictions'])
    
    if (tablesError) {
      console.error('Error checking tables:', tablesError)
    } else {
      console.log('✅ Tables created:', tables.map(t => t.table_name))
    }
    
    // Verify the view was created
    const { data: views, error: viewsError } = await supabase
      .from('information_schema.views')
      .select('table_name')
      .eq('table_name', 'shareholder_position')
    
    if (viewsError) {
      console.error('Error checking views:', viewsError)
    } else {
      console.log('✅ View created:', views.map(v => v.table_name))
    }
    
  } catch (error) {
    console.error('Error applying schema:', error)
  }
}

// Run the migration
applyTransferJournalUpdatedSchema()
  .then(() => {
    console.log('Migration completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Migration failed:', error)
    process.exit(1)
  })







