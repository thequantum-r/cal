import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Suspense } from "react"
import "./globals.css"
import { Toaster } from "sonner"
import RouteToastListener from "@/components/route-toast-listener"
import { AuthProvider } from "@/contexts/AuthContext"
import PerformanceDebugPanel from "@/components/PerformanceDebugPanel"

export const metadata = {
  title: "Shareholder Management System",
  description: "Comprehensive shareholder management with role-based access control",
  generator: "v0.app",
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className={`${GeistSans.className} bg-gradient-to-br from-orange-50 via-red-50 to-yellow-50 min-h-screen`}>
        <div className="fixed inset-0 bg-gradient-to-br from-orange-100/20 via-red-100/20 to-yellow-100/20 pointer-events-none"></div>
        <div className="relative z-10">
          <AuthProvider>
            {children}
          </AuthProvider>
        </div>
        <Suspense fallback={null}>
          <RouteToastListener />
        </Suspense>
        <Toaster />
        {/* Performance Monitoring Panel (Dev Only) */}
        {/* {process.env.NODE_ENV === 'development' && <PerformanceDebugPanel />} */}
      </body>
    </html>
  )
}
