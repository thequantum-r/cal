"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { createClient } from "@/lib/supabase/client"
import Sidebar from "@/components/sidebar"
import Header from "@/components/header"
import ShareholdersTable from "@/components/shareholders-table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, Search, Filter, Download, Plus, BarChart3 } from "lucide-react"
import { Button } from "@/components/ui/button"

async function getShareholders(issuerId, userRole) {
  const supabase = createClient()

  console.log(`[DEBUG] getShareholders called with issuerId: ${issuerId}, userRole: ${userRole}`)

  // For superadmins without issuer context, show global data
  if (userRole === 'superadmin' && !issuerId) {
    console.log("[DEBUG] Fetching all shareholders for superadmin without issuer context")
    const { data: shareholders, error } = await supabase
      .from("shareholders_new")
      .select("*, issuers_new(issuer_name)")
      .order("last_name")

    if (error) {
      console.error("Error fetching all shareholders:", error)
      console.error("Error details:", JSON.stringify(error, null, 2))
      return []
    }
    console.log(`[DEBUG] Found ${shareholders?.length || 0} shareholders globally`)
    return shareholders || []
  }

  // For issuer-specific data
  if (!issuerId) {
    console.log("[DEBUG] No issuer ID provided, returning empty array")
    return [] // No issuer selected, no data
  }

  console.log(`[DEBUG] Fetching shareholders for issuer: ${issuerId}`)
  const { data: shareholders, error } = await supabase
    .from("shareholders_new")
    .select("*, issuers_new(issuer_name)")
    .eq("issuer_id", issuerId)
    .order("last_name")

  if (error) {
    console.error(`Error fetching shareholders for issuer ${issuerId}:`, error)
    console.error("Error details:", JSON.stringify(error, null, 2))
    return []
  }

  console.log(`[DEBUG] Found ${shareholders?.length || 0} shareholders for issuer ${issuerId}`)
  
  // Calculate actual ownership percentages based on current share balances
  if (shareholders && shareholders.length > 0) {
    // Get current share balances for each shareholder
    const { data: transfers } = await supabase
      .from("transfers_new")
      .select("shareholder_id, share_quantity, transaction_type")
      .eq("issuer_id", issuerId)
    
    // Calculate current balances for each shareholder
    const shareholderBalances = {}
    let totalShares = 0
    
    if (transfers) {
      transfers.forEach(transfer => {
        if (!shareholderBalances[transfer.shareholder_id]) {
          shareholderBalances[transfer.shareholder_id] = 0
        }
        
        // Credit transactions add shares, Debit transactions subtract shares
        const multiplier = (transfer.transaction_type === 'DWAC Withdrawal' || 
                           transfer.transaction_type === 'Transfer Debit') ? -1 : 1
        
        shareholderBalances[transfer.shareholder_id] += (transfer.share_quantity || 0) * multiplier
      })
      
      // Calculate total outstanding shares
      totalShares = Object.values(shareholderBalances).reduce((sum, balance) => sum + Math.max(0, balance), 0)
    }
    
    // Add calculated ownership percentages to shareholders
    shareholders.forEach(shareholder => {
      const currentBalance = shareholderBalances[shareholder.id] || 0
      const maxBalance = Math.max(0, currentBalance) // Don't allow negative balances
      shareholder.calculated_ownership_percentage = totalShares > 0 
        ? ((maxBalance / totalShares) * 100).toFixed(2)
        : "0.00"
      shareholder.current_shares = maxBalance
    })
  }
  
  return shareholders || []
}

export default function ShareholderPage({ params: paramsPromise }) {
  const { user, userRole, currentIssuer, availableIssuers, issuerSpecificRole, userRoles, loading, initialized, validateAndSetIssuer } = useAuth()
  const router = useRouter()
  const [issuerId, setIssuerId] = useState(null)
  const [shareholders, setShareholders] = useState([])
  const [pageLoading, setPageLoading] = useState(true)

  // Get params and set issuer ID
  useEffect(() => {
    const getParams = async () => {
      const params = await paramsPromise
      setIssuerId(params?.issuerId)
    }
    getParams()
  }, [paramsPromise])

  // Validate issuer access when issuer ID is available
  useEffect(() => {
    if (!initialized || !issuerId) return
    
    const validateAccess = async () => {
      if (!user) {
        router.push('/login')
        return
      }

      const { hasAccess } = await validateAndSetIssuer(issuerId)
      
      if (!hasAccess) {
        router.push('/?error=no_access')
        return
      }

      // Load shareholders data
      const data = await getShareholders(issuerId, userRole)
      setShareholders(data)
      setPageLoading(false)
    }

    validateAccess()
  }, [initialized, issuerId, user, validateAndSetIssuer, router, userRole])

  if (loading || !initialized || pageLoading) {
    return (
      <div className="flex h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading Shareholders...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50">
      <Sidebar userRole={userRole} currentIssuerId={issuerId} issuerSpecificRole={issuerSpecificRole} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          user={user} 
          userRole={userRole} 
          currentIssuer={currentIssuer}
          availableIssuers={availableIssuers}
          issuerSpecificRole={issuerSpecificRole}
          userRoles={userRoles}
        />

        <main className="flex-1 overflow-y-auto">
          <div className="py-8">
            <div className="max-w-7xl mx-auto px-6">
              
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <Card className="card-glass border-0">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Total Shareholders</p>
                        <p className="text-3xl font-bold text-gray-900">{shareholders.length}</p>
                      </div>
                      
                    </div>
                  </CardContent>
                </Card>

                <Card className="card-glass border-0">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Active Shareholders</p>
                        <p className="text-3xl font-bold text-gray-900">{shareholders.filter(s => parseFloat(s.calculated_ownership_percentage || s.ownership_percentage || 0) > 0).length}</p>
                      </div>
                      
                    </div>
                  </CardContent>
                </Card>

                <Card className="card-glass border-0">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Average Ownership</p>
                        <p className="text-3xl font-bold text-gray-900">
                          {shareholders.length > 0 
                            ? (shareholders.reduce((sum, s) => sum + parseFloat(s.calculated_ownership_percentage || s.ownership_percentage || 0), 0) / shareholders.length).toFixed(1) + '%'
                            : '0%'
                          }
                        </p>
                      </div>
                      
                    </div>
                  </CardContent>
                </Card>
              </div>

             
              {/* Shareholders Table */}
              <Card className="card-glass border-0">
                <CardHeader>
                  <CardTitle className="text-xl font-bold text-gray-900">Shareholder Records</CardTitle>
                </CardHeader>
                <CardContent>
              <ShareholdersTable shareholders={shareholders} userRole={userRole} issuerId={issuerId} />
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
