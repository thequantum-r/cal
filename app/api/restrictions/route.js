import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Initialize Supabase client (server-side)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // use service key for RLS bypass on server
)

// GET /api/restrictions?issuerId=<uuid>
export async function GET(request) {
  const startTime = Date.now()
  try {
    const { searchParams } = new URL(request.url)
    const issuerId = searchParams.get("issuerId")

    if (!issuerId) {
      return NextResponse.json(
        { error: "Missing issuerId query parameter" },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from("restrictions")
      .select("id, issuer_id, code, legend, created_at")
      .eq("issuer_id", issuerId)
      .order("code", { ascending: true })

    if (error) {
      console.error("Supabase error:", error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    const duration = Date.now() - startTime
    console.log(`⏱️ GET /api/restrictions?issuerId=${issuerId} took ${duration}ms`)

    return NextResponse.json({ restrictions: data || [] })
  } catch (err) {
    const duration = Date.now() - startTime
    console.error("Unexpected error:", err, `(${duration}ms)`)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// POST /api/restrictions  → For adding new restrictions
export async function POST(request) {
  try {
    const body = await request.json()
    const { issuer_id, code, legend } = body

    if (!issuer_id || !code || !legend) {
      return NextResponse.json(
        { error: "issuer_id, code, and legend are required fields" },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from("restrictions")
      .insert([{ issuer_id, code, legend }])
      .select()

    if (error) {
      console.error("Insert error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ restriction: data[0] }, { status: 201 })
  } catch (err) {
    console.error("Unexpected error:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
