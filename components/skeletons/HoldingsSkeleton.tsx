'use client'

/**
 * HoldingsSkeleton - Fast visual feedback for holdings and restrictions tables
 */

export function HoldingsSkeleton() {
  return (
    <div className="space-y-8">
      {/* Holdings Table Skeleton */}
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
            {Array.from({ length: 3 }).map((_, i) => (
              <tr key={i} className="border-t animate-pulse">
                <td className="px-3 py-2">
                  <div className="h-4 w-32 bg-gray-200 rounded"></div>
                </td>
                <td className="px-3 py-2 text-center">
                  <div className="h-4 w-16 bg-gray-200 rounded mx-auto"></div>
                </td>
                <td className="px-3 py-2 text-center">
                  <div className="h-4 w-24 bg-gray-200 rounded mx-auto"></div>
                </td>
                <td className="px-3 py-2 text-center">
                  <div className="h-4 w-12 bg-gray-200 rounded mx-auto"></div>
                </td>
                <td className="px-3 py-2 text-center">
                  <div className="h-4 w-8 bg-green-200 rounded mx-auto"></div>
                </td>
                <td className="px-3 py-2 text-center">
                  <div className="h-4 w-6 bg-gray-200 rounded mx-auto"></div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Restrictions Table Skeleton */}
      <div className="mt-10">
        <div className="bg-orange-100 rounded-t-md mb-2 p-4">
          <div className="h-5 w-32 bg-gray-200 rounded animate-pulse"></div>
        </div>
        <table className="w-full border border-gray-200 text-sm">
          <thead>
            <tr className="bg-orange-50 text-gray-700">
              <th className="px-3 py-2 text-left w-20">CODE</th>
              <th className="px-3 py-2 text-left">LEGEND</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 3 }).map((_, i) => (
              <tr key={i} className="border-t animate-pulse">
                <td className="px-3 py-2">
                  <div className="h-4 w-6 bg-gray-200 rounded"></div>
                </td>
                <td className="px-3 py-2">
                  <div className="h-4 w-full bg-gray-200 rounded"></div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/**
 * TableRowSkeleton - Reusable skeleton row for any table
 */
export function TableRowSkeleton({ columns = 6 }) {
  return (
    <tr className="border-t animate-pulse">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-3 py-2">
          <div className="h-4 w-full bg-gray-200 rounded"></div>
        </td>
      ))}
    </tr>
  )
}
