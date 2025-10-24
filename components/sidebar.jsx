"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  Users,
  ArrowRightLeft,
  Calendar,
  Settings,
  LogOut,
  Menu,
  X,
  TrendingUp,
  Shield,
  Key,
  Building,
  FileText,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/actions";

// Issuer-scoped navigation (requires issuer context)
const getIssuerNavigation = (issuerId, userRole, issuerSpecificRole = "") => {
  const infoScreenItem = {
    name: "Records Management",
    href: "/information",
    icon: LayoutDashboard, // change icon if you like
    color: "from-blue-400 to-indigo-500",
  };

  // 🔹 Brokers only get Information Screen
  if (userRole === "broker") {
    return [infoScreenItem];
  }

  const baseNavigation = [
    {
      name: "Dashboard",
      href: `/issuer/${issuerId}/dashboard`,
      icon: LayoutDashboard,
      color: "from-orange-400 to-red-500",
    },
    {
      name: "RecordKeeping Book",
      href: `/issuer/${issuerId}/record-keeping`,
      icon: TrendingUp,
      color: "from-orange-400 to-red-500",
    },
    {
      name: "Control Book",
      href: `/issuer/${issuerId}/control-book`,
      icon: Shield,
      color: "from-orange-400 to-red-500",
    },
    {
      name: "Shareholders",
      href: `/issuer/${issuerId}/shareholder`,
      icon: Users,
      color: "from-orange-400 to-red-500",
    },
    {
      name: "Transfer Journal",
      href: `/issuer/${issuerId}/transfer-journal`,
      icon: ArrowRightLeft,
      color: "from-orange-400 to-red-500",
    },
    {
      name: "Transaction Processing",
      href: `/issuer/${issuerId}/transaction-processing`,
      icon: Zap,
      color: "from-orange-400 to-red-500",
    },
    {
      name: "Restrictions",
      href: `/issuer/${issuerId}/restrictions`,
      icon: Shield,
      color: "from-orange-400 to-red-500",
    },
    {
      name: "Statement Generation",
      href: `/issuer/${issuerId}/statements`,
      icon: FileText,
      color: "from-orange-400 to-red-500",
    },
    {
      name: "Issuer Profile",
      href: `/issuer/${issuerId}/settings`,
      icon: Building,
      color: "from-orange-400 to-red-500",
    },
  ];

  // Add user management for issuer admins
  const roleToCheck = issuerSpecificRole || userRole;
  if (roleToCheck === "admin") {
    baseNavigation.push({
      name: "User Management",
      href: `/issuer/${issuerId}/users`,
      icon: Settings,
      color: "from-orange-400 to-red-500",
    });
  }

  // 🔹 Add Information Screen for superadmin + admin
  if (userRole === "superadmin" || userRole === "admin") {
    baseNavigation.push(infoScreenItem);
  }

  return baseNavigation;
};

// Universal admin navigation (not issuer-scoped)
const universalAdminNavigation = [
  {
    name: "Issuer Management",
    href: "/issuers",
    icon: Building,
    color: "from-orange-500 to-red-500",
  },
  {
    name: "User Management",
    href: "/users",
    icon: Settings,
    color: "from-red-500 to-orange-600",
  },
  {
    name: "Role Management",
    href: "/roles",
    icon: Key,
    color: "from-orange-500 to-red-500",
  },
];

export default function Sidebar({
  userRole,
  currentIssuerId,
  issuerSpecificRole,
}) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { currentIssuer } = useAuth();

  // Build navigation based on user role and context
  let issuerScopedNavigation = [];
  let universalNavigation = [];

  // For superadmins, always show both issuer-scoped and universal navigation
  if (userRole === "superadmin") {
    // Always show universal admin navigation for superadmins
    universalNavigation = universalAdminNavigation;
    
    // For superadmins, always show issuer-scoped navigation (even on universal pages)
    // Use currentIssuerId prop, fallback to currentIssuer from AuthContext
    const effectiveIssuerId = currentIssuerId || currentIssuer?.issuer_id;
    
    if (effectiveIssuerId) {
      issuerScopedNavigation = getIssuerNavigation(
        effectiveIssuerId,
        userRole,
        issuerSpecificRole,
      );
    }
    // If no current issuer is available, don't show issuer navigation
    // User should select an issuer from the header issuer switcher
  } else {
    // For non-superadmins, only show issuer-scoped navigation if we have an issuer context
    // Use currentIssuerId prop, fallback to currentIssuer from AuthContext
    const effectiveIssuerId = currentIssuerId || currentIssuer?.issuer_id;
    
    if (effectiveIssuerId) {
      issuerScopedNavigation = getIssuerNavigation(
        effectiveIssuerId,
        userRole,
        issuerSpecificRole,
      );
    }
  }

  const allNavigation = [...issuerScopedNavigation, ...universalNavigation];

  const NavLinks = () => (
    <div className="space-y-3">
      {/* Issuer-scoped navigation */}
      {issuerScopedNavigation.length > 0 && (
        <div className="space-y-3">
          {issuerScopedNavigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`group relative flex items-center px-4 py-4 text-sm font-medium rounded-2xl transition-all duration-300 transform hover:scale-105 ${
                  isActive
                    ? `bg-gradient-to-r ${item.color} text-white shadow-xl`
                    : "text-gray-700 hover:bg-white/50 hover:text-gray-900 backdrop-blur-sm"
                }`}
              >
                {isActive && (
                  <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-2xl"></div>
                )}
                <div
                  className={`relative z-10 flex items-center w-full ${isActive ? "text-white" : "text-gray-600 group-hover:text-gray-900"}`}
                >
                  <item.icon
                    className={`mr-4 h-5 w-5 flex-shrink-0 transition-all duration-300 ${
                      isActive
                        ? "text-white"
                        : "text-gray-500 group-hover:text-gray-700"
                    }`}
                  />
                  <span className="font-semibold">{item.name}</span>
                  {isActive && (
                    <div className="ml-auto w-2 h-2 bg-white rounded-full animate-pulse"></div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Separator and Universal admin navigation */}
      {universalNavigation.length > 0 && (
        <>
          {issuerScopedNavigation.length > 0 && (
            <div className="my-6">
              <div className="border-t border-white/30"></div>
              <div className="mt-4 mb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-4">
                  System Administration
                </p>
              </div>
            </div>
          )}
          <div className="space-y-3">
            {universalNavigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`group relative flex items-center px-4 py-4 text-sm font-medium rounded-2xl transition-all duration-300 transform hover:scale-105 ${
                    isActive
                      ? `bg-gradient-to-r ${item.color} text-white shadow-xl`
                      : "text-gray-700 hover:bg-white/50 hover:text-gray-900 backdrop-blur-sm"
                  }`}
                >
                  {isActive && (
                    <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-2xl"></div>
                  )}
                  <div
                    className={`relative z-10 flex items-center w-full ${isActive ? "text-white" : "text-gray-600 group-hover:text-gray-900"}`}
                  >
                    <item.icon
                      className={`mr-4 h-5 w-5 flex-shrink-0 transition-all duration-300 ${
                        isActive
                          ? "text-white"
                          : "text-gray-500 group-hover:text-gray-700"
                      }`}
                    />
                    <span className="font-semibold">{item.name}</span>
                    {isActive && (
                      <div className="ml-auto w-2 h-2 bg-white rounded-full animate-pulse"></div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}


    </div>
  );

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="bg-white/80 backdrop-blur-sm shadow-lg border-white/20 hover:bg-white/90"
        >
          {isMobileMenuOpen ? (
            <X className="h-4 w-4" />
          ) : (
            <Menu className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Mobile menu overlay */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <div
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-80 bg-gradient-to-b from-orange-50/95 to-red-50/95 backdrop-blur-xl shadow-2xl transform transition-transform duration-300 ease-in-out ${
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col sidebar-scrollbar">
          <div className="flex items-center justify-between p-6 border-b border-white/20">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  Transfer Agent
                </h1>
                <p className="text-xs text-gray-600">Management Portal</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-gray-600"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <nav className="flex-1 p-6">
            <NavLinks />
          </nav>
          <div className="p-6 border-t border-white/20">
            <form action={signOut}>
              <Button
                type="submit"
                variant="ghost"
                className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50/50 rounded-xl"
              >
                <LogOut className="mr-3 h-4 w-4" />
                Sign Out
              </Button>
            </form>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:flex h-full w-80 flex-col bg-gradient-to-b from-orange-50/90 to-red-50/90 backdrop-blur-xl border-r border-white/20 shadow-2xl">
        <div className="flex flex-1 flex-col overflow-y-auto sidebar-scrollbar">
          {/* Header */}
          <div className="flex flex-shrink-0 items-center p-8">
            <div className="flex items-start flex-col">
              <div className="">
                <Image
                  src="/efficiency_logo.svg"
                  width={140}
                  height={24}
                  alt="logo"
                />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900"></h1>
                <p className="text-sm text-gray-600">
                  Transfer Agent Management Portal
                </p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-6">
            <NavLinks />
          </nav>

          {/* Footer */}
          <div className="flex-shrink-0 p-6 border-t border-white/20">
            <div className="mb-4 p-4 bg-gradient-to-r from-orange-100/50 to-red-100/50 rounded-xl">
              <div className="flex items-center space-x-2 mb-2">
                <TrendingUp className="h-4 w-4 text-orange-600" />
                <span className="text-sm font-medium text-gray-700">
                  System Status
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-gray-600">
                  All systems operational
                </span>
              </div>
            </div>
            <form action={signOut}>
              <Button
                type="submit"
                variant="ghost"
                className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50/50 rounded-xl"
              >
                <LogOut className="mr-3 h-4 w-4" />
                Sign Out
              </Button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
