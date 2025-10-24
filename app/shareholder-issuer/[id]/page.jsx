"use client"

import { useParams } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Suspense } from "react"
import { DocumentsTable } from "@/components/DocumentsTable"
import TransactionsTable from "@/components/TransactionsTable"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Check } from "lucide-react"
import { normalizeText, splitUSCounsel } from "@/lib/utils"
import dynamic from "next/dynamic"
import { useTradingViewChart } from "@/hooks/useTradingViewChart"
import { ProfileSkeleton, ChartSkeleton } from "@/components/skeletons/ProfileSkeleton"
import { HoldingsSkeleton } from "@/components/skeletons/HoldingsSkeleton"
import { useDataFetchWithDelay } from "@/hooks/useDataFetchWithDelay"

// ⚡ Dynamic imports for heavy components - load only when needed
const TrustAccount = dynamic(() => import("@/components/TrustAccount"), {
  loading: () => <div className="p-4 bg-gray-50 rounded animate-pulse h-48" />,
  ssr: false
})

export default function ShareholderIssuerPage() {
  const params = useParams()
  const { user, initialized } = useAuth()

  // Extract id early (before any effect)
  const id = params?.id ? (Array.isArray(params.id) ? params.id[0] : params.id) : null

  // ⚡ Use SWR hook - skeletons show during actual network latency in production
  const { data: issuerData, error: issuerError } = useDataFetchWithDelay(
    id ? `/api/issuers/${id}` : null
  )

  const { data: holdingsData } = useDataFetchWithDelay(
    id && user && initialized ? `/api/shareholders?email=${user.email}` : null
  )

  const { data: restrictionsData } = useDataFetchWithDelay(
    id ? `/api/restrictions?issuerId=${id}` : null
  )

  // Extract and filter holdings for this issuer
  const holdings = issuerData && holdingsData?.holdings
    ? holdingsData.holdings.filter((h) => h.issuer?.id === id)
    : []

  const restrictions = restrictionsData?.restrictions || []
  const issuer = issuerData || null
  const error = issuerError

  const { issuerCounsel, underwritersCounsel } = splitUSCounsel(issuer?.us_counsel)

  // ⚡ Initialize TradingView chart when issuer data loads
  useTradingViewChart(issuer?.ticker_symbol, issuer?.exchange_platform)

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-sm border border-orange-100">
      {/* Back Button */}
      <div className="flex justify-end mb-4">
        <Link href="/shareholder-home">
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-2 border-orange-200 text-orange-700 hover:bg-orange-50"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Homepage
          </Button>
        </Link>
      </div>

      <Tabs defaultValue="profile">
        <TabsList className="bg-orange-50 border border-orange-200 mb-6">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="holdings">Holdings</TabsTrigger>
          <TabsTrigger value="documents">Document Depository</TabsTrigger>
          <TabsTrigger value="trust">Trust Account</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
        </TabsList>

        {/* Profile Tab with Suspense */}
        <TabsContent value="profile">
          <Card>
            <CardHeader className="bg-orange-200 rounded-t-md">
              <CardTitle className="text-gray-800 font-semibold">Company Profile</CardTitle>
            </CardHeader>

            {/* Market Chart Section */}
            <div className="mt-10 pl-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                Market Performance
                {issuer && (
                  <span className="px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded">
                    {issuer.exchange_platform || "NASDAQ"}: {issuer.ticker_symbol || "N/A"}
                  </span>
                )}
              </h3>
              {!issuer ? (
                <ChartSkeleton />
              ) : (
                <div id="tradingview-widget" className="rounded-md overflow-hidden border border-orange-100" style={{ height: 400 }} />
              )}
            </div>

            {/* Profile Fields */}
            <CardContent className="pt-4">
              {error ? (
                <p className="text-red-500">{error.message || "Failed to load issuer"}</p>
              ) : !issuer ? (
                <ProfileSkeleton />
              ) : (
                <ProfileContent issuer={issuer} issuerCounsel={issuerCounsel} underwritersCounsel={underwritersCounsel} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Holdings Tab with Suspense */}
        <TabsContent value="holdings">
          <Card>
            <CardHeader className="bg-orange-200 rounded-t-md">
              <CardTitle className="text-gray-800 font-semibold">Holdings</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {!holdings.length && !restrictions.length ? (
                <HoldingsSkeleton />
              ) : (
                <HoldingsContent holdings={holdings} restrictions={restrictions} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents">
          <Card>
            <CardHeader className="bg-orange-200 rounded-t-md">
              <CardTitle className="text-gray-800 font-semibold">Document Depository</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <Suspense fallback={<div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-12 bg-gray-200 rounded animate-pulse" />
                ))}
              </div>}>
                <DocumentsTable issuerId={id} />
              </Suspense>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trust Account Tab with Dynamic Import */}
        <TabsContent value="trust">
          <Card>
            <CardHeader className="bg-orange-200 rounded-t-md">
              <CardTitle className="text-gray-800 font-semibold">Trust Account</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <Suspense fallback={<div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
                    <div className="h-6 w-48 bg-gray-100 rounded animate-pulse" />
                  </div>
                ))}
              </div>}>
                <TrustAccount issuerId={id} />
              </Suspense>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Transactions Tab */}
        <TabsContent value="transactions">
          <Card>
            <CardHeader className="bg-orange-200 rounded-t-md">
              <CardTitle className="text-gray-800 font-semibold">Transactions</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <Suspense fallback={<div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-10 bg-gray-200 rounded animate-pulse" />
                ))}
              </div>}>
                <TransactionsTable issuerId={id} />
              </Suspense>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ⚡ Extracted ProfileContent component for lazy rendering
function ProfileContent({ issuer, issuerCounsel, underwritersCounsel }) {
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6 text-sm">
      <div>
        <dt className="font-medium text-gray-600 uppercase text-xs">Company Name</dt>
        <dd className="mt-1 text-gray-900">
          {normalizeText(issuer.display_name || issuer.issuer_name)}
        </dd>
      </div>

      <div>
        <dt className="font-medium text-gray-600 uppercase text-xs">Incorporation</dt>
        <dd className="mt-1 text-gray-900">{normalizeText(issuer.incorporation)}</dd>
      </div>

      <div className="sm:col-span-2">
        <dt className="font-medium text-gray-600 uppercase text-xs">Address</dt>
        <dd className="mt-1 whitespace-pre-line text-gray-900">
          {normalizeText(issuer.address)}
        </dd>
      </div>

      <div>
        <dt className="font-medium text-gray-600 uppercase text-xs">Telephone</dt>
        <dd className="mt-1 text-gray-900">{issuer.telephone}</dd>
      </div>

      <div>
        <dt className="font-medium text-gray-600 uppercase text-xs">Tax ID</dt>
        <dd className="mt-1 text-gray-900">{issuer.tax_id}</dd>
      </div>

      <div className="sm:col-span-2">
        <dt className="font-medium text-gray-600 uppercase text-xs">Underwriter</dt>
        <dd className="mt-1 text-gray-900">{normalizeText(issuer.underwriter)}</dd>
      </div>

      <div>
        <dt className="font-medium text-gray-600 uppercase text-xs">Exchange</dt>
        <dd className="mt-1 text-gray-900">{normalizeText(issuer.exchange_platform)}</dd>
      </div>

      <div>
        <dt className="font-medium text-gray-600 uppercase text-xs">Forms/SL Status</dt>
        <dd className="mt-1 text-gray-900">{normalizeText(issuer.forms_sl_status)}</dd>
      </div>

      <div>
        <dt className="font-medium text-gray-600 uppercase text-xs">Timeframe for Separation</dt>
        <dd className="mt-1 text-gray-900">{normalizeText(issuer.timeframe_for_separation)}</dd>
      </div>

      <div>
        <dt className="font-medium text-gray-600 uppercase text-xs">Separation Ratio</dt>
        <dd className="mt-1 text-gray-900">{normalizeText(issuer.separation_ratio)}</dd>
      </div>

      <div>
        <dt className="font-medium text-gray-600 uppercase text-xs">Business Combination Timeframe</dt>
        <dd className="mt-1 text-gray-900">{normalizeText(issuer.timeframe_for_bc)}</dd>
      </div>

      <div>
        <dt className="font-medium text-gray-600 uppercase text-xs">Issuer's Counsel</dt>
        <dd className="mt-1 text-gray-900">
          {issuerCounsel ? normalizeText(issuerCounsel) : "—"}
        </dd>
      </div>

      <div>
        <dt className="font-medium text-gray-600 uppercase text-xs">Underwriters' Counsel</dt>
        <dd className="mt-1 text-gray-900">
          {underwritersCounsel ? normalizeText(underwritersCounsel) : "—"}
        </dd>
      </div>

      <div>
        <dt className="font-medium text-gray-600 uppercase text-xs">Offshore Counsel</dt>
        <dd className="mt-1 text-gray-900">{normalizeText(issuer.offshore_counsel)}</dd>
      </div>

      {issuer.notes && (
        <div className="sm:col-span-2">
          <dt className="font-medium text-gray-600 uppercase text-xs">Notes</dt>
          <dd className="mt-1 text-gray-900">{normalizeText(issuer.notes)}</dd>
        </div>
      )}
    </dl>
  )
}

// ⚡ Extracted HoldingsContent component for lazy rendering
function HoldingsContent({ holdings, restrictions }) {
  return (
    <div>
      {/* Holdings Table */}
      <div className="overflow-x-auto mb-8">
        <table className="w-full border border-gray-200 text-sm">
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
              holdings.map((h) => (
                <tr key={h.id} className="border-t hover:bg-orange-50/50 transition-colors">
                  <td className="px-3 py-2 text-left">
                    {normalizeText(h.issuer?.issuer_name)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {h.shares_owned?.toLocaleString() || "-"}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {h.issuer?.issuer_name?.toLowerCase().includes("cal redwood")
                      ? "Class B Ordinary Stock"
                      : h.security?.class_name || "-"}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {h.ownership_percentage ?? 0}%
                  </td>
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
      </div>

      {/* Restrictions Table */}
      <div className="mt-10">
        <CardHeader className="bg-orange-100 rounded-t-md mb-2">
          <CardTitle className="text-gray-800 font-semibold">Restrictions</CardTitle>
        </CardHeader>

        <table className="w-full border border-gray-200 text-sm">
          <thead>
            <tr className="bg-orange-50 text-gray-700">
              <th className="px-3 py-2 text-left w-20">CODE</th>
              <th className="px-3 py-2 text-left">LEGEND</th>
            </tr>
          </thead>
          <tbody>
            {restrictions.length > 0 ? (
              restrictions.map((r) => (
                <tr key={r.code} className={r.code === "A" ? "bg-gray-100" : ""}>
                  <td className="px-3 py-2 font-semibold">{r.code}</td>
                  <td className="px-3 py-2 whitespace-pre-line">{r.legend}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={2} className="text-center py-4 text-gray-500">
                  No restrictions data found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
