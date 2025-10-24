"use client"

import { useState, useEffect } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Building, ChevronDown, Plus } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

export default function SidebarIssuerSelector({ userRole, currentIssuerId }) {
  const [userIssuers, setUserIssuers] = useState([])
  const [selectedIssuerId, setSelectedIssuerId] = useState(currentIssuerId)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  // Get issuer from URL on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      const issuerFromUrl = urlParams.get('issuer')
      if (issuerFromUrl && issuerFromUrl !== selectedIssuerId) {
        setSelectedIssuerId(issuerFromUrl)
      }
    }
  }, [])

  useEffect(() => {
    const fetchUserIssuers = async () => {
      const supabase = createClient()
      
      try {
        let issuerUsers = []
        
        if (userRole === 'superadmin') {
          // Superadmins can access all issuers
          const { data, error } = await supabase
            .from("issuers_new")
            .select(`
              id,
              issuer_name,
              display_name,
              description
            `)
            .order("display_name")

          if (error) {
            console.error("Error fetching all issuers for superadmin:", error)
          } else if (data) {
            // For superadmin, all issuers are available, mark the current one as primary
            issuerUsers = data.map(issuer => ({
              issuer_id: issuer.id,
              is_primary: issuer.id === currentIssuerId,
              issuers: issuer
            }))
          }
        } else {
          // Regular users: fetch their specific issuer memberships
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) {
            setLoading(false)
            return
          }

          const { data, error } = await supabase
            .from("issuer_users_new")
            .select(`
              issuer_id,
              is_primary,
              issuers (
                id,
                name,
                display_name,
                description
              )
            `)
            .eq("user_id", user.id)
            .order("is_primary", { ascending: false })
            .order("created_at")

          if (error) {
            console.error("Error fetching user issuers:", error)
          } else {
            issuerUsers = data || []
          }
        }

        if (issuerUsers && issuerUsers.length > 0) {
          const issuers = issuerUsers.map(iu => iu.issuers).filter(Boolean)
          setUserIssuers(issuers)
          
          // Set the primary issuer as default if not already set
          if (!selectedIssuerId && issuers.length > 0) {
            const primaryIssuer = issuerUsers.find(iu => iu.is_primary)
            const defaultIssuerId = primaryIssuer?.issuer_id || issuers[0].id
            setSelectedIssuerId(defaultIssuerId)
          }
        }
      } catch (error) {
        console.error("Error in fetchUserIssuers:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchUserIssuers()
  }, [userRole, currentIssuerId, selectedIssuerId])

  const handleIssuerChange = (issuerId) => {
    setSelectedIssuerId(issuerId)
    // Store the selected issuer in localStorage for persistence
    localStorage.setItem('selectedIssuerId', issuerId)
    
    // Navigate to current page with issuer parameter
    const currentPath = window.location.pathname
    const currentSearch = new URLSearchParams(window.location.search)
    currentSearch.set('issuer', issuerId)
    
    const newUrl = `${currentPath}?${currentSearch.toString()}`
    router.push(newUrl)
    router.refresh()
  }

  // Don't show issuer selector if user has no issuers (after loading)
  if (!loading && userIssuers.length === 0 && userRole !== 'superadmin') {
    return null
  }

  // Show loading state
  if (loading) {
    return (
      <div className="p-4 bg-white/30 rounded-xl border border-white/20">
        <div className="flex items-center space-x-3">
          <Building className="h-5 w-5 text-gray-400 animate-pulse" />
          <div className="flex-1">
            <div className="h-4 bg-gray-200 rounded animate-pulse mb-1"></div>
            <div className="h-3 bg-gray-200 rounded animate-pulse w-2/3"></div>
          </div>
        </div>
      </div>
    )
  }

  // Show "No issuers available" if user has no issuers
  if (userIssuers.length === 0) {
    return (
      <div className="p-4 bg-white/30 rounded-xl border border-white/20">
        <div className="flex items-center space-x-3">
          <Building className="h-5 w-5 text-gray-400" />
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-600">No issuers</p>
            <p className="text-xs text-gray-500">Contact your administrator</p>
          </div>
        </div>
      </div>
    )
  }

  // Show single issuer without dropdown
  if (userIssuers.length === 1) {
    return (
      <div className="p-4 bg-white/40 rounded-xl border border-white/30 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-red-500 rounded-lg flex items-center justify-center">
            <Building className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">
              {userIssuers[0].display_name}
            </p>
            {userIssuers[0].description && (
              <p className="text-xs text-gray-500 truncate">
                {userIssuers[0].description}
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Show dropdown for multiple issuers
  return (
    <div className="p-4 bg-white/40 rounded-xl border border-white/30 shadow-sm">
      <div className="flex items-center space-x-3 mb-3">
        <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-red-500 rounded-lg flex items-center justify-center">
          <Building className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900">Issuer</p>
        </div>
      </div>
      
      <Select value={selectedIssuerId} onValueChange={handleIssuerChange}>
        <SelectTrigger className="w-full bg-white/60 border-white/30 hover:bg-white/80 text-sm">
          <SelectValue placeholder="Select issuer" />
        </SelectTrigger>
        <SelectContent className="bg-white/95 backdrop-blur-xl border border-white/30 shadow-2xl">
          {userIssuers.map((issuer) => (
            <SelectItem key={issuer.id} value={issuer.id}>
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 bg-gradient-to-r from-orange-500 to-red-500 rounded flex items-center justify-center">
                  <Building className="h-3 w-3 text-white" />
                </div>
                <div className="flex flex-col">
                  <span className="font-medium text-sm">{issuer.display_name}</span>
                  {issuer.description && (
                    <span className="text-xs text-gray-500">{issuer.description}</span>
                  )}
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}


























