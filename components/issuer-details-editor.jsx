"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Building, FileText, Save, X } from "lucide-react"
import { toast } from "sonner"
import DocumentUpload from "./document-upload"

const FORM_STATUS_OPTIONS = [
  "FILED",
  "OBTAINED", 
  "PENDING"
]

export default function IssuerDetailsEditor({ issuerId, onClose, onSave }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [issuerData, setIssuerData] = useState({})
  const [documents, setDocuments] = useState([])

  const [formData, setFormData] = useState({
    issuer_name: "",
    display_name: "",
    description: "",
    address: "",
    telephone: "",
    tax_id: "",
    incorporation: "",
    underwriter: "",
    share_info: "",
    notes: "",
    forms_sl_status: "",
    timeframe_for_separation: "",
    separation_ratio: "",
    exchange_platform: "",
    timeframe_for_bc: "",
    us_counsel: "",
    offshore_counsel: ""
  })

  useEffect(() => {
    if (issuerId) {
      fetchIssuerData()
      fetchDocuments()
    }
  }, [issuerId])

  const fetchIssuerData = async () => {
    try {
      const response = await fetch(`/api/issuers/${issuerId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch issuer data')
      }
      const data = await response.json()
      setIssuerData(data)
      setFormData({
        issuer_name: data.issuer_name || "",
        display_name: data.display_name || "",
        description: data.description || "",
        address: data.address || "",
        telephone: data.telephone || "",
        tax_id: data.tax_id || "",
        incorporation: data.incorporation || "",
        underwriter: data.underwriter || "",
        share_info: data.share_info || "",
        notes: data.notes || "",
        forms_sl_status: data.forms_sl_status || "",
        timeframe_for_separation: data.timeframe_for_separation || "",
        separation_ratio: data.separation_ratio || "",
        exchange_platform: data.exchange_platform || "",
        timeframe_for_bc: data.timeframe_for_bc || "",
        us_counsel: data.us_counsel || "",
        offshore_counsel: data.offshore_counsel || ""
      })
    } catch (error) {
      console.error('Error fetching issuer data:', error)
      toast.error('Failed to load issuer data')
    } finally {
      setLoading(false)
    }
  }

  const fetchDocuments = async () => {
    try {
      const response = await fetch(`/api/documents?issuerId=${issuerId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch documents')
      }
      const data = await response.json()
      setDocuments(data)
    } catch (error) {
      console.error('Error fetching documents:', error)
      toast.error('Failed to load documents')
    }
  }

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const response = await fetch(`/api/issuers/${issuerId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        throw new Error('Failed to update issuer')
      }

      const updatedIssuer = await response.json()
      toast.success('Issuer details updated successfully')
      
      if (onSave) {
        onSave(updatedIssuer)
      }
    } catch (error) {
      console.error('Error updating issuer:', error)
      toast.error('Failed to update issuer details')
    } finally {
      setSaving(false)
    }
  }

  const handleDocumentChange = () => {
    fetchDocuments()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">Loading issuer details...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-r from-orange-400 to-red-500 rounded-xl flex items-center justify-center">
              <Building className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Edit Issuer Details</h1>
              <p className="text-slate-600 mt-1">Manage your issuer information and documents</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white border-0 shadow-lg flex items-center space-x-2"
            >
              <Save className="h-4 w-4" />
              <span>{saving ? "Saving..." : "Save Changes"}</span>
            </Button>
            {onClose && (
              <Button
                variant="outline"
                onClick={onClose}
                className="flex items-center space-x-2 border-slate-300"
              >
                <X className="h-4 w-4" />
                <span>Close</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Basic Information */}
      <Card className="bg-white shadow-sm border border-slate-200 rounded-xl">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900">Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Issuer Name *</Label>
              <Input
                value={formData.issuer_name}
                onChange={(e) => handleInputChange('issuer_name', e.target.value)}
                placeholder="Enter issuer name"
              />
            </div>
            <div>
              <Label>Display Name</Label>
              <Input
                value={formData.display_name}
                onChange={(e) => handleInputChange('display_name', e.target.value)}
                placeholder="Enter display name"
              />
            </div>
          </div>

          <div>
            <Label>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Enter description"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Address</Label>
              <Textarea
                value={formData.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
                placeholder="Enter address"
                rows={3}
              />
            </div>
            <div className="space-y-4">
              <div>
                <Label>Telephone</Label>
                <Input
                  value={formData.telephone}
                  onChange={(e) => handleInputChange('telephone', e.target.value)}
                  placeholder="Enter telephone"
                />
              </div>
              <div>
                <Label>Tax ID</Label>
                <Input
                  value={formData.tax_id}
                  onChange={(e) => handleInputChange('tax_id', e.target.value)}
                  placeholder="Enter tax ID"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Company Details */}
      <Card className="bg-white shadow-sm border border-slate-200 rounded-xl">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900">Company Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Incorporation</Label>
              <Input
                value={formData.incorporation}
                onChange={(e) => handleInputChange('incorporation', e.target.value)}
                placeholder="State/Country of incorporation"
              />
            </div>
            <div>
              <Label>Underwriter</Label>
              <Input
                value={formData.underwriter}
                onChange={(e) => handleInputChange('underwriter', e.target.value)}
                placeholder="Enter underwriter"
              />
            </div>
          </div>

          <div>
            <Label>Share Information</Label>
            <Textarea
              value={formData.share_info}
              onChange={(e) => handleInputChange('share_info', e.target.value)}
              placeholder="Enter share information"
              rows={3}
            />
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="Enter notes"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Regulatory Information */}
      <Card className="bg-white shadow-sm border border-slate-200 rounded-xl">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900">Regulatory Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Form S-1 Status</Label>
              <Select 
                value={formData.forms_sl_status} 
                onValueChange={(value) => handleInputChange('forms_sl_status', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {FORM_STATUS_OPTIONS.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Exchange Platform</Label>
              <Input
                value={formData.exchange_platform}
                onChange={(e) => handleInputChange('exchange_platform', e.target.value)}
                placeholder="Enter exchange platform"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Timeframe for Separation</Label>
              <Input
                value={formData.timeframe_for_separation}
                onChange={(e) => handleInputChange('timeframe_for_separation', e.target.value)}
                placeholder="Enter timeframe"
              />
            </div>
            <div>
              <Label>Separation Ratio</Label>
              <Input
                value={formData.separation_ratio}
                onChange={(e) => handleInputChange('separation_ratio', e.target.value)}
                placeholder="Enter separation ratio"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Timeframe for Business Combination</Label>
              <Input
                value={formData.timeframe_for_bc}
                onChange={(e) => handleInputChange('timeframe_for_bc', e.target.value)}
                placeholder="Enter timeframe"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Legal Counsel */}
      <Card className="bg-white shadow-sm border border-slate-200 rounded-xl">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900">Legal Counsel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>US Counsel</Label>
              <Input
                value={formData.us_counsel}
                onChange={(e) => handleInputChange('us_counsel', e.target.value)}
                placeholder="Enter US counsel"
              />
            </div>
            <div>
              <Label>Offshore Counsel</Label>
              <Input
                value={formData.offshore_counsel}
                onChange={(e) => handleInputChange('offshore_counsel', e.target.value)}
                placeholder="Enter offshore counsel"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Document Management */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="text-lg font-semibold mb-6 flex items-center text-slate-900">
          <div className="w-8 h-8 bg-gradient-to-r from-orange-400 to-red-500 rounded-lg flex items-center justify-center mr-3">
            <FileText className="h-4 w-4 text-white" />
          </div>
          Document Management
        </h3>
        <DocumentUpload
          issuerId={issuerId}
          documents={documents}
          onDocumentChange={handleDocumentChange}
          allowEdit={true}
        />
      </div>
    </div>
  )
}