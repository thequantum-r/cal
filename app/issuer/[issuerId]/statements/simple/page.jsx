"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { createClient } from "@/lib/supabase/client"
import Sidebar from "@/components/sidebar"
import Header from "@/components/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { FileText, Download, Calendar, User, Building, DollarSign, AlertCircle, Settings } from "lucide-react"
import { toast } from "sonner"
import MarketValuesModal from "@/components/market-values-modal"

export default function SimpleStatementGenerationPage() {
  const { user, userRole, userRoles, currentIssuer, availableIssuers, issuerSpecificRole, loading, initialized, validateAndSetIssuer } = useAuth()
  const router = useRouter()
  const params = useParams()
  const issuerId = params.issuerId
  
  const [pageLoading, setPageLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [shareholders, setShareholders] = useState([])
  const [securities, setSecurities] = useState([])
  const [marketValues, setMarketValues] = useState([])
  const [selectedShareholder, setSelectedShareholder] = useState("")
  const [statementDate, setStatementDate] = useState(new Date().toISOString().split("T")[0])
  const [previewData, setPreviewData] = useState(null)
  const [marketValuesModalOpen, setMarketValuesModalOpen] = useState(false)

  useEffect(() => {
    if (!initialized || !issuerId) return
    checkAuthAndFetchData()
  }, [initialized, issuerId, user, validateAndSetIssuer])

  const checkAuthAndFetchData = async () => {
    try {
      if (!user) {
        router.push('/login')
        return
      }

      const { hasAccess } = await validateAndSetIssuer(issuerId)
      
      if (!hasAccess) {
        router.push('/?error=no_access')
        return
      }

      // Fetch data
      await fetchData()
    } catch (error) {
      console.error('Error in auth check:', error)
    }
  }

  const fetchData = async () => {
    try {
      setPageLoading(true)
      const supabase = createClient()

      // Fetch all data in parallel
      const [shareholdersRes, securitiesRes, marketValuesRes] = await Promise.all([
        supabase.from("shareholders_new").select("*").eq("issuer_id", issuerId),
        supabase.from("securities_new").select("*").eq("issuer_id", issuerId),
        supabase.from("statements_new").select("*").eq("issuer_id", issuerId)
      ])

      if (shareholdersRes.error) throw shareholdersRes.error
      if (securitiesRes.error) throw securitiesRes.error
      if (marketValuesRes.error) throw marketValuesRes.error

      setShareholders(shareholdersRes.data || [])
      setSecurities(securitiesRes.data || [])
      setMarketValues(marketValuesRes.data || [])
    } catch (error) {
      console.error("Error fetching data:", error)
      toast.error("Failed to load data")
    } finally {
      setPageLoading(false)
    }
  }

  const previewStatement = async () => {
    if (!selectedShareholder || !statementDate) {
      toast.error("Please select a shareholder and statement date")
      return
    }

    try {
      const supabase = createClient()
      
      // Get shareholder info
      const shareholder = shareholders.find(s => s.id === selectedShareholder)
      if (!shareholder) return

      // Get transactions as of the statement date from transfers_new
      const { data: transactions, error: transactionsError } = await supabase
        .from("transfers_new")
        .select("*")
        .eq("issuer_id", issuerId)
        .eq("shareholder_id", selectedShareholder)
        .lte("created_at", statementDate + "T23:59:59")

      if (transactionsError) throw transactionsError

      // Calculate positions for each CUSIP
      const positionsByCusip = {}
      transactions.forEach(tj => {
        if (!positionsByCusip[tj.cusip]) {
          positionsByCusip[tj.cusip] = 0
        }
        if (tj.credit_debit === 'Credit') {
          positionsByCusip[tj.cusip] += tj.share_quantity
        } else if (tj.credit_debit === 'Debit') {
          positionsByCusip[tj.cusip] -= tj.share_quantity
        }
      })

      // Get market values and restrictions for each position
      const previewData = await Promise.all(
        Object.entries(positionsByCusip)
          .filter(([cusip, shares]) => shares > 0)
          .map(async ([cusip, shares]) => {
            const security = securities.find(s => s.cusip === cusip)
            const marketValue = marketValues.find(mv => 
              mv.cusip === cusip && 
              mv.valuation_date <= statementDate
            )

            // Get restrictions text - simplified for now
            const restrictionsText = "No restrictions apply to these shares."

            return {
              cusip,
              shares_outstanding: shares,
              market_value_per_share: marketValue?.price_per_share || 0,
              market_value_total: (shares * (marketValue?.price_per_share || 0)),
              restrictions_text: restrictionsText,
              security_name: security?.issue_name || "",
              security_type: security?.security_type || ""
            }
          })
      )

      setPreviewData({
        shareholder,
        statement_date: statementDate,
        holdings: previewData
      })
    } catch (error) {
      console.error("Error previewing statement:", error)
      toast.error("Failed to preview statement")
    }
  }

  const downloadStatement = async () => {
    if (!previewData) {
      toast.error("Please preview the statement first")
      return
    }

    try {
      // Generate PDF on the client side or call API
      const response = await fetch('/api/statements/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          issuerId,
          shareholderId: selectedShareholder,
          statementDate,
          data: previewData
        })
      })

      if (!response.ok) throw new Error("Failed to generate statement")
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `statement-${selectedShareholder}-${statementDate}.txt`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      toast.success("Statement downloaded successfully!")
    } catch (error) {
      console.error("Error downloading statement:", error)
      toast.error("Failed to download statement")
    }
  }

  const getMarketValueForCusip = (cusip, date) => {
    const marketValue = marketValues.find(mv => 
      mv.cusip === cusip && 
      mv.valuation_date <= date
    )
    return marketValue?.price_per_share || 0
  }

  if (loading || !initialized || pageLoading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar 
          user={user}
          userRole={userRole}
          currentIssuer={currentIssuer}
          availableIssuers={availableIssuers}
          issuerSpecificRole={issuerSpecificRole}
        />
        
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header 
            user={user}
            userRole={userRole}
            userRoles={userRoles}
            currentIssuer={currentIssuer}
            availableIssuers={availableIssuers}
            issuerSpecificRole={issuerSpecificRole}
          />
          
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading Simple Statement...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar 
        user={user}
        userRole={userRole}
        currentIssuer={currentIssuer}
        availableIssuers={availableIssuers}
        issuerSpecificRole={issuerSpecificRole}
      />
      
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
          <div className="container mx-auto p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Statement Generation (Simple)</h1>
                <p className="text-gray-600 mt-2">Generate statements in real-time from transfer journal data</p>
              </div>
              <div className="flex items-center space-x-2">
                <FileText className="h-8 w-8 text-orange-500" />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Statement Generation Form */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Calendar className="h-5 w-5" />
                    <span>Generate Statement</span>
                  </CardTitle>
                  <CardDescription>
                    Select a shareholder and date to generate a statement
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="shareholder">Shareholder</Label>
                    <Select value={selectedShareholder} onValueChange={setSelectedShareholder}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a shareholder" />
                      </SelectTrigger>
                      <SelectContent>
                        {shareholders.map((shareholder) => (
                          <SelectItem key={shareholder.id} value={shareholder.id}>
                            {shareholder.last_name}, {shareholder.first_name} ({shareholder.account_number})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="statementDate">Statement Date</Label>
                    <Input
                      id="statementDate"
                      type="date"
                      value={statementDate}
                      onChange={(e) => setStatementDate(e.target.value)}
                      max={new Date().toISOString().split("T")[0]}
                    />
                  </div>

                  <div className="flex space-x-2">
                    <Button 
                      onClick={previewStatement}
                      variant="outline"
                      className="flex-1"
                    >
                      Preview Statement
                    </Button>
                    <Button 
                      onClick={downloadStatement}
                      disabled={!previewData}
                      className="flex-1"
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Download Statement
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Market Values Management */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <DollarSign className="h-5 w-5" />
                      <span>Market Values</span>
                    </div>
                    {issuerSpecificRole === "admin" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setMarketValuesModalOpen(true)}
                      >
                        <Settings className="h-4 w-4 mr-1" />
                        Manage
                      </Button>
                    )}
                  </CardTitle>
                  <CardDescription>
                    Current market values for securities (used in statement calculations)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {securities.map((security) => {
                      const latestMarketValue = marketValues
                        .filter(mv => mv.cusip === security.cusip)
                        .sort((a, b) => new Date(b.valuation_date) - new Date(a.valuation_date))[0]

                      return (
                        <div key={security.cusip} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <p className="font-medium">{security.issue_name}</p>
                            <p className="text-sm text-gray-600">CUSIP: {security.cusip}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">
                              ${latestMarketValue?.price_per_share?.toFixed(2) || "0.00"}
                            </p>
                            <p className="text-xs text-gray-600">
                              {latestMarketValue?.valuation_date || "No price set"}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Statement Preview */}
            {previewData && (
              <Card>
                <CardHeader>
                  <CardTitle>Statement Preview</CardTitle>
                  <CardDescription>
                    Preview for {previewData.shareholder.last_name}, {previewData.shareholder.first_name} 
                    as of {new Date(previewData.statement_date).toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Shareholder Info */}
                    <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Shareholder</p>
                        <p className="font-medium">
                          {previewData.shareholder.last_name}, {previewData.shareholder.first_name}
                        </p>
                        <p className="text-sm text-gray-600">Account: {previewData.shareholder.account_number}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600">Statement Date</p>
                        <p className="font-medium">{new Date(previewData.statement_date).toLocaleDateString()}</p>
                      </div>
                    </div>

                    {/* Holdings Table */}
                    <div>
                      <h4 className="font-medium mb-2">Security Holdings</h4>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="whitespace-nowrap">Security Type</TableHead>
                            <TableHead className="text-right whitespace-nowrap">Shares Outstanding</TableHead>
                            <TableHead className="text-right whitespace-nowrap">Market Value</TableHead>
                            <TableHead className="whitespace-nowrap">Restrictions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {previewData.holdings.map((holding) => (
                            <TableRow key={holding.cusip}>
                               <TableCell className="whitespace-nowrap">
                                <div>
                                  <p className="font-medium">{holding.security_name}</p>
                                  <p className="text-sm text-gray-600">{holding.security_type}</p>
                                  <p className="text-xs text-gray-500">CUSIP: {holding.cusip}</p>
                                </div>
                              </TableCell>
                               <TableCell className="text-right font-medium whitespace-nowrap">
                                {holding.shares_outstanding.toLocaleString()}
                              </TableCell>
                               <TableCell className="text-right whitespace-nowrap">
                                <div>
                                  <p className="font-medium">${holding.market_value_total.toFixed(2)}</p>
                                  <p className="text-sm text-gray-600">
                                    @ ${holding.market_value_per_share.toFixed(2)}/share
                                  </p>
                                </div>
                              </TableCell>
                               <TableCell className="whitespace-nowrap">
                                <Badge variant="outline" className="text-xs">
                                  {holding.restrictions_text.includes("No restrictions") ? "None" : "Restricted"}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Market Values Modal */}
            <MarketValuesModal
              isOpen={marketValuesModalOpen}
              onClose={() => setMarketValuesModalOpen(false)}
              issuerId={issuerId}
              securities={securities}
              onUpdate={fetchData}
            />
          </div>
        </main>
      </div>
    </div>
  )
}



