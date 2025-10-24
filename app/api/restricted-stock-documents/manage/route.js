import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getCurrentUserRole } from "@/lib/actions";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // ⚠️ only in server-side code
);

// Add new document requirement
export async function POST(request) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = await getCurrentUserRole();
    if (userRole !== "admin" && userRole !== "superadmin") {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    const { issuerId, document_type, description, required } = await request.json();

    if (!issuerId || !document_type) {
      return NextResponse.json({ error: "issuerId and document_type are required" }, { status: 400 });
    }

    // Get issuer name
    const { data: issuerData, error: issuerError } = await supabase
      .from("issuers_new")
      .select("issuer_name")
      .eq("id", issuerId)
      .single();

    if (issuerError || !issuerData) {
      return NextResponse.json({ error: "Issuer not found" }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("docs_for_restricted_shares")
      .insert({
        issuer_id: issuerId,
        issuer_name: issuerData.issuer_name,
        document_type,
        description: description || null,
        required: required !== undefined ? required : true,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("Add document error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Update existing document requirement
// PATCH: update doc
export async function PATCH(request) {
  try {
    const userRole = await getCurrentUserRole();
    if (userRole !== "admin" && userRole !== "superadmin") {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    const { docId, document_type, description, required } = await request.json();
    if (!docId) {
      return NextResponse.json({ error: "docId is required" }, { status: 400 });
    }

    const updateData = {};
    if (document_type !== undefined) updateData.document_type = document_type;
    if (description !== undefined) updateData.description = description;
    if (required !== undefined) updateData.required = required;
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("docs_for_restricted_shares")
      .update(updateData)
      .eq("id", docId)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 200 });
  } catch (err) {
    console.error("Update document error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Delete document requirement
// Delete document requirement
export async function DELETE(request) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = await getCurrentUserRole();
    if (userRole !== "admin" && userRole !== "superadmin") {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    const { docId } = await request.json();
    if (!docId) {
      return NextResponse.json({ error: "docId is required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("docs_for_restricted_shares")
      .delete()
      .eq("id", docId);

    if (error) throw error;
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("Delete document error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

