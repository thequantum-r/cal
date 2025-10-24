import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const body = await req.json();
    const supabase = await createClient();

    // Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      issuer_name,
      address,
      telephone,
      tax_id,
      incorporation,
      underwriter,
      share_info,
      notes,
      forms_sl_status,
      timeframe_for_separation,
      separation_ratio,
      exchange_platform,
      timeframe_for_bc,
      us_counsel,
      offshore_counsel,
      display_name,
      description,
      override,
    } = body;

    // Step 1: Check if issuer already exists
    const { data: existingIssuer, error: findError } = await supabase
      .from("issuers_new")
      .select("*")
      .eq("issuer_name", issuer_name)
      .maybeSingle();

    if (findError) {
      console.error("Find error:", findError);
      return NextResponse.json({ error: findError.message }, { status: 500 });
    }

    // Step 2: If exists and no override → notify client
    if (existingIssuer && !override) {
      return NextResponse.json({ exists: true, issuer: existingIssuer }, { status: 200 });
    }

    // Build payload
    const newIssuer = {
      issuer_name: issuer_name || "Unnamed Issuer",
      address: address || null,
      telephone: telephone || null,
      tax_id: tax_id || null,
      incorporation: incorporation || null,
      underwriter: underwriter || null,
      share_info: share_info || null,
      notes: notes || null,
      forms_sl_status: forms_sl_status || null,
      timeframe_for_separation: timeframe_for_separation || null,
      separation_ratio: separation_ratio || null,
      exchange_platform: exchange_platform || null,
      timeframe_for_bc: timeframe_for_bc || null,
      us_counsel: us_counsel || null,
      offshore_counsel: offshore_counsel || null,
      display_name: display_name || issuer_name || null,
      description: description || null,
      created_by: user.id,
    };

    // Step 3: Insert or Update
    let result;
    if (existingIssuer && override) {
      result = await supabase
        .from("issuers_new")
        .update(newIssuer)
        .eq("issuer_name", issuer_name)
        .select();
    } else {
      result = await supabase.from("issuers_new").insert(newIssuer).select();
    }

    if (result.error) {
      console.error("DB Insert/Update Error:", result.error);
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }

    return NextResponse.json(
      { success: true, issuer: result.data?.[0] || null },
      { status: existingIssuer && override ? 200 : 201 }
    );
  } catch (err) {
    console.error("API Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
