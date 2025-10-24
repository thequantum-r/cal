"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus, User, Mail } from "lucide-react"
import { toast } from "sonner"

export default function UserInvitationModal({ issuerId, issuerName }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [roles, setRoles] = useState([])
  const [formData, setFormData] = useState({
    email: "",
    name: "",
    role_id: ""
  })

  const supabase = createClient()

  useEffect(() => {
    if (open) {
      fetchRoles()
    }
  }, [open])

  async function fetchRoles() {
    try {
      const { data, error } = await supabase
        .from("roles_new")
        .select("id, role_name, display_name")
        .in("role_name", ["admin", "transfer_team", "read_only"])
        .order("display_name")

      if (error) {
        console.error("Error fetching roles:", error)
        return
      }

      setRoles(data || [])
    } catch (error) {
      console.error("Error in fetchRoles:", error)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Validate form data
      if (!formData.email || !formData.name || !formData.role_id) {
        toast.error("Please fill in all required fields")
        return
      }

      // Create invitation for user
      const { error: inviteError } = await supabase
        .from("invited_users_new")
        .insert({
          email: formData.email,
          name: formData.name,
          role_id: formData.role_id,
          issuer_id: issuerId
        })

      if (inviteError) {
        if (inviteError.code === '23505') {
          throw new Error(`An invitation for ${formData.email} already exists. Please use a different email address.`)
        }
        throw inviteError
      }
      
      toast.success("User invited successfully!")
      setOpen(false)
      setFormData({
        email: "",
        name: "",
        role_id: ""
      })
      
      // Refresh the page to show the new invitation
      window.location.reload()
    } catch (error) {
      console.error("Error inviting user:", error)
      toast.error(error.message || "Failed to invite user")
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white">
          <Plus className="h-4 w-4 mr-2" />
          Invite User
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <User className="h-5 w-5 text-orange-500" />
            <span>Invite User to {issuerName}</span>
          </DialogTitle>
          <DialogDescription>
            Invite a user to join this issuer. They will receive an invitation to access the platform.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name *</Label>
            <Input
              id="name"
              placeholder="e.g., John Doe"
              value={formData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="email">Email Address *</Label>
            <Input
              id="email"
              type="email"
              placeholder="e.g., john@issuer.com"
              value={formData.email}
              onChange={(e) => handleInputChange("email", e.target.value)}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="role">Role *</Label>
            <Select
              value={formData.role_id}
              onValueChange={(value) => handleInputChange("role_id", value)}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select user role" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
              disabled={loading}
            >
              {loading ? "Inviting..." : "Send Invitation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
