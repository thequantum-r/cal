/**
 * Custom Hook: useDataFetch
 * Wraps SWR for consistent data fetching across the app
 *
 * Features:
 * - Automatic request deduplication
 * - Built-in caching (60 seconds default)
 * - Automatic revalidation on focus/refocus
 * - Easy loading/error states
 * - Performance tracking
 */

import useSWR, { SWRConfiguration } from 'swr'
import { fetcher } from '@/lib/fetcher'
import { performanceMonitor } from '@/lib/performanceMonitor'
import { useEffect, useRef } from 'react'

interface UseDataFetchOptions extends SWRConfiguration {
  revalidateOnFocus?: boolean
  revalidateOnReconnect?: boolean
  revalidateOnMount?: boolean
  dedupingInterval?: number // default 60000ms (1 minute)
  focusThrottleInterval?: number
}

interface UseDataFetchReturn<T> {
  data: T | undefined
  isLoading: boolean
  error: any
  isValidating: boolean
  mutate: any
}

/**
 * Hook for fetching data with built-in caching and deduplication
 *
 * @param key - API endpoint URL (null to skip fetching)
 * @param options - SWR configuration options
 * @returns Object with data, loading state, error, etc.
 *
 * @example
 * const { data, isLoading, error } = useDataFetch('/api/documents/123')
 *
 * const { data: docs } = useDataFetch(
 *   shouldFetch ? `/api/documents/${id}` : null,
 *   { revalidateOnFocus: true }
 * )
 */
export function useDataFetch<T = any>(
  key: string | null,
  options: UseDataFetchOptions = {}
): UseDataFetchReturn<T> {
  const {
    revalidateOnFocus = true,
    revalidateOnReconnect = true,
    revalidateOnMount = true,
    dedupingInterval = 60000, // 1 minute deduplication window
    focusThrottleInterval = 300000, // 5 minutes focus throttle
    ...swrConfig
  } = options

  const startTimeRef = useRef<number>(0)
  const previousKeyRef = useRef<string | null>(null)

  const { data, error, isLoading, isValidating, mutate } = useSWR<T>(
    key, // If null, SWR will not fetch
    fetcher,
    {
      // Cache duration (revalidate after 60 seconds)
      revalidateOnFocus,
      revalidateOnReconnect,
      revalidateOnMount,
      dedupingInterval, // Deduplicate requests within this window
      focusThrottleInterval, // Don't revalidate on focus more than once per 5 min
      refreshInterval: 0, // Don't auto-refresh (user can click refresh)
      errorRetryCount: 2, // Retry failed requests 2 times
      errorRetryInterval: 3000, // Wait 3s before retry
      ...swrConfig,
    }
  )

  // Track performance metrics
  useEffect(() => {
    if (key && key !== previousKeyRef.current) {
      previousKeyRef.current = key
      startTimeRef.current = Date.now()
    }

    // When data loads or error occurs, record the metric
    if (key && !isLoading && data !== undefined) {
      const duration = Date.now() - startTimeRef.current
      const isCacheHit = duration < 50 // Very fast = likely cache
      performanceMonitor.recordApiCall(key, duration, isCacheHit)
    }
  }, [key, data, isLoading, error])

  return {
    data,
    isLoading: isLoading && !error,
    error,
    isValidating,
    mutate, // Allow manual cache refresh
  }
}

/**
 * Hook for multiple simultaneous requests
 *
 * @example
 * const results = useDataFetchMultiple([
 *   '/api/documents/123',
 *   '/api/transactions/123'
 * ])
 */
export function useDataFetchMultiple<T = any>(
  keys: (string | null)[],
  options: UseDataFetchOptions = {}
) {
  const results = keys.map((key) => useDataFetch<T>(key, options))

  const allLoading = results.some((r) => r.isLoading)
  const anyError = results.find((r) => r.error)

  return {
    data: results.map((r) => r.data),
    isLoading: allLoading,
    error: anyError?.error,
    isValidating: results.some((r) => r.isValidating),
    mutateAll: () => results.forEach((r) => r.mutate()),
  }
}
