import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { getCurrentUserRole, getPendingInvitations, getIssuerStatistics } from "@/lib/actions"
import Sidebar from "@/components/sidebar"
import Header from "@/components/header"
import IssuersTable from "@/components/issuers-table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Building, Plus, Users, Shield, Activity, Mail, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import ImportDataBox from "@/components/ImportDataBox";
// Force revalidation of this page
export const revalidate = 0

async function getIssuersData() {
  const supabase = await createClient()

  // Get all issuers with user counts and latest data
  const { data: issuers, error: issuersError } = await supabase
    .from("issuers_new")
    .select(`
      *,
      issuer_users_new (
        id,
        user_id
      )
    `)
    .order("display_name")

  if (issuersError) {
    console.error("Error fetching issuers:", issuersError)
  }

  // Get total user counts per issuer (no primary concept)
  const issuersWithCounts = issuers?.map(issuer => ({
    ...issuer,
    user_count: issuer.issuer_users_new?.length || 0,
    primary_users: 0 // Remove primary concept entirely
  })) || []

  return {
    issuers: issuersWithCounts,
  }
}

export default async function IssuersPage({ searchParams }) {
  const supabase = await createClient()

  // Check authentication
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect("/login")
  }

  const userRole = await getCurrentUserRole()
  
  // Only super admins can access this page
  if (userRole !== "superadmin") {
    redirect("/dashboard")
  }

  const [issuersData, pendingInvitations, statistics] = await Promise.all([
    getIssuersData(),
    getPendingInvitations(),
    getIssuerStatistics()
  ])

  const { issuers } = issuersData

  // Show all issuers (no status filtering needed)
  const allIssuers = issuers

  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-50 via-white to-orange-50">
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
        
        <main className="flex-1 overflow-auto">
          <div className="p-8 space-y-8">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="card-glass">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Issuers</p>
                      <p className="text-2xl font-bold text-gray-900">{statistics.total_companies}</p>
                    </div>
                    <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
                      <Building className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="card-glass">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Active Issuers</p>
                      <p className="text-2xl font-bold text-green-600">{statistics.active_companies}</p>
                    </div>
                    <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center">
                      <Activity className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="card-glass">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Pending Invites</p>
                      <p className="text-2xl font-bold text-yellow-600">{statistics.pending_invites}</p>
                    </div>
                    <div className="w-12 h-12 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-xl flex items-center justify-center">
                      <Mail className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>


                      {/* Main Content */}
            <div className="space-y-6">
              <IssuersTable issuers={allIssuers} userRole={userRole} />
              <ImportDataBox />
            </div>


            {/* Pending Invitations Section */}
            <Card className="card-glass">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <Clock className="h-5 w-5 mr-2 text-orange-500" />
                    Pending Issuer Invitations
                  </h3>
                </div>
                
                {pendingInvitations.length === 0 ? (
                  <div className="text-center py-8">
                    <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 font-medium">No pending invites</p>
                    <p className="text-sm text-gray-500">All issuer admins have been invited</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pendingInvitations.map((invite) => (
                      <div key={invite.email} className="p-4 border border-gray-200 rounded-lg bg-white/30 hover:bg-white/40 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-red-500 rounded-lg flex items-center justify-center">
                              <Building className="h-5 w-5 text-white" />
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900">
                                {invite.issuer_display_name || "Unknown Issuer"}
                              </div>
                              <div className="text-sm text-gray-600">
                                {invite.name || "Issuer Admin"} • {invite.email}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-gray-500">
                              Invited {invite.invited_at ? new Date(invite.invited_at).toLocaleDateString() : "Recently"}
                            </div>
                            <div className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full mt-1">
                              Pending
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  )
}
