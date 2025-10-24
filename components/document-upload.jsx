"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Upload, FileText, X, Download } from "lucide-react"
import { toast } from "sonner"

const DOCUMENT_TYPES = [
  "Certificate of Incorporation",
  "Bylaws",
  "Board Resolutions",
  "Stock Certificate",
  "Transfer Agent Agreement",
  "Underwriting Agreement",
  "Prospectus",
  "Form S-1",
  "Form 8-K",
  "Form 10-K",
  "Form 10-Q",
  "Legal Opinion",
  "Audit Report",
  "Other"
]

export default function DocumentUpload({ issuerId, documents = [], onDocumentChange, allowEdit = true }) {
  const [uploading, setUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [documentType, setDocumentType] = useState("")
  const [customDocumentName, setCustomDocumentName] = useState("")
  const fileInputRef = useRef(null)

  const handleFileSelect = (event) => {
    const file = event.target.files[0]
    if (file) {
      // Check file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File size must be less than 10MB")
        return
      }
      
      setSelectedFile(file)
      if (!customDocumentName) {
        setCustomDocumentName(file.name)
      }
    }
  }

  const handleUpload = async () => {
    if (!selectedFile || !documentType || !customDocumentName) {
      toast.error("Please select a file, document type, and provide a name")
      return
    }

    setUploading(true)
    try {
      // First upload the file
      const uploadFormData = new FormData()
      uploadFormData.append('file', selectedFile)
      uploadFormData.append('issuerId', issuerId)
      uploadFormData.append('documentType', documentType)

      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: uploadFormData
      })

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file')
      }

      const uploadResult = await uploadResponse.json()

      // Then save document metadata
      const documentResponse = await fetch('/api/documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          issuer_id: issuerId,
          document_type: documentType,
          document_name: customDocumentName,
          file_url: uploadResult.file_url,
          file_size: uploadResult.file_size,
          file_type: uploadResult.file_type
        })
      })

      if (!documentResponse.ok) {
        throw new Error('Failed to save document metadata')
      }

      const document = await documentResponse.json()

      toast.success("Document uploaded successfully")
      
      // Reset form
      setSelectedFile(null)
      setDocumentType("")
      setCustomDocumentName("")
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
      
      // Notify parent component
      if (onDocumentChange) {
        onDocumentChange()
      }
    } catch (error) {
      console.error('Upload error:', error)
      toast.error("Failed to upload document")
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (documentId) => {
    if (!confirm("Are you sure you want to delete this document?")) {
      return
    }

    try {
      const response = await fetch(`/api/documents?id=${documentId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete document')
      }

      toast.success("Document deleted successfully")
      
      // Notify parent component
      if (onDocumentChange) {
        onDocumentChange()
      }
    } catch (error) {
      console.error('Delete error:', error)
      toast.error("Failed to delete document")
    }
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString()
  }

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      {allowEdit && (
        <Card className="bg-white shadow-sm border border-slate-200 rounded-xl">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-900 flex items-center">
              <div className="w-8 h-8 bg-gradient-to-r from-orange-400 to-red-500 rounded-lg flex items-center justify-center mr-3">
                <Upload className="h-4 w-4 text-white" />
              </div>
              Upload Document
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Document Type</Label>
              <Select value={documentType} onValueChange={setDocumentType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select document type" />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Document Name</Label>
              <Input
                value={customDocumentName}
                onChange={(e) => setCustomDocumentName(e.target.value)}
                placeholder="Enter document name"
              />
            </div>

            <div>
              <Label>File</Label>
              <Input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                accept=".pdf,.doc,.docx,.xlsx,.xls,.png,.jpg,.jpeg,.gif"
              />
              {selectedFile && (
                <p className="text-sm text-muted-foreground mt-1">
                  Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                </p>
              )}
            </div>

            <Button 
              onClick={handleUpload} 
              disabled={uploading || !selectedFile || !documentType || !customDocumentName}
              className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white border-0 shadow-lg"
            >
              {uploading ? "Uploading..." : "Upload Document"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Documents List */}
      <Card className="bg-white shadow-sm border border-slate-200 rounded-xl">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900 flex items-center">
            <div className="w-8 h-8 bg-gradient-to-r from-red-400 to-orange-500 rounded-lg flex items-center justify-center mr-3">
              <FileText className="h-4 w-4 text-white" />
            </div>
            Documents ({documents.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No documents uploaded yet.
            </p>
          ) : (
            <div className="space-y-3">
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between p-4 border border-slate-200 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-orange-400 to-red-500 rounded-lg flex items-center justify-center">
                        <FileText className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-slate-900">{doc.document_name}</h4>
                        <div className="flex items-center space-x-4 text-sm text-slate-600">
                          <span className="font-medium">{doc.document_type}</span>
                          {doc.file_size && <span>{formatFileSize(doc.file_size)}</span>}
                          <span>Uploaded {formatDate(doc.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(doc.file_url, '_blank')}
                      className="border-slate-300 hover:bg-white"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    {allowEdit && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(doc.id)}
                        className="text-red-600 hover:text-red-700 border-red-300 hover:bg-red-50"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}