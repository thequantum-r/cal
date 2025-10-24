import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// GET officers by issuer
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const issuerId = searchParams.get("issuerId")

    if (!issuerId) {
      return NextResponse.json({ error: "Issuer ID is required" }, { status: 400 })
    }

    const supabase = await createClient()

    const { data: officers, error } = await supabase
      .from("officers_new")
      .select("*")
      .eq("issuer_id", issuerId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching officers:", error)
      return NextResponse.json({ error: "Failed to fetch officers" }, { status: 500 })
    }

    return NextResponse.json(officers || [])
  } catch (error) {
    console.error("Error in officers API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST create a new officer
export async function POST(request) {
  try {
    const body = await request.json()
    const supabase = await createClient()

    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { issuer_id, officer_name, officer_position, results } = body

    // Validate required fields
    if (!issuer_id || !officer_name || !officer_position) {
      return NextResponse.json(
        { error: "issuer_id, officer_name, and officer_position are required" },
        { status: 400 }
      )
    }

    // Safe approach: allow same name with different positions
    // But prevent exact duplicates (same issuer, same name, same position)
    const { data: existingOfficer } = await supabase
      .from("officers_new")
      .select("id")
      .eq("issuer_id", issuer_id)
      .eq("officer_name", officer_name)
      .eq("officer_position", officer_position)
      .maybeSingle()

    if (existingOfficer) {
      return NextResponse.json(
        { error: "This officer with the same role already exists for this issuer" },
        { status: 400 }
      )
    }

    const officerData = {
      issuer_id,
      officer_name,
      officer_position,
      results: results || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const { data: newOfficer, error } = await supabase
      .from("officers_new")
      .insert(officerData)
      .select()
      .single()

    if (error) {
      console.error("Error creating officer:", error)
      return NextResponse.json({ error: "Failed to create officer" }, { status: 500 })
    }

    return NextResponse.json(newOfficer, { status: 201 })
  } catch (error) {
    console.error("Error in POST officers API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
