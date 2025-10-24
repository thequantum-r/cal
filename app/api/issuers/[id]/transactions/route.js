import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request, { params }) {
  const startTime = Date.now()
  try {
    const { id } = await params
    const supabase = await createClient()

    // Get logged-in user (shareholder)
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Match logged-in user → shareholder_id
    const { data: shareholder, error: shError } = await supabase
      .from("shareholders_new")
      .select("id")
      .eq("email", user.email)
      .single()

    if (shError || !shareholder) {
      return NextResponse.json({ error: "Shareholder not found" }, { status: 404 })
    }

    // Fetch transactions from transfers_new
    const { data: transactions, error } = await supabase
      .from("transfers_new")
      .select(`
        id,
        issuer_id,
        cusip,
        transaction_type,
        share_quantity,
        transaction_date,
        status,
        certificate_type,
        notes
      `)
      .eq("issuer_id", id)
      .eq("shareholder_id", shareholder.id)
      .order("transaction_date", { ascending: false })

    if (error) {
      console.error("Transaction fetch error:", error)
      return NextResponse.json({ error: "Failed to fetch transactions" }, { status: 500 })
    }

    const duration = Date.now() - startTime
    console.log(`⏱️ GET /api/issuers/${id}/transactions took ${duration}ms`)

    return NextResponse.json({ transactions })
  } catch (err) {
    const duration = Date.now() - startTime
    console.error("Transactions API error:", err, `(${duration}ms)`)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
