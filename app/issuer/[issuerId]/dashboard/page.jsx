"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { createClient } from "@/lib/supabase/client"
import Sidebar from "@/components/sidebar"
import Header from "@/components/header"
import KPICard from "@/components/kpi-card"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import QuickLinks from "@/components/quick-links"
import { Users, TrendingUp, ArrowRightLeft, BarChart3, Activity, Calendar, DollarSign } from "lucide-react"

async function getDashboardData(issuerId, userRole) {
  const supabase = createClient()

  // For superadmins without issuer context, show global stats
  if (userRole === 'superadmin' && !issuerId) {
    // Get total shareholders across all issuers
    const { count: totalShareholders } = await supabase.from("shareholders_new").select("*", { count: "exact", head: true })

    // Get total shares outstanding across all issuers
    const { data: sharesData } = await supabase.from("shareholders_new").select("shares_owned")
    const totalShares = sharesData?.reduce((sum, shareholder) => sum + shareholder.shares_owned, 0) || 0

    // Get transfers in last 7 days across all issuers
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const { count: recentTransfers } = await supabase
      .from("transfers_new")
      .select("*", { count: "exact", head: true })
      .gte("transfer_date", sevenDaysAgo.toISOString().split("T")[0])

    return {
      totalShareholders: totalShareholders || 0,
      totalShares,
      recentTransfers: recentTransfers || 0,
      scope: 'global'
    }
  }

  // For issuer-specific data (both admins and superadmins with issuer)
  if (!issuerId) {
    return {
      totalShareholders: 0,
      totalShares: 0,
      recentTransfers: 0,
      scope: 'no_issuer'
    }
  }

  // Get issuer-specific shareholders
  const { count: totalShareholders } = await supabase
    .from("shareholders_new")
    .select("*", { count: "exact", head: true })
    .eq("issuer_id", issuerId)

  // Get issuer-specific shares outstanding
  const { data: sharesData } = await supabase
    .from("shareholders_new")
    .select("shares_owned")
    .eq("issuer_id", issuerId)

  const totalShares = sharesData?.reduce((sum, shareholder) => sum + shareholder.shares_owned, 0) || 0

  // Get issuer-specific transfers in last 7 days
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const { count: recentTransfers } = await supabase
    .from("transfers_new")
    .select("*", { count: "exact", head: true })
    .eq("issuer_id", issuerId)
    .gte("transfer_date", sevenDaysAgo.toISOString().split("T")[0])

  return {
    totalShareholders: totalShareholders || 0,
    totalShares,
    recentTransfers: recentTransfers || 0,
    scope: 'issuer',
    issuerId
  }
}

export default function DashboardPage({ params: paramsPromise }) {
  const { user, userRole, currentIssuer, availableIssuers, issuerSpecificRole, userRoles, loading, initialized, validateAndSetIssuer } = useAuth()
  const router = useRouter()
  const [issuerId, setIssuerId] = useState(null)
  const [dashboardData, setDashboardData] = useState(null)
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

      // Load dashboard data
      const data = await getDashboardData(issuerId, userRole)
      setDashboardData(data)
      setPageLoading(false)
    }

    validateAccess()
  }, [initialized, issuerId, user, validateAndSetIssuer, router, userRole])

  if (loading || !initialized || pageLoading) {
    return (
      <div className="flex h-screen bg-gradient-to-br from-orange-50 via-red-50 to-yellow-50">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading Dashboard...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!dashboardData) {
    return null
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-orange-50 via-red-50 to-yellow-50">
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
              {/* Welcome Header */}
              <div className="mb-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-4xl font-bold text-gray-900 mb-2">Dashboard</h1>
                  </div>
                  <div className="hidden lg:flex items-center space-x-4">
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Last updated</p>
                      <p className="text-sm font-medium text-gray-900">{new Date().toLocaleTimeString()}</p>
                    </div>
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  </div>
                </div>
              </div>
              
              {/* KPI Cards - Grid Layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                <div className="card-glass p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Shareholders</p>
                      <p className="text-3xl font-bold text-gray-900">{dashboardData.totalShareholders.toLocaleString()}</p>
                    </div>
                    <div className="w-12 h-12 bg-gradient-to-r from-orange-400 to-red-500 rounded-xl flex items-center justify-center">
                      <Users className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </div>

                <div className="card-glass p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Shares Outstanding</p>
                      <p className="text-3xl font-bold text-gray-900">{dashboardData.totalShares.toLocaleString()}</p>
                    </div>
                    <div className="w-12 h-12 bg-gradient-to-r from-red-400 to-orange-500 rounded-xl flex items-center justify-center">
                      <BarChart3 className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </div>

                <div className="card-glass p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Recent Transfers</p>
                      <p className="text-3xl font-bold text-gray-900">{dashboardData.recentTransfers.toLocaleString()}</p>
                      <div className="text-sm text-orange-600 flex items-center mt-2">
                        <Activity className="h-4 w-4 mr-1" />
                        Last 7 days
                      </div>
                    </div>
                    <div className="w-12 h-12 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center">
                      <ArrowRightLeft className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </div>

              </div>

              {/* Main Content Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-1 gap-8">
                {/* Quick Actions */}
                <div className="lg:col-span-2">
                  <Card className="card-glass border-0">
                <CardHeader>
                      <CardTitle className="text-xl font-bold text-gray-900">Quick Actions</CardTitle>
                      <CardDescription className="text-gray-600">Navigate to common tasks and recent activities</CardDescription>
                </CardHeader>
                <CardContent>
                  <QuickLinks userRole={userRole} issuerId={issuerId} />
                </CardContent>
              </Card>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
