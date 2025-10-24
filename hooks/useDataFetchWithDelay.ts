/**
 * ⚡ useDataFetchWithDelay Hook
 * Wrapper around useDataFetch for consistent skeleton UX
 * In production with network latency, skeletons will show naturally
 * No artificial delays - uses actual network timing
 */

import { useDataFetch } from './useDataFetch'

interface UseDataFetchWithDelayOptions {
  revalidateOnFocus?: boolean
  dedupingInterval?: number
}

export function useDataFetchWithDelay<T = any>(
  key: string | null,
  options?: UseDataFetchWithDelayOptions
) {
  // ⚡ Just use regular SWR - in production, network latency will naturally show skeletons
  // No artificial delays needed
  const { data, error, isLoading, isValidating, mutate } = useDataFetch(
    key,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
      ...options,
    }
  )

  return {
    data,
    isLoading,
    error,
    isValidating,
    mutate,
  }
}
