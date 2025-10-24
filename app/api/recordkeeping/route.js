import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * POST /api/recordkeeping
 * Body: {
 *   issuer_id,
 *   issue_name,
 *   issue_ticker,
 *   trading_platform,
 *   cusip,
 *   security_type,
 *   issuance_type
 * }
 */
export async function POST(req) {
  try {
    const body = await req.json();
    const supabase = await createClient();

    // --- Auth check ---
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      issuer_id,
      issue_name,
      issue_ticker,
      trading_platform,
      cusip,
      security_type,
      issuance_type,
    } = body;

    if (!issuer_id || !cusip) {
      return NextResponse.json(
        { error: "Missing required fields: issuer_id, cusip" },
        { status: 400 }
      );
    }

    // --- Insert into recordkeeping_summary_new ---
    const { data: record, error: insertError } = await supabase
      .from("recordkeeping_summary_new")
      .insert({
        issuer_id,
        issue_name,
        issue_ticker,
        trading_platform,
        cusip,
        security_type,
        issuance_type,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting record:", insertError);
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, record }, { status: 201 });
  } catch (err) {
    console.error("API Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
