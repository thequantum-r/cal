import Link from "next/link"
import { Users, ArrowRightLeft, Calendar, Settings, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

const getLinks = (issuerId) => [
  {
    name: "Shareholder",
    description: "Manage shareholder information and records",
    href: `/issuer/${issuerId}/shareholder`,
    icon: Users,
    gradient: "from-red-400 to-orange-500",
    hoverGradient: "from-red-500 to-orange-600",
  },
  {
    name: "Transfer Journal",
    description: "Track and manage share transfers",
    href: `/issuer/${issuerId}/transfer-journal`,
    icon: ArrowRightLeft,
    gradient: "from-orange-400 to-yellow-500",
    hoverGradient: "from-orange-500 to-yellow-600",
  },
  {
    name: "Historical Lookup",
    description: "Search historical shareholder data",
    href: `/issuer/${issuerId}/historical-lookup`,
    icon: Calendar,
    gradient: "from-yellow-400 to-orange-500",
    hoverGradient: "from-yellow-500 to-orange-600",
  },
]

const getAdminLinks = (issuerId) => [
  {
    name: "User Management",
    description: "Manage user roles and permissions",
    href: `/issuer/${issuerId}/users`,
    icon: Settings,
    gradient: "from-red-500 to-orange-600",
    hoverGradient: "from-red-600 to-orange-700",
  },
]

export default function QuickLinks({ userRole, issuerId }) {
  const links = getLinks(issuerId)
  const adminLinks = getAdminLinks(issuerId)
  const allLinks = userRole === "admin" ? [...links, ...adminLinks] : links

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
        {allLinks.map((link) => (
          <Link key={link.name} href={link.href}>
            <div className="group relative overflow-hidden rounded-2xl bg-white/50 backdrop-blur-sm border border-white/20 hover:bg-white/70 transition-all duration-300 transform hover:scale-105 hover:shadow-xl">
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className={`w-10 h-10 bg-gradient-to-r ${link.gradient} rounded-xl flex items-center justify-center group-hover:bg-gradient-to-r ${link.hoverGradient} transition-all duration-300`}>
                        <link.icon className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 group-hover:text-gray-800 transition-colors">
                          {link.name}
                        </h3>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 group-hover:text-gray-700 transition-colors">
                      {link.description}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-gray-600 transition-colors transform group-hover:translate-x-1" />
                </div>
              </div>
              
              {/* Hover effect overlay */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </div>
          </Link>
        ))}
      </div>
      
      {/* Additional quick actions */}
      {/* <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-gradient-to-r from-orange-100/50 to-red-100/50 rounded-xl border border-white/20">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-r from-orange-400 to-red-500 rounded-lg flex items-center justify-center">
              <Users className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Add Shareholder</p>
              <p className="text-xs text-gray-600">Create new record</p>
            </div>
          </div>
        </div>
        
        <div className="p-4 bg-gradient-to-r from-red-100/50 to-orange-100/50 rounded-xl border border-white/20">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-r from-red-400 to-orange-500 rounded-lg flex items-center justify-center">
              <ArrowRightLeft className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">New Transfer</p>
              <p className="text-xs text-gray-600">Process transfer</p>
            </div>
          </div>
        </div>
        
        <div className="p-4 bg-gradient-to-r from-yellow-100/50 to-orange-100/50 rounded-xl border border-white/20">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-lg flex items-center justify-center">
              <Calendar className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Generate Report</p>
              <p className="text-xs text-gray-600">Export data</p>
            </div>
          </div>
        </div>
      </div> */}
    </div>
  )
}
