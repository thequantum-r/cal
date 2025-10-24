import { NextResponse } from "next/server"

export async function GET(request, { params }) {
  const { id } = await params

  // Mocked trust account data (later replace with real bank API call)
  const trust = {
    bank_name: "JP Morgan Chase",
    account_number: "****6789",
    balance: 250827823, // 👈 numeric value, not string
    currency: "USD",
    last_updated: "2025-10-10T08:00:00Z",
  }

  return NextResponse.json({ trust })
}
