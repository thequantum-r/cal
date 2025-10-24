// app/shareholder/[id]/page.jsx
import { redirect, notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import ShareholderDashboard from "@/components/ShareholderDashboard"
import {
  getCurrentUserRole, // server action assumed
  validateIssuerAccess, // for issuer guard if needed
} from "@/lib/actions"

// Helper: classify debit types
const isDebit = (type) =>
  type === "DWAC Withdrawal" || type === "Transfer Debit"

export default async function ShareholderDetailPage({ params }) {
  const supabase = await createClient()

  // --- Auth gate ---
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect("/login")
  }

  // --- Role ---
  const role = await getCurrentUserRole()

  // --- Fetch shareholder with issuer join ---
  const { data: shareholder, error: shErr } = await supabase
    .from("shareholders_new")
    .select(
      "*, issuers_new:issuer_id ( issuer_name, display_name, address, telephone )"
    )
    .eq("id", params.id)
    .single()

  if (shErr || !shareholder) {
    notFound()
  }

  // --- Access control ---
  // Shareholders can only view their own record (assuming you store user_id on shareholder)
  if (role === "shareholder" && shareholder.user_id !== user.id) {
    redirect("/shareholder-home")
  }

  
  // --- Fetch transactions for this shareholder (and issuer to be safe) ---
  const { data: transactions = [] } = await supabase
    .from("transfers_new")
    .select(
      "id, shareholder_id, issuer_id, transaction_type, share_quantity, transaction_date"
    )
    .eq("shareholder_id", shareholder.id)
    .eq("issuer_id", shareholder.issuer_id)
    .order("transaction_date", { ascending: false })

  // --- Compute currentShares using your debit/credit rules ---
  const currentShares = (transactions || []).reduce((acc, t) => {
    const qty = Number(t.share_quantity || 0)
    return acc + (isDebit(t.transaction_type) ? -qty : qty)
  }, 0)

  // --- Shape data for your ShareholderDashboard ---
  const shareholderData = {
    shareholder,
    issuer: {
      issuer_name: shareholder.issuers_new?.issuer_name,
      display_name: shareholder.issuers_new?.display_name,
      address: shareholder.issuers_new?.address,
      telephone: shareholder.issuers_new?.telephone,
    },
    transactions,
    currentShares: Math.max(0, currentShares),
  }

  return (
    <ShareholderDashboard
      shareholderData={shareholderData}
      userRole={role}
      // no onSignOut here → admin view
    />
  )
}
