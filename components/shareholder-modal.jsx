"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Users, MapPin, Phone, Mail, Calendar, DollarSign, Hash, UserCheck, Shield } from "lucide-react"

export default function ShareholderModal({ isOpen, onClose, shareholder = null, userRole, issuerId }) {
  const [hasTransferRecords, setHasTransferRecords] = useState(false)
  
  const toInputDate = (value) => {
    if (!value) return ""
    if (typeof value === "string") return value.slice(0, 10)
    try {
      return new Date(value).toISOString().slice(0, 10)
    } catch {
      return ""
    }
  }

  const [formData, setFormData] = useState({
    issuer_id: issuerId || "",
    first_name: shareholder?.first_name || "",
    last_name: shareholder?.last_name || "",
    lei: shareholder?.lei || "",
    holder_type: shareholder?.holder_type || "",
    address: shareholder?.address || "",
    city: shareholder?.city || "",
    state: shareholder?.state || "",
    zip: shareholder?.zip || "",
    country: shareholder?.country || "USA",
    taxpayer_id: shareholder?.taxpayer_id || "",
    tin_status: shareholder?.tin_status || "",
    email: shareholder?.email || "",
    phone: shareholder?.phone || "",
    ownership_percentage: shareholder?.ownership_percentage || "",
    ofac_date: toInputDate(shareholder?.ofac_date) || "",
    account_number: shareholder?.account_number || "",
    dob: toInputDate(shareholder?.dob) || "",
    ofac_results: shareholder?.ofac_results || "",
  })

  useEffect(() => {
    if (!isOpen) {
      return
    }
    
    setFormData({
      issuer_id: issuerId || "",
      first_name: shareholder?.first_name || "",
      last_name: shareholder?.last_name || "",
      lei: shareholder?.lei || "",
      holder_type: shareholder?.holder_type || "",
      address: shareholder?.address || "",
      city: shareholder?.city || "",
      state: shareholder?.state || "",
      zip: shareholder?.zip || "",
      country: shareholder?.country || "USA",
      taxpayer_id: shareholder?.taxpayer_id || "",
      tin_status: shareholder?.tin_status || "",
      email: shareholder?.email || "",
      phone: shareholder?.phone || "",
      ownership_percentage: shareholder?.ownership_percentage || "",
      ofac_date: toInputDate(shareholder?.ofac_date) || "",
      account_number: shareholder?.account_number || "",
      dob: toInputDate(shareholder?.dob) || "",
      ofac_results: shareholder?.ofac_results || "",
    })

    // Check if shareholder has transfer records
    if (shareholder?.id) {
      checkTransferRecords(shareholder.id).then(hasRecords => {
        setHasTransferRecords(hasRecords)
      })
    } else {
      setHasTransferRecords(false)
    }


  }, [shareholder, isOpen, issuerId])

  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})
  const router = useRouter()



  // Check if shareholder has transfer journal records
  const checkTransferRecords = async (shareholderId) => {
    if (!shareholderId) return false
    
    const supabase = createClient()
    try {
      const { data, error } = await supabase
        .from('transfers_new')
        .select('id')
        .eq('shareholder_id', shareholderId)
        .limit(1)
      
      if (error) throw error
      return data && data.length > 0
    } catch (error) {
      console.error('Error checking transfer records:', error)
      return false
    }
  }

  const validateForm = () => {
    const newErrors = {}

    if (!formData.first_name.trim()) newErrors.first_name = "First name is required"
    if (!formData.address.trim()) newErrors.address = "Address is required"
    if (!formData.account_number.trim()) newErrors.account_number = "Account number is required"
    if (!formData.taxpayer_id.trim()) newErrors.taxpayer_id = "Taxpayer ID is required"

    const ownershipPercentage = Number.parseFloat(formData.ownership_percentage)
    if (formData.ownership_percentage !== "" && (isNaN(ownershipPercentage) || ownershipPercentage < 0 || ownershipPercentage > 100)) {
      newErrors.ownership_percentage = "% Ownership must be between 0 and 100"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!validateForm()) return

    setLoading(true)
    const supabase = createClient()

    try {
      // Clean up the data - convert empty strings to null for dates
      // Only include fields that exist in the shareholders table
      const shareholderData = {
        issuer_id: formData.issuer_id,
        name: `${formData.first_name} ${formData.last_name || ''}`.trim(),
        first_name: formData.first_name,
        last_name: formData.last_name || null,
        address: formData.address,
        taxpayer_id: formData.taxpayer_id,
        account_number: formData.account_number,
        ownership_percentage: formData.ownership_percentage ? Number.parseFloat(formData.ownership_percentage) : null,
        ofac_date: formData.ofac_date || null,
        dob: formData.dob || null,
        // Optional fields
        lei: formData.lei || null,
        holder_type: formData.holder_type || null,
        tin_status: formData.tin_status || null,
        ofac_results: formData.ofac_results || null,
        email: formData.email || null,
        phone: formData.phone || null,
        city: formData.city || null,
        state: formData.state || null,
        zip: formData.zip || null,
        country: formData.country || 'USA'
      }

      if (shareholder) {
        // Update existing shareholder
        const { error } = await supabase.from("shareholders_new").update(shareholderData).eq("id", shareholder.id)

        if (error) throw error
      } else {
        // Create new shareholder
        const { error } = await supabase.from("shareholders_new").insert([shareholderData])

        if (error) throw error
      }

      router.refresh()
      onClose()
    } catch (error) {
      console.error("Error saving shareholder:", error)
      
      // Provide user-friendly error messages
      let userMessage = "Failed to save shareholder information. Please try again."
      
      if (error.code === "42703") {
        userMessage = "Database schema error. Please contact support."
      } else if (error.code === "23505") {
        userMessage = "A shareholder with this account number already exists."
      } else if (error.code === "23502") {
        userMessage = "Please fill in all required fields."
      } else if (error.message) {
        // For other errors, show a generic message
        userMessage = "Unable to save shareholder. Please check your information and try again."
      }
      
      setErrors({ submit: userMessage })
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }))
    }
  }

  const canEdit = userRole === "admin" || userRole === "transfer_team"
  const canCreate = userRole === "admin"
  const canUpdateAddress = userRole === "admin" || userRole === "transfer_team"
  const canUpdateTaxId = userRole === "admin" || userRole === "transfer_team"

  if (!canEdit) return null



  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto bg-white/95 backdrop-blur-xl border border-white/20 shadow-2xl">
        <DialogHeader className="space-y-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-red-500 to-orange-500 rounded-xl flex items-center justify-center">
              <Users className="h-5 w-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-gray-900">
                {shareholder ? "Edit Shareholder" : "Add New Shareholder"}
              </DialogTitle>
              <p className="text-sm text-gray-600">
                Enter shareholder information
              </p>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
            {errors.submit && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                {errors.submit}
              </div>
            )}

            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <Users className="h-5 w-5 mr-2 text-orange-500" />
                Basic Information
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name" className="text-sm font-medium text-gray-700">
                    First Name *
                  </Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => handleChange("first_name", e.target.value)}
                    className={`${errors.first_name ? "border-red-500" : "border-gray-300"} bg-white/50`}
                    placeholder="Enter first name"
                  />
                  {errors.first_name && (
                    <span className="text-red-500 text-sm flex items-center">
                      <span className="w-1 h-1 bg-red-500 rounded-full mr-2"></span>
                      {errors.first_name}
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="last_name" className="text-sm font-medium text-gray-700">
                    Last Name (Optional)
                  </Label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => handleChange("last_name", e.target.value)}
                    className="border-gray-300 bg-white/50"
                    placeholder="Enter last name"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="lei" className="text-sm font-medium text-gray-700">LEI</Label>
                  <Input
                    id="lei"
                    value={formData.lei}
                    onChange={(e) => handleChange("lei", e.target.value)}
                    className="border-gray-300 bg-white/50"
                    placeholder="Legal Entity Identifier"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="holder_type" className="text-sm font-medium text-gray-700">Holder Type</Label>
                  <Input
                    id="holder_type"
                    value={formData.holder_type}
                    onChange={(e) => handleChange("holder_type", e.target.value)}
                    className="border-gray-300 bg-white/50"
                    placeholder="Individual, Institution, etc."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="account_number" className="text-sm font-medium text-gray-700">
                  Account Number * {hasTransferRecords && <span className="text-orange-500 text-xs">(Locked - Transfer records exist)</span>}
                </Label>
                <Input
                  id="account_number"
                  value={formData.account_number}
                  onChange={(e) => handleChange("account_number", e.target.value)}
                  disabled={hasTransferRecords}
                  className={`${errors.account_number ? "border-red-500" : "border-gray-300"} ${hasTransferRecords ? "bg-gray-100 cursor-not-allowed" : "bg-white/50"}`}
                  placeholder="Enter account number"
                />
                {errors.account_number && (
                  <span className="text-red-500 text-sm flex items-center">
                    <span className="w-1 h-1 bg-red-500 rounded-full mr-2"></span>
                    {errors.account_number}
                  </span>
                )}
              </div>
            </div>

            {/* Address Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <MapPin className="h-5 w-5 mr-2 text-blue-500" />
                Address Information
              </h3>
              
              <div className="space-y-2">
                <Label htmlFor="address" className="text-sm font-medium text-gray-700">
                  Street Address *
                </Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => handleChange("address", e.target.value)}
                    className={`${errors.address ? "border-red-500" : "border-gray-300"} bg-white/50 pl-10`}
                    placeholder="Enter street address"
                  />
                </div>
                {errors.address && (
                  <span className="text-red-500 text-sm flex items-center">
                    <span className="w-1 h-1 bg-red-500 rounded-full mr-2"></span>
                    {errors.address}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city" className="text-sm font-medium text-gray-700">City</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => handleChange("city", e.target.value)}
                    className="border-gray-300 bg-white/50"
                    placeholder="City"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="state" className="text-sm font-medium text-gray-700">State</Label>
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(e) => handleChange("state", e.target.value)}
                    className="border-gray-300 bg-white/50"
                    placeholder="State"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="zip" className="text-sm font-medium text-gray-700">ZIP Code</Label>
                  <Input
                    id="zip"
                    value={formData.zip}
                    onChange={(e) => handleChange("zip", e.target.value)}
                    className="border-gray-300 bg-white/50"
                    placeholder="ZIP"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="country" className="text-sm font-medium text-gray-700">Country</Label>
                  <Input
                    id="country"
                    value={formData.country}
                    onChange={(e) => handleChange("country", e.target.value)}
                    className="border-gray-300 bg-white/50"
                    placeholder="Country"
                  />
                </div>
              </div>
            </div>

            {/* Tax and Compliance Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <Shield className="h-5 w-5 mr-2 text-green-500" />
                Tax and Compliance Information
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="taxpayer_id" className="text-sm font-medium text-gray-700">
                    Taxpayer ID *
                  </Label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="taxpayer_id"
                      value={formData.taxpayer_id}
                      onChange={(e) => handleChange("taxpayer_id", e.target.value)}
                      className={`${errors.taxpayer_id ? "border-red-500" : "border-gray-300"} bg-white/50 pl-10`}
                      placeholder="Enter taxpayer ID"
                    />
                  </div>
                  {errors.taxpayer_id && (
                    <span className="text-red-500 text-sm flex items-center">
                      <span className="w-1 h-1 bg-red-500 rounded-full mr-2"></span>
                      {errors.taxpayer_id}
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tin_status" className="text-sm font-medium text-gray-700">TIN Status</Label>
                  <Input
                    id="tin_status"
                    value={formData.tin_status}
                    onChange={(e) => handleChange("tin_status", e.target.value)}
                    className="border-gray-300 bg-white/50"
                    placeholder="Valid, Invalid, etc."
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ofac_date" className="text-sm font-medium text-gray-700">OFAC Date</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="ofac_date"
                      type="date"
                      value={formData.ofac_date}
                      onChange={(e) => handleChange("ofac_date", e.target.value)}
                      className="border-gray-300 bg-white/50 pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ofac_results" className="text-sm font-medium text-gray-700">OFAC Results</Label>
                  <Input
                    id="ofac_results"
                    value={formData.ofac_results}
                    onChange={(e) => handleChange("ofac_results", e.target.value)}
                    className="border-gray-300 bg-white/50"
                    placeholder="Clear, Match, etc."
                  />
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <Mail className="h-5 w-5 mr-2 text-orange-500" />
                Contact Information
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-gray-700">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleChange("email", e.target.value)}
                      className="border-gray-300 bg-white/50 pl-10"
                      placeholder="Enter email address"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-sm font-medium text-gray-700">Phone</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => handleChange("phone", e.target.value)}
                      className="border-gray-300 bg-white/50 pl-10"
                      placeholder="Enter phone number"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dob" className="text-sm font-medium text-gray-700">Date of Birth</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="dob"
                      type="date"
                      value={formData.dob}
                      onChange={(e) => handleChange("dob", e.target.value)}
                      className="border-gray-300 bg-white/50 pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ownership_percentage" className="text-sm font-medium text-gray-700">
                    Ownership Percentage (%)
                  </Label>
                  <Input
                    id="ownership_percentage"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.ownership_percentage}
                    onChange={(e) => handleChange("ownership_percentage", e.target.value)}
                    className={`${errors.ownership_percentage ? "border-red-500" : "border-gray-300"} bg-white/50`}
                    placeholder="0.00"
                  />
                  {errors.ownership_percentage && (
                    <span className="text-red-500 text-sm flex items-center">
                      <span className="w-1 h-1 bg-red-500 rounded-full mr-2"></span>
                      {errors.ownership_percentage}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter className="pt-6">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="border-gray-300 bg-white/50 hover:bg-white/70"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white"
              >
                {loading ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Saving...</span>
                  </div>
                ) : (
                  shareholder ? "Update Shareholder" : "Create Shareholder"
                )}
              </Button>
            </DialogFooter>
          </form>
      </DialogContent>
    </Dialog>
  )
}
