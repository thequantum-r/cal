import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const issuerId = searchParams.get("issuerId");

    if (!issuerId) {
      return NextResponse.json(
        { error: "Issuer ID is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("split_events")
      .select("transaction_type, class_a_ratio, rights_ratio")
      .eq("issuer_id", issuerId);

    if (error) {
      console.error("❌ Error fetching split events:", error);
      return NextResponse.json(
        { error: "Failed to fetch splits" },
        { status: 500 }
      );
    }

    return NextResponse.json(data || []);
  } catch (err) {
    console.error("❌ Error in splits GET API:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    console.log("📥 Incoming split payload:", body);

    const supabase = await createClient();

    // Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("❌ Unauthorized split POST attempt");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      issuer_id,
      transaction_type = "separation",
      class_a_ratio,
      rights_ratio,
    } = body;

    // Validate required fields
    if (
      !issuer_id ||
      class_a_ratio === undefined ||
      rights_ratio === undefined
    ) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: issuer_id, class_a_ratio, rights_ratio",
        },
        { status: 400 }
      );
    }

    const splitData = {
      issuer_id,
      transaction_type,
      class_a_ratio: Number(class_a_ratio),
      rights_ratio: Number(rights_ratio),
    };

    console.log("🛠 Final splitData to save:", splitData);

    // Check if split event already exists for this issuer
    const { data: existingSplit, error: findError } = await supabase
      .from("split_events")
      .select("id")
      .eq("issuer_id", issuer_id)
      .eq("transaction_type", transaction_type)
      .maybeSingle();

    if (findError) {
      console.error("❌ Find error while checking existing split:", findError);
      return NextResponse.json({ error: findError.message }, { status: 500 });
    }

    let result;
    if (existingSplit) {
      console.log("🔄 Updating existing split:", existingSplit.id);
      result = await supabase
        .from("split_events")
        .update({
          ...splitData,
          created_at: new Date().toISOString(),
        })
        .eq("id", existingSplit.id)
        .select();
    } else {
      console.log("➕ Inserting new split event");
      result = await supabase.from("split_events").insert(splitData).select();
    }

    if (result.error) {
      console.error("❌ DB Split Insert/Update Error:", result.error);
      return NextResponse.json(
        { error: result.error.message },
        { status: 500 }
      );
    }

    console.log("✅ DB Split Insert/Update Success:", result.data);

    return NextResponse.json(
      {
        success: true,
        split_event: result.data?.[0] || null,
        action: existingSplit ? "updated" : "created",
      },
      { status: existingSplit ? 200 : 201 }
    );
  } catch (err) {
    console.error("❌ API Error in splits POST:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
