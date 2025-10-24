"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"

export default function ProtectedRoute({ children, requireIssuer = false, issuerId = null }) {
  const { user, loading: authLoading, validateAndSetIssuer, initialized } = useAuth()
  const [loading, setLoading] = useState(true)
  const [hasAccess, setHasAccess] = useState(false)
  const router = useRouter()

  useEffect(() => {
    checkAccess()
  }, [user, initialized, issuerId])

  const checkAccess = async () => {
    if (!initialized) return

    // If no user and auth is loaded, redirect to login
    if (!user && !authLoading) {
      router.push('/login')
      return
    }

    // If we have a user but need issuer validation
    if (user && requireIssuer && issuerId) {
      try {
        const { hasAccess: issuerAccess } = await validateAndSetIssuer(issuerId)
        if (!issuerAccess) {
          router.push('/?error=no_access')
          return
        }
        setHasAccess(true)
      } catch (error) {
        console.error('Error validating issuer access:', error)
        router.push('/?error=access_error')
        return
      }
    } else if (user) {
      setHasAccess(true)
    }

    setLoading(false)
  }

  if (loading || authLoading || !initialized) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-orange-50 via-red-50 to-yellow-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user || (requireIssuer && !hasAccess)) {
    return null // Will redirect in useEffect
  }

  return children
}