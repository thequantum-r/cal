"use client"

import React, { useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Users, Mail, UserPlus, Shield, Crown, Clock, Settings } from "lucide-react"
import { getRoleDisplay } from "@/lib/constants"

export default function UsersTable({ users, invited = [], currentUserId, currentUserRole, currentUserIssuerId, currentIssuer }) {
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [updatingUsers, setUpdatingUsers] = useState(new Set())
  const router = useRouter()
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [invite, setInvite] = useState({ email: "", name: "", role_id: "", issuer_id: "" })
  const [inviteError, setInviteError] = useState("")
  const [issuers, setIssuers] = useState([])
  const [loadingIssuers, setLoadingIssuers] = useState(false)
  const [addToIssuerModal, setAddToIssuerModal] = useState({ open: false, user: null })
  const [addToIssuerData, setAddToIssuerData] = useState({ issuer_id: "", role_id: "" })

  // Debug: Log what users are being passed to the component
  console.log("UsersTable received users count:", users?.length || 0)
  console.log("UsersTable received invited count:", invited?.length || 0)

  // Fetch roles and issuers on component mount
  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient()
      try {
        // Fetch roles based on user permission
        let rolesQuery = supabase
          .from("roles_new")
          .select("*")
          .order("display_name")
        
        // For admin users, exclude superadmin role from selection
        if (currentUserRole === "admin") {
          rolesQuery = rolesQuery.neq("role_name", "superadmin")
        }
        
        const { data: rolesData, error: rolesError } = await rolesQuery
        if (rolesError) throw rolesError
        
        console.log("Loaded roles for", currentUserRole, ":", rolesData?.map(r => r.role_name))
        setRoles(rolesData || [])
        
        // For superadmins, also fetch all issuers for issuer selection
        if (currentUserRole === "superadmin") {
          setLoadingIssuers(true)
          const { data: issuersData, error: issuersError } = await supabase
            .from("issuers_new")
            .select("id, issuer_name, display_name")
            .order("display_name")
          
          if (issuersError) {
            console.error("Error fetching issuers:", issuersError)
            console.error("Issuers error details:", JSON.stringify(issuersError, null, 2))
          } else {
            setIssuers(issuersData || [])
          }
          setLoadingIssuers(false)
        }
      } catch (error) {
        console.error("Error fetching data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [currentUserRole])

  const handleRoleChange = async (userId, newRoleId) => {
    // Check if user is trying to remove their own admin privileges
    const currentUser = users.find(u => u.id === currentUserId)
    const targetUser = users.find(u => u.id === userId)
    const newRole = roles.find(r => r.id === newRoleId)
    
    // Prevent admin from changing their own role
    if (userId === currentUserId) {
      alert("You cannot change your own role. Please contact another administrator.")
      return
    }

    // Prevent admin from changing superadmin roles
    if (currentUserRole === "admin" && targetUser?.role === "superadmin") {
      alert("Admins cannot modify super admin roles.")
      return
    }

    // Prevent changing superadmin roles to non-superadmin (unless current user is superadmin)
    if (targetUser?.role === "superadmin" && newRole?.name !== "superadmin" && currentUserRole !== "superadmin") {
      alert("Super admin roles cannot be changed to other roles.")
      return
    }

    // Prevent non-superadmins from assigning superadmin role
    if (newRole?.name === "superadmin" && currentUserRole !== "superadmin") {
      alert("Only super admins can assign super admin roles.")
      return
    }

    setUpdatingUsers((prev) => new Set([...prev, userId]))
    const supabase = createClient()

    try {
      // Update user role through issuer_users table instead of users table
      // First, get the user's current issuer assignments
      const { data: currentAssignments } = await supabase
        .from("issuer_users_new")
        .select("issuer_id, role_id")
        .eq("user_id", userId)

      if (currentAssignments && currentAssignments.length > 0) {
        // Update the first issuer assignment (primary)
        const { error } = await supabase
          .from("issuer_users_new")
          .update({ role_id: newRoleId })
          .eq("user_id", userId)
          .eq("issuer_id", currentAssignments[0].issuer_id)

        if (error) throw error
      } else {
        // If no issuer assignments, create one with the default issuer
        const { error } = await supabase
          .from("issuer_users_new")
          .insert({
            user_id: userId,
            issuer_id: 'e1b53a11-7412-40fc-9d26-822066cd6af2', // Default issuer
            role_id: newRoleId
          })

        if (error) throw error
      }

      if (error) throw error

      router.refresh()
    } catch (error) {
      console.error("Error updating user role:", error)
      alert("Error updating user role: " + error.message)
    } finally {
      setUpdatingUsers((prev) => {
        const newSet = new Set(prev)
        newSet.delete(userId)
        return newSet
      })
    }
  }

  const handleInvite = async () => {
    try {
      setInviteError("")
      
      // Validate required fields
      if (!invite.email || !invite.role_id) {
        setInviteError("Email and role are required")
        return
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(invite.email)) {
        setInviteError("Please enter a valid email address")
        return
      }

      // Check if user already exists
      const existingUser = users.find(u => u.email.toLowerCase() === invite.email.toLowerCase())
      if (existingUser) {
        setInviteError("A user with this email already exists in the system")
        return
      }
      
      // Determine which issuer to use
      let targetIssuerId
      if (currentUserRole === "superadmin") {
        // Superadmins must select an issuer (unless inviting another superadmin)
        const selectedRole = roles.find(r => r.id === invite.role_id)
        if (selectedRole?.role_name === "superadmin") {
          // Superadmin invitations don't need issuer assignment
          targetIssuerId = null
        } else {
          // Non-superadmin invitations require issuer selection
          if (!invite.issuer_id) {
            setInviteError("Please select an issuer for this user")
            return
          }
          targetIssuerId = invite.issuer_id
        }
      } else if (currentUserRole === "admin") {
        // Admins can only invite to their own issuer
        if (!currentUserIssuerId || currentUserIssuerId === 'null' || currentUserIssuerId === 'undefined') {
          console.error("Invalid issuer ID:", currentUserIssuerId)
          throw new Error("No issuer assigned. Please contact an administrator.")
        }
        targetIssuerId = currentUserIssuerId
        console.log("Using admin's issuer ID:", targetIssuerId)
      }

      const supabase = createClient()
      
      // For superadmin invitations, insert directly into users table
      const selectedRole = roles.find(r => r.id === invite.role_id)
      if (selectedRole?.name === "superadmin") {
        // Create superadmin user directly (they don't go through invitation process)
        const { error: userError } = await supabase.from("users_new").insert({
          email: invite.email,
          name: invite.name,
          is_super_admin: true
        })
        
        if (userError) {
          console.error("Database error:", userError)
          if (userError.code === '23505') {
            setInviteError("A user with this email already exists")
          } else {
            setInviteError(`Error creating superadmin user: ${userError.message}`)
          }
          return
        }
      } else {
        // Check if invitation already exists for this email + issuer + role combination
        const existingInvite = invited.find(i => 
          i.email.toLowerCase() === invite.email.toLowerCase() &&
          i.issuer_id === targetIssuerId &&
          i.role_id === invite.role_id
        )

        if (existingInvite) {
          setInviteError("An invitation for this email with the same role already exists for this issuer")
          return
        }

        // Create invitation for non-superadmin users
        const { error } = await supabase.from("invited_users_new").insert({
          email: invite.email,
          name: invite.name,
          role_id: invite.role_id,
          issuer_id: targetIssuerId
        })
        
        if (error) {
          console.error("Database error:", error)
          if (error.code === '23505') {
            setInviteError("An invitation for this email already exists for this issuer and role")
          } else {
            setInviteError(`Error creating invitation: ${error.message}`)
          }
          return
        }
      }
      
      
      setIsInviteOpen(false)
      setInvite({ email: "", name: "", role_id: "", issuer_id: "" })
      router.refresh()
    } catch (err) {
      console.error("Invite error:", err)
      setInviteError(err.message)
    }
  }

  const openAddToIssuerModal = (user) => {
    setAddToIssuerModal({ open: true, user })
    setAddToIssuerData({ issuer_id: "", role_id: "" })
  }

  const handleAddToIssuer = async () => {
    try {
      if (!addToIssuerData.issuer_id || !addToIssuerData.role_id) {
        alert("Please select both an issuer and role")
        return
      }

      const supabase = createClient()
      
      // Check if user already has this specific role in this issuer
      const { data: existingRoleMembership } = await supabase
        .from("issuer_users_new")
        .select("id")
        .eq("user_id", addToIssuerModal.user.id)
        .eq("issuer_id", addToIssuerData.issuer_id)
        .eq("role_id", addToIssuerData.role_id)
        .single()

      if (existingRoleMembership) {
        alert("User already has this role in this issuer")
        return
      }

      // Check if user has any membership in this issuer
      const { data: anyMembership } = await supabase
        .from("issuer_users_new")
        .select("id")
        .eq("user_id", addToIssuerModal.user.id)
        .eq("issuer_id", addToIssuerData.issuer_id)
        .limit(1)

      // Add user role to issuer
      const { error } = await supabase
        .from("issuer_users_new")
        .insert({
          user_id: addToIssuerModal.user.id,
          issuer_id: addToIssuerData.issuer_id,
          role_id: addToIssuerData.role_id
        })

      if (error) {
        throw error
      }

      setAddToIssuerModal({ open: false, user: null })
      router.refresh()
    } catch (error) {
      console.error("Error adding user role to issuer:", error)
      alert(`Error: ${error.message}`)
    }
  }

  // Build a quick lookup of active users by email
  const activeEmails = new Set(users.map((u) => u.email))
  const pendingInvites = invited.filter((i) => !activeEmails.has(i.email))

  return (
    <div className="card-glass overflow-hidden">
      
      
      <div className="px-6 py-4 border-b border-white/20">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">System Users</h3>
            <p className="text-sm text-gray-600">Manage user roles and permissions</p>
          </div>
          <Button 
            onClick={() => setIsInviteOpen(true)}
            className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Add User
          </Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow className="bg-white/30">
            <TableHead className="font-semibold text-gray-900">Email</TableHead>
            <TableHead className="font-semibold text-gray-900">Issuer</TableHead>
            <TableHead className="font-semibold text-gray-900">Role</TableHead>
            <TableHead className="font-semibold text-gray-900">Member Since</TableHead>
            <TableHead className="font-semibold text-gray-900">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users && users.length > 0 ? users.map((user) => {
            const isUpdating = updatingUsers.has(user.id)
            const isCurrentUser = user.id === currentUserId
            
            // Get issuer memberships for display
            let memberships = []
            
            if (currentUserRole === "admin") {
              // For admin users, use issuer_roles data
              if (user.issuer_roles && user.issuer_roles.length > 0) {
                // Get issuer name from current context
                const issuerName = currentIssuer?.display_name || user.current_issuer?.display_name || "Current Issuer"
                memberships = [{ 
                  roles: user.issuer_roles, 
                  issuer: { display_name: issuerName },
                  is_primary_issuer: true // Default to true since is_primary doesn't exist
                }]
              }
            } else {
              // For superadmin users, use issuer_memberships data
              memberships = user.issuer_memberships || []
            }
            
            return (
              <React.Fragment key={user.id}>
                {/* Main user row */}
                <TableRow className="hover:bg-white/20 transition-colors border-b-2 border-white/30">
                  <TableCell className="font-medium text-gray-900" rowSpan={Math.max(1, memberships.length)}>
                    <div className="flex items-center space-x-2">
                      <Mail className="h-4 w-4 text-gray-500" />
                      <span>{user.email}</span>
                      {isCurrentUser && (
                        <Badge className="bg-blue-100 text-blue-800 text-xs">You</Badge>
                      )}
                    </div>
                  </TableCell>
                  
                  {memberships.length > 0 ? (
                    <>
                      {/* First issuer */}
                      <TableCell className="text-gray-700">
                        <span className="font-medium">{memberships[0].issuer?.display_name}</span>
                      </TableCell>
                      
                      {/* First issuer roles */}
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {memberships[0].roles?.map((role, roleIdx) => {
                            const { color } = getRoleDisplay(role.role_name || 'read_only')
                            return (
                              <Badge 
                                key={role.id || roleIdx}
                                className={`text-xs ${color}`}
                              >
                                {role.display_name}
                              </Badge>
                            )
                          })}
                        </div>
                      </TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell className="text-gray-400 text-sm">No issuer access</TableCell>
                      <TableCell className="text-gray-400 text-sm">—</TableCell>
                    </>
                  )}
                  
                  {/* Member Since (spans all child rows) */}
                  <TableCell className="text-sm text-gray-600" rowSpan={Math.max(1, memberships.length)}>
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4 text-gray-400" />
                      <span>{new Date(user.created_at).toLocaleDateString()}</span>
                    </div>
                  </TableCell>
                  
                  {/* Actions (spans all child rows) */}
                  <TableCell rowSpan={Math.max(1, memberships.length)}>
                    {user.is_super_admin && currentUserRole !== "superadmin" ? (
                      <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        Protected
                      </div>
                    ) : isCurrentUser ? (
                      <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        Cannot edit self
                      </div>
                    ) : (
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="text-xs h-8 px-3 bg-white/50 backdrop-blur-sm border border-white/20"
                        onClick={() => openAddToIssuerModal(user)}
                        disabled={isUpdating}
                      >
                        <Settings className="h-3 w-3 mr-1" />
                        Update User
                      </Button>
                    )}
                    
                    {isUpdating && (
                      <div className="flex items-center space-x-2 mt-2">
                        <div className="w-3 h-3 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin"></div>
                        <span className="text-xs text-gray-500">Updating...</span>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
                
                {/* Additional issuer rows */}
                {memberships.slice(1).map((membership, idx) => (
                  <TableRow key={`${user.id}-issuer-${idx + 1}`} className="hover:bg-white/10 transition-colors border-b border-white/20">
                    <TableCell className="text-gray-700">
                      <span className="font-medium">{membership.issuer?.display_name}</span>
                    </TableCell>
                    
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {membership.roles?.map((role, roleIdx) => {
                          const { color } = getRoleDisplay(role.role_name || 'read_only')
                          return (
                            <Badge 
                              key={role.id || roleIdx}
                              className={`text-xs ${color}`}
                            >
                              {role.display_name}
                            </Badge>
                          )
                        })}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </React.Fragment>
            )
          }) : (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-8">
                <div className="text-gray-500">
                  {!users ? "Loading users..." : "No users found"}
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {users && users.length === 0 && (
        <div className="px-6 py-12 text-center">
          <div className="w-16 h-16 mx-auto bg-gradient-to-r from-gray-100 to-gray-200 rounded-full flex items-center justify-center mb-4">
            <Users className="h-8 w-8 text-gray-400" />
          </div>
          <p className="text-gray-500">No users found.</p>
        </div>
      )}

      {/* Pending invitations */}
      <div className="px-6 py-4 border-t border-white/20">
        <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center">
          <Clock className="h-4 w-4 mr-2 text-orange-500" />
          Pending Invitations
        </h4>
        {pendingInvites.length === 0 ? (
          <p className="text-sm text-gray-500">No pending invites.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-white/20">
                  <TableHead className="font-semibold text-gray-900">Email</TableHead>
                  <TableHead className="font-semibold text-gray-900">Name</TableHead>
                  <TableHead className="font-semibold text-gray-900">Role</TableHead>
                  <TableHead className="font-semibold text-gray-900">Invited</TableHead>
                  <TableHead className="font-semibold text-gray-900">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingInvites.map((inv) => {
                  // Fix: Use inv.roles.name instead of inv.role
                  const roleName = inv.roles?.role_name || 'read_only'
                  const { color, label, Icon } = getRoleDisplay(roleName)
                  const SafeIcon = Icon || Users
                  
                  return (
                    <TableRow key={inv.email} className="hover:bg-white/10 transition-colors">
                      <TableCell className="font-medium text-gray-900">
                        <div className="flex items-center space-x-2">
                          <Mail className="h-4 w-4 text-gray-500" />
                          <span>{inv.email}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-700">{inv.name || "—"}</TableCell>
                      <TableCell>
                        <Badge className={`${color} text-xs font-semibold flex items-center space-x-1`}>
                          <SafeIcon className="h-3 w-3" />
                          <span>{label}</span>
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {inv.invited_at ? new Date(inv.invited_at).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-xs font-semibold">
                          Pending
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
        <DialogContent className="bg-white/95 backdrop-blur-xl border border-white/20 shadow-2xl max-h-[90vh] flex flex-col">
          <DialogHeader className="space-y-4 flex-shrink-0">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
                <UserPlus className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-gray-900">Add User</DialogTitle>
                <DialogDescription className="text-gray-600">Add an email to allow login and set initial role.</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleInvite(); }} className="space-y-6 flex-1 overflow-y-auto">
            <div className="space-y-3">
              <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                Email *
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input 
                  id="email"
                  type="email"
                  value={invite.email} 
                  onChange={(e) => setInvite({ ...invite, email: e.target.value })}
                  className="bg-white/50  border border-white/20 pl-10"
                  placeholder="Enter email address"
                />
              </div>
            </div>
            <div className="space-y-3">
              <Label htmlFor="name" className="text-sm font-medium text-gray-700">
                Name
              </Label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input 
                  id="name"
                  value={invite.name} 
                  onChange={(e) => setInvite({ ...invite, name: e.target.value })}
                  className="bg-white/50 border border-white/20 pl-10"
                  placeholder="Enter full name"
                />
              </div>
            </div>
            <div className="space-y-3">
              <Label htmlFor="role" className="text-sm font-medium text-gray-700">
                Role *
              </Label>
              <Select value={invite.role_id} onValueChange={(v) => setInvite({ ...invite, role_id: v })} disabled={loading}>
                <SelectTrigger className="bg-white/50 backdrop-blur-sm border border-white/20">
                  <SelectValue placeholder={loading ? "Loading roles..." : "Select a role"} />
                </SelectTrigger>
                <SelectContent className="bg-white/95 backdrop-blur-xl border border-white/20 max-h-60 overflow-y-auto" position="popper" side="bottom" align="start">
                  {roles.map((role) => {
                    const { Icon: RoleIcon } = getRoleDisplay(role.role_name)
                    return (
                      <SelectItem key={role.id} value={role.id} className="cursor-pointer">
                        <div className="flex items-center space-x-2">
                          <RoleIcon className="h-4 w-4" />
                          <span>{role.display_name}</span>
                        </div>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
            {/* Issuer selection for superadmins (show only if not inviting superadmin) */}
            {currentUserRole === "superadmin" && invite.role_id && roles.find(r => r.id === invite.role_id)?.role_name !== "superadmin" && (
              <div className="space-y-3">
                <Label htmlFor="issuer" className="text-sm font-medium text-gray-700">
                  Issuer *
                </Label>
                <Select value={invite.issuer_id} onValueChange={(v) => setInvite({ ...invite, issuer_id: v })} disabled={loadingIssuers}>
                  <SelectTrigger className="bg-white/50 backdrop-blur-sm border border-white/20">
                    <SelectValue placeholder={loadingIssuers ? "Loading issuers..." : "Select an issuer"} />
                  </SelectTrigger>
                  <SelectContent className="bg-white/95 backdrop-blur-xl border border-white/20 max-h-60 overflow-y-auto" position="popper" side="bottom" align="start">
                    {issuers.map((issuer) => (
                      <SelectItem key={issuer.id} value={issuer.id} className="cursor-pointer">
                        <div className="flex items-center space-x-2">
                          <Users className="h-4 w-4" />
                          <span>{issuer.display_name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {inviteError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                {inviteError}
              </div>
            )}
          </form>
          <DialogFooter className="pt-6 flex-shrink-0">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setIsInviteOpen(false)}
              className="border-gray-300 bg-white/50 hover:bg-white/70"
            >
              Cancel
            </Button>
            <Button 
              type="button"
              onClick={handleInvite}
              className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white"
            >
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add to Issuer Modal */}
      <Dialog open={addToIssuerModal.open} onOpenChange={(open) => setAddToIssuerModal({ open, user: null })}>
        <DialogContent className="bg-white/95 backdrop-blur-xl border border-white/20 shadow-2xl">
          <DialogHeader className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
                <Users className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-gray-900">
                  Update User: {addToIssuerModal.user?.email}
                </DialogTitle>
                <DialogDescription className="text-gray-600">
                  Manage user roles across issuers. You can add new roles or assign roles to different issuers.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-3">
              <Label className="text-sm font-medium text-gray-700">Select Issuer *</Label>
              <Select 
                value={addToIssuerData.issuer_id} 
                onValueChange={(v) => setAddToIssuerData({ ...addToIssuerData, issuer_id: v })}
              >
                <SelectTrigger className="bg-white/50 backdrop-blur-sm border border-white/20">
                  <SelectValue placeholder="Select an issuer" />
                </SelectTrigger>
                <SelectContent className="bg-white/95 backdrop-blur-xl border border-white/20">
                  {issuers.map((issuer) => (
                    <SelectItem key={issuer.id} value={issuer.id}>
                      {issuer.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-3">
              <Label className="text-sm font-medium text-gray-700">Role in Issuer *</Label>
              <Select 
                value={addToIssuerData.role_id} 
                onValueChange={(v) => setAddToIssuerData({ ...addToIssuerData, role_id: v })}
              >
                <SelectTrigger className="bg-white/50 backdrop-blur-sm border border-white/20">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent className="bg-white/95 backdrop-blur-xl border border-white/20">
                  {roles.filter(role => role.role_name !== 'superadmin').map((role) => {
                    const { Icon: RoleIcon } = getRoleDisplay(role.role_name)
                    return (
                      <SelectItem key={role.id} value={role.id}>
                        <div className="flex items-center space-x-2">
                          <RoleIcon className="h-4 w-4" />
                          <span>{role.display_name}</span>
                        </div>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter className="pt-6">
            <Button 
              variant="outline" 
              onClick={() => setAddToIssuerModal({ open: false, user: null })}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleAddToIssuer}
              className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white"
            >
              Add Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}


