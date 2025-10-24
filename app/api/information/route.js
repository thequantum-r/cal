import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getCurrentUserRole } from "@/lib/actions"; // Assuming this action exists and returns the role

export async function GET(request) {
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

    // In a real application, you would fetch dynamic data here
    const informationData = {
      title: "Important Market Information",
      content: "This section provides critical market insights, compliance updates, and aggregated portfolio summaries relevant to authorized personnel. Stay informed about the latest regulatory changes and market trends affecting your issuers and clients.",
      updates: [
        { id: 1, text: "New compliance directive issued on 2025-09-29.", date: "2025-09-29" },
        { id: 2, text: "Quarterly market review available for Q3 2025.", date: "2025-09-28" },
        { id: 3, text: "Upcoming changes to shareholder reporting requirements.", date: "2025-09-25" },
      ],
      brokerTips: [
        "Ensure all client portfolios are up-to-date with the latest compliance guidelines.",
        "Utilize the new reporting tools for comprehensive client statements.",
      ],
      lastUpdated: new Date().toISOString(),
    };

    return NextResponse.json(informationData, { status: 200 });
  } catch (error) {
    console.error("API Error fetching information:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

