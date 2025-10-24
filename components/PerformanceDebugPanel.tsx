'use client'

import { useState, useEffect } from 'react'
import { performanceMonitor } from '@/lib/performanceMonitor'

/**
 * Debug Panel - Shows real-time API performance metrics
 * Shows in development only or when enabled
 */
export default function PerformanceDebugPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const [metrics, setMetrics] = useState<any>(null)

  // Auto-refresh metrics every 2 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(performanceMonitor.getSummary())
    }, 2000)

    return () => clearInterval(interval)
  }, [])

  // Initial load
  useEffect(() => {
    setMetrics(performanceMonitor.getSummary())
  }, [])

  if (!metrics) return null

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 z-40 bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-full text-xs font-semibold shadow-lg"
        title="Toggle Performance Debug Panel"
      >
        📊 Performance
      </button>

      {/* Debug Panel */}
      {isOpen && (
        <div className="fixed bottom-16 right-4 z-40 w-80 bg-white rounded-lg shadow-2xl border border-orange-200 p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-sm text-gray-800">Performance Monitor</h3>
            <button
              onClick={() => {
                performanceMonitor.clear()
                setMetrics(performanceMonitor.getSummary())
              }}
              className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
            >
              Clear
            </button>
          </div>

          <div className="space-y-3 text-xs">
            {/* Total Requests */}
            <div className="flex justify-between p-2 bg-gray-50 rounded">
              <span className="text-gray-600">Total Requests:</span>
              <span className="font-semibold text-gray-900">{metrics.totalRequests}</span>
            </div>

            {/* Cache Hits */}
            <div className="flex justify-between p-2 bg-green-50 rounded border border-green-200">
              <span className="text-green-700">Cache Hits:</span>
              <span className="font-semibold text-green-900">
                {metrics.cacheHits} ({metrics.cacheHitRate})
              </span>
            </div>

            {/* Cache Misses */}
            <div className="flex justify-between p-2 bg-blue-50 rounded border border-blue-200">
              <span className="text-blue-700">Fresh Requests:</span>
              <span className="font-semibold text-blue-900">{metrics.cacheMisses}</span>
            </div>

            {/* Average Response Time */}
            <div className="flex justify-between p-2 bg-orange-50 rounded border border-orange-200">
              <span className="text-orange-700">Avg Response Time:</span>
              <span className="font-semibold text-orange-900">{metrics.avgResponseTime}ms</span>
            </div>

            {/* Total Time */}
            <div className="flex justify-between p-2 bg-purple-50 rounded border border-purple-200">
              <span className="text-purple-700">Total Time Spent:</span>
              <span className="font-semibold text-purple-900">{metrics.totalTime}ms</span>
            </div>

            {/* Saved Time */}
            <div className="flex justify-between p-2 bg-yellow-50 rounded border border-yellow-200">
              <span className="text-yellow-700">⚡ Time Saved by Cache:</span>
              <span className="font-semibold text-yellow-900">{metrics.savedTime}ms</span>
            </div>

            {/* Last Update */}
            <div className="text-center text-gray-500 text-xs mt-4 pt-2 border-t">
              Updated: {new Date().toLocaleTimeString()}
            </div>
          </div>

          {/* Detailed Metrics Button */}
          <button
            onClick={() => performanceMonitor.printDetails()}
            className="w-full mt-4 text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
          >
            📋 Show Details in Console
          </button>
        </div>
      )}
    </>
  )
}
