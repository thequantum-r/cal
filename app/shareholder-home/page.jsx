"use client"

import { useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { normalizeText } from "@/lib/utils"
import Header from "@/components/header"
import { Check } from "lucide-react"
import { useDataFetchWithDelay } from "@/hooks/useDataFetchWithDelay"
import { ShareholderProfileSkeleton, ShareholderHoldingsTableSkeleton } from "@/components/skeletons/ShareholderHomeSkeleton"

export default function ShareholderHomePage() {
  const { user, initialized } = useAuth()
  const [searchTerm, setSearchTerm] = useState("")
  const router = useRouter()

  // ⚡ Use SWR hook with skeleton fallback
  const { data: shareholderData, isLoading, error } = useDataFetchWithDelay(
    user && initialized ? `/api/shareholders?email=${user.email}` : null
  )

  const profile = shareholderData?.profile || null
  const holdings = shareholderData?.holdings || []

  // ⚡ Show skeletons immediately while auth initializes + data loads
  // Don't wait for initialized - show UI with skeletons right away
  return (
    <>
      <Header user={user} userRole="shareholder" />
      <div className="max-w-6xl mt-6 mx-auto p-6 bg-white rounded-lg shadow-sm border border-orange-100">
        {/* Search Issuer */}
        <div className="flex items-center gap-2 mb-6">
          <Input
            placeholder="Search Company"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border-gray-300 focus:ring-orange-400 focus:border-orange-400"
          />
        </div>

        {/* Shareholder Profile Section */}
        {isLoading ? (
          <ShareholderProfileSkeleton />
        ) : error ? (
          <Card className="mb-8 border-red-200">
            <CardContent className="pt-4">
              <p className="text-red-500">{error.message || "Failed to load profile"}</p>
            </CardContent>
          </Card>
        ) : profile ? (
          <Card className="mb-8">
            <CardHeader className="bg-orange-200 rounded-t-md">
              <CardTitle className="text-gray-800 font-semibold">My Profile</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <ProfileContent profile={profile} />
            </CardContent>
          </Card>
        ) : null}

        {/* Holdings Table Section */}
        {isLoading ? (
          <ShareholderHoldingsTableSkeleton />
        ) : (
          <Card>
            <CardHeader className="bg-orange-200 rounded-t-md">
              <CardTitle className="text-gray-800 font-semibold">Holdings</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <HoldingsTable holdings={holdings} searchTerm={searchTerm} router={router} />
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}

/**
 * ⚡ Extracted ProfileContent component for cleaner rendering
 */
function ProfileContent({ profile }) {
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
      <div>
        <dt className="font-medium text-gray-700">Name</dt>
        <dd className="text-gray-900">
          {profile.first_name} {profile.last_name}
        </dd>
      </div>
      <div>
        <dt className="font-medium text-gray-700">Account Number</dt>
        <dd className="text-gray-900">{profile.account_number}</dd>
      </div>
      <div>
        <dt className="font-medium text-gray-700">Shareholder Type</dt>
        <dd className="text-gray-900">{profile.holder_type}</dd>
      </div>
      <div>
        <dt className="font-medium text-gray-700">Address</dt>
        <dd className="text-gray-900">{profile.address}</dd>
      </div>
      <div>
        <dt className="font-medium text-gray-700">Email</dt>
        <dd className="text-gray-900">{profile.email}</dd>
      </div>
      <div>
        <dt className="font-medium text-gray-700">Phone Number</dt>
        <dd className="text-gray-900">{profile.phone}</dd>
      </div>
    </dl>
  )
}

/**
 * ⚡ Extracted HoldingsTable component for cleaner rendering
 */
function HoldingsTable({ holdings, searchTerm, router }) {
  return (
    <table className="w-full border">
      <thead>
        <tr className="bg-orange-50 text-gray-700">
          <th className="px-3 py-2 text-left">Company</th>
          <th className="px-3 py-2 text-center">Number of Securities</th>
          <th className="px-3 py-2 text-center">Type of Security</th>
          <th className="px-3 py-2 text-center">Ownership</th>
          <th className="px-3 py-2 text-center">Restricted</th>
          <th className="px-3 py-2 text-center">Legend</th>
        </tr>
      </thead>
      <tbody>
        {holdings.length > 0 ? (
          holdings
            .filter((h) =>
              h.issuer?.issuer_name?.toLowerCase().includes(searchTerm.toLowerCase())
            )
            .map((h) => (
              <tr
                key={h.id}
                className="border-t hover:bg-orange-50/50 cursor-pointer transition-colors"
                onClick={() => h.issuer?.id && router.push(`/shareholder-issuer/${h.issuer.id}`)}
              >
                <td className="px-3 py-2 text-left">{normalizeText(h.issuer?.issuer_name) || "-"}</td>
                <td className="px-3 py-2 text-center">{h.shares_owned?.toLocaleString() || "-"}</td>
                <td className="px-3 py-2 text-center">Class B Ordinary Stock</td>
                <td className="px-3 py-2 text-center">{h.ownership_percentage ?? 0}%</td>
                <td className="px-3 py-2 text-center text-green-500">
                  <Check className="h-4 w-4 inline-block" />
                </td>
                <td className="px-3 py-2 text-center font-semibold text-gray-800">
                  {h.legend_code || "A"}
                </td>
              </tr>
            ))
        ) : (
          <tr>
            <td colSpan={6} className="text-center py-4 text-gray-500">
              No holdings found
            </td>
          </tr>
        )}
      </tbody>
    </table>
  )
}
