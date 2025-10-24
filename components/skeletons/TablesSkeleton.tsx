'use client'

/**
 * DocumentsTableSkeleton - Fast visual feedback for documents table
 */
export function DocumentsTableSkeleton() {
  return (
    <table className="w-full border">
      <thead>
        <tr className="bg-orange-50 text-gray-700">
          <th className="px-3 py-2 text-left">Type</th>
          <th className="px-3 py-2 text-left">Title</th>
          <th className="px-3 py-2 text-left">Filed At</th>
          <th className="px-3 py-2 text-left">Link</th>
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: 4 }).map((_, i) => (
          <tr key={i} className="border-t animate-pulse">
            <td className="px-3 py-2">
              <div className="h-4 w-20 bg-gray-200 rounded"></div>
            </td>
            <td className="px-3 py-2">
              <div className="h-4 w-48 bg-gray-200 rounded"></div>
            </td>
            <td className="px-3 py-2">
              <div className="h-4 w-24 bg-gray-200 rounded"></div>
            </td>
            <td className="px-3 py-2">
              <div className="h-4 w-20 bg-blue-200 rounded"></div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/**
 * TransactionsTableSkeleton - Fast visual feedback for transactions table
 */
export function TransactionsTableSkeleton() {
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
        {Array.from({ length: 5 }).map((_, i) => (
          <tr key={i} className="border-t animate-pulse">
            <td className="px-3 py-2">
              <div className="h-4 w-20 bg-gray-200 rounded"></div>
            </td>
            <td className="px-3 py-2">
              <div className="h-4 w-16 bg-gray-200 rounded"></div>
            </td>
            <td className="px-3 py-2">
              <div className="h-4 w-20 bg-gray-200 rounded"></div>
            </td>
            <td className="px-3 py-2">
              <div className="h-4 w-24 bg-gray-200 rounded"></div>
            </td>
            <td className="px-3 py-2">
              <div className="h-4 w-16 bg-gray-200 rounded"></div>
            </td>
            <td className="px-3 py-2">
              <div className="h-4 w-16 bg-green-200 rounded"></div>
            </td>
            <td className="px-3 py-2">
              <div className="h-4 w-20 bg-gray-200 rounded"></div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/**
 * TrustAccountSkeleton - Fast visual feedback for trust account
 */
export function TrustAccountSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="p-4 border border-gray-200 rounded-md animate-pulse">
          <div className="h-4 w-32 bg-gray-200 rounded mb-2"></div>
          <div className="h-6 w-24 bg-gray-100 rounded"></div>
        </div>
      ))}
    </div>
  )
}
