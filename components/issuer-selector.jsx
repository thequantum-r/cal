"use client"

import { useState, useEffect } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Building } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

export default function IssuerSelector({ currentIssuer, onIssuerChange }) {
  const [userIssuers, setUserIssuers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchUserIssuers = async () => {
      const supabase = createClient()
      try {
        const { data: issuerUsers, error } = await supabase
          .from("issuer_users_new")
          .select(`
            issuer_id,
            is_primary,
            issuers_new (
              id,
              issuer_name,
              display_name,
              description
            )
          `)
          .order("is_primary", { ascending: false })
          .order("created_at")

        if (error) {
          console.error("Error fetching user issuers:", error)
        } else if (issuerUsers && issuerUsers.length > 0) {
          const issuers = issuerUsers.map(iu => iu.issuers_new).filter(Boolean)
          setUserIssuers(issuers)
        }
      } catch (error) {
        console.error("Error in fetchUserIssuers:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchUserIssuers()
  }, [])

  const handleIssuerChange = (issuerId) => {
    if (onIssuerChange) {
      onIssuerChange(issuerId)
    }
    // Store the selected issuer in localStorage for persistence
    localStorage.setItem('selectedIssuerId', issuerId)
  }

  // Don't show if user has no issuers or only one issuer
  if (loading || userIssuers.length <= 1) {
    return null
  }

  return (
    <div className="flex items-center space-x-2">
      <Building className="h-4 w-4 text-gray-500" />
      <Select value={currentIssuer} onValueChange={handleIssuerChange}>
        <SelectTrigger className="w-48 bg-white/60 border-white/30 hover:bg-white/80 text-sm">
          <SelectValue placeholder="Select workspace" />
        </SelectTrigger>
        <SelectContent className="bg-white/95 backdrop-blur-xl border border-white/30 shadow-2xl">
          {userIssuers.map((issuer) => (
            <SelectItem key={issuer.id} value={issuer.id}>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-gradient-to-r from-orange-500 to-red-500 rounded flex items-center justify-center">
                  <Building className="h-2 w-2 text-white" />
                </div>
                <span className="font-medium text-sm">{issuer.display_name}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

