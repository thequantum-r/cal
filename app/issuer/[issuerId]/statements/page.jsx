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
import { FileText, Download, Calendar, DollarSign, Settings } from "lucide-react"
import { toast } from "sonner"
import MarketValuesModal from "@/components/market-values-modal"
import ReactSelect, { components } from "react-select"

export default function StatementGenerationPage() {
  const { user, userRole, userRoles, currentIssuer, availableIssuers, issuerSpecificRole, loading, initialized, validateAndSetIssuer } = useAuth()
  const router = useRouter()
  const params = useParams()
  const issuerId = params.issuerId
  
  const [pageLoading, setPageLoading] = useState(true)
  const [shareholders, setShareholders] = useState([])
  const [securities, setSecurities] = useState([])
  const [marketValues, setMarketValues] = useState([])
  const [selectedShareholders, setSelectedShareholders] = useState([]) // multi-selection
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

      // Fetch all data in parallel - using correct tables and no filters
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
    if (!selectedShareholders || selectedShareholders.length === 0 || !statementDate) {
      toast.error("Please select at least one shareholder and a statement date")
      return
    }
  
    try {
      const supabase = createClient()
      const previews = []
  
      for (const shareholderId of selectedShareholders) {
        const shareholder = shareholders.find(s => s.id === shareholderId)
        if (!shareholder) continue
  
        console.log(`[STATEMENT] Fetching transfers for shareholder ${shareholderId} as of ${statementDate}`)
  
        // Get all transfer journal entries for this shareholder
        const { data: transfers, error: transfersError } = await supabase
          .from("transfers_new")
          .select("cusip, transaction_type, share_quantity, restriction_id, transaction_date, created_at")
          .eq("issuer_id", issuerId)
          .eq("shareholder_id", shareholderId)
          .lte("transaction_date", statementDate + "T23:59:59")
          .order("transaction_date", { ascending: true })
  
        if (transfersError) throw transfersError
  
        // Calculate holdings
        const holdingsByCusip = {}
        transfers?.forEach((transfer) => {
          if (!holdingsByCusip[transfer.cusip]) {
            holdingsByCusip[transfer.cusip] = { shares: 0, restrictions: [], transactions: [] }
          }
  
          const isCredit = !(transfer.transaction_type === 'DWAC Withdrawal' ||
                            transfer.transaction_type === 'Transfer Debit')
          const shareChange = isCredit ? transfer.share_quantity : -transfer.share_quantity
          holdingsByCusip[transfer.cusip].shares += shareChange
  
          holdingsByCusip[transfer.cusip].transactions.push({
            date: transfer.transaction_date,
            type: transfer.transaction_type,
            shares: shareChange,
            running_total: holdingsByCusip[transfer.cusip].shares
          })
  
          if (transfer.restriction_id) {
            holdingsByCusip[transfer.cusip].restrictions.push(transfer.restriction_id)
          }
        })
  
        // Get restrictions
        const restrictionIds = [...new Set(transfers.filter(t => t.restriction_id).map(t => t.restriction_id))]
        let restrictions = []
        if (restrictionIds.length > 0) {
          const { data: restrictionsData, error: restrictionsError } = await supabase
            .from("restrictions_templates_new")
            .select("id, restriction_type, description")
            .in("id", restrictionIds)
            .eq("is_active", true)
  
          if (restrictionsError) throw restrictionsError
          restrictions = restrictionsData || []
        }
  
        // Build holdings array
        const holdings = Object.entries(holdingsByCusip)
          .filter(([cusip, data]) => data.shares > 0)
          .map(([cusip, data]) => {
            const security = securities.find(s => s.cusip === cusip)
            const marketValue = marketValues.find(mv =>
              mv.cusip === cusip &&
              mv.valuation_date <= statementDate
            )
  
            const restriction = restrictions.find(r => data.restrictions.includes(r.id))
            const restrictionsText = restriction
              ? restriction.description
              : "No restrictions apply to these shares."
  
            return {
              cusip,
              shares_outstanding: data.shares,
              market_value_per_share: marketValue?.price_per_share || 0,
              market_value_total: (data.shares * (marketValue?.price_per_share || 0)),
              restrictions_text: restrictionsText,
              security_name: security?.issue_name || "",
              security_type: security?.class_name || ""
            }
          })
  
        // Push shareholder’s preview
        previews.push({
          shareholder,
          statement_date: statementDate,
          holdings,
          all_transactions: transfers || []
        })
      }
  
      setPreviewData(previews)
    } catch (error) {
      console.error("Error previewing statement:", error)
      toast.error(`Failed to preview statements: ${error.message || 'Unknown error'}`)
    }
  }
  
  
  const downloadStatement = () => {
    if (!previewData) {
      toast.error("Please preview the statement first")
      return
    }
  
    try {
      // Get the preview content
      const printContents = document.getElementById("statement-preview").innerHTML
      
      // Open a new print window
      const newWindow = window.open("", "_blank")
      newWindow.document.write(`
        <html>
          <head>
            <title>Shareholder Statement</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                margin: 20px;
              }
              table {
                border-collapse: collapse;
                width: 100%;
              }
              table, th, td {
                border: 1px solid #ccc;
              }
              th, td {
                padding: 8px;
                text-align: left;
              }
              @media print {
                body { 
                  -webkit-print-color-adjust: exact; 
                  print-color-adjust: exact; 
                }
              }
            </style>
          </head>
          <body>${printContents}</body>
        </html>
      `)
      newWindow.document.close()
      newWindow.focus()
      newWindow.print()
      newWindow.close()
    } catch (error) {
      console.error("Error printing statement:", error)
      toast.error("Failed to print statement")
    }
  }

  if (loading || !initialized || pageLoading) {
    return (
      <div className="flex h-screen bg-gradient-to-br from-orange-50 to-red-50">
        <Sidebar 
          userRole={userRole}
          currentIssuerId={issuerId}
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
              <p className="text-gray-600">Loading Statement Generation...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Custom Option with checkbox
const CheckboxOption = (props) => {
  return (
    <components.Option {...props}>
      <input
        type="checkbox"
        checked={props.isSelected}
        onChange={() => null}
        className="mr-2"
      />
      <label>{props.label}</label>
    </components.Option>
  )
}

// Custom MenuList with "Select All"
const MenuList = (props) => {
  const {
    options,
    getValue,
    setValue,
    selectProps: { onSelectAll }
  } = props

  const isAllSelected = getValue().length === options.length

  return (
    <div>
      <div
        className="px-3 py-2 border-b bg-gray-50 cursor-pointer flex items-center"
        onClick={() => {
          if (isAllSelected) {
            setValue([], "deselect-option")
          } else {
            setValue(options, "select-option")
          }
          if (onSelectAll) onSelectAll(!isAllSelected)
        }}
      >
        <input type="checkbox" readOnly checked={isAllSelected} className="mr-2" />
        <span className="font-medium text-gray-700">
          {isAllSelected ? "Deselect All" : "Select All"}
        </span>
      </div>
      <components.MenuList {...props}>{props.children}</components.MenuList>
    </div>
  )
}

  return (
    <div className="flex h-screen bg-gradient-to-br from-orange-50 to-red-50">
      <Sidebar 
        userRole={userRole}
        currentIssuerId={issuerId}
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
                <h1 className="text-3xl font-bold text-gray-900">Statement Generation</h1>
                <p className="text-gray-600 mt-2">Generate formal statements for shareholders as of specific dates</p>
              </div>
              <div className="flex items-center space-x-2">
                <FileText className="h-8 w-8 text-orange-500" />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Statement Generation Form */}
              <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
                <CardHeader className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-t-lg">
                  <CardTitle className="flex items-center space-x-2">
                    <Calendar className="h-5 w-5" />
                    <span>Generate Statement</span>
                  </CardTitle>
                  <CardDescription className="text-orange-100">
                    Select a shareholder and date to generate a formal statement
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 p-6">
                  <div className="space-y-2">
                  <Label className="text-gray-700 font-medium">Shareholders</Label>
<ReactSelect
  isMulti
  closeMenuOnSelect={false}
  hideSelectedOptions={false}
  options={shareholders.map((s) => ({
    value: s.id,
    label: `${[s.first_name, s.last_name]
      .filter(Boolean)
      .join(" ")} (${s.account_number || ""})`
  }))}
  value={shareholders
    .filter((s) => selectedShareholders.includes(s.id))
    .map((s) => ({
      value: s.id,
      label: `${[s.first_name, s.last_name]
        .filter(Boolean)
        .join(" ")} (${s.account_number || ""})`
    }))
  }
  onChange={(selected) =>
    setSelectedShareholders(selected.map((opt) => opt.value))
  }
  components={{ Option: CheckboxOption, MenuList }}
  className="basic-multi-select"
  classNamePrefix="select"
/>                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="statementDate" className="text-gray-700 font-medium">Statement Date</Label>
                    <Input
                      id="statementDate"
                      type="date"
                      value={statementDate}
                      onChange={(e) => setStatementDate(e.target.value)}
                      max={new Date().toISOString().split("T")[0]}
                      className="border-gray-300 focus:border-orange-500 focus:ring-orange-500"
                    />
                  </div>

                  <div className="flex space-x-2">
                    <Button 
                      onClick={previewStatement}
                      variant="outline"
                      className="flex-1 border-orange-300 text-orange-700 hover:bg-orange-50 hover:border-orange-500"
                    >
                      Preview Statement
                    </Button>
                    <Button 
                      onClick={downloadStatement}
                      disabled={!previewData}
                      className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white"
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Download Statement
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Market Values Management */}
              <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
                <CardHeader className="bg-gradient-to-r from-orange-400 to-red-500 text-white rounded-t-lg">
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
                        className="border-white/30 text-white bg-white/20 hover:bg-white/20"
                      >
                        <Settings className="h-4 w-4 mr-1" />
                        Manage
                      </Button>
                    )}
                  </CardTitle>
                  <CardDescription className="text-orange-100">
                    Current market values for securities (used in statement calculations)
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-3">
                    {securities.length > 0 ? (
                      securities.map((security) => {
                        const latestMarketValue = marketValues
                          .filter(mv => mv.cusip === security.cusip)
                          .sort((a, b) => new Date(b.valuation_date) - new Date(a.valuation_date))[0]

                        return (
                          <div key={security.cusip} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg bg-white/50">
                            <div>
                              <p className="font-medium text-gray-900">{security.issue_name}</p>
                              <p className="text-sm text-gray-600">CUSIP: {security.cusip}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-medium text-orange-600">
                                ${latestMarketValue?.price_per_share?.toFixed(2) || "0.00"}
                              </p>
                              <p className="text-xs text-gray-600">
                                {latestMarketValue?.valuation_date || "No price set"}
                              </p>
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <div className="text-center py-4 text-gray-500">
                        No securities found for this issuer
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

        {/* Statement Preview */}
{/* Statement Preview */}
{previewData && previewData.length > 0 && (
  <div
    id="statement-preview"
    className="bg-white border border-gray-200 rounded-xl shadow-sm print:shadow-none print:border-0 print:rounded-none"
    style={{ width: "100%" }}
  >
    <div className="p-12 print:p-8" style={{ width: "100%" }}>
      {/* Issuer Header (only once, top of all statements) */}
      <div className="text-center mb-12 print:mb-8" style={{ width: "100%" }}>
        <h1 className="text-2xl font-bold text-gray-900 uppercase tracking-wide mb-2">
          {currentIssuer?.issuer_name?.replace(/_/g, " ") ||
            currentIssuer?.issuer_name ||
            ""}
        </h1>
        <h2 className="text-lg font-semibold text-gray-700 mb-2">
          Shareholder Statements
        </h2>
        <h3 className="text-base text-gray-600">
          As of {new Date(previewData[0].statement_date).toLocaleDateString()}
        </h3>
      </div>

      {/* Loop through shareholders */}
      {previewData.map((data, idx) => (
        <section
          key={idx}
          className="statement-preview mb-12 print:mb-8 border-t border-gray-200 pt-10"
          style={{ pageBreakAfter: "always", width: "100%" }}
        >
          {/* Shareholder Info - Prominent */}
<div
  className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-md"
  style={{
    pageBreakInside: "avoid", // prevents breaking in PDF
    marginBottom: "24px",
  }}
>
  <div
    className="print:block"
    style={{
      width: "100%",
      textAlign: "left",
    }}
  >
    {/* Shareholder Name */}
    <div
      className="font-bold text-gray-900"
      style={{
        fontSize: "20px", // force bigger for PDF
        marginBottom: "8px",
      }}
    >
      {[data.shareholder.first_name, data.shareholder.last_name]
        .filter(Boolean)
        .join(" ")}
    </div>

    {/* Details stacked vertically for PDF */}
    <div
      style={{
        fontSize: "14px",
        lineHeight: "1.6",
        color: "#374151", // Tailwind gray-700
      }}
    >
      <div>
        <span style={{ fontWeight: "600" }}>Account #:</span>{" "}
        {data.shareholder.account_number || "N/A"}
      </div>
      <div>
        <span style={{ fontWeight: "600" }}>TIN:</span>{" "}
        {data.shareholder.taxpayer_id || "N/A"}
      </div>
      <div>
        <span style={{ fontWeight: "600" }}>Email:</span>{" "}
        {data.shareholder.email || "N/A"}
      </div>
    </div>
  </div>
</div>

          {/* Current Holdings */}
          <div className="mb-8 print:mb-6" style={{ width: "100%" }}>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Current Holdings by Security
            </h3>
            <table className="w-full border-collapse border border-gray-300 rounded-lg overflow-hidden">
              <thead>
                <tr>
                  <th className="border-r border-gray-300 p-4 text-left font-semibold bg-gray-50 print:bg-white text-gray-700 uppercase tracking-wide text-sm">
                    CUSIP
                  </th>
                  <th className="border-r border-gray-300 p-4 text-left font-semibold bg-gray-50 print:bg-white text-gray-700 uppercase tracking-wide text-sm">
                    SECURITY TYPE
                  </th>
                  <th className="border-r border-gray-300 p-4 text-center font-semibold bg-gray-50 print:bg-white text-gray-700 uppercase tracking-wide text-sm">
                    CURRENT OUTSTANDING BALANCE
                  </th>
                  <th className="p-4 text-center font-semibold bg-gray-50 print:bg-white text-gray-700 uppercase tracking-wide text-sm">
                    RESTRICTIONS
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.holdings.length > 0 ? (
                  data.holdings.map((holding) => (
                    <tr key={holding.cusip} className="border-t border-gray-200">
                      <td className="border-r border-gray-200 p-4 font-mono text-sm font-medium text-gray-900">
                        {holding.cusip}
                      </td>
                      <td className="border-r border-gray-200 p-4">
                        <div className="font-medium text-gray-900 mb-1">
                          {holding.security_name}
                        </div>
                        <div className="text-sm text-gray-700">
                          {holding.security_type}
                        </div>
                      </td>
                      <td className="border-r border-gray-200 p-4 text-center font-bold text-gray-900 text-lg">
                        {holding.shares_outstanding
                          ? holding.shares_outstanding.toLocaleString()
                          : "0"}
                      </td>
                      <td className="p-4 text-center text-gray-800">
                        {holding.restrictions_text &&
                        !holding.restrictions_text.includes("No restrictions")
                          ? holding.restrictions_text
                          : "None"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr className="border-t border-gray-200">
                    <td
                      colSpan={4}
                      className="p-4 text-center text-gray-500 italic"
                    >
                      No holdings as of{" "}
                      {new Date(data.statement_date).toLocaleDateString()}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Transaction History */}
          <div className="mb-8 print:mb-6" style={{ width: "100%" }}>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Complete Transaction History
            </h3>
            {(() => {
              const transactionsByCusip = {}
              data.all_transactions?.forEach((transaction) => {
                const cusip = transaction.cusip
                if (!transactionsByCusip[cusip]) {
                  transactionsByCusip[cusip] = []
                }
                transactionsByCusip[cusip].push(transaction)
              })

              return Object.entries(transactionsByCusip).map(
                ([cusip, transactions]) => {
                  const security = securities.find((s) => s.cusip === cusip)
                  let runningBalance = 0

                  return (
                    <div key={cusip} className="mb-8">
                      <h4 className="text-base font-semibold text-gray-900 mb-2">
                        {security?.issue_name || "Unknown Security"} - CUSIP:{" "}
                        {cusip}
                      </h4>
                      <table className="w-full border-collapse border border-gray-300 rounded-lg overflow-hidden mb-4">
                        <thead>
                          <tr>
                            <th className="border-r border-gray-300 p-3 text-left font-semibold bg-gray-50 print:bg-white text-gray-700 uppercase tracking-wide text-xs">
                              Transaction Date
                            </th>
                            <th className="border-r border-gray-300 p-3 text-left font-semibold bg-gray-50 print:bg-white text-gray-700 uppercase tracking-wide text-xs">
                              Transaction Type
                            </th>
                            <th className="border-r border-gray-300 p-3 text-center font-semibold bg-gray-50 print:bg-white text-gray-700 uppercase tracking-wide text-xs">
                              Credit/Debit
                            </th>
                            <th className="border-r border-gray-300 p-3 text-center font-semibold bg-gray-50 print:bg-white text-gray-700 uppercase tracking-wide text-xs">
                              Shares
                            </th>
                            <th className="p-3 text-center font-semibold bg-gray-50 print:bg-white text-gray-700 uppercase tracking-wide text-xs">
                              Running Balance
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {transactions.map((transaction, index) => {
                            const isCredit = !(
                              transaction.transaction_type === "DWAC Withdrawal" ||
                              transaction.transaction_type === "Transfer Debit"
                            )
                            const shareChange = isCredit
                              ? transaction.share_quantity
                              : -transaction.share_quantity
                            runningBalance += shareChange

                            return (
                              <tr
                                key={index}
                                className="border-t border-gray-200"
                              >
                                <td className="border-r border-gray-200 p-3 text-gray-900">
                                  {new Date(
                                    transaction.transaction_date
                                  ).toLocaleDateString()}
                                </td>
                                <td className="border-r border-gray-200 p-3 text-gray-900">
                                  {transaction.transaction_type}
                                </td>
                                <td className="border-r border-gray-200 p-3 text-center">
                                  <span
                                    className={`px-2 py-1 rounded text-xs font-medium ${
                                      isCredit
                                        ? "bg-green-100 text-green-800"
                                        : "bg-red-100 text-red-800"
                                    }`}
                                  >
                                    {isCredit ? "Credit" : "Debit"}
                                  </span>
                                </td>
                                <td className="border-r border-gray-200 p-3 text-center font-medium text-gray-900">
                                  {isCredit ? "+" : "-"}
                                  {transaction.share_quantity.toLocaleString()}
                                </td>
                                <td className="p-3 text-center font-bold text-gray-900">
                                  {runningBalance.toLocaleString()}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )
                }
              )
            })()}
          </div>
        </section>
      ))}

      {/* Restrictions Section (once at the end) */}
      <div className="mb-10 print:mb-6" style={{ width: "100%" }}>
        <div className="font-semibold text-gray-900 mb-3 text-base">
          *Restrictions:
        </div>
        <table className="w-full border-collapse border border-gray-300 rounded-lg overflow-hidden">
          <tbody>
            <tr>
              <td className="border-r border-gray-200 p-4 h-20"></td>
              <td className="border-r border-gray-200 p-4 h-20"></td>
              <td className="border-r border-gray-200 p-4 h-20"></td>
              <td className="p-4 h-20"></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Footer (only once, perfectly centered for PDF) */}
      <div style={{ textAlign: "center", marginBottom: "24px", width: "100%" }}>
        <p className="text-sm text-gray-700" style={{ marginBottom: "12px" }}>
          If you have any questions, please do not hesitate to reach out to us
          at DAAQ@useefficiency.com
        </p>
        <img
          src="/efficiency_logo.svg"
          alt="Efficiency - Always Act with Urgency"
          style={{
            display: "block",
            marginLeft: "auto",
            marginRight: "auto",
            height: "80px",
          }}
        />
        <p
          className="text-sm text-gray-600"
          style={{
            marginTop: "8px",
            textAlign: "center",
            display: "block",
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          Always Act with Urgency
        </p>
      </div>
    </div>
  </div>
)}



          </div>
        </main>
      </div>
      
      {/* Market Values Modal */}
      <MarketValuesModal
        isOpen={marketValuesModalOpen}
        onClose={() => setMarketValuesModalOpen(false)}
        issuerId={issuerId}
        securities={securities}
        onUpdate={fetchData}
      />
    </div>
  )
}
