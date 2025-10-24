import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const issuerId = searchParams.get('issuerId')

    if (!issuerId) {
      return NextResponse.json({ error: 'Issuer ID is required' }, { status: 400 })
    }

    const supabase = await createClient()

    // First get the raw transactions, then we'll enrich them
    const { data: transferJournal, error } = await supabase
      .from("transfers_new")
      .select("*")
      .eq("issuer_id", issuerId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error('Error fetching transfer journal:', error)
      return NextResponse.json({ error: 'Failed to fetch transfer journal' }, { status: 500 })
    }

    // Get CUSIP details for enrichment
    const { data: cusipDetails, error: cusipError } = await supabase
      .from("securities_new")
      .select("*")
      .eq("issuer_id", issuerId)

    if (cusipError) {
      console.error('Error fetching CUSIP details:', cusipError)
    }

    // Get shareholder details
    const { data: shareholders, error: shareholderError } = await supabase
      .from("shareholders_new")
      .select("*")
      .eq("issuer_id", issuerId)

    if (shareholderError) {
      console.error('Error fetching shareholders:', shareholderError)
    }

    // Create lookup maps
    const cusipMap = {}
    cusipDetails?.forEach(cusip => {
      cusipMap[cusip.cusip] = cusip
    })

    const shareholderMap = {}
    shareholders?.forEach(shareholder => {
      shareholderMap[shareholder.id] = shareholder
    })

    // Enrich the transactions with joined data and derive credit_debit from transaction_type
    const enrichedTransactions = transferJournal?.map(transaction => {
      // Determine credit_debit based on transaction_type
      let credit_debit = 'Credit' // Default to Credit
      if (transaction.transaction_type === 'DWAC Withdrawal' || 
          transaction.transaction_type === 'Transfer Debit') {
        credit_debit = 'Debit'
      }

      const cusipDetails = cusipMap[transaction.cusip] || null
      const shareholder = shareholderMap[transaction.shareholder_id] || null
      
      return {
        ...transaction,
        credit_debit, // Add the derived field
        // Enriched fields for export
        issue_name: cusipDetails?.issue_name || '',
        issue_ticker: cusipDetails?.issue_ticker || '',
        trading_platform: cusipDetails?.trading_platform || '',
        security_type: cusipDetails?.class_name || '',
        quantity: transaction.share_quantity, // Map quantity field
        certificate_type: transaction.certificate_type || 'Book Entry',
        // Shareholder details
        account_number: shareholder?.account_number || '',
        shareholder_name: shareholder ? `${shareholder.first_name} ${shareholder.last_name}`.trim() : '',
        shareholder_first_name: shareholder?.first_name || '',
        shareholder_last_name: shareholder?.last_name || '',
        address: shareholder?.address || '',
        city: shareholder?.city || '',
        state: shareholder?.state || '',
        zip: shareholder?.zip || '',
        country: shareholder?.country || '',
        taxpayer_id: shareholder?.taxpayer_id || '',
        tin_status: shareholder?.tin_status || '',
        email: shareholder?.email || '',
        phone: shareholder?.phone || '',
        date_of_birth: shareholder?.dob || '',
        ownership_percentage: shareholder?.ownership_percentage || '',
        lei: shareholder?.lei || '',
        holder_type: shareholder?.holder_type || '',
        ofac_date: shareholder?.ofac_date || '',
        ofac_results: '', // This field doesn't exist in our schema
        cusip_details: cusipDetails,
        shareholder: shareholder
      }
    }) || []

    return NextResponse.json(enrichedTransactions)
  } catch (error) {
    console.error('Error in transfer journal API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}





