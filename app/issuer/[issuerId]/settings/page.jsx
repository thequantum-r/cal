"use client"

import { useAuth } from "@/contexts/AuthContext"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import Sidebar from "@/components/sidebar"
import Header from "@/components/header"
import IssuerDetailsEditor from "@/components/issuer-details-editor"

export default function IssuerSettingsPage({ params: paramsPromise }) {
  const { user, userRole, userRoles, currentIssuer, availableIssuers, issuerSpecificRole, loading, initialized, validateAndSetIssuer } = useAuth()
  const router = useRouter()
  const [issuerId, setIssuerId] = useState(null)
  const [pageLoading, setPageLoading] = useState(true)

  useEffect(() => {
    const getParams = async () => {
      const params = await paramsPromise
      setIssuerId(params.issuerId)
    }
    getParams()
  }, [paramsPromise])

  const checkAuthAndFetchData = async () => {
    try {
      if (!user) {
        router.push('/login')
        return
      }

      const { hasAccess } = await validateAndSetIssuer(issuerId)
      
      if (!hasAccess) {
        router.push('/?error=no_access')
        return
      }

      setPageLoading(false)
    } catch (error) {
      console.error('Error in auth check:', error)
      setPageLoading(false)
    }
  }

  useEffect(() => {
    if (!initialized || !issuerId) return
    checkAuthAndFetchData()
  }, [initialized, issuerId, user, validateAndSetIssuer])

  const handleSave = (updatedIssuer) => {
    // Optionally refresh auth context or redirect
    console.log('Issuer updated:', updatedIssuer)
  }

  if (loading || !initialized || pageLoading) {
    return (
      <div className="flex min-h-screen">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p>Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-orange-50 via-red-50 to-yellow-50">
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
          <div className="p-8">
            <IssuerDetailsEditor 
              issuerId={issuerId}
              onSave={handleSave}
            />
          </div>
        </main>
      </div>
    </div>
  )
}