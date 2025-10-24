import { createClient } from '@supabase/supabase-js'

// Use service role key for seeding (bypasses RLS)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function seedData() {
  console.log('Starting database seed...')

  try {
    // Seed shareholders
    const { data: shareholders, error: shareholdersError } = await supabase
      .from('shareholders')
      .insert([
        {
          name: 'John Smith',
          address: '123 Main St, New York, NY 10001',
          tax_id: '123-45-6789',
          account_number: 'ACC001',
          shares_owned: 1000,
          acquisition_date: '2023-01-15',
          cusip: 'CUSIP001'
        },
        {
          name: 'Jane Doe',
          address: '456 Oak Ave, Los Angeles, CA 90210',
          tax_id: '987-65-4321',
          account_number: 'ACC002',
          shares_owned: 750,
          acquisition_date: '2023-02-20',
          cusip: 'CUSIP002'
        },
        {
          name: 'Robert Johnson',
          address: '789 Pine St, Chicago, IL 60601',
          tax_id: '555-44-3333',
          account_number: 'ACC003',
          shares_owned: 500,
          acquisition_date: '2023-03-10',
          cusip: 'CUSIP003'
        },
        {
          name: 'Emily Davis',
          address: '321 Elm St, Houston, TX 77001',
          tax_id: '111-22-3333',
          account_number: 'ACC004',
          shares_owned: 1250,
          acquisition_date: '2023-04-05',
          cusip: 'CUSIP004'
        },
        {
          name: 'Michael Wilson',
          address: '654 Maple Dr, Phoenix, AZ 85001',
          tax_id: '777-88-9999',
          account_number: 'ACC005',
          shares_owned: 300,
          acquisition_date: '2023-05-12',
          cusip: 'CUSIP005'
        }
      ])
      .select()

    if (shareholdersError) throw shareholdersError
    console.log('✅ Shareholders seeded successfully')

    // Seed transfers
    const { error: transfersError } = await supabase
      .from('transfers')
      .insert([
        {
          from_shareholder_id: shareholders[0].id,
          to_shareholder_id: shareholders[1].id,
          shares_transferred: 100,
          transfer_date: '2023-06-01'
        },
        {
          from_shareholder_id: shareholders[1].id,
          to_shareholder_id: shareholders[2].id,
          shares_transferred: 50,
          transfer_date: '2023-06-15'
        },
        {
          from_shareholder_id: shareholders[3].id,
          to_shareholder_id: shareholders[4].id,
          shares_transferred: 75,
          transfer_date: '2023-07-01'
        },
        {
          from_shareholder_id: shareholders[2].id,
          to_shareholder_id: shareholders[0].id,
          shares_transferred: 25,
          transfer_date: '2023-07-20'
        },
        {
          from_shareholder_id: shareholders[4].id,
          to_shareholder_id: shareholders[3].id,
          shares_transferred: 150,
          transfer_date: '2023-08-10'
        }
      ])

    if (transfersError) throw transfersError
    console.log('✅ Transfers seeded successfully')

    // Seed daily snapshots
    const snapshots = []
    const dates = ['2023-12-31', '2024-01-31', '2024-02-29', '2024-03-31']
    
    for (const date of dates) {
      for (const shareholder of shareholders) {
        snapshots.push({
          date,
          shareholder_id: shareholder.id,
          shares_owned: shareholder.shares_owned + Math.floor(Math.random() * 100) - 50 // Random variation
        })
      }
    }

    const { error: snapshotsError } = await supabase
      .from('daily_snapshots')
      .insert(snapshots)

    if (snapshotsError) throw snapshotsError
    console.log('✅ Daily snapshots seeded successfully')

    console.log('🎉 Database seeding completed!')

  } catch (error) {
    console.error('❌ Error seeding database:', error)
    process.exit(1)
  }
}

seedData()
