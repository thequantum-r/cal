"use client"

import { Badge } from "@/components/ui/badge"
import { User, Bell, Search, Settings, Activity, Users, Building, ArrowRightLeft, Calendar, Shield, Key, ChevronDown, Plus ,Home} from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { getRoleDisplay } from "@/lib/constants"
import { usePathname, useRouter } from "next/navigation"
import { signOut } from "@/lib/actions"

// Page configuration mapping
const pageConfig = {
  // Issuer-scoped pages
  "/issuer/[issuerId]/dashboard": {
  title: "Dashboard",
  description: "", 
  icon: Activity,
  iconBg: "from-orange-500 to-red-500"
},

  "/issuer/[issuerId]/shareholder": {
    title: "Shareholders",
    description: "Manage shareholder information and records",
    icon: Users,
    iconBg: "from-red-500 to-orange-500"
  },
  "/issuer/[issuerId]/transfer-journal": {
    title: "Transfer Journal",
    description: "Comprehensive recordkeeping for securities transactions",
    icon: ArrowRightLeft,
    iconBg: "from-yellow-500 to-orange-500"
  },
  "/issuer/[issuerId]/historical-lookup": {
    title: "Historical Lookup",
    description: "Search historical shareholder positions by date",
    icon: Calendar,
    iconBg: "from-orange-500 to-red-500"
  },
  // Universal admin pages
  "/issuers": {
    title: "Issuer Management",
    description: "Manage issuers",
    icon: Building,
    iconBg: "from-orange-500 to-red-500"
  },
  "/shareholder-home": {
  title: "Efficiency",
  //description: "Overview of your account",
  icon: Home, 
  iconBg: "from-orange-500 to-yellow-500"
},

  "/users": {
    title: "User Management",
    description: "Manage user roles and permissions",
    icon: Shield,
    iconBg: "from-red-500 to-orange-500"
  },
  "/roles": {
    title: "Role Management",
    description: "Create and manage user roles and permissions",
    icon: Key,
    iconBg: "from-orange-500 to-red-500"
  }
}

export default function Header({ user, userRole, currentIssuer, availableIssuers = [], issuerSpecificRole = null, userRoles = [] }) {
  const pathname = usePathname()
  const router = useRouter()
  
  // For superadmin users, always show "Super Admin" regardless of issuer-specific role
  const isSuperAdmin = userRole === 'superadmin'
  
  // Check if user has multiple roles for current issuer
  const currentIssuerRoles = userRoles.filter(role => role.issuer_id === currentIssuer?.issuer_id)
  const hasMultipleRoles = currentIssuerRoles.length > 1
  
  // Use issuer-specific role if available, otherwise fall back to global role
  const displayRole = isSuperAdmin ? 'superadmin' : (issuerSpecificRole || userRole)
  const { color, label, Icon } = getRoleDisplay(displayRole)
  
  // Check if current path is issuer-scoped
  const isIssuerScoped = pathname.startsWith('/issuer/')
  const hasMultipleIssuers = availableIssuers.length > 1
  
  // Get current page configuration - handle dynamic routes
  let pageKey = pathname
  if (pathname.includes('/issuer/')) {
    // Convert dynamic route to template for lookup
    pageKey = pathname.replace(/\/issuer\/[^\/]+/, '/issuer/[issuerId]')
  }
  
  const currentPage = pageConfig[pageKey] || {
  title: "Dashboard", 
  description: "", // removed "Welcome back"
  icon: Activity,
  iconBg: "from-orange-500 to-red-500"
}


  // Handle issuer switching
  const handleIssuerSwitch = (issuerId) => {
    const currentPath = pathname.split('/').slice(3).join('/') || 'dashboard' // Get path after /issuer/[id]/
    router.push(`/issuer/${issuerId}/${currentPath}`)
  }
  
  const PageIcon = currentPage.icon

  return (
    <header className="bg-white/80 backdrop-blur-xl shadow-lg border-b border-white/20">
      <div className="flex items-center justify-between px-4 sm:px-6 py-4">
        <div className="flex items-center space-x-4 sm:space-x-6">
          {/* Mobile menu button - only show on small screens */}
          <div className="lg:hidden">
            <Button
              variant="ghost"
              size="sm"
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100/50 rounded-xl"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </Button>
          </div>
          
          {/* Page title and description */}
<div className="flex items-center space-x-3 sm:space-x-4">
  {pathname === "/shareholder-home" || (userRole === "broker" && pathname.startsWith("/information")) ? (
    // Shareholder Home & Broker Information Header (custom logo)
    <div className="flex items-center">
      <img
        src="/efficiency_logo.svg" // Your combined logo
        alt="Company Logo"
        className="w-28 h-auto sm:w-36 object-contain" // Larger logo
      />
    </div>
  ) : (
    // Default Header Layout
    <>
      <div
        className={`w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-r ${currentPage.iconBg} rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg`}
      >
        <PageIcon className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
      </div>

      <div className="hidden sm:block">
        <h2 className="text-lg sm:text-xl font-bold text-gray-900">
          {currentPage.title}
        </h2>
        <p className="text-xs sm:text-sm text-gray-600">
          {currentPage.description}
        </p>
      </div>

      {/* Mobile title */}
      <div className="sm:hidden">
        <h2 className="text-base font-bold text-gray-900">{currentPage.title}</h2>
      </div>
    </>
  )}
</div>

        </div>
        
        {/* Issuer Switcher - only show for issuer-scoped pages */}
        {isIssuerScoped && currentIssuer && (
          <div className="flex items-center">
            {hasMultipleIssuers ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center space-x-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100/50 rounded-xl px-3 py-2">
                    <Building className="h-4 w-4" />
                    <span className="hidden sm:inline">{currentIssuer.issuer_display_name || currentIssuer.issuer_name}</span>
                    <span className="sm:hidden">{(currentIssuer.issuer_display_name || currentIssuer.issuer_name).split(' ')[0]}</span>
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-56">
                  {availableIssuers.map((issuer) => (
                    <DropdownMenuItem
                      key={issuer.issuer_id}
                      onClick={() => handleIssuerSwitch(issuer.issuer_id)}
                      className={`flex items-center space-x-2 ${
                        issuer.issuer_id === currentIssuer.issuer_id ? 'bg-orange-50 text-orange-700' : ''
                      }`}
                    >
                      <Building className="h-4 w-4" />
                      <span>{issuer.issuer_display_name || issuer.issuer_name}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              // Single issuer - just show name without dropdown
              <div className="flex items-center space-x-2 text-sm font-medium text-gray-700 px-3 py-2">
                <Building className="h-4 w-4" />
                <span className="hidden sm:inline">{currentIssuer.issuer_display_name || currentIssuer.issuer_name}</span>
                <span className="sm:hidden">{(currentIssuer.issuer_display_name || currentIssuer.issuer_name).split(' ')[0]}</span>
              </div>
            )}
          </div>
        )}
        
        <div className="flex items-center space-x-2 sm:space-x-4">
          {/* User profile */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Role badge with dropdown for multiple roles */}
            {pathname === "/shareholder-home" || (userRole === "broker" && pathname.startsWith("/information")) ? (
  // Show user name for shareholder-home and broker on information pages
  <Badge className="bg-orange-100 text-orange-700 text-xs font-semibold px-3 sm:px-4 py-1 rounded-full shadow-sm">
    {user?.user_metadata?.full_name || user?.email?.split("@")[0]}
  </Badge>
) : hasMultipleRoles ? (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button
        variant="ghost"
        className={`${color} text-xs font-semibold px-2 sm:px-3 py-1 rounded-full shadow-sm flex items-center space-x-1 hover:opacity-80`}
      >
        <Icon className="h-3 w-3" />
        <span className="hidden sm:inline">{label}</span>
        <span className="sm:hidden">{label.split(" ")[0]}</span>
        <Plus className="h-3 w-3 ml-1" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-56">
      <div className="px-3 py-2">
        <p className="text-xs font-medium text-gray-500">Your Roles</p>
      </div>
      {currentIssuerRoles.map((role, index) => {
        const roleDisplay = getRoleDisplay(role.roles.name)
        return (
          <DropdownMenuItem
            key={index}
            className="flex items-center space-x-2 px-3 py-2"
          >
            <roleDisplay.Icon className="h-3 w-3" />
            <span className="text-sm">{roleDisplay.label}</span>
          </DropdownMenuItem>
        )
      })}
    </DropdownMenuContent>
  </DropdownMenu>
) : (
  <Badge
    className={`${color} text-xs font-semibold px-2 sm:px-3 py-1 rounded-full shadow-sm flex items-center space-x-1`}
  >
    <Icon className="h-3 w-3" />
    <span className="hidden sm:inline">{label}</span>
    <span className="sm:hidden">{label.split(" ")[0]}</span>
  </Badge>
)}

            
            {/* Profile dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="p-0 h-auto">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-r from-orange-400 to-red-500 rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg hover:opacity-80 transition-opacity overflow-hidden">
                    {user?.user_metadata?.avatar_url ? (
                      <img 
                        src={user.user_metadata.avatar_url} 
                        alt="Profile" 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <User className="h-4 w-4 sm:h-5 sm:w-5 text-white" style={{ display: user?.user_metadata?.avatar_url ? 'none' : 'flex' }} />
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <div className="px-3 py-3 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-900">{user?.email?.split('@')[0]}</p>
                  <p className="text-xs text-gray-500">{user?.email}</p>
                </div>
                <div className="py-2">
                  <DropdownMenuItem 
                    className="flex items-center space-x-2 px-3 py-2 text-red-600 hover:text-red-700"
                    onClick={async () => {
                      try {
                        await signOut()
                        router.push('/auth/login')
                      } catch (error) {
                        console.error('Sign out error:', error)
                      }
                    }}
                  >
                    <Key className="h-4 w-4" />
                    <span>Sign Out</span>
                  </DropdownMenuItem>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  )
}
