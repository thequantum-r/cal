'use client'

/**
 * ShareholderHomeSkeleton - Fast visual feedback for shareholder home page
 */

export function ShareholderProfileSkeleton() {
  return (
    <div className="bg-white border border-orange-100 rounded-lg shadow-sm mb-8">
      <div className="bg-orange-200 rounded-t-md p-4 mb-2">
        <div className="h-5 w-24 bg-gray-200 rounded animate-pulse" />
      </div>
      <div className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
              <div className="h-5 w-full bg-gray-100 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * ShareholderHoldingsTableSkeleton - Skeleton for holdings table
 */
export function ShareholderHoldingsTableSkeleton() {
  return (
    <div className="bg-white border border-orange-100 rounded-lg shadow-sm">
      <div className="bg-orange-200 rounded-t-md p-4 mb-2">
        <div className="h-5 w-20 bg-gray-200 rounded animate-pulse" />
      </div>
      <div className="p-4">
        <table className="w-full">
          <thead>
            <tr className="bg-orange-50">
              {Array.from({ length: 6 }).map((_, i) => (
                <th key={i} className="px-3 py-2">
                  <div className="h-4 w-16 bg-gray-200 rounded animate-pulse" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 4 }).map((_, i) => (
              <tr key={i} className="border-t animate-pulse">
                <td className="px-3 py-2">
                  <div className="h-4 w-32 bg-gray-200 rounded" />
                </td>
                <td className="px-3 py-2">
                  <div className="h-4 w-20 bg-gray-200 rounded mx-auto" />
                </td>
                <td className="px-3 py-2">
                  <div className="h-4 w-24 bg-gray-200 rounded mx-auto" />
                </td>
                <td className="px-3 py-2">
                  <div className="h-4 w-12 bg-gray-200 rounded mx-auto" />
                </td>
                <td className="px-3 py-2">
                  <div className="h-4 w-8 bg-green-200 rounded mx-auto" />
                </td>
                <td className="px-3 py-2">
                  <div className="h-4 w-6 bg-gray-200 rounded mx-auto" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
