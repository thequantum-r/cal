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
      .from("restrictions_templates_new")
      .select("*")
      .eq("issuer_id", issuerId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error('Error fetching share restrictions:', error)
      return NextResponse.json({ error: 'Failed to fetch share restrictions' }, { status: 500 })
    }

    return NextResponse.json(restrictions || [])
  } catch (error) {
    console.error('Error in share restrictions API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const body = await request.json()
    const { issuer_id, restriction_name, restriction_type, restriction_description, is_active } = body

    if (!issuer_id || !restriction_type || !restriction_description) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: restriction, error } = await supabase
      .from("restrictions_templates_new")
      .insert({
        issuer_id,
        restriction_type,
        description: restriction_description,
        is_active: is_active !== undefined ? is_active : true,
        created_by: user.id
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating share restriction:', error)
      return NextResponse.json({ error: 'Failed to create share restriction' }, { status: 500 })
    }

    return NextResponse.json(restriction)
  } catch (error) {
    console.error('Error in share restrictions POST API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}





