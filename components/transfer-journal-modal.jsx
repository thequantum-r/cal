"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { ArrowRightLeft, Calendar, Building, Hash, FileText, User, MapPin, CreditCard, AlertCircle, CheckCircle, Search, AlertTriangle, Shield } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

export default function TransferJournalModal({ isOpen, onClose, shareholders, userRole, issuerId }) {
  const [formData, setFormData] = useState({
    // Core transaction fields (as per new schema)
    issuer_id: issuerId,
    cusip: "",
    transaction_type: "",
    share_quantity: "",
    shareholder_id: "",
    restriction_id: "none",
    
    // Derived fields
    credit_debit: "",
    credit_date: "",
    debit_date: "",
    
    // Additional metadata
    status: "Active",
    notes: ""
  })

  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})
  const [selectedShareholder, setSelectedShareholder] = useState(null)
  const [cusipSearchTerm, setCusipSearchTerm] = useState("")
  const [errorDialogOpen, setErrorDialogOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [securities, setSecurities] = useState([])
  const [restrictionTemplates, setRestrictionTemplates] = useState([])
  const [restrictionCheckResult, setRestrictionCheckResult] = useState(null)
  const [selectedSecurity, setSelectedSecurity] = useState(null)
  const [sharesInfo, setSharesInfo] = useState(null)
  const router = useRouter()

  // Enhanced transaction types based on spreadsheet examples
  const transactionTypes = [
    "IPO CREDIT",
    "DWAC Withdrawal", 
    "DWAC Deposit",
    "Transfer Credit",
    "Transfer Debit",
    "Dividend",
    "Stock Split",
    "Redemption",
    "Cancellation"
  ]

  // Load securities and restriction templates on mount
  useEffect(() => {
    if (isOpen && issuerId) {
      loadSecurities()
      loadRestrictionTemplates()
    }
  }, [isOpen, issuerId])

  const loadSecurities = async () => {
    const supabase = createClient()
    try {
      // Get CUSIPs from securities table
      const { data: securitiesData, error: securitiesError } = await supabase
        .from("securities_new")
        .select("*")
        .eq("issuer_id", issuerId)
        .eq("status", "active")
        .order("created_at")

      if (securitiesError) throw securitiesError
      setSecurities(securitiesData || [])
    } catch (error) {
      console.error("Error fetching securities:", error)
      setSecurities([])
    }
  }

  const loadRestrictionTemplates = async () => {
    const supabase = createClient()
    try {
      const { data, error } = await supabase
        .from("restrictions_templates_new")
        .select("*")
        .eq("issuer_id", issuerId)
        .eq("is_active", true)
        .order("code")

      if (error) throw error
      setRestrictionTemplates(data || [])
    } catch (error) {
      console.error("Error fetching restriction templates:", error)
    }
  }

  // Load shares information for a CUSIP
  const loadSharesInfo = async (cusip) => {
    if (!cusip) return
    
    const supabase = createClient()
    try {
      // Get the security details including total_authorized_shares
      // Handle potential duplicate CUSIPs by getting the first one
      const { data: securityData, error: securityError } = await supabase
        .from("securities_new")
        .select("total_authorized_shares, issue_name")
        .eq("cusip", cusip)
        .limit(1)
        .maybeSingle()

      if (securityError) throw securityError
      
      // If no security found, return early
      if (!securityData) {
        setSharesInfo(null)
        return
      }
      
      // Calculate current outstanding shares for this CUSIP
      const { data: currentShares, error: sharesError } = await supabase
        .from("transfers_new")
        .select("share_quantity, credit_debit")
        .eq("cusip", cusip)

      if (sharesError) throw sharesError

      // Calculate net outstanding shares
      let currentOutstanding = 0
      currentShares.forEach(record => {
        if (record.credit_debit === "Credit") {
          currentOutstanding += record.share_quantity
        } else if (record.credit_debit === "Debit") {
          currentOutstanding -= record.share_quantity
        }
      })

      setSharesInfo({
        currentOutstanding,
        totalAuthorized: securityData.total_authorized_shares,
        issueName: securityData.issue_name,
        hasLimit: !!securityData.total_authorized_shares
      })
    } catch (error) {
      console.error("Error loading shares info:", error)
      setSharesInfo(null)
    }
  }

  // Check Total Authorized Shares limit
  const checkTotalAuthorizedShares = async (cusip, shareQuantity) => {
    if (!cusip || !shareQuantity) return { valid: true }
    
    const supabase = createClient()
    try {
      // Get the security details including total_authorized_shares
      // Handle potential duplicate CUSIPs by getting the first one
      const { data: securityData, error: securityError } = await supabase
        .from("securities_new")
        .select("total_authorized_shares")
        .eq("cusip", cusip)
        .limit(1)
        .maybeSingle()

      if (securityError) throw securityError
      
      // If no security found or no total_authorized_shares limit is set, allow the transaction
      if (!securityData || !securityData.total_authorized_shares) {
        return { valid: true }
      }

      // Calculate current outstanding shares for this CUSIP
      const { data: currentShares, error: sharesError } = await supabase
        .from("transfers_new")
        .select("share_quantity, credit_debit")
        .eq("cusip", cusip)

      if (sharesError) throw sharesError

      // Calculate net outstanding shares
      let currentOutstanding = 0
      currentShares.forEach(record => {
        if (record.credit_debit === "Credit") {
          currentOutstanding += record.share_quantity
        } else if (record.credit_debit === "Debit") {
          currentOutstanding -= record.share_quantity
        }
      })

      // Calculate what the outstanding shares would be after this transaction
      const newOutstanding = currentOutstanding + (formData.credit_debit === "Credit" ? shareQuantity : -shareQuantity)
      
      // Check if this would exceed the limit
      if (newOutstanding > securityData.total_authorized_shares) {
        return {
          valid: false,
          currentOutstanding,
          totalAuthorized: securityData.total_authorized_shares,
          wouldExceed: newOutstanding,
          message: `This transaction would exceed the Total Authorized Shares limit. Current outstanding: ${currentOutstanding.toLocaleString()}, Total authorized: ${securityData.total_authorized_shares.toLocaleString()}, Would result in: ${newOutstanding.toLocaleString()} shares.`
        }
      }

      return { valid: true, currentOutstanding, totalAuthorized: securityData.total_authorized_shares }
    } catch (error) {
      console.error("Error checking total authorized shares:", error)
      return { valid: true } // Allow transaction if we can't check
    }
  }

  // Enhanced auto-fill functions
  const handleShareholderChange = (shareholderId) => {
    const shareholder = shareholders.find(s => s.id === shareholderId)
    if (shareholder) {
      setSelectedShareholder(shareholder)
      setFormData(prev => ({
        ...prev,
        shareholder_id: shareholderId,
        // Auto-fill CUSIP if shareholder has one
        cusip: shareholder.cusip || prev.cusip
      }))
      
      // Check for restrictions on this shareholder
      if (shareholder.cusip) {
        checkShareholderRestrictions(shareholderId, shareholder.cusip)
      }
      
      // Clear shareholder-related errors
      setErrors(prev => ({
        ...prev,
        shareholder_id: undefined
      }))
    }
  }

  const handleCusipChange = async (cusip) => {
    setFormData(prev => ({
      ...prev,
      cusip: cusip
    }))

    // Check for restrictions if shareholder is selected
    if (formData.shareholder_id) {
      checkShareholderRestrictions(formData.shareholder_id, cusip)
    }

    // Load shares information for this CUSIP
    if (cusip) {
      await loadSharesInfo(cusip)
    } else {
      setSharesInfo(null)
    }

    // Clear CUSIP-related errors
    setErrors(prev => ({
      ...prev,
      cusip: undefined
    }))
  }

  const checkShareholderRestrictions = async (shareholderId, cusip) => {
    if (!shareholderId || !cusip || !issuerId) return

    const supabase = createClient()
    try {
      const { data, error } = await supabase.rpc('check_shareholder_restrictions', {
        p_shareholder_id: shareholderId,
        p_cusip: cusip,
        p_issuer_id: issuerId
      })

      if (error) throw error
      setRestrictionCheckResult(data?.[0] || null)
    } catch (error) {
      console.error("Error checking restrictions:", error)
    }
  }

  const handleTransactionTypeChange = (transactionType) => {
    let creditDebit = "Credit"
    let creditDate = ""
    let debitDate = ""
    const currentDate = format(new Date(), "yyyy-MM-dd")

    // Enhanced logic based on transaction type
    if (transactionType.includes("CREDIT") || transactionType === "DWAC Deposit" || transactionType === "Transfer Credit" || transactionType === "Dividend" || transactionType === "Stock Split") {
      creditDebit = "Credit"
      creditDate = currentDate
    } else if (transactionType.includes("DEBIT") || transactionType === "DWAC Withdrawal" || transactionType === "Transfer Debit" || transactionType === "Redemption" || transactionType === "Cancellation") {
      creditDebit = "Debit"
      debitDate = currentDate
    }

    setFormData(prev => ({
      ...prev,
      transaction_type: transactionType,
      credit_debit: creditDebit,
      credit_date: creditDate,
      debit_date: debitDate
    }))

    // Clear transaction-related errors
    setErrors(prev => ({
      ...prev,
      transaction_type: undefined,
      credit_date: undefined,
      debit_date: undefined
    }))
  }

  const validateForm = async () => {
    const newErrors = {}

    // Required fields validation
    if (!formData.cusip) {
      newErrors.cusip = "CUSIP is required"
    }
    if (!formData.transaction_type) {
      newErrors.transaction_type = "Transaction type is required"
    }
    if (!formData.share_quantity || formData.share_quantity <= 0) {
      newErrors.share_quantity = "Share quantity must be greater than 0"
    }
    if (!formData.shareholder_id) {
      newErrors.shareholder_id = "Shareholder is required"
    }

    // Date validation based on transaction type
    if (formData.credit_debit === "Credit" && !formData.credit_date) {
      newErrors.credit_date = "Credit date is required for credit transactions"
    } else if (formData.credit_debit === "Debit" && !formData.debit_date) {
      newErrors.debit_date = "Debit date is required for debit transactions"
    }

    // Check for restrictions
    if (restrictionCheckResult?.has_restrictions) {
      newErrors.restriction_warning = `Shareholder has restrictions: ${restrictionCheckResult.restriction_codes.join(', ')}`
    }

    // Check Total Authorized Shares limit
    if (formData.cusip && formData.share_quantity) {
      const authCheck = await checkTotalAuthorizedShares(formData.cusip, Number.parseInt(formData.share_quantity))
      if (!authCheck.valid) {
        newErrors.total_authorized_shares = authCheck.message
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const isValid = await validateForm()
    if (!isValid) return

    // If there are restrictions, show confirmation dialog
    if (restrictionCheckResult?.has_restrictions) {
      setErrorMessage(`This shareholder has restrictions: ${restrictionCheckResult.restriction_codes.join(', ')}. Are you sure you want to proceed?`)
      setErrorDialogOpen(true)
      return
    }

    await submitTransaction()
  }

  const submitTransaction = async () => {
    setLoading(true)
    const supabase = createClient()

    try {
      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const recordData = {
        ...formData,
        share_quantity: Number.parseInt(formData.share_quantity),
        created_by: user?.id,
        // Convert empty strings and "none" to null for optional fields
        restriction_id: formData.restriction_id && formData.restriction_id !== "none" ? formData.restriction_id : null,
        credit_date: formData.credit_date || null,
        debit_date: formData.debit_date || null,
        notes: formData.notes || null
      }

      const { error } = await supabase.from("transfers_new").insert([recordData])

      if (error) throw error

      router.refresh()
      onClose()
    } catch (error) {
      console.error("Error creating transfer journal record:", error)
      let errorMsg = "Error creating record"
      if (error.message.includes("date")) {
        errorMsg = "Invalid date format. Please use YYYY-MM-DD format."
      } else if (error.message.includes("required")) {
        errorMsg = "Please fill in all required fields."
      } else {
        errorMsg = error.message
      }
      setErrorMessage(errorMsg)
      setErrorDialogOpen(true)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setFormData({
      issuer_id: issuerId,
      cusip: "",
      transaction_type: "",
      share_quantity: "",
      shareholder_id: "",
      restriction_id: "none",
      credit_debit: "",
      credit_date: "",
      debit_date: "",
      status: "Active",
      notes: ""
    })
    setErrors({})
    setSelectedShareholder(null)
    setCusipSearchTerm("")
    setRestrictionCheckResult(null)
    setSharesInfo(null)
    onClose()
  }

  const handleConfirmWithRestrictions = async () => {
    setErrorDialogOpen(false)
    await submitTransaction()
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5" />
              New Transfer Journal Record
                </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Core Transaction Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* CUSIP Selection */}
              <div className="space-y-2">
                <Label htmlFor="cusip" className="text-sm font-medium text-gray-700">
                  CUSIP *
                </Label>
                <Select value={formData.cusip} onValueChange={handleCusipChange}>
                  <SelectTrigger className={cn("w-full", errors.cusip && "border-red-500")}>
                    <SelectValue placeholder="Select CUSIP" />
                  </SelectTrigger>
                  <SelectContent>
                    {securities.length > 0 ? (
                      securities.map((security) => (
                        <SelectItem key={security.cusip} value={security.cusip}>
                          <div className="flex items-center gap-2">
                            <Hash className="h-4 w-4" />
                            <span>{security.cusip}</span>
                            <span className="text-gray-500">- {security.security_type}</span>
                          </div>
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-securities" disabled>
                        No securities available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {errors.cusip && (
                  <p className="text-sm text-red-500">{errors.cusip}</p>
                )}
                
                {/* Shares Information Display */}
                {sharesInfo && (
                  <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <div className="flex items-center gap-2 mb-2">
                      <Building className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-800">Shares Information</span>
                    </div>
                    <div className="text-sm text-blue-700 space-y-1">
                      <div><span className="font-medium">Issue:</span> {sharesInfo.issueName}</div>
                      <div><span className="font-medium">Current Outstanding:</span> {sharesInfo.currentOutstanding.toLocaleString()} shares</div>
                      {sharesInfo.hasLimit && (
                        <div><span className="font-medium">Total Authorized:</span> {sharesInfo.totalAuthorized.toLocaleString()} shares</div>
                      )}
                      {sharesInfo.hasLimit && (
                        <div><span className="font-medium">Available:</span> {(sharesInfo.totalAuthorized - sharesInfo.currentOutstanding).toLocaleString()} shares</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Transaction Type */}
                <div className="space-y-2">
                <Label htmlFor="transaction_type" className="text-sm font-medium text-gray-700">
                  Transaction Type *
                  </Label>
                <Select value={formData.transaction_type} onValueChange={handleTransactionTypeChange}>
                  <SelectTrigger className={cn("w-full", errors.transaction_type && "border-red-500")}>
                    <SelectValue placeholder="Select transaction type" />
                    </SelectTrigger>
                  <SelectContent>
                    {transactionTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        <div className="flex items-center gap-2">
                          <ArrowRightLeft className="h-4 w-4" />
                          <span>{type}</span>
                        </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                {errors.transaction_type && (
                  <p className="text-sm text-red-500">{errors.transaction_type}</p>
                  )}
                </div>

              {/* Share Quantity */}
                <div className="space-y-2">
                <Label htmlFor="share_quantity" className="text-sm font-medium text-gray-700">
                  Share Quantity *
                  </Label>
                  <Input
                  id="share_quantity"
                  type="number"
                  value={formData.share_quantity}
                  onChange={(e) => setFormData(prev => ({ ...prev, share_quantity: e.target.value }))}
                  placeholder="Enter share quantity"
                  className={cn(errors.share_quantity && "border-red-500")}
                />
                {errors.share_quantity && (
                  <p className="text-sm text-red-500">{errors.share_quantity}</p>
                  )}
                </div>

              {/* Shareholder Selection */}
                <div className="space-y-2">
                <Label htmlFor="shareholder_id" className="text-sm font-medium text-gray-700">
                  Shareholder *
                  </Label>
                <Select value={formData.shareholder_id} onValueChange={handleShareholderChange}>
                  <SelectTrigger className={cn("w-full", errors.shareholder_id && "border-red-500")}>
                    <SelectValue placeholder="Select shareholder" />
                  </SelectTrigger>
                  <SelectContent>
                    {shareholders.length > 0 ? (
                      shareholders.map((shareholder) => (
                        <SelectItem key={shareholder.id} value={shareholder.id}>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            <span>{shareholder.first_name} {shareholder.last_name}</span>
                            <span className="text-gray-500">({shareholder.account_number})</span>
                          </div>
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-shareholders" disabled>
                        No shareholders available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {errors.shareholder_id && (
                  <p className="text-sm text-red-500">{errors.shareholder_id}</p>
                  )}
                </div>

              {/* Restriction Template */}
                <div className="space-y-2">
                <Label htmlFor="restriction_id" className="text-sm font-medium text-gray-700">
                  Restriction (Optional)
                  </Label>
                <Select value={formData.restriction_id} onValueChange={(value) => setFormData(prev => ({ ...prev, restriction_id: value }))}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select restriction (if applicable)" />
                    </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Restriction</SelectItem>
                    {restrictionTemplates.length > 0 && restrictionTemplates.map((restriction) => (
                      <SelectItem key={restriction.id} value={restriction.id}>
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-orange-500" />
                          <span className="font-medium">{restriction.code}</span>
                        </div>
                      </SelectItem>
                    ))}
                    </SelectContent>
                  </Select>
              </div>

              {/* Credit/Debit Display */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  Credit/Debit
                </Label>
                <div className={cn(
                  "p-3 rounded-md border",
                  formData.credit_debit === "Credit" ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
                )}>
                  <div className="flex items-center gap-2">
                    {formData.credit_debit === "Credit" ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                    )}
                    <span className={cn(
                      "font-medium",
                      formData.credit_debit === "Credit" ? "text-green-700" : "text-red-700"
                    )}>
                      {formData.credit_debit}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Date Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {formData.credit_debit === "Credit" && (
                <div className="space-y-2">
                  <Label htmlFor="credit_date" className="text-sm font-medium text-gray-700">
                    Credit Date *
                  </Label>
                  <Input
                    id="credit_date"
                    type="date"
                    value={formData.credit_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, credit_date: e.target.value }))}
                    className={cn(errors.credit_date && "border-red-500")}
                  />
                  {errors.credit_date && (
                    <p className="text-sm text-red-500">{errors.credit_date}</p>
                  )}
                </div>
              )}

              {formData.credit_debit === "Debit" && (
                <div className="space-y-2">
                  <Label htmlFor="debit_date" className="text-sm font-medium text-gray-700">
                    Debit Date *
                  </Label>
                  <Input
                    id="debit_date"
                    type="date"
                    value={formData.debit_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, debit_date: e.target.value }))}
                    className={cn(errors.debit_date && "border-red-500")}
                  />
                  {errors.debit_date && (
                    <p className="text-sm text-red-500">{errors.debit_date}</p>
                  )}
                </div>
                  )}
                </div>

            {/* Restriction Warning */}
            {restrictionCheckResult?.has_restrictions && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  <div>
                    <h4 className="font-medium text-yellow-800">Shareholder Restrictions Detected</h4>
                    <p className="text-sm text-yellow-700">
                      This shareholder has the following restrictions: {restrictionCheckResult.restriction_codes.join(', ')}
                    </p>
                    <p className="text-sm text-yellow-700 mt-1">
                      Legends: {restrictionCheckResult.restriction_legends.join(', ')}
                    </p>
                </div>
                </div>
              </div>
            )}

            {/* Total Authorized Shares Error */}
            {errors.total_authorized_shares && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <div>
                    <h4 className="font-medium text-red-800">Total Authorized Shares Limit Exceeded</h4>
                    <p className="text-sm text-red-700">
                      {errors.total_authorized_shares}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Notes */}
                <div className="space-y-2">
              <Label htmlFor="notes" className="text-sm font-medium text-gray-700">
                Notes (Optional)
                  </Label>
              <textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Add any additional notes..."
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading} className="bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white">
                {loading ? "Creating..." : "Create Record"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Restriction Confirmation Dialog */}
      <AlertDialog open={errorDialogOpen} onOpenChange={setErrorDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              Confirm Transaction with Restrictions
            </AlertDialogTitle>
            <AlertDialogDescription>
                  {errorMessage}
                </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setErrorDialogOpen(false)}>
              Cancel
            </AlertDialogAction>
            <AlertDialogAction onClick={handleConfirmWithRestrictions} className="bg-yellow-600 hover:bg-yellow-700">
              Proceed Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
