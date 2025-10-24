import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getCurrentUserRole } from "@/lib/actions";

export async function PATCH(request) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userRole = await getCurrentUserRole();
    if (userRole !== "admin" && userRole !== "superadmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { submissionId, action, comments } = await request.json();

    if (!["Accepted", "Rejected"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("broker_doc_submissions")
      .update({
        status: action,
        comments: comments || null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", submissionId)
      .select();

    if (error) throw error;
    return NextResponse.json(data[0], { status: 200 });
  } catch (err) {
    console.error("Review Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}