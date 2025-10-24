"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { ChevronDown, Building, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"

export default function IssuerToggle({ currentIssuerId, onIssuerChange }) {
  const [issuers, setIssuers] = useState([])
  const [currentIssuer, setCurrentIssuer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    fetchUserIssuers()
  }, [])

  useEffect(() => {
    if (currentIssuerId && issuers.length > 0) {
      const issuer = issuers.find(i => i.issuer_id === currentIssuerId)
      setCurrentIssuer(issuer || issuers[0])
    } else if (issuers.length > 0) {
      setCurrentIssuer(issuers[0])
    }
  }, [currentIssuerId, issuers])

  async function fetchUserIssuers() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from("issuers_new")
        .select(`
          id,
          issuer_name,
          display_name,
          issuer_users_new!inner (
            role_id,
            roles_new (
              name,
              display_name
            )
          )
        `)
        .eq("issuer_users.user_id", user.id)
        .order("display_name")

      if (error) {
        console.error("Error fetching user issuers:", error)
        return
      }

      const formattedIssuers = data.map(issuer => ({
        issuer_id: issuer.id,
        issuer_name: issuer.name,
        issuer_display_name: issuer.display_name,
        role_name: issuer.issuer_users[0]?.roles?.name || 'read_only'
      }))

      setIssuers(formattedIssuers)
    } catch (error) {
      console.error("Error in fetchUserIssuers:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleIssuerSelect = (issuer) => {
    setCurrentIssuer(issuer)
    setOpen(false)
    if (onIssuerChange) {
      onIssuerChange(issuer)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center space-x-2 px-3 py-2 bg-white/50 rounded-lg">
        <div className="w-4 h-4 bg-gray-300 rounded animate-pulse"></div>
        <div className="w-24 h-4 bg-gray-300 rounded animate-pulse"></div>
      </div>
    )
  }

  if (issuers.length === 0) {
    return (
      <div className="flex items-center space-x-2 px-3 py-2 bg-white/50 rounded-lg">
        <Building className="h-4 w-4 text-gray-500" />
        <span className="text-sm text-gray-500">No issuers</span>
      </div>
    )
  }

  if (issuers.length === 1) {
    const issuer = issuers[0]
    return (
      <div className="flex items-center space-x-2 px-3 py-2 bg-white/50 rounded-lg">
        <Building className="h-4 w-4 text-orange-500" />
        <span className="text-sm font-medium text-gray-900">{issuer.issuer_display_name}</span>
        <Badge variant="secondary" className="text-xs">
          {issuer.role_name}
        </Badge>
      </div>
    )
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex items-center space-x-2 px-3 py-2 bg-white/50 hover:bg-white/70 rounded-lg"
        >
          <Building className="h-4 w-4 text-orange-500" />
          <span className="text-sm font-medium text-gray-900">
            {currentIssuer?.issuer_display_name || "Select Issuer"}
          </span>
          <ChevronDown className="h-4 w-4 text-gray-500" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <div className="px-2 py-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
          Issuers
        </div>
        {issuers.map((issuer) => (
          <DropdownMenuItem
            key={issuer.issuer_id}
            onClick={() => handleIssuerSelect(issuer)}
            className="flex items-center justify-between px-3 py-2 cursor-pointer"
          >
            <div className="flex items-center space-x-3">
              <Building className="h-4 w-4 text-orange-500" />
              <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-900">
                  {issuer.issuer_display_name}
                </span>
                <span className="text-xs text-gray-500">
                  {issuer.issuer_name}
                </span>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="secondary" className="text-xs">
                {issuer.role_name}
              </Badge>
              {currentIssuer?.issuer_id === issuer.issuer_id && (
                <Check className="h-4 w-4 text-green-500" />
              )}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
