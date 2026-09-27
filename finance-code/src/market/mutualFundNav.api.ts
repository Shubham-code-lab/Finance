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

function simplifiedFundName(value: string) {
  return value
    .replace(/\b(direct|regular|growth|dividend|idcw|payout|reinvestment|plan|option)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

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

export function closestNavHistory(referenceNav: number, histories: MutualFundNavHistory[]) {
  if (!Number.isFinite(referenceNav) || referenceNav <= 0) return histories[0] ?? null
  return [...histories].sort((left, right) => {
    const leftNav = left.points.at(-1)?.nav ?? 0
    const rightNav = right.points.at(-1)?.nav ?? 0
    const leftDistance = leftNav > 0 ? Math.abs(Math.log(leftNav / referenceNav)) : Number.POSITIVE_INFINITY
    const rightDistance = rightNav > 0 ? Math.abs(Math.log(rightNav / referenceNav)) : Number.POSITIVE_INFINITY
    return leftDistance - rightDistance
  })[0]
}

async function fetchFundHistory(scheme: MutualFundScheme, latestOnly: boolean, signal?: AbortSignal) {
  const suffix = latestOnly ? '/latest' : ''
  const response = await fetch(`${apiOrigin}/mf/${scheme.schemeCode}${suffix}`, { headers: { Accept: 'application/json' }, signal })
  if (!response.ok) throw new Error(`NAV history failed (${response.status})`)
  return parseMutualFundHistory(scheme, (await response.json()) as HistoryResponse)
}

export async function getMutualFundNavHistory(
  name: string,
  signal?: AbortSignal,
  referenceNav?: number | null,
): Promise<MutualFundNavHistory> {
  const queries = [...new Set([name, simplifiedFundName(name)].filter(Boolean))]
  const responses = await Promise.all(
    queries.map((query) =>
      fetch(`${apiOrigin}/mf/search?q=${encodeURIComponent(query)}`, { headers: { Accept: 'application/json' }, signal }),
    ),
  )
  const failed = responses.find((response) => !response.ok)
  if (failed) throw new Error(`Fund search failed (${failed.status})`)
  const found = (await Promise.all(responses.map((response) => response.json() as Promise<MutualFundScheme[]>))).flat()
  const schemes = [...new Map(found.map((candidate) => [candidate.schemeCode, candidate])).values()]
  let scheme = selectMutualFundScheme(name, schemes)
  if (!scheme) throw new Error(`No NAV history found for ${name}`)

  if (referenceNav && referenceNav > 0) {
    const wanted = fundNameTokens(name)
    const wantsDirect = wanted.has('direct')
    const wantsRegular = wanted.has('regular')
    const wantsGrowth = wanted.has('growth')
    const candidates = schemes
      .filter((candidate) => {
        const available = fundNameTokens(candidate.schemeName)
        const matches = [...wanted].filter((token) => available.has(token)).length
        const wrongPlan =
          (wantsDirect && available.has('regular')) ||
          (wantsRegular && available.has('direct')) ||
          (wantsGrowth && ['dividend', 'idcw', 'payout', 'reinvestment'].some((token) => available.has(token)))
        return !wrongPlan && matches >= Math.max(2, wanted.size - 2)
      })
      .slice(0, 10)
    const latest = (
      await Promise.all(
        candidates.map(async (candidate) => {
          try {
            return await fetchFundHistory(candidate, true, signal)
          } catch {
            return null
          }
        }),
      )
    ).filter((history): history is MutualFundNavHistory => Boolean(history?.points.length))
    scheme = closestNavHistory(referenceNav, latest)?.scheme ?? scheme
  }

  const parsed = await fetchFundHistory(scheme, false, signal)
  if (!parsed.points.length) throw new Error(`No NAV history found for ${name}`)
  return parsed
}
