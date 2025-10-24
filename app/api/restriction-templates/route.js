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

    const { data: templates, error } = await supabase
      .from("restrictions_templates_new")
      .select("*")
      .eq("issuer_id", issuerId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error('Error fetching restriction templates:', error)
      return NextResponse.json({ error: 'Failed to fetch restriction templates' }, { status: 500 })
    }

    return NextResponse.json(templates || [])
  } catch (error) {
    console.error('Error in restriction templates API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const body = await request.json()
    const { issuer_id, restriction_type, description, is_active } = body

    if (!issuer_id || !restriction_type || !description) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: template, error } = await supabase
      .from("restrictions_templates_new")
      .insert({
        issuer_id,
        restriction_type,
        description,
        is_active: is_active !== undefined ? is_active : true,
        created_by: user.id
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating restriction template:', error)
      return NextResponse.json({ error: 'Failed to create restriction template' }, { status: 500 })
    }

    return NextResponse.json(template)
  } catch (error) {
    console.error('Error in restriction templates POST API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
