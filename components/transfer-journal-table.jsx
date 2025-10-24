"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Calendar as CalendarIcon, Trash2, Plus, Filter, ArrowUpDown, Building, Hash, FileText, User, MapPin, Search, Download, ArrowRightLeft, BarChart3, Clock, CreditCard, AlertTriangle, Shield, CheckCircle } from "lucide-react"

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import TransferJournalModal from "./transfer-journal-modal"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Label } from "@/components/ui/label"

export default function TransferJournalTable({ records, shareholders, userRole, issuerId }) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterType, setFilterType] = useState("all")
  const [sortField, setSortField] = useState("created_at")
  const [sortDirection, setSortDirection] = useState("desc")
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [recordToDelete, setRecordToDelete] = useState(null)
  const router = useRouter()

  // Permission checks
  const canEdit = userRole === "superadmin" || userRole === "admin" || userRole === "transfer_team"
  const canDelete = userRole === "superadmin" || userRole === "admin"

  // Enhanced transaction types for filtering
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

  // Filter and sort records
  const filteredRecords = records
    .filter(record => {
      const matchesSearch = 
        record.cusip?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.transaction_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.shareholder_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.notes?.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesFilter = filterType === "all" || record.transaction_type === filterType

      return matchesSearch && matchesFilter
    })
    .sort((a, b) => {
      let aValue = a[sortField]
      let bValue = b[sortField]

      if (sortField === "created_at" || sortField === "credit_date" || sortField === "debit_date") {
        aValue = new Date(a.transaction_date || a.created_at || 0)
        bValue = new Date(b.transaction_date || b.created_at || 0)
    }

    if (sortDirection === "asc") {
        return aValue > bValue ? 1 : -1
    } else {
        return aValue < bValue ? 1 : -1
    }
  })

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const handleDelete = async () => {
    if (!recordToDelete) return

    const supabase = createClient()
    try {
      const { error } = await supabase
        .from("transfers_new")
        .delete()
        .eq("id", recordToDelete.id)

      if (error) throw error

      router.refresh()
      setDeleteDialogOpen(false)
      setRecordToDelete(null)
    } catch (error) {
      console.error("Error deleting record:", error)
    }
  }

  const handleExport = () => {
    // Export functionality - can be implemented later
    console.log("Export functionality to be implemented")
  }

  const getShareholderName = (shareholderId) => {
    const shareholder = shareholders.find(s => s.id === shareholderId)
    return shareholder ? `${shareholder.first_name} ${shareholder.last_name}` : "Unknown"
  }

  const getShareholderAccount = (shareholderId) => {
    const shareholder = shareholders.find(s => s.id === shareholderId)
    return shareholder?.account_number || "N/A"
  }

  return (
    <div className="space-y-4">
      {/* Header with Actions */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
              placeholder="Search by CUSIP, transaction type, shareholder..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-80"
            />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
            <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
              {transactionTypes.map(type => (
                <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

        <div className="flex items-center gap-2">
          {canEdit && (
            <Button onClick={() => setIsModalOpen(true)} className="bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white">
              <Plus className="h-4 w-4 mr-2" />
              New Record
                </Button>
            )}
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Records Table */}
      <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort("created_at")}
                  className="h-auto p-0 font-semibold"
                >
                  Date
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
                </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort("cusip")}
                  className="h-auto p-0 font-semibold"
                >
                  CUSIP
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
                </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort("transaction_type")}
                  className="h-auto p-0 font-semibold"
                >
                  Transaction Type
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
                </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort("share_quantity")}
                  className="h-auto p-0 font-semibold"
                >
                  Quantity
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
                </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort("credit_debit")}
                  className="h-auto p-0 font-semibold"
                >
                  Credit/Debit
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
                </TableHead>
              <TableHead className="font-semibold">Shareholder</TableHead>
              <TableHead className="font-semibold">Account</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="font-semibold">Restrictions</TableHead>
              {canEdit && <TableHead className="font-semibold">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
            {filteredRecords.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canEdit ? 9 : 8} className="text-center py-8 text-gray-500">
                  No transfer journal records found
                  </TableCell>
              </TableRow>
            ) : (
              filteredRecords.map((record) => (
                <TableRow key={record.id} className="hover:bg-gray-50">
                  <TableCell className="whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <CalendarIcon className="h-3 w-3 text-gray-400 flex-shrink-0" />
                      <span className="text-xs font-medium">
                        {(record.transaction_date || record.created_at) ? format(new Date(record.transaction_date || record.created_at), "MMM dd, yyyy") : "N/A"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <Hash className="h-3 w-3 text-gray-400 flex-shrink-0" />
                      <span className="font-mono text-xs">{record.cusip}</span>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <ArrowRightLeft className="h-3 w-3 text-gray-400 flex-shrink-0" />
                      <span className="text-xs">{record.transaction_type}</span>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <span className="font-medium text-xs">
                      {record.share_quantity?.toLocaleString() || "0"}
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div className={cn(
                      "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium",
                      record.credit_debit === "Credit" 
                        ? "bg-green-100 text-green-800" 
                        : "bg-red-100 text-red-800"
                    )}>
                      {record.credit_debit === "Credit" ? (
                        <CheckCircle className="h-2.5 w-2.5" />
                      ) : (
                        <AlertTriangle className="h-2.5 w-2.5" />
                      )}
                      {record.credit_debit}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3 text-gray-400 flex-shrink-0" />
                      <span className="text-xs max-w-[120px] truncate" title={getShareholderName(record.shareholder_id)}>
                        {getShareholderName(record.shareholder_id)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <span className="text-xs text-gray-600">{getShareholderAccount(record.shareholder_id)}</span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div className={cn(
                      "inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium",
                      record.status === "Active" ? "bg-blue-100 text-blue-800" :
                      record.status === "Completed" ? "bg-green-100 text-green-800" :
                      record.status === "Pending" ? "bg-yellow-100 text-yellow-800" :
                      "bg-gray-100 text-gray-800"
                    )}>
                      {record.status}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {record.restriction_id ? (
                      <div className="flex items-center gap-1">
                        <Shield className="h-2.5 w-2.5 text-yellow-600" />
                        <span className="text-xs text-yellow-700">Restricted</span>
                    </div>
                    ) : (
                      <span className="text-xs text-gray-500">None</span>
                    )}
                  </TableCell>
                  {canEdit && (
                    <TableCell>
                      <div className="flex items-center gap-2">
                  {canDelete && (
                      <Button
                            variant="ghost"
                        size="sm"
                            onClick={() => {
                              setRecordToDelete(record)
                              setDeleteDialogOpen(true)
                            }}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
            </TableBody>
          </Table>
        </div>

      {/* Summary Stats */}
      {/* <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Records</p>
              <p className="text-2xl font-bold text-gray-900">{filteredRecords.length}</p>
            </div>
            <FileText className="h-8 w-8 text-blue-600" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Shares</p>
              <p className="text-2xl font-bold text-gray-900">
                {filteredRecords.reduce((sum, r) => sum + (r.share_quantity || 0), 0).toLocaleString()}
              </p>
            </div>
            <BarChart3 className="h-8 w-8 text-green-600" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Credits</p>
              <p className="text-2xl font-bold text-gray-900">
                {filteredRecords.filter(r => r.credit_debit === "Credit").length}
              </p>
      </div>
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Debits</p>
              <p className="text-2xl font-bold text-gray-900">
                {filteredRecords.filter(r => r.credit_debit === "Debit").length}
              </p>
            </div>
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
        </div>
      </div> */}

      {/* Modal */}
      <TransferJournalModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        shareholders={shareholders}
        userRole={userRole}
        issuerId={issuerId}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transfer Record</AlertDialogTitle>
            <AlertDialogDescription>
                  Are you sure you want to delete this transfer journal record? This action cannot be undone.
                </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
