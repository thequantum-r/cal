import { NextResponse } from "next/server"

export async function GET(request, { params }) {
  const { id } = await params
  const CAL_REDWOOD_ID = "e28e5ed8-3710-4dae-819a-e0489686ab01"

  if (id !== CAL_REDWOOD_ID) {
    return NextResponse.json({ documents: [] })
  }

  const docs = [
    {
      id: "s1",
      type: "S-1",
      title: "Initial Registration Statement",
      filing_date: "2025-03-03",
      url: "https://www.sec.gov/Archives/edgar/data/2058359/000121390025019475/ea0232145-01.htm",
    },
    {
      id: "s1a",
      type: "S-1/A",
      title: "Amendment to Registration Statement",
      filing_date: "2025-05-21",
      url: "https://www.sec.gov/Archives/edgar/data/2058359/000121390025046176/ea0232145-08.htm",
    },
    {
      id: "424b4",
      type: "424B4",
      title: "Prospectus Filed Pursuant to Rule 424(b)(4)",
      filing_date: "2025-05-23",
      url: "https://www.sec.gov/Archives/edgar/data/2058359/000121390025047444/ea0232145-09.htm",
    },
    {
      id: "8k-1",
      type: "8-K",
      title: "Current Report – Initial Business Combination Announcement",
      filing_date: "2025-06-17",
      url: "https://www.sec.gov/Archives/edgar/data/2058359/000121390025055207/ea0245915-8k_calred.htm",
    },
    {
      id: "8k-2",
      type: "8-K",
      title: "Current Report – Management Update",
      filing_date: "2025-06-02",
      url: "https://www.sec.gov/Archives/edgar/data/2058359/000121390025050126/ea0243885-8k_calred.htm",
    },
    {
      id: "8k-3",
      type: "8-K",
      title: "Current Report – Entry into a Material Agreement",
      filing_date: "2025-05-27",
      url: "https://www.sec.gov/Archives/edgar/data/2058359/000121390025047867/ea0243417-8k_calredwood.htm",
    },
    {
      id: "IMTA",
      type: "IMTA",
      title: "Investment Management Trust Agreement",
      filing_date: "2025-05-22",
      url: "https://www.sec.gov/Archives/edgar/data/2058359/000121390025045030/ea023214507ex10-2_calred.htm",
    },
    {
  id: "onboarding-1",
  type: "Onboarding",
  title: "Cal Redwood Account Packet",
  filing_date: "2025-05-09",
  url: "https://rpnrtswahzutdgotkzkz.supabase.co/storage/v1/object/public/documents/Document%20Depository/CRAC/Cal%20Redwood%20Onboarding%20Packet.pdf",
},


  ]

  return NextResponse.json({ documents: docs })
}
