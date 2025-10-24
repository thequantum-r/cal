"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Download, Plus, Search, Calendar, BarChart3 } from "lucide-react"
import SnapshotModal from "./snapshot-modal"
import { createClient } from "@/lib/supabase/client"

export default function AsOfSearch({ shareholders, userRole }) {
  const [searchDate, setSearchDate] = useState("")
  const [snapshots, setSnapshots] = useState([])
  const [loading, setLoading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  const handleSearch = async () => {
    if (!searchDate) return

    setLoading(true)
    const supabase = createClient()

    try {
      const { data, error } = await supabase
        .from("statements_new")
        .select(
          `
          *,
          shareholders (
            name,
            cusip,
            account_number
          )
        `,
        )
        .eq("date", searchDate)
        .order("shareholders(last_name)")

      if (error) throw error

      setSnapshots(data || [])
      setHasSearched(true)
    } catch (error) {
      console.error("Error searching snapshots:", error)
      alert("Error searching snapshots: " + error.message)
    } finally {
      setLoading(false)
    }
  }

  // Auto-search whenever the date changes
  useEffect(() => {
    if (searchDate) {
      handleSearch()
    } else {
      setSnapshots([])
      setHasSearched(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDate])

  const handleExportCSV = () => {
    if (snapshots.length === 0) return

    const headers = ["Date", "Shareholder Name", "CUSIP", "Account Number", "Shares Owned"]
    // Excel-safe date cell to avoid ###### when column is narrow
    const excelSafeDate = `="${new Date(searchDate).toLocaleDateString()}"`
    const csvContent = [
      headers.join(","),
      ...snapshots.map((snapshot) =>
        [
          excelSafeDate,
          `"${snapshot.shareholders?.name || "Unknown"}"`,
          snapshot.shareholders?.cusip || "N/A",
          snapshot.shareholders?.account_number || "N/A",
          snapshot.shares_owned,
        ].join(","),
      ),
    ].join("\n")

    // Prepend BOM for Excel compatibility
    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `shareholder-snapshot-${searchDate}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const canEdit = userRole === "admin" || userRole === "transfer_team"

  const totalShares = snapshots.reduce((sum, snapshot) => sum + snapshot.shares_owned, 0)

  return (
    <div className="space-y-6">
      {/* Search Section */}
      <div className="card-glass p-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-r from-orange-400 to-red-500 rounded-lg flex items-center justify-center">
              <Calendar className="h-4 w-4 text-white" />
            </div>
            <Label htmlFor="search-date" className="text-sm font-medium text-gray-700">
              Date:
            </Label>
          </div>
          <Input
            id="search-date"
            type="date"
            value={searchDate}
            onChange={(e) => setSearchDate(e.target.value)}
            className="w-48 bg-white/50 backdrop-blur-sm border border-white/20 focus:border-orange-500 focus:ring-orange-500/20"
          />
          {canEdit && (
            <Button 
              onClick={() => setIsModalOpen(true)} 
              variant="outline"
              className="border-white/20 bg-white/50 hover:bg-white/70"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Snapshot
            </Button>
          )}
        </div>
      </div>

      {/* Results Section */}
      {hasSearched && (
        <div className="card-glass">
          <div className="px-6 py-4 border-b border-white/20">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Shareholder Positions as of {new Date(searchDate).toLocaleDateString()}
                </h3>
                <p className="text-sm text-gray-600 flex items-center mt-1">
                  <BarChart3 className="h-4 w-4 mr-2 text-orange-500" />
                  {snapshots.length} shareholders • {totalShares.toLocaleString()} total shares
                </p>
              </div>
              {snapshots.length > 0 && (
                <Button 
                  onClick={handleExportCSV} 
                  variant="outline"
                  className="border-white/20 bg-white/50 hover:bg-white/70"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              )}
            </div>
          </div>

          {snapshots.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="w-16 h-16 mx-auto bg-gradient-to-r from-gray-100 to-gray-200 rounded-full flex items-center justify-center mb-4">
                <Calendar className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No snapshots found</h3>
              <p className="text-sm text-gray-600 mb-6">
                No shareholder data was recorded for {new Date(searchDate).toLocaleDateString()}.
              </p>
              {canEdit && (
                <Button 
                  onClick={() => setIsModalOpen(true)}
                  className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Snapshot for This Date
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-white/30">
                    <TableHead className="font-semibold text-gray-900">Shareholder Name</TableHead>
                    <TableHead className="font-semibold text-gray-900">CUSIP</TableHead>
                    <TableHead className="font-semibold text-gray-900">Account Number</TableHead>
                    <TableHead className="text-right font-semibold text-gray-900">Shares Owned</TableHead>
                    <TableHead className="text-right font-semibold text-gray-900">Percentage</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {snapshots.map((snapshot) => {
                    const percentage = totalShares > 0 ? (snapshot.shares_owned / totalShares) * 100 : 0
                    return (
                      <TableRow key={snapshot.id} className="hover:bg-white/20 transition-colors">
                        <TableCell className="font-medium text-gray-900">
                          {snapshot.shareholders?.name || "Unknown"}
                        </TableCell>
                        <TableCell className="text-gray-700">{snapshot.shareholders?.cusip || "N/A"}</TableCell>
                        <TableCell className="text-gray-700">{snapshot.shareholders?.account_number || "N/A"}</TableCell>
                        <TableCell className="text-right font-medium text-gray-900">
                          {snapshot.shares_owned.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-gray-700">
                          <span className="px-2 py-1 bg-gradient-to-r from-orange-100 to-red-100 text-orange-800 rounded-full text-sm font-medium">
                            {percentage.toFixed(2)}%
                          </span>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      <SnapshotModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        shareholders={shareholders}
        userRole={userRole}
      />
    </div>
  )
}
