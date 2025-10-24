"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { createClient } from "@/lib/supabase/client"
import Sidebar from "@/components/sidebar"
import Header from "@/components/header"
import TransferJournalTable from "@/components/transfer-journal-table"
import TransferJournalView from "@/components/transfer-journal-view"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowRightLeft, TrendingUp, Calendar, DollarSign, Filter, Download, Plus, Clock, CheckCircle, BarChart3, Users, Shield, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"

async function getTransferJournalData(issuerId, userRole) {
  const supabase = createClient()

  // For superadmins without issuer context, show global data
  if (userRole === 'superadmin' && !issuerId) {
    // Get all transfer journal records
    const { data: rawRecords, error: recordsError } = await supabase
      .from("transfers_new")
      .select("*, issuers_new(issuer_name)")
      .order("transaction_date", { ascending: false })

    if (recordsError) {
      console.error("Error fetching all transfer journal records:", recordsError)
    }

    // Get all securities for enrichment
    const { data: securities, error: securitiesError } = await supabase
      .from("securities_new")
      .select("*")

    if (securitiesError) {
      console.error("Error fetching all securities:", securitiesError)
    }

    // Create securities lookup map
    const securitiesMap = {}
    securities?.forEach(security => {
      securitiesMap[security.cusip] = security
    })

    // Enrich records with credit_debit derivation and security details
    const records = rawRecords?.map(record => {
      // Determine credit_debit based on transaction_type
      let credit_debit = 'Credit' // Default to Credit
      if (record.transaction_type?.includes('Withdrawal') || 
          record.transaction_type?.includes('Debit') ||
          record.transaction_type?.includes('DWAC Withdrawal')) {
        credit_debit = 'Debit'
      } else if (record.transaction_type?.includes('Credit') ||
                 record.transaction_type?.includes('Deposit') ||
                 record.transaction_type?.includes('IPO') ||
                 record.transaction_type?.includes('DWAC Deposit')) {
        credit_debit = 'Credit'
      }

      const security = securitiesMap[record.cusip] || null
      
      return {
        ...record,
        credit_debit, // Add the derived field
        security_type: security?.security_type || 'Unknown',
        issue_name: security?.issue_name || '',
        issue_ticker: security?.issue_ticker || ''
      }
    }) || []

    // Get all shareholders
    const { data: shareholders, error: shareholdersError } = await supabase
      .from("shareholders_new")
      .select("*, issuers_new(issuer_name)")
      .order("first_name")

    if (shareholdersError) {
      console.error("Error fetching all shareholders:", shareholdersError)
    }

    return {
      records: records || [],
      shareholders: shareholders || [],
      scope: 'global'
    }
  }

  // For issuer-specific data
  if (!issuerId) {
    return {
      records: [],
      shareholders: [],
      scope: 'no_issuer'
    }
  }

  // Get issuer-specific transfer journal records
  const { data: rawRecords, error: recordsError } = await supabase
    .from("transfers_new")
    .select("*, issuers_new(issuer_name)")
    .eq("issuer_id", issuerId)
    .order("transaction_date", { ascending: false })

  if (recordsError) {
    console.error("Error fetching issuer transfer journal records:", recordsError)
  }

  // Get securities for enrichment
  const { data: securities, error: securitiesError } = await supabase
    .from("securities_new")
    .select("*")
    .eq("issuer_id", issuerId)

  if (securitiesError) {
    console.error("Error fetching securities:", securitiesError)
  }

  // Create securities lookup map
  const securitiesMap = {}
  securities?.forEach(security => {
    securitiesMap[security.cusip] = security
  })

  // Enrich records with credit_debit derivation and security details
  const records = rawRecords?.map(record => {
    // Determine credit_debit based on transaction_type
    let credit_debit = 'Credit' // Default to Credit
    if (record.transaction_type?.includes('Withdrawal') || 
        record.transaction_type?.includes('Debit') ||
        record.transaction_type?.includes('DWAC Withdrawal')) {
      credit_debit = 'Debit'
    } else if (record.transaction_type?.includes('Credit') ||
               record.transaction_type?.includes('Deposit') ||
               record.transaction_type?.includes('IPO') ||
               record.transaction_type?.includes('DWAC Deposit')) {
      credit_debit = 'Credit'
    }

    const security = securitiesMap[record.cusip] || null
    
    return {
      ...record,
      credit_debit, // Add the derived field
      security_type: security?.security_type || security?.class_name || 'Unknown',
      issue_name: security?.issue_name || '',
      issue_ticker: security?.issue_ticker || ''
    }
  }) || []

  // Get issuer-specific shareholders
  const { data: shareholders, error: shareholdersError } = await supabase
    .from("shareholders_new")
    .select("*, issuers_new(issuer_name)")
    .eq("issuer_id", issuerId)
    .order("first_name")

  if (shareholdersError) {
    console.error("Error fetching issuer shareholders:", shareholdersError)
  }

  return {
    records: records || [],
    shareholders: shareholders || [],
    scope: 'issuer'
  }
}

export default function TransferJournalPage({ params: paramsPromise }) {
  const { user, userRole, userRoles, currentIssuer, availableIssuers, issuerSpecificRole, loading, initialized, validateAndSetIssuer } = useAuth()
  const router = useRouter()
  const [issuerId, setIssuerId] = useState(null)
  const [transferData, setTransferData] = useState({ records: [], shareholders: [], scope: 'issuer' })
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

      // Load transfer journal data
      const data = await getTransferJournalData(issuerId, userRole)
      setTransferData(data)
      setPageLoading(false)
    }

    validateAccess()
  }, [initialized, issuerId, user, validateAndSetIssuer, router, userRole])

  if (loading || !initialized || pageLoading) {
    return (
      <div className="flex h-screen bg-gradient-to-br from-yellow-50 via-orange-50 to-red-50">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading Transfer Journal...</p>
          </div>
        </div>
      </div>
    )
  }

  // Calculate stats
  const { records, shareholders, scope } = transferData
  const totalRecords = records.length
  const recentRecords = records.filter(r => {
    const recordDate = new Date(r.transaction_date || r.created_at)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    return recordDate >= sevenDaysAgo
  }).length

  const totalShares = records.reduce((sum, r) => sum + (r.share_quantity || 0), 0)
  const creditRecords = records.filter(r => r.credit_debit === "Credit").length
  const debitRecords = records.filter(r => r.credit_debit === "Debit").length
  const restrictedRecords = records.filter(r => r.restriction_id).length

  return (
    <div className="flex h-screen bg-gradient-to-br from-yellow-50 via-orange-50 to-red-50">
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
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <Card className="card-glass border-0">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Total Records</p>
                        <p className="text-3xl font-bold text-gray-900">{totalRecords}</p>
                      </div>
                      
                    </div>
                  </CardContent>
                </Card>

                <Card className="card-glass border-0">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Total Shares</p>
                        <p className="text-3xl font-bold text-gray-900">{totalShares.toLocaleString()}</p>
                      </div>
                      
                    </div>
                  </CardContent>
                </Card>

                <Card className="card-glass border-0">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Credits/Debits</p>
                        <p className="text-3xl font-bold text-gray-900">{creditRecords}/{debitRecords}</p>
                        <p className="text-sm text-orange-600 flex items-center mt-2">
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Transfer activities
                        </p>
                      </div>
                      
                    </div>
                  </CardContent>
                </Card>

                <Card className="card-glass border-0">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Restricted Records</p>
                        <p className="text-3xl font-bold text-gray-900">{restrictedRecords}</p>
                      </div>
                      
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Main Content Area */}
              <div className="space-y-6">
                <TransferJournalView 
                  records={records} 
                  shareholders={shareholders} 
                  userRole={userRole} 
                  issuerId={issuerId}
                  currentIssuer={currentIssuer}
                />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}


