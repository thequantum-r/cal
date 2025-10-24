import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { getCurrentUserRole } from "@/lib/actions"
import Sidebar from "@/components/sidebar"
import Header from "@/components/header"
import RolesTable from "@/components/roles-table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Shield, Crown, Settings, Key, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"

async function getRoles() {
  const supabase = await createClient()

  const { data: roles, error } = await supabase
    .from("roles_new")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching roles:", error)
    return []
  }

  return roles || []
}

export default async function RolesPage() {
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

  if (userRole !== "superadmin" && userRole !== "admin") {
    redirect("/dashboard")
  }

  // Get roles data
  const roles = await getRoles()

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
              {/* Role Management Content */}
              <Card className="card-glass border-0">
                <CardHeader>
                  <CardTitle className="text-xl font-bold text-gray-900">Roles</CardTitle>
                </CardHeader>
                <CardContent>
                  <RolesTable roles={roles} />
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
