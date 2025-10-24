import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// ⚡ GET method with response time logging
export async function GET(request, { params }) {
  const startTime = Date.now()
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data: issuer, error } = await supabase
      .from("issuers_new")
      .select("*")
      .eq("id", id)
      .single()

    const duration = Date.now() - startTime
    console.log(`⏱️ GET /api/issuers/${id} took ${duration}ms`)

    if (error) {
      console.error('Error fetching issuer:', error)
      return NextResponse.json({ error: 'Failed to fetch issuer' }, { status: 500 })
    }

    if (!issuer) {
      return NextResponse.json({ error: 'Issuer not found' }, { status: 404 })
    }

    return NextResponse.json(issuer)
  } catch (error) {
    const duration = Date.now() - startTime
    console.error('Error in issuer GET API:', error, `(${duration}ms)`)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Your existing PUT method - unchanged
export async function PUT(request, { params }) {
  try {
    const { id } = params
    const body = await request.json()

    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Update issuer
    const { data: issuer, error } = await supabase
      .from("issuers_new")
      .update({
        ...body,
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error('Error updating issuer:', error)
      return NextResponse.json({ error: 'Failed to update issuer' }, { status: 500 })
    }

    return NextResponse.json(issuer)
  } catch (error) {
    console.error('Error in issuer PUT API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// NEW: PATCH method specifically for split ratio updates
export async function PATCH(request, { params }) {
  try {
    const { id } = params
    const body = await request.json()
    const supabase = await createClient()

    // Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Extract only the fields we want to update via PATCH
    const { separation_ratio } = body

    // Check if issuer exists
    const { data: existingIssuer, error: findError } = await supabase
      .from("issuers_new")
      .select("id")
      .eq("id", id)
      .single()

    if (findError || !existingIssuer) {
      console.error("Find error:", findError)
      return NextResponse.json({ error: "Issuer not found" }, { status: 404 })
    }

    // Update only specific fields (more targeted than PUT)
    const { data: updatedIssuer, error: updateError } = await supabase
      .from("issuers_new")
      .update({
        separation_ratio,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single()

    if (updateError) {
      console.error("Update error:", updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      issuer: updatedIssuer
    })
  } catch (err) {
    console.error("Error in issuer PATCH API:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}