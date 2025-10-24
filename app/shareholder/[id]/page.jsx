"use client"

import { useParams, useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { useEffect, useState } from "react"
import { getShareholderData } from "../page" 
import ShareholderDashboard from "@/components/ShareholderDashboard"

export default function ShareholderAdminPage() {
  const { id } = useParams()
  const { userRole, loading, initialized } = useAuth()
  const router = useRouter()
  const [shareholderData, setShareholderData] = useState(null)
  const [pageLoading, setPageLoading] = useState(true)

  useEffect(() => {
    if (!initialized || loading) return

    // ✅ allow only admins / superadmins
    if (userRole !== "admin" && userRole !== "superadmin") {
      router.push("/login")
      return
    }

    const fetchData = async () => {
      const data = await getShareholderData({ shareholderId: id })
      setShareholderData(data)
      setPageLoading(false)
    }

    fetchData()
  }, [initialized, loading, userRole, id, router])

  if (pageLoading) {
    return (
      <div className="flex h-screen bg-gradient-to-br from-orange-50 via-red-50 to-yellow-50">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading Shareholder Data...</p>
          </div>
        </div>
      </div>
    )
  }

  // ✅ render dashboard (no signOut here)
  return (
    <ShareholderDashboard
      shareholderData={shareholderData}
      userRole={userRole}
    />
  )
}
