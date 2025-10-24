"use client"

import React, { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Mail, Clock, Trash2, Crown, AlertTriangle, ArrowRightLeft, UserPlus } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

export default function SuperAdminTable({ superAdmins, currentUserId, currentUserIsOwner }) {
  const [deleteModal, setDeleteModal] = useState({ open: false, user: null })
  const [isDeleting, setIsDeleting] = useState(false)
  const [transferModal, setTransferModal] = useState({ open: false, user: null })
  const [isTransferring, setIsTransferring] = useState(false)
  const [addModal, setAddModal] = useState({ open: false })
  const [isAdding, setIsAdding] = useState(false)
  const [newAdminData, setNewAdminData] = useState({ email: "", name: "" })
  const router = useRouter()

  const handleDeleteSuperAdmin = async () => {
    if (!deleteModal.user) return
    
    try {
      setIsDeleting(true)
      const supabase = createClient()
      
      // Delete the superadmin user
      const { error } = await supabase
        .from("users_new")
        .delete()
        .eq("id", deleteModal.user.id)
      
      if (error) {
        throw error
      }
      
      setDeleteModal({ open: false, user: null })
      router.refresh()
    } catch (error) {
      console.error("Error deleting superadmin:", error)
      alert(`Error deleting superadmin: ${error.message}`)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleTransferOwnership = async () => {
    if (!transferModal.user) return
    
    try {
      setIsTransferring(true)
      const supabase = createClient()
      
      // Start a transaction-like operation
      // First, remove ownership from current owner
      const { error: removeError } = await supabase
        .from("users_new")
        .update({ is_owner: false })
        .eq("is_owner", true)
      
      if (removeError) {
        throw removeError
      }
      
      // Then, set new owner
      const { error: setError } = await supabase
        .from("users_new")
        .update({ is_owner: true })
        .eq("id", transferModal.user.id)
      
      if (setError) {
        // Try to rollback by setting current user as owner again
        await supabase
          .from("users_new")
          .update({ is_owner: true })
          .eq("id", currentUserId)
        throw setError
      }
      
      setTransferModal({ open: false, user: null })
      toast.success(`Ownership has been transferred to ${transferModal.user.email}`)
      router.refresh()
    } catch (error) {
      console.error("Error transferring ownership:", error)
      toast.error(`Error transferring ownership: ${error.message}`)
    } finally {
      setIsTransferring(false)
    }
  }

  const handleAddSuperAdmin = async () => {
    if (!newAdminData.email || !newAdminData.name) {
      toast.error("Please fill in all required fields")
      return
    }
    
    try {
      setIsAdding(true)
      const supabase = createClient()
      
      // Check if user already exists
      const { data: existingUser, error: checkError } = await supabase
        .from("users_new")
        .select("id, is_super_admin")
        .eq("email", newAdminData.email)
        .single()
      
      if (checkError && checkError.code !== "PGRST116") {
        throw checkError
      }
      
      if (existingUser) {
        if (existingUser.is_super_admin) {
          toast.error("User is already a super admin")
          return
        }
        
        // Update existing user to superadmin
        const { error: updateError } = await supabase
          .from("users_new")
          .update({ is_super_admin: true })
          .eq("id", existingUser.id)
        
        if (updateError) {
          throw updateError
        }
        
        toast.success(`${newAdminData.email} has been promoted to super admin`)
      } else {
        // Create new superadmin user
        const { error: insertError } = await supabase
          .from("users_new")
          .insert({
            email: newAdminData.email,
            name: newAdminData.name,
            is_super_admin: true,
            is_owner: false
          })
        
        if (insertError) {
          throw insertError
        }
        
        toast.success(`${newAdminData.email} has been added as super admin`)
      }
      
      setAddModal({ open: false })
      setNewAdminData({ email: "", name: "" })
      router.refresh()
    } catch (error) {
      console.error("Error adding superadmin:", error)
      toast.error(`Error adding super admin: ${error.message}`)
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <>
      <div className="card-glass overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-white/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
                <Crown className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Super Administrators</h3>
                <p className="text-sm text-gray-600">Manage system super administrators</p>
              </div>
            </div>
            <Button
              onClick={() => setAddModal({ open: true })}
              className="bg-gradient-to-r from-orange-500 to-red-500 text-white"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Add Super Admin
            </Button>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="bg-white/30">
              <TableHead className="font-semibold text-gray-900">Name</TableHead>
              <TableHead className="font-semibold text-gray-900">Email</TableHead>
              <TableHead className="font-semibold text-gray-900">Member Since</TableHead>
              <TableHead className="font-semibold text-gray-900">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {superAdmins && superAdmins.length > 0 ? superAdmins.map((user) => {
              const isCurrentUser = user.id === currentUserId
              
              return (
                <TableRow key={user.id} className="hover:bg-white/20 transition-colors">
                  <TableCell className="font-medium text-gray-900">
                    <div className="flex items-center space-x-2">
                      <Crown className="h-4 w-4 text-orange-500" />
                      <span>{user.is_owner ? 'Owner' : 'Super Admin'}</span>
                      {isCurrentUser && (
                        <span className="text-xs text-blue-600 font-medium">(You)</span>
                      )}
                      {user.is_owner && !isCurrentUser && (
                        <span className="text-xs text-purple-600 font-medium bg-purple-100 px-2 py-0.5 rounded">OWNER</span>
                      )}
                    </div>
                  </TableCell>
                  
                  <TableCell className="text-gray-700">
                    <div className="flex items-center space-x-2">
                      <Mail className="h-4 w-4 text-gray-500" />
                      <span>{user.email}</span>
                    </div>
                  </TableCell>
                  
                  <TableCell className="text-sm text-gray-600">
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4 text-gray-400" />
                      <span>{new Date(user.created_at).toLocaleDateString('en-US')}</span>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      {isCurrentUser ? (
                        <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                          Cannot delete self
                        </div>
                      ) : user.is_owner ? (
                        <div className="text-xs text-purple-500 bg-purple-100 px-2 py-1 rounded">
                          Cannot delete owner
                        </div>
                      ) : (
                        <Button 
                          size="sm" 
                          variant="destructive"
                          className="text-xs h-8 px-3"
                          onClick={() => setDeleteModal({ open: true, user })}
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Delete
                        </Button>
                      )}
                      
                      {/* Transfer ownership button - only visible to current owner and not for self */}
                      {currentUserIsOwner && !isCurrentUser && !user.is_owner && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="text-xs h-8 px-3 border-purple-300 text-purple-600 hover:bg-purple-50"
                          onClick={() => setTransferModal({ open: true, user })}
                        >
                          <ArrowRightLeft className="h-3 w-3 mr-1" />
                          Transfer Ownership
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            }) : (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8">
                  <div className="text-gray-500">No super administrators found</div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Delete Confirmation Modal */}
      <Dialog open={deleteModal.open} onOpenChange={(open) => setDeleteModal({ open, user: null })}>
        <DialogContent className="bg-white/95 backdrop-blur-xl border border-white/20 shadow-2xl">
          <DialogHeader className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-red-500 to-red-600 rounded-xl flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-gray-900">
                  Delete Super Administrator
                </DialogTitle>
                <DialogDescription className="text-gray-600">
                  Are you sure you want to delete {deleteModal.user?.email}? This action cannot be undone.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
              <div className="text-sm text-red-700">
                <p className="font-medium">Warning: This is a permanent action</p>
                <p>Deleting a super administrator will permanently remove their account and all associated data.</p>
              </div>
            </div>
          </div>
          
          <DialogFooter className="pt-6">
            <Button 
              variant="outline" 
              onClick={() => setDeleteModal({ open: false, user: null })}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleDeleteSuperAdmin}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete Super Admin"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Ownership Modal */}
      <Dialog open={transferModal.open} onOpenChange={(open) => setTransferModal({ open, user: null })}>
        <DialogContent className="bg-white/95 backdrop-blur-xl border border-white/20 shadow-2xl">
          <DialogHeader className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
                <ArrowRightLeft className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-gray-900">
                  Transfer Ownership
                </DialogTitle>
                <DialogDescription className="text-gray-600">
                  Transfer app ownership to {transferModal.user?.email}? You will lose owner privileges.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-purple-500 mt-0.5" />
              <div className="text-sm text-purple-700">
                <p className="font-medium">Important: This action cannot be undone</p>
                <p>By transferring ownership to {transferModal.user?.email}, you will:</p>
                <ul className="mt-2 ml-4 list-disc space-y-1">
                  <li>Lose the ability to delete other super admins</li>
                  <li>Lose the ability to transfer ownership</li>
                  <li>Remain a super admin but without owner privileges</li>
                </ul>
              </div>
            </div>
          </div>
          
          <DialogFooter className="pt-6">
            <Button 
              variant="outline" 
              onClick={() => setTransferModal({ open: false, user: null })}
              disabled={isTransferring}
            >
              Cancel
            </Button>
            <Button 
              variant="default"
              className="bg-gradient-to-r from-purple-500 to-purple-600 text-white"
              onClick={handleTransferOwnership}
              disabled={isTransferring}
            >
              {isTransferring ? "Transferring..." : "Transfer Ownership"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Super Admin Modal */}
      <Dialog open={addModal.open} onOpenChange={(open) => setAddModal({ open })}>
        <DialogContent className="bg-white/95 backdrop-blur-xl border border-white/20 shadow-2xl">
          <DialogHeader className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
                <UserPlus className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-gray-900">
                  Add Super Administrator
                </DialogTitle>
                <DialogDescription className="text-gray-600">
                  Create a new super administrator or promote an existing user.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter email address"
                value={newAdminData.email}
                onChange={(e) => setNewAdminData({ ...newAdminData, email: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="name" className="text-sm font-medium text-gray-700">
                Full Name
              </Label>
              <Input
                id="name"
                type="text"
                placeholder="Enter full name"
                value={newAdminData.name}
                onChange={(e) => setNewAdminData({ ...newAdminData, name: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>
          
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
            <div className="flex items-start space-x-3">
              <Crown className="h-5 w-5 text-orange-500 mt-0.5" />
              <div className="text-sm text-orange-700">
                <p className="font-medium">Super Administrator Privileges</p>
                <p>This user will have full system access including:</p>
                <ul className="mt-2 ml-4 list-disc space-y-1">
                  <li>Manage all users across all issuers</li>
                  <li>Create and delete other super admins</li>
                  <li>Access all system data and settings</li>
                </ul>
              </div>
            </div>
          </div>
          
          <DialogFooter className="pt-6">
            <Button 
              variant="outline" 
              onClick={() => {
                setAddModal({ open: false })
                setNewAdminData({ email: "", name: "" })
              }}
              disabled={isAdding}
            >
              Cancel
            </Button>
            <Button 
              className="bg-gradient-to-r from-orange-500 to-red-500 text-white"
              onClick={handleAddSuperAdmin}
              disabled={isAdding || !newAdminData.email || !newAdminData.name}
            >
              {isAdding ? "Adding..." : "Add Super Admin"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}