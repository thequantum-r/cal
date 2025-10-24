"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Calendar as CalendarIcon, Trash2, Plus, Filter, ArrowUpDown, Users, Hash, BarChart3, Clock, Search, Download, ArrowRightLeft, AlertTriangle } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import TransferModal from "./transfer-modal"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Label } from "@/components/ui/label"

export default function TransfersTable({ transfers, shareholders, userRole }) {
  const [searchTerm, setSearchTerm] = useState("")
  const [dateFilter, setDateFilter] = useState("")
  const [cusipFilter, setCusipFilter] = useState("")
  const [sortField, setSortField] = useState("transfer_date")
  const [sortDirection, setSortDirection] = useState("desc")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [transferToDelete, setTransferToDelete] = useState(null)
  const [errorDialogOpen, setErrorDialogOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const itemsPerPage = 10
  const router = useRouter()

  // Create a map for quick shareholder lookup
  const shareholderMap = shareholders.reduce((acc, shareholder) => {
    acc[shareholder.id] = shareholder
    return acc
  }, {})

  // Filter transfers
  const filteredTransfers = transfers.filter((transfer) => {
    const fromShareholder = shareholderMap[transfer.from_shareholder_id]
    const toShareholder = shareholderMap[transfer.to_shareholder_id]

    // Search filter
    const searchMatch = !searchTerm || 
      `${fromShareholder?.first_name || ''} ${fromShareholder?.last_name || ''}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${toShareholder?.first_name || ''} ${toShareholder?.last_name || ''}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transfer.shares_transferred.toString().includes(searchTerm) ||
      fromShareholder?.cusip.toLowerCase().includes(searchTerm.toLowerCase()) ||
      toShareholder?.cusip.toLowerCase().includes(searchTerm.toLowerCase())

    // Date filter
    const matchesDate = !dateFilter || transfer.transfer_date >= dateFilter

    // CUSIP filter
    const matchesCusip =
      !cusipFilter || cusipFilter === "all" ||
      fromShareholder?.cusip.toLowerCase().includes(cusipFilter.toLowerCase()) ||
      toShareholder?.cusip.toLowerCase().includes(cusipFilter.toLowerCase())

    return searchMatch && matchesDate && matchesCusip
  })

  // Sort transfers
  const sortedTransfers = [...filteredTransfers].sort((a, b) => {
    let aValue, bValue

    if (sortField === "from_name") {
      aValue = `${shareholderMap[a.from_shareholder_id]?.first_name || ''} ${shareholderMap[a.from_shareholder_id]?.last_name || ''}`.trim() || ""
      bValue = `${shareholderMap[b.from_shareholder_id]?.first_name || ''} ${shareholderMap[b.from_shareholder_id]?.last_name || ''}`.trim() || ""
    } else if (sortField === "to_name") {
      aValue = `${shareholderMap[a.to_shareholder_id]?.first_name || ''} ${shareholderMap[a.to_shareholder_id]?.last_name || ''}`.trim() || ""
      bValue = `${shareholderMap[b.to_shareholder_id]?.first_name || ''} ${shareholderMap[b.to_shareholder_id]?.last_name || ''}`.trim() || ""
    } else {
      aValue = a[sortField]
      bValue = b[sortField]
    }

    if (sortDirection === "asc") {
      return aValue < bValue ? -1 : aValue > bValue ? 1 : 0
    } else {
      return aValue > bValue ? -1 : aValue < bValue ? 1 : 0
    }
  })

  // Paginate transfers
  const totalPages = Math.ceil(sortedTransfers.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedTransfers = sortedTransfers.slice(startIndex, startIndex + itemsPerPage)

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const handleDeleteClick = (transfer) => {
    setTransferToDelete(transfer)
    setDeleteDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!transferToDelete) return

    const supabase = createClient()

    try {
      const { error } = await supabase.from("transfers_new").delete().eq("id", transferToDelete.id)

      if (error) throw error

      router.refresh()
      setDeleteDialogOpen(false)
      setTransferToDelete(null)
    } catch (error) {
      console.error("Error deleting transfer:", error)
      setErrorMessage("Error deleting transfer: " + error.message)
      setErrorDialogOpen(true)
    }
  }

  const handleExport = () => {
    const csvContent = [
      ["Date", "From", "To", "Shares", "From CUSIP", "To CUSIP", "Created"],
      ...sortedTransfers.map(transfer => {
        const fromShareholder = shareholderMap[transfer.from_shareholder_id]
        const toShareholder = shareholderMap[transfer.to_shareholder_id]
        return [
          new Date(transfer.transfer_date).toLocaleDateString(),
          `${fromShareholder?.first_name || ''} ${fromShareholder?.last_name || ''}`.trim() || "Unknown",
          `${toShareholder?.first_name || ''} ${toShareholder?.last_name || ''}`.trim() || "Unknown",
          transfer.shares_transferred.toLocaleString(),
          fromShareholder?.cusip || "N/A",
          toShareholder?.cusip || "N/A",
          new Date(transfer.created_at).toLocaleDateString()
        ]
      })
    ].map(row => row.join(",")).join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `transfers-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const canEdit = userRole === "superadmin" || userRole === "transfer_team"
  const canDelete = userRole === "superadmin"

  // Get unique CUSIPs for filter dropdown
  const uniqueCusips = [...new Set(shareholders.map((s) => s.cusip))].sort()

  return (
    <div className="space-y-8">
      {/* Search and Filters Section */}
      <div className="card-glass p-6">
        <div className="space-y-6">
          {/* Search Bar */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex-1">
              <Label className="text-sm font-medium text-gray-700 mb-2 block">Search Transfers</Label>
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by name, shares, or CUSIP..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-11 bg-white/60 backdrop-blur-sm border border-white/30 focus:border-orange-500 focus:ring-orange-500/20 transition-all duration-200"
                />
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
              {sortedTransfers.length > 0 && (
                <Button 
                  variant="outline" 
                  onClick={handleExport}
                  className="h-11 px-6 border-white/30 bg-white/60 hover:bg-white/80 text-gray-700 hover:text-gray-900 transition-all duration-200"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              )}
              {canEdit && (
                <Button 
                  onClick={() => setIsModalOpen(true)} 
                  className="h-11 px-6 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Transfer
                </Button>
              )}
            </div>
          </div>

          {/* Filters Row */}
          <div className="flex flex-col lg:flex-row lg:items-end gap-4">
            {/* Date Filter */}
            <div className="flex-1 max-w-xs">
              <Label className="text-sm font-medium text-gray-700 mb-2 block">From Date</Label>
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full h-11 justify-start text-left font-normal bg-white/60 backdrop-blur-sm border border-white/30 hover:bg-white/80 transition-all duration-200",
                      !dateFilter && "text-gray-500"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFilter ? format(new Date(dateFilter), "PPP") : "Select a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-white/95 backdrop-blur-xl border border-white/30 shadow-2xl" align="start">
                  <Calendar
                    mode="single"
                    selected={dateFilter ? new Date(dateFilter) : undefined}
                    onSelect={(date) => {
                      setDateFilter(date ? format(date, "yyyy-MM-dd") : "")
                      setCalendarOpen(false)
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* CUSIP Filter */}
            <div className="flex-1 max-w-xs">
              <Label className="text-sm font-medium text-gray-700 mb-2 block">CUSIP Filter</Label>
              <Select value={cusipFilter} onValueChange={setCusipFilter}>
                <SelectTrigger className="h-11 bg-white/60 backdrop-blur-sm border border-white/30 focus:border-orange-500 focus:ring-orange-500/20 transition-all duration-200">
                  <SelectValue placeholder="All CUSIPs" />
                </SelectTrigger>
                <SelectContent className="bg-white/95 backdrop-blur-xl border border-white/30 shadow-2xl">
                  <SelectItem value="all">All CUSIPs</SelectItem>
                  {uniqueCusips.map((cusip) => (
                    <SelectItem key={cusip} value={cusip}>
                      {cusip}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Clear Filters */}
            {(searchTerm || dateFilter || cusipFilter) && (
              <div className="flex items-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchTerm("")
                    setDateFilter("")
                    setCusipFilter("")
                  }}
                  className="h-11 px-4 border-white/30 bg-white/60 hover:bg-white/80 text-gray-700 hover:text-gray-900 transition-all duration-200"
                >
                  Clear Filters
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Results Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-semibold text-gray-900">Transfer Records</h3>
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span>{sortedTransfers.length} transfer{sortedTransfers.length !== 1 ? 's' : ''} found</span>
          </div>
        </div>
        
        {totalPages > 1 && (
          <div className="text-sm text-gray-600">
            Page {currentPage} of {totalPages}
          </div>
        )}
      </div>

      {/* Table Card */}
      <div className="card-glass overflow-hidden shadow-xl">
        <div className="overflow-x-auto table-scrollbar">
          <Table>
            <TableHeader>
              <TableRow className="bg-white/40 hover:bg-white/50 transition-colors">
                <TableHead 
                  className="cursor-pointer hover:bg-white/60 transition-all duration-200 font-semibold text-gray-900 whitespace-nowrap py-4"
                  onClick={() => handleSort("transfer_date")}
                >
                  <div className="flex items-center space-x-2">
                    <CalendarIcon className="h-4 w-4 text-gray-500" />
                    <span>Date</span>
                    {sortField === "transfer_date" && (
                      <ArrowUpDown className={`h-4 w-4 ${sortDirection === "asc" ? "text-orange-500" : "text-red-500"}`} />
                    )}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-white/60 transition-all duration-200 font-semibold text-gray-900 whitespace-nowrap py-4"
                  onClick={() => handleSort("from_name")}
                >
                  <div className="flex items-center space-x-2">
                    <Users className="h-4 w-4 text-gray-500" />
                    <span>From</span>
                    {sortField === "from_name" && (
                      <ArrowUpDown className={`h-4 w-4 ${sortDirection === "asc" ? "text-orange-500" : "text-red-500"}`} />
                    )}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-white/60 transition-all duration-200 font-semibold text-gray-900 whitespace-nowrap py-4"
                  onClick={() => handleSort("to_name")}
                >
                  <div className="flex items-center space-x-2">
                    <Users className="h-4 w-4 text-gray-500" />
                    <span>To</span>
                    {sortField === "to_name" && (
                      <ArrowUpDown className={`h-4 w-4 ${sortDirection === "asc" ? "text-orange-500" : "text-red-500"}`} />
                    )}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-white/60 transition-all duration-200 font-semibold text-gray-900 whitespace-nowrap py-4"
                  onClick={() => handleSort("shares_transferred")}
                >
                  <div className="flex items-center space-x-2">
                    <BarChart3 className="h-4 w-4 text-gray-500" />
                    <span>Shares</span>
                    {sortField === "shares_transferred" && (
                      <ArrowUpDown className={`h-4 w-4 ${sortDirection === "asc" ? "text-orange-500" : "text-red-500"}`} />
                    )}
                  </div>
                </TableHead>
                <TableHead className="font-semibold text-gray-900 whitespace-nowrap py-4">
                  <div className="flex items-center space-x-2">
                    <Hash className="h-4 w-4 text-gray-500" />
                    <span>From CUSIP</span>
                  </div>
                </TableHead>
                <TableHead className="font-semibold text-gray-900 whitespace-nowrap py-4">
                  <div className="flex items-center space-x-2">
                    <Hash className="h-4 w-4 text-gray-500" />
                    <span>To CUSIP</span>
                  </div>
                </TableHead>
                <TableHead className="font-semibold text-gray-900 whitespace-nowrap py-4">
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-gray-500" />
                    <span>Created</span>
                  </div>
                </TableHead>
                {canDelete && <TableHead className="font-semibold text-gray-900 whitespace-nowrap py-4">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedTransfers.map((transfer, index) => {
                const fromShareholder = shareholderMap[transfer.from_shareholder_id]
                const toShareholder = shareholderMap[transfer.to_shareholder_id]

                return (
                  <TableRow 
                    key={transfer.id} 
                    className={cn(
                      "hover:bg-white/30 transition-all duration-200",
                      index % 2 === 0 ? "bg-white/10" : "bg-white/5"
                    )}
                  >
                    <TableCell className="text-gray-700 whitespace-nowrap py-4">
                      <div className="font-medium">
                        {new Date(transfer.transfer_date).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="font-medium text-gray-900 max-w-[150px] truncate" title={`${fromShareholder?.first_name || ''} ${fromShareholder?.last_name || ''}`.trim() || "Unknown"}>
                        {`${fromShareholder?.first_name || ''} ${fromShareholder?.last_name || ''}`.trim() || "Unknown"}
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="font-medium text-gray-900 max-w-[150px] truncate" title={`${toShareholder?.first_name || ''} ${toShareholder?.last_name || ''}`.trim() || "Unknown"}>
                        {`${toShareholder?.first_name || ''} ${toShareholder?.last_name || ''}`.trim() || "Unknown"}
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="font-semibold text-gray-900">
                        {transfer.shares_transferred.toLocaleString()}
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-700 whitespace-nowrap py-4">
                      <span className="px-2 py-1 bg-gray-100 rounded-md text-sm font-medium">
                        {fromShareholder?.cusip || "N/A"}
                      </span>
                    </TableCell>
                    <TableCell className="text-gray-700 whitespace-nowrap py-4">
                      <span className="px-2 py-1 bg-gray-100 rounded-md text-sm font-medium">
                        {toShareholder?.cusip || "N/A"}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500 whitespace-nowrap py-4">
                      {new Date(transfer.created_at).toLocaleDateString()}
                    </TableCell>
                    {canDelete && (
                      <TableCell className="whitespace-nowrap py-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteClick(transfer)}
                          className="border-red-200 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 transition-all duration-200"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>

        {/* Empty State */}
        {paginatedTransfers.length === 0 && (
          <div className="px-8 py-16 text-center">
            <div className="w-20 h-20 mx-auto bg-gradient-to-r from-gray-100 to-gray-200 rounded-full flex items-center justify-center mb-6">
              <ArrowRightLeft className="h-10 w-10 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">No transfers found</h3>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">
              {searchTerm || dateFilter || cusipFilter 
                ? "Try adjusting your search criteria or filters to find what you're looking for." 
                : "No transfers have been recorded yet. Create your first transfer to get started."}
            </p>
            {canEdit && !searchTerm && !dateFilter && !cusipFilter && (
              <Button 
                onClick={() => setIsModalOpen(true)}
                className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create First Transfer
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-sm text-gray-600">
            Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, sortedTransfers.length)} of{" "}
            {sortedTransfers.length} results
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="border-white/30 bg-white/60 hover:bg-white/80 text-gray-700 hover:text-gray-900 transition-all duration-200"
            >
              Previous
            </Button>
            <div className="flex items-center space-x-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <Button
                  key={page}
                  variant={currentPage === page ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentPage(page)}
                  className={cn(
                    currentPage === page 
                      ? "bg-gradient-to-r from-orange-500 to-red-500 text-white" 
                      : "border-white/30 bg-white/60 hover:bg-white/80 text-gray-700 hover:text-gray-900",
                    "transition-all duration-200"
                  )}
                >
                  {page}
                </Button>
              ))}
            </div>
            <Button
              variant="outline"
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="border-white/30 bg-white/60 hover:bg-white/80 text-gray-700 hover:text-gray-900 transition-all duration-200"
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Modal */}
      <TransferModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        shareholders={shareholders}
        userRole={userRole}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-white/95 backdrop-blur-xl border border-white/20 shadow-2xl">
          <AlertDialogHeader>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-red-500 to-orange-500 rounded-xl flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-white" />
              </div>
              <div>
                <AlertDialogTitle className="text-xl font-bold text-gray-900">Delete Transfer</AlertDialogTitle>
                <AlertDialogDescription className="text-gray-600">
                  Are you sure you want to delete this transfer? This action cannot be undone.
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-4 flex-col sm:flex-row gap-2">
            <AlertDialogCancel 
              className="border-white/30 bg-white/60 hover:bg-white/80 text-gray-700 hover:text-gray-900 w-full sm:w-auto"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white w-full sm:w-auto"
            >
              Delete Transfer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Error Dialog */}
      <AlertDialog open={errorDialogOpen} onOpenChange={setErrorDialogOpen}>
        <AlertDialogContent className="bg-white/95 backdrop-blur-xl border border-white/20 shadow-2xl">
          <AlertDialogHeader>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-red-500 to-orange-500 rounded-xl flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-white" />
              </div>
              <div>
                <AlertDialogTitle className="text-xl font-bold text-gray-900">Error</AlertDialogTitle>
                <AlertDialogDescription className="text-gray-600">
                  {errorMessage}
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-4">
            <AlertDialogAction 
              onClick={() => setErrorDialogOpen(false)}
              className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white"
            >
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
