import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { getCurrentUserRole } from "@/lib/actions"
import Sidebar from "@/components/sidebar"
import Header from "@/components/header"
import UsersTable from "@/components/users-table"
import SuperAdminTable from "@/components/superadmin-table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, Shield, UserPlus, Activity, Settings, Key, Crown } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

async function getUsers(currentUserIssuerId, userRole) {
  const supabase = await createClient()

  console.log("getUsers called with:", { currentUserIssuerId, userRole })
  
  // Check current user authentication
  const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser()
  console.log("Current authenticated user:", currentUser?.id, currentUser?.email)
  console.log("Auth error:", authError)

  if (userRole === "admin") {
    console.log("Admin user query - currentUserIssuerId:", currentUserIssuerId)
    
    if (!currentUserIssuerId) {
      console.error("Admin user has no issuer ID, cannot fetch users")
      return []
    }
    
    // For admins, get users with all their roles in the current issuer
    console.log("Fetching users with multi-role support for issuer:", currentUserIssuerId)
    
    // Get issuer_users records first (avoiding foreign key relationship issues)
    const { data: issuerUserRecords, error: issuerError } = await supabase
      .from("issuer_users_new")
      .select("user_id, role_id")
      .eq("issuer_id", currentUserIssuerId)
    
    if (issuerError) {
      console.error("Error fetching issuer user records:", issuerError)
      return []
    }
    
    if (!issuerUserRecords || issuerUserRecords.length === 0) {
      console.log("No issuer user records found")
      return []
    }
    
    // Get unique user IDs
    const userIds = [...new Set(issuerUserRecords.map(record => record.user_id))]
    
    // Get user details
    const { data: users, error: usersError } = await supabase
      .from("users_new")
      .select("id, email, name, is_super_admin, is_owner, created_at")
      .in("id", userIds)
    
    if (usersError) {
      console.error("Error fetching users:", usersError)
      return []
    }
    
    // Get unique role IDs
    const roleIds = [...new Set(issuerUserRecords.map(record => record.role_id))]
    
    // Get role details
    const { data: roles, error: rolesError } = await supabase
      .from("roles_new")
      .select("id, role_name, display_name")
      .in("id", roleIds)
    
    if (rolesError) {
      console.error("Error fetching roles:", rolesError)
      return []
    }
    
    // Combine the data manually
    const issuerUsers = issuerUserRecords.map(record => ({
      user_id: record.user_id,
      role_id: record.role_id,
      users: users.find(u => u.id === record.user_id),
      roles: roles.find(r => r.id === record.role_id) ? {
        ...roles.find(r => r.id === record.role_id),
        name: roles.find(r => r.id === record.role_id).role_name // Map role_name to name for compatibility
      } : null
    }))
    
    console.log("Combined issuer users data:", issuerUsers)
    
    // Group by user and collect their roles for this issuer
    const userRoleMap = new Map()
    let currentIssuer = null
    
    issuerUsers.forEach(issuerUser => {
      const userId = issuerUser.user_id
      
      // Store issuer info (should be the same for all since we filtered by issuer_id)
      if (!currentIssuer && issuerUser.issuers) {
        currentIssuer = issuerUser.issuers
      }
      
      if (!userRoleMap.has(userId)) {
        userRoleMap.set(userId, {
          ...issuerUser.users,
          issuer_roles: [],
          primary_role: null,
          is_primary_user: false,
          current_issuer: currentIssuer
        })
      }
      
      const userData = userRoleMap.get(userId)
      userData.issuer_roles.push({
        ...issuerUser.roles
      })
      
      // Use first role as primary (since is_primary column doesn't exist)
      if (!userData.primary_role) {
        userData.primary_role = issuerUser.roles
        userData.is_primary_user = true
      }
    })
    
    const usersWithMultiRoles = Array.from(userRoleMap.values())
    console.log("Users with multi-role support:", usersWithMultiRoles?.length || 0)
    return usersWithMultiRoles || []
  } else {
    // For super admins, get all users with all their issuer memberships
    console.log("Executing superadmin user query...")
    
    // First try a simple query to test if we can fetch users at all
    // Exclude superadmin users from main user list
    const { data: simpleUsers, error: simpleError } = await supabase
      .from("users_new")
      .select("*")
      .neq("is_super_admin", true)
      .order("created_at", { ascending: false })
    
    console.log("Simple user query result:", { users: simpleUsers?.length, error: simpleError })
    
    if (simpleError) {
      console.error("Simple query failed:", simpleError)
      return []
    }
    
    // Use manual joins to avoid foreign key relationship issues
    // Exclude superadmin users from main user list
    const { data: users, error } = await supabase
      .from("users_new")
      .select("*")
      .neq("is_super_admin", true)
      .order("created_at", { ascending: false })
    
    if (error) {
      console.error("Error fetching users:", error)
      return simpleUsers?.map(user => ({
        ...user,
        roles: null,
        issuer_memberships: [],
        primary_issuer: null,
        total_issuers: 0
      })) || []
    }
    
    // Get all issuer_users relationships
    const { data: allIssuerUsers, error: issuerUsersError } = await supabase
      .from("issuer_users_new")
      .select("user_id, issuer_id, role_id")
    
    // Get all roles
    const { data: allRoles, error: rolesError } = await supabase
      .from("roles_new")
      .select("id, role_name, display_name")
    
    // Get all issuers
    const { data: allIssuers, error: issuersError } = await supabase
      .from("issuers_new")
      .select("id, issuer_name, display_name")
    
    if (issuerUsersError || rolesError || issuersError) {
      console.error("Error fetching related data:", { 
        issuerUsersError: JSON.stringify(issuerUsersError, null, 2), 
        rolesError: JSON.stringify(rolesError, null, 2), 
        issuersError: JSON.stringify(issuersError, null, 2) 
      })
      return simpleUsers?.map(user => ({
        ...user,
        roles: null,
        issuer_memberships: [],
        primary_issuer: null,
        total_issuers: 0
      })) || []
    }

    console.log("Fetched data:", { 
      users: users?.length, 
      issuerUsers: allIssuerUsers?.length, 
      roles: allRoles?.length, 
      issuers: allIssuers?.length 
    })

    // Add multi-issuer context to each user with grouped role information
    const usersWithMultiIssuerContext = users?.map(user => {
      // Get all issuer_users relationships for this user
      const userIssuerRelationships = allIssuerUsers?.filter(iu => iu.user_id === user.id) || []
      
      // Group roles by issuer
      const issuerRoleMap = new Map()
      userIssuerRelationships.forEach(relationship => {
        const issuerId = relationship.issuer_id
        if (!issuerRoleMap.has(issuerId)) {
          const issuer = allIssuers?.find(i => i.id === issuerId)
          issuerRoleMap.set(issuerId, {
            issuer: issuer ? {
              ...issuer,
              name: issuer.issuer_name // Map issuer_name to name for compatibility
            } : null,
            roles: [],
            is_primary_issuer: false
          })
        }
        
        const issuerData = issuerRoleMap.get(issuerId)
        const role = allRoles?.find(r => r.id === relationship.role_id)
        if (role) {
          issuerData.roles.push({
            ...role,
            name: role.role_name // Map role_name to name for compatibility
          })
        }
        
        // Use first relationship as primary (since is_primary column doesn't exist)
        if (!issuerData.issuer_memberships) {
          issuerData.issuer_memberships = []
        }
        if (issuerData.issuer_memberships.length === 0) {
          issuerData.is_primary_issuer = true
        }
      })
      
      const groupedMemberships = Array.from(issuerRoleMap.values())
      
      return {
        ...user,
        issuer_memberships: groupedMemberships,
        primary_issuer: groupedMemberships.find(gm => gm.is_primary_issuer)?.issuer,
        total_issuers: groupedMemberships.length,
        total_roles: userIssuerRelationships.length // Total number of role assignments
      }
    }) || []

    console.log("All users fetched for superadmin:", usersWithMultiIssuerContext?.length || 0)
    return usersWithMultiIssuerContext
  }
}

async function getSuperAdminUsers() {
  const supabase = await createClient()
  
  console.log("Fetching superadmin users...")
  
  const { data: superAdmins, error } = await supabase
    .from("users_new")
    .select("id, email, name, created_at, is_owner")
    .eq("is_super_admin", true)
    .order("created_at", { ascending: false })
  
  if (error) {
    console.error("Error fetching superadmin users:", error)
    return []
  }
  
  console.log("Superadmin users fetched:", superAdmins?.length || 0)
  return superAdmins || []
}

async function getInvitedUsers(currentUserIssuerId, userRole) {
  const supabase = await createClient()
  
  let query = supabase
    .from("invited_users_new")
    .select(`
      email, 
      name, 
      invited_at,
      issuer_id,
      roles_new:role_id (
        id,
        role_name,
        display_name
      ),
      issuers_new:issuer_id (
        id,
        issuer_name,
        display_name
      )
    `)

  // For admins, only show invitations from their issuer
  if (userRole === "admin") {
    if (currentUserIssuerId) {
      query = query.eq("issuer_id", currentUserIssuerId)
    } else {
      // If admin has no issuer, return empty results
      return []
    }
  }

  const { data, error } = await query.order("invited_at", { ascending: false })

  if (error) {
    console.error("Error fetching invited users:", error)
    return []
  }
  
  return data || []
}

export default async function UsersPage() {
  const supabase = await createClient()

  // Check authentication
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect("/login")
  }

  // Get user role and check admin access
  const userRole = await getCurrentUserRole()

  
  // Only superadmins can access the global /users page
// Admins should use /issuer/[issuerId]/users instead
if (userRole !== "superadmin") {
  // Redirect admins to their issuer-specific user management
  if (userRole === "admin") {
    // Get their issuer ID and redirect
    const { data: issuerUsers } = await supabase
      .from("issuer_users_new")
      .select("issuer_id")
      .eq("user_id", user.id)
      .limit(1)
      .single()
    
    if (issuerUsers?.issuer_id) {
      redirect(`/issuer/${issuerUsers.issuer_id}/users`)
    }
  }
  redirect("/dashboard")
}

  // Check if current user is owner
  let currentUserIsOwner = false
  if (userRole === "superadmin") {
    const { data: currentUserData } = await supabase
      .from("users_new")
      .select("is_owner")
      .eq("id", user.id)
      .single()
    
    currentUserIsOwner = currentUserData?.is_owner === true
  }

  // Get current user's issuer information
  let currentUserIssuerId = null
  let currentIssuer = null
  
  if (userRole === "admin") {
    console.log("Fetching issuer information for admin:", user.id)
    
    // First check if user exists in public.users table with correct data
    const { data: currentUser, error: userCheckError } = await supabase
      .from("users_new")
      .select("id, email, name, is_super_admin, is_owner")
      .eq("id", user.id)
      .single()
    
    console.log("Current user data:", currentUser)
    console.log("User check error:", userCheckError)
    
    // Get all issuers the user has access to (simplified query)
    const { data: issuerUsers, error } = await supabase
      .from("issuer_users_new")
      .select("issuer_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
    
    console.log("Issuer users data:", issuerUsers)
    console.log("Issuer users error:", error)
    console.log("Issuer users length:", issuerUsers?.length)
    
    if (error) {
      console.error("Error fetching issuer users:", error)
    } else if (issuerUsers && issuerUsers.length > 0) {
      // Get the first issuer as default (since is_primary doesn't exist)
      currentUserIssuerId = issuerUsers[0].issuer_id
      
      console.log("Current user issuer ID:", currentUserIssuerId)
      console.log("Total issuer memberships:", issuerUsers.length)
      
      // Get the actual issuer information
      if (currentUserIssuerId) {
        const { data: issuerData, error: issuerError } = await supabase
          .from("issuers_new")
          .select("id, issuer_name, display_name")
          .eq("id", currentUserIssuerId)
          .single()
        
        if (!issuerError && issuerData) {
          currentIssuer = {
            ...issuerData,
            name: issuerData.issuer_name // Map issuer_name to name for compatibility
          }
          console.log("Current issuer:", currentIssuer)
        }
      }
    }
    
    // If still no issuer ID, check if this issuer admin needs a fix
    if (!currentUserIssuerId) {
      console.log("No issuer ID found, checking if user needs issuer_users record...")
      
      // Check if this user was invited as issuer admin but missing issuer_users record
      const { data: invitationHistory, error: inviteError } = await supabase
        .from("invited_users_new")
        .select("issuer_id, role_id")
        .eq("email", user.email)
        .single()
      
      console.log("Invitation history:", invitationHistory)
      console.log("Invite error:", inviteError)
      
      if (invitationHistory && invitationHistory.issuer_id) {
        console.log("Found missing issuer_users record - user should be linked to issuer:", invitationHistory.issuer_id)
        currentUserIssuerId = invitationHistory.issuer_id
        
        // Note: In production, you'd want to create the missing record via server action
        console.warn("MISSING ISSUER_USERS RECORD DETECTED - user should be linked to issuer but isn't")
      }
      
      // Try direct query as fallback - get first issuer
      const { data: directIssuer, error: directError } = await supabase
        .from("issuer_users_new")
        .select("issuer_id")
        .eq("user_id", user.id)
        .limit(1)
        .single()
      
      console.log("Direct issuer query result:", directIssuer)
      console.log("Direct issuer error:", directError)
      
      if (!directError && directIssuer) {
        currentUserIssuerId = directIssuer.issuer_id
        console.log("Found issuer ID via direct query:", currentUserIssuerId)
      }
    }
    
    console.log("Final current user issuer ID:", currentUserIssuerId)
  }

  // Get users data
  console.log("=== CALLING getUsers WITH ===")
  console.log("currentUserIssuerId:", currentUserIssuerId)
  console.log("userRole:", userRole)
  console.log("===========================")
  
  // Get superadmin users only if current user is superadmin
  const superAdmins = userRole === "superadmin" ? await getSuperAdminUsers() : []
  
  const [users, invited] = await Promise.all([getUsers(currentUserIssuerId, userRole), getInvitedUsers(currentUserIssuerId, userRole)])
  
  console.log("=== PAGE LEVEL DEBUG ===")
  console.log("Users passed to component:", users)
  console.log("Users count:", users?.length || 0)
  console.log("Invited passed to component:", invited)
  console.log("Invited count:", invited?.length || 0)
  console.log("Current user issuer ID:", currentUserIssuerId)
  console.log("User role:", userRole)

  return (
    <div className="flex h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50">
              <Sidebar 
          userRole={userRole} 
          currentIssuerId={null} 
          issuerSpecificRole={null}
        />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          user={user} 
          userRole={userRole}
          currentIssuer={null}
          availableIssuers={[]}
          issuerSpecificRole={null}
          userRoles={[]}
        />

        <main className="flex-1 overflow-y-auto">
          <div className="py-8">
            <div className="max-w-7xl mx-auto px-6">

              {/* Admin Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <Card className="card-glass border-0">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">
                          {userRole === "admin" ? "Issuer Users" : "Total Users"}
                        </p>
                        <p className="text-3xl font-bold text-gray-900">{users.length}</p>
                      </div>
                      
                    </div>
                  </CardContent>
                </Card>

                <Card className="card-glass border-0">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">
                          {userRole === "admin" ? "Pending Invites" : "Pending Invites"}
                        </p>
                        <p className="text-3xl font-bold text-gray-900">{invited.length}</p>
                      </div>
                      
                    </div>
                  </CardContent>
                </Card>

                <Card className="card-glass border-0">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">
                          {userRole === "admin" ? "Active Users" : "Superadmin Users"}
                        </p>
                        <p className="text-3xl font-bold text-gray-900">
                          {userRole === "admin" 
                            ? users.filter(u => !u.is_super_admin).length 
                            : superAdmins.length
                          }
                        </p>
                      </div>
                      
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Super Admin Table - Only visible to superadmins */}
              {userRole === "superadmin" && (
                <SuperAdminTable 
                  superAdmins={superAdmins} 
                  currentUserId={user.id}
                  currentUserIsOwner={currentUserIsOwner}
                />
              )}

              {/* Admin Actions */}
              <div className="card-glass p-6 mb-8">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {userRole === "admin" ? "Issuer Management" : "Administrative Actions"}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {userRole === "admin" 
                        ? "Manage users and permissions for your issuer" 
                        : "Manage system access and permissions"
                      }
                    </p>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    {userRole === "superadmin" && (
                      <Link href="/roles">
                        <Button variant="outline" className="border-white/20 bg-white/50 hover:bg-white/70">
                          <Key className="h-4 w-4 mr-2" />
                          Manage Roles
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              </div>

              {/* User Management Content */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Users Table */}
                <div className="lg:col-span-3">
                  <Card className="card-glass border-0">
                    <CardHeader>
                      <CardTitle className="text-xl font-bold text-gray-900">
                        {userRole === "admin" ? "Issuer User Management" : "User Management"}
                      </CardTitle>
                      <p className="text-sm text-gray-600">
                        {userRole === "admin" 
                          ? "Manage users and permissions for your issuer"
                          : "Manage all system users and their roles"
                        }
                      </p>
                    </CardHeader>
                    <CardContent>
                      <UsersTable 
                        users={users} 
                        invited={invited} 
                        currentUserId={user.id} 
                        currentUserRole={userRole}
                        currentUserIssuerId={currentUserIssuerId}
                        currentIssuer={currentIssuer}
                      />
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
