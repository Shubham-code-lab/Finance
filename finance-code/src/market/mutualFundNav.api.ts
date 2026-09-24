export type MutualFundScheme = {
  schemeCode: number
  schemeName: string
}

export type MutualFundNavPoint = {
  date: string
  nav: number
}

export type MutualFundNavHistory = {
  scheme: MutualFundScheme
  points: MutualFundNavPoint[]
}

type HistoryResponse = {
  meta?: { scheme_code?: number; scheme_name?: string }
  data?: Array<{ date?: string; nav?: string }>
}

const apiOrigin = 'https://api.mfapi.in'
const ignoredTokens = new Set(['fund', 'plan', 'scheme', 'the'])

export function fundNameTokens(value: string) {
  return new Set(
    value
      .toLocaleLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .split(/\s+/)
      .filter((token) => token && !ignoredTokens.has(token)),
  )
}

export function selectMutualFundScheme(name: string, schemes: MutualFundScheme[]) {
  const wanted = fundNameTokens(name)
  if (!wanted.size) return null
  const best = [...schemes]
    .map((scheme) => {
      const available = fundNameTokens(scheme.schemeName)
      const matches = [...wanted].filter((token) => available.has(token)).length
      const missing = [...wanted].filter((token) => !available.has(token)).length
      const extras = [...available].filter((token) => !wanted.has(token)).length
      const directBonus = wanted.has('direct') === available.has('direct') ? 2 : -3
      const growthBonus = wanted.has('growth') === available.has('growth') ? 2 : -3
      return { scheme, score: matches * 4 - missing * 5 - extras * 0.25 + directBonus + growthBonus }
    })
    .sort((left, right) => right.score - left.score)[0]
  return best && best.score >= wanted.size * 2 ? best.scheme : null
}

export function parseMutualFundDate(value: string) {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value)
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null
}

export function parseMutualFundHistory(scheme: MutualFundScheme, payload: HistoryResponse): MutualFundNavHistory {
  const points = (payload.data ?? [])
    .flatMap((item): MutualFundNavPoint[] => {
      const date = item.date ? parseMutualFundDate(item.date) : null
      const nav = Number(item.nav)
      return date && Number.isFinite(nav) && nav > 0 ? [{ date, nav }] : []
    })
    .sort((left, right) => left.date.localeCompare(right.date))
  return { scheme, points }
}

export async function getMutualFundNavHistory(name: string, signal?: AbortSignal): Promise<MutualFundNavHistory> {
  const searchResponse = await fetch(`${apiOrigin}/mf/search?q=${encodeURIComponent(name)}`, {
    headers: { Accept: 'application/json' },
    signal,
  })
  if (!searchResponse.ok) throw new Error(`Fund search failed (${searchResponse.status})`)
  const schemes = (await searchResponse.json()) as MutualFundScheme[]
  const scheme = selectMutualFundScheme(name, schemes)
  if (!scheme) throw new Error(`No NAV history found for ${name}`)

  const historyResponse = await fetch(`${apiOrigin}/mf/${scheme.schemeCode}`, {
    headers: { Accept: 'application/json' },
    signal,
  })
  if (!historyResponse.ok) throw new Error(`NAV history failed (${historyResponse.status})`)
  const parsed = parseMutualFundHistory(scheme, (await historyResponse.json()) as HistoryResponse)
  if (!parsed.points.length) throw new Error(`No NAV history found for ${name}`)
  return parsed
}
