// File: app/api/securities/route.js
import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// GET securities by issuer
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const issuerId = searchParams.get("issuerId")

    if (!issuerId) {
      return NextResponse.json(
        { error: "Issuer ID is required" },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    const { data: securities, error } = await supabase
      .from("securities_new")
      .select("*")
      .eq("issuer_id", issuerId)
      .eq("status", "active")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("❌ Error fetching securities:", error)
      return NextResponse.json(
        { error: "Failed to fetch securities" },
        { status: 500 }
      )
    }

    console.log("✅ Securities fetched for issuer:", issuerId, {
      count: securities?.length,
      sample: securities?.[0],
    })

    return NextResponse.json(securities || [])
  } catch (err) {
    console.error("❌ Error in GET /securities:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// POST create a new security
export async function POST(request) {
  try {
    const body = await request.json()
    const supabase = await createClient()

    // --- Auth check ---
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const {
      issuer_id,
      class_name,
      cusip,
      issue_name,
      issue_ticker,
      total_authorized_shares,
      trading_platform,
      // issuance_type is ignored for now
    } = body

    // --- Validation ---
    if (!issuer_id || !class_name || !cusip || !issue_name) {
      return NextResponse.json(
        { error: "issuer_id, class_name, cusip, and issue_name are required" },
        { status: 400 }
      )
    }

    // --- Check for duplicate CUSIP ---
    const { data: existingSecurity, error: checkError } = await supabase
      .from("securities_new")
      .select("id")
      .eq("issuer_id", issuer_id)
      .eq("cusip", cusip)
      .maybeSingle()

    if (checkError) {
      console.error("❌ Error checking existing security:", checkError)
      return NextResponse.json(
        { error: "Error validating existing securities" },
        { status: 500 }
      )
    }

    if (existingSecurity) {
      console.warn("⚠️ Duplicate CUSIP detected:", { issuer_id, cusip })
      return NextResponse.json(
        { error: "CUSIP already exists for this issuer" },
        { status: 400 }
      )
    }

    // --- Prepare insert payload ---
    
    
    // Normalize status if provided, default to "active"
let normalizedStatus = "active";
if (body.status) {
  normalizedStatus =
    typeof body.status === "string" && body.status.toLowerCase() === "active"
      ? "active"
      : body.status.toLowerCase();
}

const securityData = {
  issuer_id,
  class_name,
  cusip,
  issue_name,
  issue_ticker: issue_ticker || null,
  total_authorized_shares: total_authorized_shares || null,
  trading_platform: trading_platform || null,
  created_by: user.id,
  status: normalizedStatus,
};


    // --- Insert new record ---
    const { data: newSecurity, error: insertError } = await supabase
      .from("securities_new")
      .insert(securityData)
      .select()
      .single()

    if (insertError) {
      console.error("❌ Error creating security:", insertError)
      return NextResponse.json(
        { error: "Failed to create security" },
        { status: 500 }
      )
    }

    console.log("✅ Security created:", newSecurity)
    return NextResponse.json(newSecurity, { status: 201 })
  } catch (err) {
    console.error("❌ Error in POST /securities:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
