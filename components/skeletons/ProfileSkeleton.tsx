'use client'

/**
 * ProfileSkeleton - Fast visual feedback while profile loads
 * Uses CSS shimmer animation for premium feel
 */

export function ProfileSkeleton() {
  return (
    <div className="space-y-8">
      {/* Trading Chart Skeleton */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-6 w-48 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-6 w-24 bg-orange-100 rounded animate-pulse"></div>
        </div>
        <div
          className="w-full bg-gray-100 rounded-md border border-orange-100 animate-pulse"
          style={{ height: 400 }}
        ></div>
      </div>

      {/* Profile Fields Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6 text-sm">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-5 w-full bg-gray-100 rounded animate-pulse"></div>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * ChartSkeleton - Lightweight skeleton for trading chart only
 */
export function ChartSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="h-6 w-48 bg-gray-200 rounded animate-pulse"></div>
        <div className="h-6 w-24 bg-orange-100 rounded animate-pulse"></div>
      </div>
      <div
        className="w-full bg-gray-100 rounded-md border border-orange-100 animate-pulse"
        style={{ height: 400 }}
      ></div>
    </div>
  )
}
