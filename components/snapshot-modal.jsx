"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Calendar, Users, BarChart3 } from "lucide-react"

export default function SnapshotModal({ isOpen, onClose, shareholders, userRole }) {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    shareholder_id: "",
    shares_owned: "",
  })
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})
  const router = useRouter()

  const validateForm = () => {
    const newErrors = {}

    if (!formData.date) newErrors.date = "Date is required"
    if (!formData.shareholder_id) newErrors.shareholder_id = "Shareholder is required"

    const sharesOwned = Number.parseInt(formData.shares_owned)
    if (!formData.shares_owned || isNaN(sharesOwned) || sharesOwned < 0) {
      newErrors.shares_owned = "Shares owned must be a non-negative integer"
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
      const { error } = await supabase.from("statements_new").insert([
        {
          ...formData,
          shares_owned: Number.parseInt(formData.shares_owned),
        },
      ])

      if (error) throw error

      router.refresh()
      onClose()
    } catch (error) {
      console.error("Error creating snapshot:", error)
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

  const canEdit = userRole === "admin" || userRole === "transfer_team"

  if (!canEdit) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] bg-white/95 backdrop-blur-xl border border-white/20 shadow-2xl">
        <DialogHeader className="space-y-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-xl flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-gray-900">Add Daily Snapshot</DialogTitle>
              <p className="text-sm text-gray-600">Record shareholder position for a specific date</p>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {errors.submit && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
              {errors.submit}
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-3">
              <Label htmlFor="date" className="text-sm font-medium text-gray-700">
                Date *
              </Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => handleChange("date", e.target.value)}
                  className={`${errors.date ? "border-red-500" : "border-gray-300"} bg-white/50  pl-10`}
                />
              </div>
              {errors.date && (
                <span className="text-red-500 text-sm flex items-center">
                  <span className="w-1 h-1 bg-red-500 rounded-full mr-2"></span>
                  {errors.date}
                </span>
              )}
            </div>

            <div className="space-y-3">
              <Label htmlFor="shareholder" className="text-sm font-medium text-gray-700">
                Shareholder *
              </Label>
              <Select value={formData.shareholder_id} onValueChange={(value) => handleChange("shareholder_id", value)}>
                <SelectTrigger className={`${errors.shareholder_id ? "border-red-500" : "border-gray-300"} bg-white/50 backdrop-blur-sm`}>
                  <SelectValue placeholder="Select shareholder" />
                </SelectTrigger>
                <SelectContent className="bg-white/95 backdrop-blur-xl border border-white/20">
                  {shareholders.map((shareholder) => (
                    <SelectItem key={shareholder.id} value={shareholder.id}>
                      <div className="flex items-center space-x-2">
                        <Users className="h-4 w-4 text-gray-500" />
                        <span>{shareholder.name}</span>
                        <span className="text-gray-500">({shareholder.cusip})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.shareholder_id && (
                <span className="text-red-500 text-sm flex items-center">
                  <span className="w-1 h-1 bg-red-500 rounded-full mr-2"></span>
                  {errors.shareholder_id}
                </span>
              )}
            </div>

            <div className="space-y-3">
              <Label htmlFor="shares_owned" className="text-sm font-medium text-gray-700">
                Shares Owned *
              </Label>
              <Input
                id="shares_owned"
                type="number"
                min="0"
                value={formData.shares_owned}
                onChange={(e) => handleChange("shares_owned", e.target.value)}
                className={`${errors.shares_owned ? "border-red-500" : "border-gray-300"} bg-white/50 backdrop-blur-sm`}
                placeholder="Enter number of shares"
              />
              {errors.shares_owned && (
                <span className="text-red-500 text-sm flex items-center">
                  <span className="w-1 h-1 bg-red-500 rounded-full mr-2"></span>
                  {errors.shares_owned}
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
                  <span>Creating...</span>
                </div>
              ) : (
                "Add Snapshot"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
