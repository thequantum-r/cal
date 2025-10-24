import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'

dotenv.config()

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function applyFix() {
  try {
    console.log('🔧 Applying multi-issuer schema fix...')
    
    // Read the fix script
    const fixScript = fs.readFileSync(
      path.join(process.cwd(), 'scripts', 'fix_multi_issuer_schema.sql'),
      'utf8'
    )
    
    // Execute the fix
    const { error } = await supabase.rpc('exec', { sql: fixScript })
    
    if (error) {
      console.error('❌ Error applying fix:', error)
      return
    }
    
    console.log('✅ Multi-issuer schema fix applied successfully!')
    console.log('')
    console.log('🎯 What was fixed:')
    console.log('- Removed infinite recursion in RLS policies')
    console.log('- Simplified policies to avoid conflicts')
    console.log('- Ensured all tables have proper structure')
    console.log('- Added default data safely')
    console.log('')
    console.log('🚀 You can now test the issuer creation modal!')
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

applyFix()

