import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request, { params }) {
  const { id } = params
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("issuers_new")
    .select(`
      id,
      issuer_name,
      display_name,
      address,
      telephone,
      tax_id,
      incorporation,
      underwriter,
      exchange_platform,
      forms_sl_status,
      timeframe_for_separation,
      separation_ratio,
      timeframe_for_bc,
      us_counsel,
      offshore_counsel,
      notes,
      created_at,
      updated_at
    `)
    .eq("id", id)
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Issuer not found" }, { status: 404 })
  }

  return NextResponse.json({ issuer: data })
}
