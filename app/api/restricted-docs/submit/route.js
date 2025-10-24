import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { issuerId } = await request.json();

    const { error } = await supabase
      .from("broker_doc_submissions")
      .update({ status: "AwaitingVerification" })
      .eq("broker_id", user.id)
      .eq("issuer_id", issuerId)
      .eq("status", "Uploaded"); // Only update uploaded docs

    if (error) throw error;
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("Submit Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}