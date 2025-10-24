"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { createClient } from "@/lib/supabase/client"
import Sidebar from "@/components/sidebar"
import Header from "@/components/header"
import AsOfSearch from "@/components/as-of-search"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar, Search, Clock, TrendingUp, BarChart3, Filter, Download } from "lucide-react"
import { Button } from "@/components/ui/button"

async function getShareholders(issuerId, userRole) {
  const supabase = createClient()

  // For superadmins without issuer context, show global data
  if (userRole === 'superadmin' && !issuerId) {
    const { data: shareholders, error } = await supabase
      .from("shareholders_new")
      .select("*, issuers_new(issuer_name)")
      .order("last_name")

    if (error) {
      console.error("Error fetching all shareholders:", error)
      return []
    }
    return shareholders || []
  }

  // For issuer-specific data
  if (!issuerId) {
    return [] // No issuer selected, no data
  }

  const { data: shareholders, error } = await supabase
    .from("shareholders_new")
    .select("*, issuers_new(issuer_name)")
    .eq("issuer_id", issuerId)
    .order("last_name")

  if (error) {
    console.error("Error fetching issuer shareholders:", error)
    return []
  }

  return shareholders || []
}

export default function AsOfSearchPage({ params: paramsPromise }) {
  const { user, userRole, userRoles, currentIssuer, availableIssuers, issuerSpecificRole, loading, initialized, validateAndSetIssuer } = useAuth()
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
      <div className="flex h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading Historical Lookup...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-orange-50 via-red-50 to-yellow-50">
      <Sidebar userRole={userRole} currentIssuerId={issuerId} issuerSpecificRole={issuerSpecificRole} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          user={user} 
          userRole={userRole} 
          userRoles={userRoles}
          currentIssuer={currentIssuer}
          availableIssuers={availableIssuers}
          issuerSpecificRole={issuerSpecificRole}
        />

        <main className="flex-1 overflow-y-auto">
          <div className="py-8">
            <div className="max-w-7xl mx-auto px-6">
              {/* Search Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <Card className="card-glass border-0">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Total Records</p>
                        <p className="text-3xl font-bold text-gray-900">{shareholders.length}</p>
                      </div>
                      <div className="w-12 h-12 bg-gradient-to-r from-orange-400 to-red-500 rounded-xl flex items-center justify-center">
                        <Search className="h-6 w-6 text-white" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="card-glass border-0">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Historical Data</p>
                        <p className="text-3xl font-bold text-gray-900">∞</p>
                        <p className="text-sm text-blue-600 flex items-center mt-2">
                          <Clock className="h-4 w-4 mr-1" />
                          Complete history
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-gradient-to-r from-red-400 to-orange-500 rounded-xl flex items-center justify-center">
                        <Clock className="h-6 w-6 text-white" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="card-glass border-0">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Search Accuracy</p>
                        <p className="text-3xl font-bold text-gray-900">100%</p>
                        <p className="text-sm text-green-600 flex items-center mt-2">
                          <TrendingUp className="h-4 w-4 mr-1" />
                          Real-time data
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center">
                        <BarChart3 className="h-6 w-6 text-white" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Main Search Interface */}
              <div className="grid grid-cols-1 lg:grid-cols-1 gap-8">
                {/* Search Results */}
                <div className="lg:col-span-2">
                  <Card className="card-glass border-0">
                    <CardHeader>
                      <CardTitle className="text-xl font-bold text-gray-900">Historical Search Results</CardTitle>
                    </CardHeader>
                    <CardContent>
              <AsOfSearch shareholders={shareholders} userRole={userRole} />
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
