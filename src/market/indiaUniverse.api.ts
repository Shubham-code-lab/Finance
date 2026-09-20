const constituentPath = '/content/indices/ind_nifty500list.csv'

function constituentUrl() {
  if (import.meta.env.DEV) return `/market/nse${constituentPath}`
  const proxy = import.meta.env.VITE_NSE_PROXY
  return proxy ? `${proxy.replace(/\/$/, '')}${constituentPath}` : `https://nsearchives.nseindia.com${constituentPath}`
}

export async function fetchNifty500Csv(signal?: AbortSignal) {
  const response = await fetch(constituentUrl(), { headers: { Accept: 'text/csv' }, signal })
  if (!response.ok) throw new Error(`Nifty 500 universe request failed (${response.status})`)
  return response.text()
}
