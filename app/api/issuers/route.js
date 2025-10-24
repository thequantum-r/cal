
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createClient();

    // Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch all issuers
    const { data: issuers, error: fetchError } = await supabase
      .from("issuers_new")
      .select("id, issuer_name, display_name, separation_ratio, created_at")
      .order("issuer_name", { ascending: true });

    if (fetchError) {
      console.error("Fetch error:", fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    return NextResponse.json(issuers || [], { status: 200 });
  } catch (err) {
    console.error("API Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
