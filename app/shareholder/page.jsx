"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { createClient } from "@/lib/supabase/client"
import { signOut } from "@/lib/actions"
import ShareholderDashboard from "@/components/ShareholderDashboard" // ✅ new UI component

/**
 * Fetch shareholder data by either userEmail (self-view) or shareholderId (admin view).
 */
export async function getShareholderData({ userEmail = null, shareholderId = null }) {
  const supabase = createClient()

  let shareholder = null

  if (shareholderId) {
    const { data, error } = await supabase
      .from("shareholders_new")
      .select("*")
      .eq("id", shareholderId)
      .single()

    if (error) console.error("Error fetching shareholder by ID:", error)
    shareholder = data
  } else if (userEmail) {
    const { data, error } = await supabase
      .from("shareholders_new")
      .select("*")
      .eq("email", userEmail)
      .single()

    if (error) console.error("Error fetching shareholder by email:", error)
    shareholder = data
  }

  if (!shareholder) {
    return { shareholder: null, transactions: [], currentShares: 0, issuer: null }
  }

  // Get issuer
  const { data: issuer, error: issuerError } = await supabase
    .from("issuers_new")
    .select("*")
    .eq("id", shareholder.issuer_id)
    .single()
  if (issuerError) console.error("Error fetching issuer:", issuerError)

  // Get transactions
  const { data: transactions, error: transactionsError } = await supabase
    .from("transfers_new")
    .select("*")
    .eq("shareholder_id", shareholder.id)
    .order("transaction_date", { ascending: false })
  if (transactionsError) console.error("Error fetching transactions:", transactionsError)

  // Calculate current shares
  let currentShares = 0
  if (transactions) {
    currentShares = transactions.reduce((total, transaction) => {
      const quantity = Number(transaction.share_quantity) || 0
      const multiplier =
        transaction.transaction_type === "DWAC Withdrawal" ||
        transaction.transaction_type === "Transfer Debit"
          ? -1
          : 1
      return total + quantity * multiplier
    }, 0)
  }

  return {
    shareholder,
    transactions: transactions || [],
    currentShares: Math.max(0, currentShares),
    issuer: issuer || null,
  }
}

export default function ShareholderPage() {
  const { user, userRole, loading, initialized } = useAuth()
  const router = useRouter()
  const params = useParams() // for /shareholder/[id]
  const [shareholderData, setShareholderData] = useState(null)
  const [pageLoading, setPageLoading] = useState(true)

useEffect(() => {
  const fetchData = async () => {
    // Wait for auth context to finish loading
    if (!initialized || loading) return

    // 🚫 No valid role → force login
    if (
      userRole !== "shareholder" &&
      userRole !== "admin" &&
      userRole !== "superadmin"
    ) {
      router.push("/login")
      return
    }

    //  Shareholders should NOT access admin/superadmin pages
    if (userRole === "shareholder") {
      router.push("/shareholder-home")
      return
    }


    // ✅ Admin or Superadmin logic
    try {
      let data

      if ((userRole === "admin" || userRole === "superadmin") && params?.id) {
        // Admin/superadmin view by shareholderId
        data = await getShareholderData({ shareholderId: params.id })
      } else if (userRole === "shareholder" && user?.email) {
        // Shareholder self-view (if ever needed in this page)
        data = await getShareholderData({ userEmail: user.email })
      } else {
        data = {
          shareholder: null,
          transactions: [],
          currentShares: 0,
          issuer: null,
        }
      }

      setShareholderData(data)
    } catch (error) {
      console.error("Error fetching shareholder data:", error)
      setShareholderData({
        shareholder: null,
        transactions: [],
        currentShares: 0,
        issuer: null,
      })
    } finally {
      setPageLoading(false)
    }
  }

  fetchData()
}, [initialized, loading, userRole, user, params, router])


  const handleSignOut = async () => {
    try {
      await signOut()
      router.push("/login")
    } catch (error) {
      console.error("Sign out error:", error)
    }
  }

  if (loading || !initialized || pageLoading) {
    return (
      <div className="flex h-screen bg-gradient-to-br from-orange-50 via-red-50 to-yellow-50">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading Shareholder Data...</p>
          </div>
        </div>
      </div>
    )
  }

  // ✅ delegate all UI to the new component
  return (
    <ShareholderDashboard
      shareholderData={shareholderData}
      userRole={userRole}
      onSignOut={handleSignOut} // only self-view uses this
    />
  )
}
