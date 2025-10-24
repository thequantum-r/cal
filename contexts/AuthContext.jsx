"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { validateIssuerAccess, getUserIssuers, getUserRoleForIssuer, getUserRolesForIssuer, getCurrentUserRole } from "@/lib/actions"

const AuthContext = createContext({})

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [availableIssuers, setAvailableIssuers] = useState([])
  const [currentIssuer, setCurrentIssuer] = useState(null)
  const [issuerSpecificRole, setIssuerSpecificRole] = useState(null)
  const [userRoles, setUserRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [initialized, setInitialized] = useState(false)
  const router = useRouter()

  // Initialize auth state
  useEffect(() => {
    initializeAuth()
  }, [])

  const initializeAuth = async () => {
    try {
      const supabase = createClient()
      
      // Get current session
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error || !session?.user) {
        setLoading(false)
        setInitialized(true)
        return
      }

      setUser(session.user)

      // Get user's role
      const role = await getCurrentUserRole()
      setUserRole(role)

      // Get user's available issuers
      const issuers = await getUserIssuers()
      setAvailableIssuers(issuers)

      
      // Set up auth state change listener
supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === 'SIGNED_OUT' || !session) {
    setUser(null)
    setUserRole(null)
    setAvailableIssuers([])
    setCurrentIssuer(null)
    setIssuerSpecificRole(null)
    router.push('/login')
  } else if (event === 'SIGNED_IN' && session?.user) {
    setUser(session.user)

    // Refresh role + issuers
    const newRole = await getCurrentUserRole()
    setUserRole(newRole)
    const newIssuers = await getUserIssuers()
    setAvailableIssuers(newIssuers)

    // 🔑 Redirect logic
    if (newRole === "shareholder") {
      router.push("/shareholder-home")
    } else if (newRole === "admin" || newRole === "superadmin") {
      router.push("/dashboard")
    } else {
      router.push("/") // fallback
    }
  }
})

        
     

      
    } catch (error) {
      console.error('Error initializing auth:', error)
    } finally {
      setLoading(false)
      setInitialized(true)
    }
  }

  // Validate access to specific issuer
  const validateAndSetIssuer = async (issuerId) => {
    if (!user || !issuerId) return { hasAccess: false }

    // If we already have this issuer loaded, don't reload
    if (currentIssuer && currentIssuer.issuer_id === issuerId) {
      return { hasAccess: true, issuer: currentIssuer, userRole, issuerSpecificRole }
    }

    try {
      const { hasAccess, issuer, userRole: role } = await validateIssuerAccess(issuerId)
      
      if (!hasAccess) {
        return { hasAccess: false }
      }

      setCurrentIssuer(issuer)
      setUserRole(role)

      // Get issuer-specific role
      const specificRole = await getUserRoleForIssuer(issuerId)
      setIssuerSpecificRole(specificRole)

      // Get all user roles for this issuer
      const roles = await getUserRolesForIssuer(issuerId)
      setUserRoles(roles)

      return { hasAccess: true, issuer, userRole: role, issuerSpecificRole: specificRole, userRoles: roles }
    } catch (error) {
      console.error('Error validating issuer access:', error)
      return { hasAccess: false }
    }
  }

  // Check if user has permission
  const hasPermission = (requiredRole) => {
    if (!userRole) return false
    
    const roleHierarchy = ['read_only', 'broker', 'shareholder', 'transfer_team', 'admin', 'superadmin']
    const userRoleIndex = roleHierarchy.indexOf(userRole)
    const requiredRoleIndex = roleHierarchy.indexOf(requiredRole)
    
    return userRoleIndex >= requiredRoleIndex
  }

  // Check if user is a broker
  const isBroker = () => {
    return hasPermission('broker')
  }

  // Check if user can edit
  const canEdit = () => {
    return hasPermission('transfer_team')
  }

  // Check if user is admin or higher
  const isAdmin = () => {
    return hasPermission('admin')
  }

  // Check if user is superadmin
  const isSuperAdmin = () => {
    return userRole === 'superadmin'
  }

  const value = {
    // State
    user,
    userRole,
    availableIssuers,
    currentIssuer,
    issuerSpecificRole,
    userRoles,
    loading,
    initialized,

    // Methods
    validateAndSetIssuer,
    hasPermission,
    canEdit,
    isAdmin,
    isSuperAdmin,
    isBroker,

    // Setters for manual updates if needed
    setCurrentIssuer,
    setUserRole,
    setIssuerSpecificRole,
    setUserRoles
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}