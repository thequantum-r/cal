"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { ArrowRightLeft, Calendar, Users } from "lucide-react"

export default function TransferModal({ isOpen, onClose, shareholders, userRole }) {
  const [formData, setFormData] = useState({
    from_shareholder_id: "",
    to_shareholder_id: "",
    shares_transferred: "",
    transfer_date: new Date().toISOString().split("T")[0],
  })
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})
  const router = useRouter()

  const validateForm = () => {
    const newErrors = {}

    if (!formData.from_shareholder_id) newErrors.from_shareholder_id = "From shareholder is required"
    if (!formData.to_shareholder_id) newErrors.to_shareholder_id = "To shareholder is required"
    if (!formData.transfer_date) newErrors.transfer_date = "Transfer date is required"

    if (formData.from_shareholder_id === formData.to_shareholder_id) {
      newErrors.to_shareholder_id = "Cannot transfer to the same shareholder"
    }

    const sharesTransferred = Number.parseInt(formData.shares_transferred)
    if (!formData.shares_transferred || isNaN(sharesTransferred) || sharesTransferred <= 0) {
      newErrors.shares_transferred = "Shares transferred must be a positive integer"
    } else {
      // Check if from shareholder has enough shares
      const fromShareholder = shareholders.find((s) => s.id === formData.from_shareholder_id)
      if (fromShareholder && sharesTransferred > fromShareholder.shares_owned) {
        newErrors.shares_transferred = `Cannot transfer more than ${fromShareholder.shares_owned} shares owned`
      }
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
      const sharesTransferred = Number.parseInt(formData.shares_transferred)

      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser()

      // Start transaction-like operations
      // 1. Insert the transfer record
      const { data: transferData, error: transferError } = await supabase
        .from("transfers_new")
        .insert([
          {
            ...formData,
            shares_transferred: sharesTransferred,
            created_by: user?.id,
          },
        ])
        .select()

      if (transferError) throw transferError

      // 2. Update from shareholder (decrement shares)
      const fromShareholder = shareholders.find((s) => s.id === formData.from_shareholder_id)
      const { error: fromError } = await supabase
        .from("shareholders_new")
        .update({ shares_owned: fromShareholder.shares_owned - sharesTransferred })
        .eq("id", formData.from_shareholder_id)

      if (fromError) {
        // Rollback: delete the transfer record
        await supabase.from("transfers_new").delete().eq("id", transferData[0].id)
        throw fromError
      }

      // 3. Update to shareholder (increment shares)
      const toShareholder = shareholders.find((s) => s.id === formData.to_shareholder_id)
      const { error: toError } = await supabase
        .from("shareholders_new")
        .update({ shares_owned: toShareholder.shares_owned + sharesTransferred })
        .eq("id", formData.to_shareholder_id)

      if (toError) {
        // Rollback: delete transfer and restore from shareholder
        await supabase.from("transfers_new").delete().eq("id", transferData[0].id)
        await supabase
          .from("shareholders_new")
          .update({ shares_owned: fromShareholder.shares_owned })
          .eq("id", formData.from_shareholder_id)
        throw toError
      }

      // Reset form
      setFormData({
        from_shareholder_id: "",
        to_shareholder_id: "",
        shares_transferred: "",
        transfer_date: new Date().toISOString().split("T")[0],
      })

      router.refresh()
      onClose()
    } catch (error) {
      console.error("Error creating transfer:", error)
      setErrors({ submit: error.message })
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

  const canEdit = userRole === "superadmin" || userRole === "transfer_team"
  const fromShareholder = shareholders.find((s) => s.id === formData.from_shareholder_id)

  if (!canEdit) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] bg-white/95 backdrop-blur-xl border border-white/20 shadow-2xl">
        <DialogHeader className="space-y-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
              <ArrowRightLeft className="h-5 w-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-gray-900">Create New Transfer</DialogTitle>
              <p className="text-sm text-gray-600">Transfer shares between shareholders</p>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {errors.submit && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
              {errors.submit}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <Label htmlFor="from_shareholder" className="text-sm font-medium text-gray-700">
                From Shareholder *
              </Label>
              <Select
                value={formData.from_shareholder_id}
                onValueChange={(value) => handleChange("from_shareholder_id", value)}
              >
                <SelectTrigger className={`${errors.from_shareholder_id ? "border-red-500" : "border-gray-300"} bg-white/50 backdrop-blur-sm`}>
                  <SelectValue placeholder="Select from shareholder" />
                </SelectTrigger>
                <SelectContent className="bg-white/95 backdrop-blur-xl border border-white/20">
                  {shareholders.map((shareholder) => (
                    <SelectItem key={shareholder.id} value={shareholder.id}>
                      <div className="flex items-center space-x-2">
                        <Users className="h-4 w-4 text-gray-500" />
                        <span>{shareholder.name}</span>
                        <span className="text-gray-500">({shareholder.shares_owned.toLocaleString()} shares)</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.from_shareholder_id && (
                <span className="text-red-500 text-sm flex items-center">
                  <span className="w-1 h-1 bg-red-500 rounded-full mr-2"></span>
                  {errors.from_shareholder_id}
                </span>
              )}
            </div>

            <div className="space-y-3">
              <Label htmlFor="to_shareholder" className="text-sm font-medium text-gray-700">
                To Shareholder *
              </Label>
              <Select
                value={formData.to_shareholder_id}
                onValueChange={(value) => handleChange("to_shareholder_id", value)}
              >
                <SelectTrigger className={`${errors.to_shareholder_id ? "border-red-500" : "border-gray-300"} bg-white/50 backdrop-blur-sm`}>
                  <SelectValue placeholder="Select to shareholder" />
                </SelectTrigger>
                <SelectContent className="bg-white/95 backdrop-blur-xl border border-white/20">
                  {shareholders
                    .filter((s) => s.id !== formData.from_shareholder_id)
                    .map((shareholder) => (
                      <SelectItem key={shareholder.id} value={shareholder.id}>
                        <div className="flex items-center space-x-2">
                          <Users className="h-4 w-4 text-gray-500" />
                          <span>{shareholder.name}</span>
                          <span className="text-gray-500">({shareholder.shares_owned.toLocaleString()} shares)</span>
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {errors.to_shareholder_id && (
                <span className="text-red-500 text-sm flex items-center">
                  <span className="w-1 h-1 bg-red-500 rounded-full mr-2"></span>
                  {errors.to_shareholder_id}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <Label htmlFor="shares_transferred" className="text-sm font-medium text-gray-700">
                Shares to Transfer *
                {fromShareholder && (
                  <span className="text-sm text-gray-500 ml-2">
                    (Max: {fromShareholder.shares_owned.toLocaleString()})
                  </span>
                )}
              </Label>
              <Input
                id="shares_transferred"
                type="number"
                min="1"
                max={fromShareholder?.shares_owned || undefined}
                value={formData.shares_transferred}
                onChange={(e) => handleChange("shares_transferred", e.target.value)}
                className={`${errors.shares_transferred ? "border-red-500" : "border-gray-300"} bg-white/50 backdrop-blur-sm`}
                placeholder="Enter number of shares"
              />
              {errors.shares_transferred && (
                <span className="text-red-500 text-sm flex items-center">
                  <span className="w-1 h-1 bg-red-500 rounded-full mr-2"></span>
                  {errors.shares_transferred}
                </span>
              )}
            </div>

            <div className="space-y-3">
              <Label htmlFor="transfer_date" className="text-sm font-medium text-gray-700">
                Transfer Date *
              </Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="transfer_date"
                  type="date"
                  value={formData.transfer_date}
                  onChange={(e) => handleChange("transfer_date", e.target.value)}
                  className={`${errors.transfer_date ? "border-red-500" : "border-gray-300"} bg-white/50 backdrop-blur-sm pl-10`}
                />
              </div>
              {errors.transfer_date && (
                <span className="text-red-500 text-sm flex items-center">
                  <span className="w-1 h-1 bg-red-500 rounded-full mr-2"></span>
                  {errors.transfer_date}
                </span>
              )}
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
                  <span>Processing...</span>
                </div>
              ) : (
                "Create Transfer"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
