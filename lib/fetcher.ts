/**
 * Unified Fetcher Function for SWR
 * Handles all API calls with consistent error handling
 */

export const fetcher = async (url: string) => {
  const res = await fetch(url)

  // Parse the response
  const data = await res.json()

  // If not ok, throw error for SWR to handle
  if (!res.ok) {
    const error = new Error(data.error || `HTTP ${res.status}`)
    throw error
  }

  return data
}

/**
 * Alternative: fetcher with POST support for future batching
 */
export const fetcherWithMethod = async (
  url: string,
  method: string = 'GET',
  body?: any
) => {
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  }

  if (body) {
    options.body = JSON.stringify(body)
  }

  const res = await fetch(url, options)
  const data = await res.json()

  if (!res.ok) {
    const error = new Error(data.error || `HTTP ${res.status}`)
    throw error
  }

  return data
}
