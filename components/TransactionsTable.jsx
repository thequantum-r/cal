'use client'

import { useDataFetchWithDelay } from '@/hooks/useDataFetchWithDelay'
import { TransactionsTableSkeleton } from '@/components/skeletons/TablesSkeleton'

export default function TransactionsTable({ issuerId }) {
  return <TransactionsTableContent issuerId={issuerId} />
}

function TransactionsTableContent({ issuerId }) {
  // ⚡ Using SWR hook - skeleton shows during network latency
  const { data, isLoading, error } = useDataFetchWithDelay(
    issuerId ? `/api/issuers/${issuerId}/transactions` : null
  )

  const txs = data?.transactions || []

  if (isLoading) return <TransactionsTableSkeleton />
  if (error) return <p className="text-red-500">{error.message || "Failed to load transactions"}</p>

  return (
    <table className="w-full border">
      <thead>
        <tr className="bg-orange-50 text-gray-700">
          <th className="px-3 py-2 text-left">Date</th>
          <th className="px-3 py-2 text-left">Type</th>
          <th className="px-3 py-2 text-left">CUSIP</th>
          <th className="px-3 py-2 text-left">Security</th>
          <th className="px-3 py-2 text-left">Quantity</th>
          <th className="px-3 py-2 text-left">Status</th>
          <th className="px-3 py-2 text-left">Notes</th>
        </tr>
      </thead>
      <tbody>
        {txs.length > 0 ? (
          txs.map((tx) => (
            <tr key={tx.id} className="border-t hover:bg-gray-50">
              <td className="px-3 py-2">
                {tx.transaction_date
                  ? new Date(tx.transaction_date).toLocaleDateString()
                  : "-"}
              </td>
              <td className="px-3 py-2">{tx.transaction_type || "-"}</td>
              <td className="px-3 py-2">{tx.cusip || "-"}</td>
              <td className="px-3 py-2">{tx.certificate_type || "-"}</td>
              <td className="px-3 py-2">{tx.share_quantity || 0}</td>
              <td className="px-3 py-2">{tx.status || "-"}</td>
              <td className="px-3 py-2">{tx.notes || "-"}</td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={7} className="text-center py-4 text-gray-500">
              No transactions available
            </td>
          </tr>
        )}
      </tbody>
    </table>
  )
}
