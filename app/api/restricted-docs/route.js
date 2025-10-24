import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getCurrentUserRole } from "@/lib/actions";

export async function GET() {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userRole = await getCurrentUserRole();

    if (userRole === "broker") {
      // Brokers: get docs with their submissions
      const { data, error } = await supabase
        .from("docs_for_restricted_shares")
        .select(`
          id, issuer_id, issuer_name, document_type, description, required,
          broker_doc_submissions!inner (
            id, status, file_url, comments
          )
        `)
        .eq("broker_doc_submissions.broker_id", user.id);

      if (error) throw error;
      
      // Transform to expected format
      const grouped = data.reduce((acc, doc) => {
        const issuerId = doc.issuer_id;
        if (!acc[issuerId]) {
          acc[issuerId] = {
            issuer_id: issuerId,
            issuer_name: doc.issuer_name,
            documents: [],
          };
        }
        acc[issuerId].documents.push({
          id: doc.id,
          document_type: doc.document_type,
          description: doc.description,
          required: doc.required,
          submission: doc.broker_doc_submissions?.[0] || null,
        });
        return acc;
      }, {});

      return NextResponse.json(Object.values(grouped), { status: 200 });
    }

    if (userRole === "admin" || userRole === "superadmin") {
      // Admins: all docs with all submissions grouped by broker
      const { data, error } = await supabase
        .from("docs_for_restricted_shares")
        .select(`
          id, issuer_id, issuer_name, document_type, description, required,
          broker_doc_submissions (
            id, broker_id, status, file_url, comments, submitted_at,
            users_new:broker_id (
              id, name, email
            )
          )
        `);

      if (error) throw error;

      // Group by issuer, then by broker
      const grouped = data.reduce((acc, doc) => {
        const issuerId = doc.issuer_id;
        if (!acc[issuerId]) {
          acc[issuerId] = {
            issuer_id: issuerId,
            issuer_name: doc.issuer_name,
            documents: [],
            brokers: {},
          };
        }

        // Add document
        acc[issuerId].documents.push({
          id: doc.id,
          document_type: doc.document_type,
          description: doc.description,
          required: doc.required,
          submissions: doc.broker_doc_submissions || [],
        });

        // Group submissions by broker
        (doc.broker_doc_submissions || []).forEach(sub => {
          if (!acc[issuerId].brokers[sub.broker_id]) {
            acc[issuerId].brokers[sub.broker_id] = {
              id: sub.broker_id,
              name: sub.users_new?.name || sub.users_new?.email || 'Unknown',
              docs: [],
            };
          }
          acc[issuerId].brokers[sub.broker_id].docs.push({
            id: doc.id,
            document_type: doc.document_type,
            submission_id: sub.id,
            file_url: sub.file_url,
            status: sub.status,
          });
        });

        return acc;
      }, {});

      // Convert brokers object to array
      const result = Object.values(grouped).map(issuer => ({
        ...issuer,
        brokers: Object.values(issuer.brokers),
      }));

      return NextResponse.json(result, { status: 200 });
    }

    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  } catch (err) {
    console.error("GET Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { issuerId, docId, fileUrl } = await request.json();

    const { data, error } = await supabase
      .from("broker_doc_submissions")
      .upsert(
        {
          broker_id: user.id,
          issuer_id: issuerId,
          doc_id: docId,
          file_url: fileUrl,
          status: "Uploaded",
        },
        { onConflict: "broker_id,doc_id" }
      )
      .select();

    if (error) throw error;
    return NextResponse.json(data[0], { status: 200 });
  } catch (err) {
    console.error("Upload Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}