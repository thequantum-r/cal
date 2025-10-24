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

    const { data: restrictions, error } = await supabase
      .from("transaction_restrictions_new")
      .select(`
        *,
        shareholders_new (id, first_name, last_name, account_number),
        restrictions_templates_new (restriction_type, description)
      `)
      .eq("issuer_id", issuerId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error('Error fetching shareholder restrictions:', error)
      return NextResponse.json({ error: 'Failed to fetch shareholder restrictions' }, { status: 500 })
    }

    return NextResponse.json(restrictions || [])
  } catch (error) {
    console.error('Error in shareholder restrictions API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const body = await request.json()
    const { issuer_id, shareholder_id, restriction_id, cusip, restricted_shares, restriction_date, expiration_date, notes } = body

    if (!issuer_id || !shareholder_id || !restriction_id || !cusip || restricted_shares === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: restriction, error } = await supabase
      .from("transaction_restrictions_new")
      .insert({
        issuer_id,
        shareholder_id,
        restriction_id,
        cusip,
        restricted_shares,
        restriction_date: restriction_date || new Date().toISOString().split('T')[0],
        expiration_date,
        notes,
        created_by: user.id
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating shareholder restriction:', error)
      return NextResponse.json({ error: 'Failed to create shareholder restriction' }, { status: 500 })
    }

    return NextResponse.json(restriction)
  } catch (error) {
    console.error('Error in shareholder restrictions POST API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}





