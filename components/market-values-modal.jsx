"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { DollarSign, Calendar, TrendingUp } from "lucide-react"

export default function MarketValuesModal({ isOpen, onClose, issuerId, securities, onUpdate }) {
  const [formData, setFormData] = useState({
    cusip: "",
    valuation_date: new Date().toISOString().split("T")[0],
    price_per_share: "",
    source: "manual",
    notes: ""
  })
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})
  const [existingValues, setExistingValues] = useState([])

  useEffect(() => {
    if (isOpen && issuerId) {
      fetchExistingValues()
    }
  }, [isOpen, issuerId])

  const fetchExistingValues = async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("statements_new")
        .select("*")
        .eq("issuer_id", issuerId)
        .order("valuation_date", { ascending: false })

      if (error) throw error
      setExistingValues(data || [])
    } catch (error) {
      console.error("Error fetching market values:", error)
    }
  }

  const validateForm = () => {
    const newErrors = {}

    if (!formData.cusip) newErrors.cusip = "CUSIP is required"
    if (!formData.valuation_date) newErrors.valuation_date = "Valuation date is required"
    if (!formData.price_per_share) newErrors.price_per_share = "Price per share is required"

    const price = parseFloat(formData.price_per_share)
    if (isNaN(price) || price < 0) {
      newErrors.price_per_share = "Price must be a positive number"
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
      const { error } = await supabase.from("statements_new").upsert({
        issuer_id: issuerId,
        cusip: formData.cusip,
        valuation_date: formData.valuation_date,
        price_per_share: parseFloat(formData.price_per_share),
        source: formData.source,
        notes: formData.notes
      })

      if (error) throw error

      toast.success("Market value updated successfully!")
      onUpdate?.()
      onClose()
      resetForm()
    } catch (error) {
      console.error("Error updating market value:", error)
      toast.error("Failed to update market value")
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      cusip: "",
      valuation_date: new Date().toISOString().split("T")[0],
      price_per_share: "",
      source: "manual",
      notes: ""
    })
    setErrors({})
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const getLatestPrice = (cusip) => {
    const values = existingValues.filter(v => v.cusip === cusip)
    if (values.length === 0) return null
    return values.sort((a, b) => new Date(b.valuation_date) - new Date(a.valuation_date))[0]
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <DollarSign className="h-5 w-5" />
            <span>Manage Market Values</span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cusip">CUSIP</Label>
              <Select value={formData.cusip} onValueChange={(value) => setFormData({ ...formData, cusip: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a CUSIP" />
                </SelectTrigger>
                <SelectContent>
                  {securities.map((security) => {
                    const latestPrice = getLatestPrice(security.cusip)
                    return (
                      <SelectItem key={security.cusip} value={security.cusip}>
                        <div className="flex items-center justify-between w-full">
                          <span>{security.cusip}</span>
                          {latestPrice && (
                            <span className="text-xs text-gray-500 ml-2">
                              ${latestPrice.price_per_share.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
              {errors.cusip && <p className="text-sm text-red-500">{errors.cusip}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="valuation_date">Valuation Date</Label>
              <Input
                id="valuation_date"
                type="date"
                value={formData.valuation_date}
                onChange={(e) => setFormData({ ...formData, valuation_date: e.target.value })}
                max={new Date().toISOString().split("T")[0]}
              />
              {errors.valuation_date && <p className="text-sm text-red-500">{errors.valuation_date}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price_per_share">Price Per Share ($)</Label>
              <Input
                id="price_per_share"
                type="number"
                step="0.01"
                min="0"
                value={formData.price_per_share}
                onChange={(e) => setFormData({ ...formData, price_per_share: e.target.value })}
                placeholder="0.00"
              />
              {errors.price_per_share && <p className="text-sm text-red-500">{errors.price_per_share}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="source">Source</Label>
              <Select value={formData.source} onValueChange={(value) => setFormData({ ...formData, source: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual Entry</SelectItem>
                  <SelectItem value="api">API Feed</SelectItem>
                  <SelectItem value="calculated">Calculated</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Input
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes about this valuation..."
            />
          </div>

          {/* Show existing values for selected CUSIP */}
          {formData.cusip && (
            <div className="space-y-2">
              <Label className="flex items-center space-x-2">
                <TrendingUp className="h-4 w-4" />
                <span>Recent Values for {formData.cusip}</span>
              </Label>
              <div className="max-h-32 overflow-y-auto border rounded-lg p-2">
                {existingValues
                  .filter(v => v.cusip === formData.cusip)
                  .slice(0, 5)
                  .map((value) => (
                    <div key={value.id} className="flex items-center justify-between py-1 text-sm">
                      <span>{new Date(value.valuation_date).toLocaleDateString()}</span>
                      <span className="font-medium">${value.price_per_share.toFixed(2)}</span>
                      <span className="text-xs text-gray-500">{value.source}</span>
                    </div>
                  ))}
                {existingValues.filter(v => v.cusip === formData.cusip).length === 0 && (
                  <p className="text-sm text-gray-500">No previous values found</p>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save Market Value"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}






