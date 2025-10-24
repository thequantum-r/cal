import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getCurrentUserRole } from "@/lib/actions";

// PATCH - Save or update a user's personal note for a document
export async function PATCH(request) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = await getCurrentUserRole();

    // Check if the user has the required role
    if (userRole !== "broker" && userRole !== "admin" && userRole !== "superadmin") {
      return NextResponse.json({ error: "Forbidden - Insufficient permissions" }, { status: 403 });
    }

    const { docId, note } = await request.json();

    if (!docId) {
      return NextResponse.json({ error: "Document ID is required" }, { status: 400 });
    }

    // Upsert the note - create if doesn't exist, update if it does
    // Each user gets their own note per document
    const { data, error } = await supabase
      .from("document_notes")
      .upsert(
        {
          doc_id: docId,
          user_id: user.id,
          note: note || null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'doc_id,user_id' // Update if this user already has a note for this doc
        }
      )
      .select();

    if (error) {
      console.error("Update note error:", error);
      throw error;
    }

    return NextResponse.json({ success: true, data: data?.[0] }, { status: 200 });
  } catch (error) {
    console.error("API Error updating note:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

// GET - Fetch user's notes for documents
export async function GET(request) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = await getCurrentUserRole();

    if (userRole !== "broker" && userRole !== "admin" && userRole !== "superadmin") {
      return NextResponse.json({ error: "Forbidden - Insufficient permissions" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const issuerId = searchParams.get('issuerId');

    // Fetch all notes for this user
    let query = supabase
      .from("document_notes")
      .select('*')
      .eq('user_id', user.id);

    const { data, error } = await query;

    if (error) {
      console.error("Fetch notes error:", error);
      throw error;
    }

    return NextResponse.json({ notes: data || [] }, { status: 200 });
  } catch (error) {
    console.error("API Error fetching notes:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
