function yahooApiUrl(path: string) {
  if (import.meta.env.DEV) return `/market/yahoo${path}`
  const proxy = import.meta.env.VITE_QUOTE_PROXY
  return proxy ? `${proxy.replace(/\/$/, '')}${path}` : `https://query1.finance.yahoo.com${path}`
}

export async function fetchYahooApi<T>(path: string, failureLabel: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(yahooApiUrl(path), { headers: { Accept: 'application/json' }, signal })
  if (!response.ok) throw new Error(`${failureLabel} request failed (${response.status})`)
  return response.json() as Promise<T>
}
