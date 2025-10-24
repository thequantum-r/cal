import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request) {
  const startTime = Date.now()
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get("email")
    const issuerId = searchParams.get("issuerId") || searchParams.get("issuer_id")

    const supabase = await createClient()

    // If caller requested shareholders by issuerId (used by the UI), return an array
    if (issuerId) {
      const { data: shareholders, error } = await supabase
        .from("shareholders_new")
        .select(
          "id, issuer_id, account_number, first_name, last_name, address, email, phone, holder_type, ownership_percentage, created_at, updated_at"
        )
        .eq("issuer_id", issuerId)

      if (error) {
        console.error("Error fetching shareholders by issuerId:", error)
        return NextResponse.json({ error: "Failed to fetch shareholders" }, { status: 500 })
      }

      // Return the raw array (frontend expects an array)
      return NextResponse.json(shareholders || [])
    }

    // Fallback: support existing email-based profile + holdings lookup
    if (!email) {
      return NextResponse.json({ error: "Email or issuerId is required" }, { status: 400 })
    }

    // 1. Get shareholder profile
    const { data: profile, error: profileError } = await supabase
      .from("shareholders_new")
      .select("id, first_name, last_name, account_number, holder_type, address, email, phone, ownership_percentage")
      .eq("email", email)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: "Shareholder not found" }, { status: 404 })
    }

    // ⚡ OPTIMIZED: Fetch all data in parallel (no joins to avoid FK conflicts)
    // This runs in parallel instead of sequential, saving ~5-7 seconds

    const [
      { data: holdingsRaw, error: holdingsError },
      { data: issuers },
      { data: securities }
    ] = await Promise.all([
      // Query 1: Get holdings (simple select, no joins)
      supabase
        .from("shareholder_positions_new")
        .select("id, shares_owned, position_date, issuer_id, security_id")
        .eq("shareholder_id", profile.id),

      // Query 2: Get all issuers (PARALLEL - doesn't wait for Query 1)
      supabase.from("issuers_new").select("id, issuer_name"),

      // Query 3: Get all securities (PARALLEL - doesn't wait for Query 1 or 2)
      supabase.from("securities_new").select("id, class_name, cusip, total_authorized_shares")
    ])

    if (holdingsError) {
      console.error("Error fetching holdings:", holdingsError)
      return NextResponse.json({ error: "Failed to fetch holdings" }, { status: 500 })
    }

    // ⚡ Merge data on client-side (fast now because all queries ran in parallel)
    const holdings = (holdingsRaw || []).map(h => {
      const issuer = issuers?.find(i => i.id === h.issuer_id) || null
      const security = securities?.find(s => s.id === h.security_id) || null

      let ownership_percentage = 0
      if (security?.total_authorized_shares > 0) {
        ownership_percentage = (h.shares_owned / security.total_authorized_shares) * 100
      }

      return {
        ...h,
        issuer,
        security,
        ownership_percentage: Number(ownership_percentage.toFixed(2))
      }
    })

    const duration = Date.now() - startTime
    console.log(`⏱️ GET /api/shareholders?email=${email} took ${duration}ms`)

    return NextResponse.json({
      profile,
      holdings
    })
  } catch (err) {
    const duration = Date.now() - startTime
    console.error("API Error in /shareholders:", err, `(${duration}ms)`)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ✅ POST shareholders - bulk insert
export async function POST(req) {
  try {
    const body = await req.json()
    const supabase = await createClient()

    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Accept either a single object or an array
    const isArray = Array.isArray(body)
    const items = isArray ? body : [body]

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "No shareholders provided" }, { status: 400 })
    }

    // Map payload
    const payload = items.map((sh) => ({
      issuer_id: sh.issuer_id,
      account_number: sh.account_number || null,
      first_name: sh.first_name || sh.shareholder_name || null,
      last_name: sh.last_name || null,
      address: sh.address || null,
      city: sh.city || null,
      state: sh.state || null,
      zip: sh.zip || null,
      country: sh.country || null,
      taxpayer_id: sh.taxpayer_id || null,
      tin_status: sh.tin_status || null,
      email: sh.email || null,
      phone: sh.phone || null,
      dob: sh.dob || sh.date_of_birth || null,
      holder_type: sh.holder_type || null,
      lei: sh.lei || null,
      ownership_percentage: sh.ownership_percentage || 0,
      ofac_date: sh.ofac_date || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }))

    const { data, error } = await supabase
      .from("shareholders_new")
      .insert(payload)
      .select()

    if (error) {
      console.error("Error inserting shareholders:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // If caller sent a single object, return single record for convenience
    if (!isArray) {
      return NextResponse.json(data[0], { status: 201 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    console.error("API Error (shareholders POST):", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
