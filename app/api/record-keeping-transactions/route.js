import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request) {
  try {
    console.log('🔍 Record keeping transactions API called')
    const { searchParams } = new URL(request.url)
    const issuerId = searchParams.get('issuerId')
    console.log('🔍 Requested issuer ID:', issuerId)

    if (!issuerId) {
      return NextResponse.json({ error: 'Issuer ID is required' }, { status: 400 })
    }

    const supabase = await createClient()

    // First get the raw transactions, then we'll enrich them
    const { data: recordKeepingTransactions, error } = await supabase
      .from("transfers_new")
      .select("*")
      .eq("issuer_id", issuerId)
      .order("transaction_date", { ascending: true })

    if (error) {
      console.error('Error fetching record keeping transactions:', error)
      return NextResponse.json({ error: 'Failed to fetch record keeping transactions', details: error.message }, { status: 500 })
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
    
    // Debug: Log CUSIP mapping details
    console.log('🔍 CUSIP mapping details:', {
      cusipMapKeys: Object.keys(cusipMap),
      transactionCusips: [...new Set(recordKeepingTransactions?.map(t => t.cusip))],
      exampleTransaction: recordKeepingTransactions?.[0] ? {
        cusip: recordKeepingTransactions[0].cusip,
        willFindMatch: !!cusipMap[recordKeepingTransactions[0].cusip]
      } : 'No transactions'
    })

    const shareholderMap = {}
    shareholders?.forEach(shareholder => {
      shareholderMap[shareholder.id] = shareholder
    })

    // Get restriction details for transactions that have restriction_id
    const transactionRestrictionIds = recordKeepingTransactions
      ?.filter(t => t.restriction_id)
      .map(t => t.restriction_id) || []

    let restrictionTemplatesMap = {}
    if (transactionRestrictionIds.length > 0) {
      const { data: restrictionTemplates, error: restrictionError } = await supabase
        .from("restrictions_templates_new")
        .select("*")
        .in("id", transactionRestrictionIds)

      if (restrictionError) {
        console.error('Error fetching restriction templates:', restrictionError)
      } else {
        restrictionTemplates?.forEach(template => {
          restrictionTemplatesMap[template.id] = template
        })
      }
    }

    // Enrich the transactions with joined data and derive credit_debit from transaction_type
    const enrichedTransactions = recordKeepingTransactions?.map(transaction => {
      // Determine credit_debit based on transaction_type
      let credit_debit = 'Credit' // Default to Credit
      if (transaction.transaction_type === 'DWAC Withdrawal' || 
          transaction.transaction_type === 'Transfer Debit') {
        credit_debit = 'Debit'
      }
      
      const cusipDetails = cusipMap[transaction.cusip] || null
      const shareholder = shareholderMap[transaction.shareholder_id] || null
      
      // Only get restriction information if this transaction has a restriction_id
      let restrictionInfo = {
        restrictions: [],
        restricted_shares: 0,
        restriction_codes: ''
      }
      
      if (transaction.restriction_id && restrictionTemplatesMap[transaction.restriction_id]) {
        const restrictionTemplate = restrictionTemplatesMap[transaction.restriction_id]
        restrictionInfo = {
          restrictions: [restrictionTemplate],
          restricted_shares: transaction.share_quantity, // The restricted shares for this transaction
          restriction_codes: restrictionTemplate.restriction_type || ''
        }
      }
      
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
        shareholder_name: shareholder ? `${shareholder.first_name || ''} ${shareholder.last_name || ''}`.trim() : '',
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
        shareholder: shareholder,
        // Restriction information - only for transactions with restrictions
        ...restrictionInfo
      }
    }) || []

    console.log('🔍 Raw CUSIP details fetched:', { count: cusipDetails?.length, sample: cusipDetails?.[0] })
    console.log('🔍 Raw shareholders fetched:', { count: shareholders?.length, sample: shareholders?.[0] })
    console.log('🔍 CUSIP Map created:', Object.keys(cusipMap))
    console.log('🔍 Shareholder Map created:', Object.keys(shareholderMap))
    console.log('🔍 Sample transaction shareholder mapping:', enrichedTransactions?.[0] ? {
      transaction_shareholder_id: enrichedTransactions[0].shareholder_id,
      shareholder_found_in_map: !!shareholderMap[enrichedTransactions[0].shareholder_id],
      shareholder_details: shareholderMap[enrichedTransactions[0].shareholder_id],
      derived_shareholder_name: enrichedTransactions[0].shareholder_name
    } : 'No transactions')
    console.log('🔍 Sample transaction quantity data:', enrichedTransactions?.[0] ? {
      transaction_type: enrichedTransactions[0].transaction_type,
      share_quantity: enrichedTransactions[0].share_quantity,
      derived_credit_debit: enrichedTransactions[0].credit_debit,
      cusip_details_found: !!enrichedTransactions[0].cusip_details,
      restriction_id: enrichedTransactions[0].restriction_id,
      restriction_codes: enrichedTransactions[0].restriction_codes
    } : 'No transactions')
    console.log('🔍 Restriction templates loaded:', { count: Object.keys(restrictionTemplatesMap).length, templates: Object.keys(restrictionTemplatesMap) })
    console.log('🔍 Enriched transactions:', { count: enrichedTransactions.length, sample: enrichedTransactions[0] })

    return NextResponse.json(enrichedTransactions)
  } catch (error) {
    console.error('Error in record keeping transactions API:', error)
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 })
  }
}