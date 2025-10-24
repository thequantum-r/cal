/**
 * Performance Monitoring Utility
 * Tracks API response times, cache hits, and network waterfall
 */

interface PerformanceMetric {
  url: string
  startTime: number
  endTime: number
  duration: number
  cacheHit: boolean
  timestamp: Date
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = []
  private readonly maxMetrics = 100 // Keep last 100 metrics

  /**
   * Record API call timing
   */
  recordApiCall(url: string, duration: number, cacheHit: boolean = false) {
    const metric: PerformanceMetric = {
      url,
      startTime: Date.now() - duration,
      endTime: Date.now(),
      duration,
      cacheHit,
      timestamp: new Date(),
    }

    this.metrics.push(metric)

    // Keep only last N metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift()
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(
        `📊 API Call: ${url} - ${duration}ms ${cacheHit ? '✅ CACHED' : '🌐 FRESH'}`
      )
    }
  }

  /**
   * Get performance summary
   */
  getSummary() {
    if (this.metrics.length === 0) {
      return {
        totalRequests: 0,
        cacheHits: 0,
        cacheMisses: 0,
        avgResponseTime: 0,
        totalTime: 0,
        savedTime: 0,
      }
    }

    const cacheHits = this.metrics.filter((m) => m.cacheHit).length
    const totalDuration = this.metrics.reduce((sum, m) => sum + m.duration, 0)
    const avgResponseTime = totalDuration / this.metrics.length

    // Calculate saved time (cache hits * average response time)
    const savedTime = cacheHits * avgResponseTime

    return {
      totalRequests: this.metrics.length,
      cacheHits,
      cacheMisses: this.metrics.length - cacheHits,
      avgResponseTime: Math.round(avgResponseTime),
      totalTime: Math.round(totalDuration),
      savedTime: Math.round(savedTime),
      cacheHitRate: `${((cacheHits / this.metrics.length) * 100).toFixed(1)}%`,
    }
  }

  /**
   * Get detailed metrics
   */
  getMetrics() {
    return this.metrics
  }

  /**
   * Clear all metrics
   */
  clear() {
    this.metrics = []
  }

  /**
   * Print summary to console
   */
  printSummary() {
    const summary = this.getSummary()
    console.group('📈 Performance Summary')
    console.table(summary)
    console.groupEnd()
  }

  /**
   * Print detailed metrics table
   */
  printDetails() {
    if (this.metrics.length === 0) {
      console.log('No metrics recorded yet')
      return
    }
    console.group('📊 Detailed Metrics')
    console.table(
      this.metrics.map((m) => ({
        URL: m.url.split('/').pop() || m.url,
        'Duration (ms)': m.duration,
        'Cache Hit': m.cacheHit ? '✅' : '🌐',
        Time: m.timestamp.toLocaleTimeString(),
      }))
    )
    console.groupEnd()
  }
}

// Create singleton instance
export const performanceMonitor = new PerformanceMonitor()

/**
 * Hook to capture fetch timing with SWR integration
 * Call this after useSWR to track the request
 */
export function trackApiCall(
  url: string | null,
  startTime: number,
  isCacheHit: boolean,
  isLoading: boolean
) {
  if (!url || isLoading) return

  const duration = Date.now() - startTime

  // Only log if duration is reasonable (actual request completed)
  if (duration > 0) {
    performanceMonitor.recordApiCall(url, duration, isCacheHit)
  }
}
