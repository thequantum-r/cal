import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// POST -> bulk insert into transfers_new
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

    if (!Array.isArray(body) || body.length === 0) {
      return NextResponse.json(
        { error: "No transactions provided" },
        { status: 400 }
      );
    }

    // ✅ Map parsed Excel fields to transfers_new schema
    const payload = body.map((tx) => ({
      issuer_id: tx.issuer_id || null, // must come from issuer save
      cusip: tx.cusip || null,
      transaction_type: tx.transaction_type || null,
      share_quantity: Number.isFinite(tx.share_quantity)
        ? tx.share_quantity
        : 0,
      shareholder_id: /^[0-9a-fA-F-]{36}$/.test(tx.shareholder_id)
        ? tx.shareholder_id
        : null,
      restriction_id: null,
      transaction_date: tx.transaction_date || null, // already formatted
      status: tx.status || "ACTIVE",
      notes: tx.notes || null,
      certificate_type: tx.certificate_type || "Book Entry",
      created_by: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    console.log("Sample payload for transfers_new:", payload[0]);

    const { data, error } = await supabase
      .from("transfers_new")
      .insert(payload)
      .select();

    if (error) {
      console.error("Insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { success: true, count: data.length, records: data },
      { status: 201 }
    );
  } catch (err) {
    console.error("API Error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: err.message },
      { status: 500 }
    );
  }
}
