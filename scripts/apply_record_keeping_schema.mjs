import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// Load environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function applySchema() {
  try {
    console.log('Applying Record Keeping and Control Book schema...')
    
    // Read the schema file
    const schemaPath = path.join(process.cwd(), 'scripts', 'record_keeping_control_book_schema.sql')
    const schema = fs.readFileSync(schemaPath, 'utf8')
    
    // Apply the schema
    const { error } = await supabase.rpc('exec_sql', { sql: schema })
    
    if (error) {
      console.error('Error applying schema:', error)
      return false
    }
    
    console.log('✅ Schema applied successfully')
    return true
  } catch (error) {
    console.error('Error reading schema file:', error)
    return false
  }
}

async function seedSampleData() {
  try {
    console.log('Seeding sample data...')
    
    // Get the first issuer
    const { data: issuers, error: issuerError } = await supabase
      .from('issuers')
      .select('id, name')
      .limit(1)
    
    if (issuerError || !issuers || issuers.length === 0) {
      console.log('No issuers found. Please create an issuer first.')
      return false
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
        },
        {
          issuer_id: issuerId,
          account_number: '2',
          last_name: 'Smith',
          first_name: 'John',
          address: '123 Main Street',
          city: 'Los Angeles',
          state: 'CA',
          zip_code: '90210',
          country: 'USA',
          tax_id: '12-3456789',
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
      .limit(2)
    
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
          },
          {
            issuer_id: issuerId,
            cusip: 'G17564108',
            shareholder_id: shareholderData[1].id,
            transaction_type: 'Transfer Credit',
            credit_debit: 'Credit',
            transaction_date: '2025-06-24',
            quantity: 50000,
            certificate_type: 'Book Entry',
            status: 'Active',
            notes: 'Transfer from another account'
          }
        ])
      
      if (transactionError) {
        console.error('Error inserting transactions:', transactionError)
      } else {
        console.log('✅ Sample transactions inserted')
      }
    }
    
    return true
  } catch (error) {
    console.error('Error seeding data:', error)
    return false
  }
}

async function main() {
  try {
    const schemaSuccess = await applySchema()
    if (schemaSuccess) {
      await seedSampleData()
    }
    console.log('🎉 Record Keeping Book and Control Book setup completed!')
  } catch (error) {
    console.error('Error during setup:', error)
  }
}

main()
