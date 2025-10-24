import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function applyRolesSchema() {
  console.log('Applying roles schema...')
  
  try {
    // Read the SQL file
    const sqlPath = path.join(process.cwd(), 'scripts', 'roles_schema.sql')
    const sql = fs.readFileSync(sqlPath, 'utf8')
    
    // Split the SQL into individual statements
    const statements = sql.split(';').filter(stmt => stmt.trim())
    
    for (const statement of statements) {
      if (statement.trim()) {
        console.log('Executing:', statement.substring(0, 50) + '...')
        const { error } = await supabase.rpc('exec', { sql: statement + ';' })
        
        if (error) {
          console.error('Error executing statement:', error)
          console.error('Statement:', statement)
        } else {
          console.log('✅ Statement executed successfully')
        }
      }
    }
    
    console.log('✅ Roles schema applied successfully')
  } catch (error) {
    console.error('Error applying roles schema:', error)
    process.exit(1)
  }
}

applyRolesSchema().catch(console.error)






















