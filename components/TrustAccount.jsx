"use client"

import { useDataFetchWithDelay } from "@/hooks/useDataFetchWithDelay"

export default function TrustAccount({ issuerId }) {
  // ⚡ Use SWR hook - skeleton shows during network latency
  const { data, error, isLoading } = useDataFetchWithDelay(
    issuerId ? `/api/issuers/${issuerId}/trust` : null
  )

  const trust = data?.trust || null

  if (error) {
    return <p className="text-red-500">{error.message || "Failed to load trust account"}</p>
  }

  if (isLoading || !trust) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
            <div className="h-6 w-48 bg-gray-100 rounded animate-pulse" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-gray-700">BANK</h3>
        <p className="text-gray-900">{trust.bank_name}</p>
      </div>
      <div>
        <h3 className="font-semibold text-gray-700">ACCOUNT NUMBER</h3>
        <p className="text-gray-900">{trust.account_number}</p>
      </div>
      <div>
        <h3 className="font-semibold text-gray-700">INVESTMENT SECURITY</h3>
        <p className="text-gray-900">3-month Treasury Bill Due 12/26/2025</p>
      </div>
      <div>
        <h3 className="font-semibold text-gray-700">BALANCE</h3>
        <p className="text-gray-900">
          ${trust.balance.toLocaleString("en-US")}
        </p>
      </div>
      <div>
        <h3 className="font-semibold text-gray-700">LAST UPDATED</h3>
        <p className="text-gray-900">{new Date(trust.last_updated).toLocaleString()}</p>
      </div>
    </div>
  )
}
