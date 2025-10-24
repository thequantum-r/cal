"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { createClient } from "@/lib/supabase/client"
import Sidebar from "@/components/sidebar"
import Header from "@/components/header"
import IssuerUsersTable from "@/components/issuer-users-table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, Shield, UserPlus, Activity } from "lucide-react"

async function getIssuerUsers(issuerId, userRole) {
  const supabase = createClient()

  console.log(`[DEBUG] getIssuerUsers called with issuerId: ${issuerId}, userRole: ${userRole}`)

  // Only admins can access issuer-specific user management
  if (userRole !== 'admin') {
    console.log("[DEBUG] User role not authorized for issuer-specific user management")
    return []
  }

  // Get users for this specific issuer only
  console.log(`[DEBUG] Fetching users for issuer: ${issuerId}`)
  
  // Get issuer_users records first
  const { data: issuerUserRecords, error: issuerError } = await supabase
    .from("issuer_users_new")
    .select("user_id, role_id")
    .eq("issuer_id", issuerId)
  
  if (issuerError) {
    console.error("Error fetching issuer user records:", issuerError)
    console.error("Error details:", JSON.stringify(issuerError, null, 2))
    return []
  }
  
  if (!issuerUserRecords || issuerUserRecords.length === 0) {
    console.log("[DEBUG] No issuer user records found")
    return []
  }
  
  // Get unique user IDs
  const userIds = [...new Set(issuerUserRecords.map(record => record.user_id))]
  
  // Get user details
  const { data: users, error: usersError } = await supabase
    .from("users_new")
    .select("id, email, is_super_admin, is_owner, created_at")
    .in("id", userIds)
  
  if (usersError) {
    console.error("Error fetching users:", usersError)
    console.error("Error details:", JSON.stringify(usersError, null, 2))
    return []
  }
  
  // Get unique role IDs
  const roleIds = [...new Set(issuerUserRecords.map(record => record.role_id))]
  
  // Get role details
  const { data: roles, error: rolesError } = await supabase
    .from("roles_new")
    .select("id, role_name, display_name, description")
    .in("id", roleIds)
  
  if (rolesError) {
    console.error("Error fetching roles:", rolesError)
    console.error("Error details:", JSON.stringify(rolesError, null, 2))
    return []
  }
  
  // Combine the data manually
  const issuerUsers = issuerUserRecords.map(record => ({
    user_id: record.user_id,
    role_id: record.role_id,
    is_primary: false, // Default since column doesn't exist
    users: users.find(u => u.id === record.user_id),
    roles: roles.find(r => r.id === record.role_id)
  }))
  
  console.log(`[DEBUG] Found ${issuerUsers.length} users for issuer ${issuerId}`)
  return issuerUsers || []
}

async function getIssuerInvitedUsers(issuerId, userRole) {
  const supabase = createClient()
  
  console.log(`[DEBUG] getIssuerInvitedUsers called with issuerId: ${issuerId}`)
  
  // Only admins can access issuer-specific user management
  if (userRole !== 'admin') {
    return []
  }

  const { data: invitedUsers, error } = await supabase
    .from("invited_users_new")
    .select(`
      email, 
      name, 
      invited_at,
      issuer_id,
      roles_new (
        id,
        role_name,
        display_name
      )
    `)
    .eq("issuer_id", issuerId)
    .order("invited_at", { ascending: false })

  if (error) {
    console.error("Error fetching invited users:", error)
    console.error("Error details:", JSON.stringify(error, null, 2))
    return []
  }
  
  console.log(`[DEBUG] Found ${invitedUsers?.length || 0} invited users for issuer ${issuerId}`)
  return invitedUsers || []
}

export default function IssuerUsersPage({ params: paramsPromise }) {
  const { user, userRole, userRoles, currentIssuer, availableIssuers, issuerSpecificRole, loading, initialized, validateAndSetIssuer } = useAuth()
  const router = useRouter()
  const [issuerId, setIssuerId] = useState(null)
  const [pageLoading, setPageLoading] = useState(true)
  const [issuerUsers, setIssuerUsers] = useState([])
  const [invitedUsers, setInvitedUsers] = useState([])
  const [hasAdminAccess, setHasAdminAccess] = useState(false)

  // Get params and set issuer ID
  useEffect(() => {
    const getParams = async () => {
      const params = await paramsPromise
      setIssuerId(params?.issuerId)
    }
    getParams()
  }, [paramsPromise])

  // Validate issuer access when issuer ID is available
  useEffect(() => {
    if (!initialized || !issuerId) return
    
    const validateAccess = async () => {
      if (!user) {
        router.push('/login')
        return
      }

      const { hasAccess } = await validateAndSetIssuer(issuerId)
      
      if (!hasAccess) {
        router.push('/?error=no_access')
        return
      }

      // Check if user has admin access to this specific issuer
      const supabase = createClient()
      const { data: issuerUserRoles, error: roleError } = await supabase
        .from("issuer_users_new")
        .select("roles(name)")
        .eq("user_id", user.id)
        .eq("issuer_id", issuerId)
        .order("created_at", { ascending: true })

      console.log(`[DEBUG] User ${user.email} roles in issuer ${issuerId}:`, issuerUserRoles)

      // Check if user has admin role in this specific issuer
      const hasAdminRole = issuerUserRoles?.some(roleData => roleData.roles?.name === 'admin')
      
      if (roleError || !issuerUserRoles || !hasAdminRole) {
        console.log(`[DEBUG] Access denied - user is not admin for this issuer`)
        router.push('/?error=no_access')
        return
      }

      setHasAdminAccess(true)

      // Get users and invited users for this issuer
      const [users, invited] = await Promise.all([
        getIssuerUsers(issuerId, userRole),
        getIssuerInvitedUsers(issuerId, userRole)
      ])

      setIssuerUsers(users)
      setInvitedUsers(invited)
      setPageLoading(false)
    }

    validateAccess()
  }, [initialized, issuerId, user, validateAndSetIssuer, router, userRole])

  if (loading || !initialized || pageLoading || !hasAdminAccess) {
    return (
      <div className="flex h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading User Management...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50">
      <Sidebar userRole={userRole} currentIssuerId={issuerId} issuerSpecificRole={issuerSpecificRole} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          user={user} 
          userRole={userRole} 
          userRoles={userRoles}
          currentIssuer={currentIssuer}
          availableIssuers={availableIssuers}
          issuerSpecificRole={issuerSpecificRole}
        />

        <main className="flex-1 overflow-y-auto">
          <div className="py-8">
            <div className="max-w-7xl mx-auto px-6">
              
              {/* Header */}
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  User Management
                </h1>
                <p className="text-gray-600">
                  Manage users and roles for {currentIssuer?.display_name || currentIssuer?.name}
                </p>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <Card className="card-glass border-0">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Active Users</p>
                        <p className="text-3xl font-bold text-gray-900">{issuerUsers.length}</p>
                      </div>
                      <div className="w-12 h-12 bg-gradient-to-r from-red-400 to-orange-500 rounded-xl flex items-center justify-center">
                        <Users className="h-6 w-6 text-white" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="card-glass border-0">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Pending Invites</p>
                        <p className="text-3xl font-bold text-gray-900">{invitedUsers.length}</p>
                      </div>
                      <div className="w-12 h-12 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center">
                        <UserPlus className="h-6 w-6 text-white" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="card-glass border-0">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Admin Users</p>
                        <p className="text-3xl font-bold text-gray-900">
                          {issuerUsers.filter(u => u.roles?.name === 'admin').length}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-gradient-to-r from-purple-400 to-red-500 rounded-xl flex items-center justify-center">
                        <Shield className="h-6 w-6 text-white" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* User Management Table */}
              <Card className="card-glass border-0">
                <CardHeader>
                  <CardTitle className="text-xl font-bold text-gray-900">Issuer Users</CardTitle>
                  <p className="text-sm text-gray-600">
                    Manage user roles within this issuer. You can change roles but cannot add new users to other issuers.
                  </p>
                </CardHeader>
                <CardContent>
                  <IssuerUsersTable 
                    users={issuerUsers} 
                    invitedUsers={invitedUsers}
                    currentUserId={user.id} 
                    currentUserRole={userRole}
                    issuerId={issuerId}
                    currentIssuer={currentIssuer}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}