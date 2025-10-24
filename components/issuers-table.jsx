"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Building, Plus, Edit, Users, Search, MoreHorizontal, Eye, Trash2, Shield, RefreshCw } from "lucide-react"
import { format } from "date-fns"
// import EnhancedIssuerModal from "./enhanced-issuer-modal"
import EnhancedIssuerModal from "@/components/enhanced-issuer-modal"

import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

export default function IssuersTable({ issuers, userRole }) {
  const [searchTerm, setSearchTerm] = useState("")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedIssuer, setSelectedIssuer] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const router = useRouter()

  // Filter issuers based on search
  const filteredIssuers = issuers.filter((issuer) =>
    issuer.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    issuer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    issuer.description?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleRefresh = async () => {
    setRefreshing(true)
    router.refresh()
    setTimeout(() => setRefreshing(false), 1000)
  }

  const handleEdit = (issuer) => {
    setSelectedIssuer(issuer)
    setIsModalOpen(true)
  }

  const handleCreate = () => {
    setSelectedIssuer(null)
    setIsModalOpen(true)
  }

  const handleDelete = async (issuer) => {
    if (!confirm(`Are you sure you want to delete "${issuer.display_name}"? This action cannot be undone.`)) {
      return
    }

    const supabase = createClient()
    
    try {
      const { error } = await supabase
        .from("issuers_new")
        .delete()
        .eq("id", issuer.id)

      if (error) throw error

      router.refresh()
    } catch (error) {
      console.error("Error deleting issuer:", error)
      alert("Error deleting issuer: " + error.message)
    }
  }

  const handleAccess = (issuer) => {
    // Always navigate to dashboard
    router.push(`/issuer/${issuer.id}/dashboard`)
  }

  // Status badge removed - no status field needed

  return (
    <div className="flex h-screen bg-gradient-to-br from-orange-50 via-red-50 to-yellow-50">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="space-y-6 p-4">
           {/* Results Summary */}
          <div className="flex items-center justify-between pt-4">
            <div className="flex items-center space-x-4">
              <h3 className="text-lg font-semibold text-gray-900">Issuers</h3>
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>{filteredIssuers.length} issuer{filteredIssuers.length !== 1 ? 's' : ''} found</span>
              </div>
            </div>
          </div>
          {/* Search and Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search issuers..."
                  value={searchTerm}
                  name="search"
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-11 bg-white/60  border border-white/30 focus:border-orange-500 focus:ring-orange-500/20 transition-all duration-200"
                />
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button 
                onClick={handleRefresh}
                variant="outline"
                size="sm"
                disabled={refreshing}
                className="border-gray-300 bg-white/60 hover:bg-white/80 text-gray-700 hover:text-gray-900 transition-all duration-200"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              
              <Button 
                onClick={handleCreate}
                className="h-11 px-6 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Issuer
              </Button>
            </div>
          </div>

         

          {/* Table */}
          <div className="card-glass overflow-hidden shadow-xl">
            <div className="overflow-x-auto table-scrollbar">
              <Table>
                <TableHeader>
                  <TableRow className="bg-white/40 hover:bg-white/50 transition-colors">
                    <TableHead className="font-semibold text-gray-900 whitespace-nowrap py-4">
                      <div className="flex items-center space-x-2">
                        <Building className="h-4 w-4 text-gray-500" />
                        <span>Issuer</span>
                      </div>
                    </TableHead>
                    <TableHead className="font-semibold text-gray-900 whitespace-nowrap py-4">Description</TableHead>
                    <TableHead className="font-semibold text-gray-900 whitespace-nowrap py-4">
                      <div className="flex items-center space-x-2">
                        <Users className="h-4 w-4 text-gray-500" />
                        <span>Users</span>
                      </div>
                    </TableHead>

                    <TableHead className="font-semibold text-gray-900 whitespace-nowrap py-4">Created</TableHead>
                    <TableHead className="font-semibold text-gray-900 whitespace-nowrap py-4">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredIssuers.map((issuer, index) => (
                    <TableRow 
                      key={issuer.id} 
                      className={`hover:bg-white/30 transition-all duration-200 ${
                        index % 2 === 0 ? "bg-white/10" : "bg-white/5"
                      }`}
                    >
                      <TableCell className="py-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-red-500 rounded-lg flex items-center justify-center">
                            <Building className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900">{issuer.display_name}</div>
                            <div className="text-sm text-gray-500">{issuer.name}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="max-w-xs">
                          <p className="text-gray-700 text-sm line-clamp-2">
                            {issuer.description || "No description provided"}
                          </p>
                        </div>
                      </TableCell>

                      <TableCell className="py-4">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-gray-900">{issuer.user_count}</span>
                        </div>
                      </TableCell>

                      <TableCell className="py-4">
                        <div className="text-sm text-gray-600">
                          {format(new Date(issuer.created_at), "MMM dd, yyyy")}
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAccess(issuer)}
                            className="border-orange-300 bg-orange-50 hover:bg-orange-100 text-orange-700 hover:text-orange-800 transition-all duration-200"
                          >
                            <Eye className="h-4 w-4" />
                            View
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(issuer)}
                            className="border-gray-300 bg-white/60 hover:bg-white/80 text-gray-700 hover:text-gray-900 transition-all duration-200"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(issuer)}
                            className="border-red-200 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 transition-all duration-200"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Empty State */}
            {filteredIssuers.length === 0 && (
              <div className="px-8 py-16 text-center">
                <div className="w-20 h-20 mx-auto bg-gradient-to-r from-gray-100 to-gray-200 rounded-full flex items-center justify-center mb-6">
                  <Building className="h-10 w-10 text-gray-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">No issuers found</h3>
                <p className="text-gray-600 mb-8 max-w-md mx-auto">
                  {searchTerm 
                    ? "Try adjusting your search criteria to find what you're looking for." 
                    : "No issuers have been created yet. Create your first issuer to get started."}
                </p>
                {!searchTerm && (
                  <Button 
                    onClick={handleCreate}
                    className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 mb-4"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Issuer
                  </Button>
                )}
                
              </div>
            )}
          </div>

          {/* Modal */}
          <EnhancedIssuerModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            issuer={selectedIssuer}
          />
        </div>
      </div>
    </div>
  )
}

