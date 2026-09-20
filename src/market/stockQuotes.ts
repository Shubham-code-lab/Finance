import { DailyClose } from '@/calc/stockPerformance'
import { todayIso } from '@/domain/money'
import { PriceQuote } from '@/domain/types'
import { fetchYahooApi } from '@/market/stockQuotes.api'
import { readMarketQuoteCache, writeMarketQuoteCache } from '@/storage/marketQuoteCache.api'
import { readMarketTickerQuoteCache, writeMarketTickerQuoteCache } from '@/storage/marketTickerQuoteCache.api'

type YahooChart = {
  chart?: {
    result?: Array<{
      meta?: { regularMarketPrice?: number; regularMarketTime?: number }
      timestamp?: number[]
      indicators?: { quote?: Array<{ close?: Array<number | null> }>; adjclose?: Array<{ adjclose?: Array<number | null> }> }
    }>
    error?: { description?: string } | null
  }
}

type YahooSearch = {
  quotes?: Array<{
    symbol?: string
    shortname?: string
    longname?: string
    exchange?: string
    quoteType?: string
    sector?: string
    industry?: string
  }>
}

type YahooTimeSeriesPoint = { asOfDate?: string; reportedValue?: { raw?: number } }
type YahooFundamentalsTimeSeries = {
  timeseries?: {
    result?: Array<{ meta?: { type?: string[] }; [key: string]: unknown }>
    error?: { description?: string } | null
  }
}

export type MarketFundamentals = {
  marketCap?: number
  trailingPE?: number
  priceToBook?: number
  dividendYield?: number
  trailingEps?: number
  returnOnEquity?: number
  returnOnAssets?: number
  currentRatio?: number
  revenueGrowth?: number
  earningsGrowth?: number
  totalRevenue?: number
  totalDebt?: number
  freeCashflow?: number
  enterpriseValue?: number
  enterpriseToEbitda?: number
  pegRatio?: number
}

export type MarketSymbolSearchResult = {
  ticker: string
  name: string
  exchange: string
  type: string
  sector?: string
  industry?: string
}

const memoryQuotes = new Map<string, PriceQuote[]>()
const MAX_MEMORY_TICKERS = 12

function rememberQuotes(ticker: string, quotes: PriceQuote[]) {
  memoryQuotes.delete(ticker)
  memoryQuotes.set(ticker, quotes)
  while (memoryQuotes.size > MAX_MEMORY_TICKERS) {
    const oldest = memoryQuotes.keys().next().value
    if (!oldest) break
    memoryQuotes.delete(oldest)
  }
}

function recalledQuotes(ticker: string) {
  const quotes = memoryQuotes.get(ticker) ?? []
  if (quotes.length) rememberQuotes(ticker, quotes)
  return quotes
}

export function yahooTicker(ticker: string) {
  const normalized = ticker.trim().toUpperCase()
  return normalized.includes('.') ? normalized : `${normalized}.NS`
}

export function addDays(date: string, count: number) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + count)
  return value.toISOString().slice(0, 10)
}

function utcSeconds(date: string) {
  return Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 1000)
}

export function quoteRangeIsCovered(dates: string[], from: string, to: string, today = todayIso()) {
  if (!dates.length || from > to) return false
  const end = to < today ? to : today
  const earliest = dates[0]
  const latest = dates[dates.length - 1]
  return earliest <= addDays(from, 7) && latest >= addDays(end, -4)
}

function quotePath(ticker: string, from: string, to: string) {
  const params = new URLSearchParams({
    period1: String(utcSeconds(from)),
    period2: String(utcSeconds(addDays(to, 1))),
    interval: '1d',
    events: 'history',
    includeAdjustedClose: 'true',
  })
  return `/v8/finance/chart/${encodeURIComponent(ticker)}?${params}`
}

function yahooSearchPath(query: string) {
  const params = new URLSearchParams({ q: query, quotesCount: '12', newsCount: '0', enableFuzzyQuery: 'true' })
  return `/v1/finance/search?${params}`
}

function series(payload: YahooFundamentalsTimeSeries, type: string) {
  const result = payload.timeseries?.result?.find((item) => item.meta?.type?.includes(type))
  const values = result?.[type]
  if (!Array.isArray(values)) return []
  return (values as YahooTimeSeriesPoint[])
    .filter((item) => typeof item.reportedValue?.raw === 'number' && Number.isFinite(item.reportedValue.raw))
    .sort((left, right) => (left.asOfDate ?? '').localeCompare(right.asOfDate ?? ''))
}

function latestRaw(payload: YahooFundamentalsTimeSeries, type: string) {
  return series(payload, type).at(-1)?.reportedValue?.raw
}

function quarterlyGrowth(payload: YahooFundamentalsTimeSeries, type: string) {
  const values = series(payload, type)
  if (values.length < 5) return undefined
  const latest = values.at(-1)?.reportedValue?.raw
  const yearAgo = values.at(-5)?.reportedValue?.raw
  return latest === undefined || yearAgo === undefined || yearAgo === 0 ? undefined : (latest - yearAgo) / Math.abs(yearAgo)
}

export function parseMarketFundamentals(payload: YahooFundamentalsTimeSeries): MarketFundamentals {
  if (!payload.timeseries?.result?.length) return {}
  return {
    marketCap: latestRaw(payload, 'trailingMarketCap'),
    trailingPE: latestRaw(payload, 'trailingPeRatio'),
    priceToBook: latestRaw(payload, 'trailingPbRatio'),
    dividendYield: latestRaw(payload, 'trailingAnnualDividendYield'),
    trailingEps: latestRaw(payload, 'trailingDilutedEPS'),
    returnOnEquity: latestRaw(payload, 'trailingReturnOnEquity'),
    returnOnAssets: latestRaw(payload, 'trailingReturnOnAssets'),
    currentRatio: latestRaw(payload, 'quarterlyCurrentRatio'),
    revenueGrowth: quarterlyGrowth(payload, 'quarterlyTotalRevenue'),
    earningsGrowth: quarterlyGrowth(payload, 'quarterlyNetIncome'),
    totalRevenue: latestRaw(payload, 'trailingTotalRevenue'),
    totalDebt: latestRaw(payload, 'quarterlyTotalDebt'),
    freeCashflow: latestRaw(payload, 'trailingFreeCashFlow'),
    enterpriseValue: latestRaw(payload, 'trailingEnterpriseValue'),
    enterpriseToEbitda: latestRaw(payload, 'trailingEnterprisesValueEBITDARatio'),
    pegRatio: latestRaw(payload, 'trailingPegRatio'),
  }
}

export async function getMarketFundamentals(rawTicker: string): Promise<MarketFundamentals> {
  const ticker = yahooTicker(rawTicker)
  const types = [
    'trailingMarketCap',
    'trailingPeRatio',
    'trailingPbRatio',
    'trailingAnnualDividendYield',
    'trailingDilutedEPS',
    'trailingReturnOnEquity',
    'trailingReturnOnAssets',
    'quarterlyCurrentRatio',
    'quarterlyTotalRevenue',
    'quarterlyNetIncome',
    'trailingTotalRevenue',
    'quarterlyTotalDebt',
    'trailingFreeCashFlow',
    'trailingEnterpriseValue',
    'trailingEnterprisesValueEBITDARatio',
    'trailingPegRatio',
  ]
  const period2 = Math.floor(Date.now() / 1000) + 86_400
  const period1 = period2 - 3 * 366 * 86_400
  const params = new URLSearchParams({
    symbol: ticker,
    type: types.join(','),
    merge: 'false',
    period1: String(period1),
    period2: String(period2),
  })
  const payload = await fetchYahooApi<YahooFundamentalsTimeSeries>(
    `/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(ticker)}?${params}`,
    'Fundamentals',
  )
  if (payload.timeseries?.error?.description) throw new Error(payload.timeseries.error.description)
  return parseMarketFundamentals(payload)
}

export async function searchMarketSymbols(query: string): Promise<MarketSymbolSearchResult[]> {
  const value = query.trim()
  if (value.length < 2) return []
  const payload = await fetchYahooApi<YahooSearch>(yahooSearchPath(value), 'Stock search')
  const allowedTypes = new Set(['EQUITY', 'ETF'])
  return (payload.quotes ?? []).flatMap((quote) => {
    const ticker = quote.symbol?.trim().toUpperCase()
    if (!ticker || !allowedTypes.has(quote.quoteType ?? '')) return []
    return [
      {
        ticker,
        name: quote.longname?.trim() || quote.shortname?.trim() || ticker,
        exchange: quote.exchange?.trim() || 'Market',
        type: quote.quoteType ?? 'EQUITY',
        sector: quote.sector?.trim() || undefined,
        industry: quote.industry?.trim() || undefined,
      },
    ]
  })
}

export async function getMarketSymbolProfile(ticker: string) {
  const normalized = ticker.trim().toUpperCase()
  const matches = await searchMarketSymbols(normalized)
  return matches.find((item) => item.ticker === normalized) ?? null
}

export async function getMarketBatchDailyCloses(
  rawTickers: string[],
  from: string,
  to: string,
  signal?: AbortSignal,
): Promise<Record<string, DailyClose[]>> {
  const end = to > todayIso() ? todayIso() : to
  if (!from || !end || from > end) return {}
  const tickers = [...new Set(rawTickers.map(yahooTicker))]
  const result: Record<string, DailyClose[]> = Object.fromEntries(tickers.map((ticker) => [ticker, []]))
  const stored = await readMarketQuoteCache(tickers, from, end).catch(() => ({}) as Record<string, PriceQuote[]>)
  const fetchedQuotes: PriceQuote[] = []
  let cursor = 0
  let failed = 0
  const workerCount = Math.min(6, tickers.length)
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (cursor < tickers.length) {
        signal?.throwIfAborted()
        const ticker = tickers[cursor]
        cursor += 1
        const cached = (stored[ticker] ?? []).filter((quote) => quote.date >= from && quote.date <= end)
        if (
          quoteRangeIsCovered(
            cached.map((quote) => quote.date),
            from,
            end,
          )
        ) {
          result[ticker] = cached.map((quote) => ({ date: quote.date, closeMinor: quote.closeMinor }))
          continue
        }
        try {
          const fetched = await fetchYahooQuotes(ticker, from, end, signal)
          fetchedQuotes.push(...fetched)
          const merged = mergeQuotes(cached, fetched)
          result[ticker] = merged
            .filter((quote) => quote.date >= from && quote.date <= end)
            .map((quote) => ({ date: quote.date, closeMinor: quote.closeMinor }))
        } catch (error) {
          if (signal?.aborted) throw error
          failed += 1
          result[ticker] = cached.map((quote) => ({ date: quote.date, closeMinor: quote.closeMinor }))
        }
      }
    }),
  )
  if (fetchedQuotes.length) await writeMarketQuoteCache(fetchedQuotes).catch(() => undefined)
  if (tickers.length && failed === tickers.length && !Object.values(result).some((quotes) => quotes.length)) {
    throw new Error('Exact-date market history failed for every stock.')
  }
  return result
}

export async function getSelectedMarketDailyCloses(
  rawTickers: string[],
  from: string,
  to: string,
  signal?: AbortSignal,
): Promise<Record<string, DailyClose[]>> {
  const end = to > todayIso() ? todayIso() : to
  if (!from || !end || from > end) return {}
  const tickers = [...new Set(rawTickers.map(yahooTicker))]
  const result: Record<string, DailyClose[]> = Object.fromEntries(tickers.map((ticker) => [ticker, []]))
  const stored = await readMarketTickerQuoteCache(tickers, from, end).catch(() => ({}) as Record<string, PriceQuote[]>)
  const fetchedQuotes: PriceQuote[] = []
  let cursor = 0
  let failed = 0
  const workerCount = Math.min(6, tickers.length)

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (cursor < tickers.length) {
        signal?.throwIfAborted()
        const ticker = tickers[cursor]
        cursor += 1
        const cached = stored[ticker] ?? []
        if (
          quoteRangeIsCovered(
            cached.map((quote) => quote.date),
            from,
            end,
          )
        ) {
          result[ticker] = cached.map((quote) => ({ date: quote.date, closeMinor: quote.closeMinor }))
          continue
        }
        try {
          const fetched = await fetchYahooQuotes(ticker, from, end, signal)
          fetchedQuotes.push(...fetched)
          result[ticker] = mergeQuotes(cached, fetched).map((quote) => ({ date: quote.date, closeMinor: quote.closeMinor }))
        } catch (error) {
          if (signal?.aborted) throw error
          failed += 1
          result[ticker] = cached.map((quote) => ({ date: quote.date, closeMinor: quote.closeMinor }))
        }
      }
    }),
  )

  if (fetchedQuotes.length) await writeMarketTickerQuoteCache(fetchedQuotes).catch(() => undefined)
  if (tickers.length && failed === tickers.length && !Object.values(result).some((quotes) => quotes.length)) {
    throw new Error('Exact-date market history failed for every stock.')
  }
  return result
}

export function parseYahooChart(payload: YahooChart, ticker: string, fetchedAt = new Date().toISOString()): PriceQuote[] {
  const error = payload.chart?.error?.description
  if (error) throw new Error(error)
  const result = payload.chart?.result?.[0]
  const timestamps = result?.timestamp ?? []
  const closes = result?.indicators?.quote?.[0]?.close ?? []
  const adjCloses = result?.indicators?.adjclose?.[0]?.adjclose ?? []
  const quotes = timestamps.flatMap((timestamp, index) => {
    const close = closes[index] ?? adjCloses[index]
    if (close == null || !Number.isFinite(close) || close <= 0) return []
    const date = new Date(timestamp * 1000).toISOString().slice(0, 10)
    return [{ id: `${ticker}:${date}`, ticker, date, closeMinor: Math.round(close * 100), fetchedAt }]
  })
  const livePrice = result?.meta?.regularMarketPrice
  const liveTime = result?.meta?.regularMarketTime
  if (livePrice && livePrice > 0 && liveTime) {
    const date = new Date(liveTime * 1000).toISOString().slice(0, 10)
    const closeMinor = Math.round(livePrice * 100)
    const existing = quotes.findIndex((quote) => quote.date === date)
    const live = { id: `${ticker}:${date}`, ticker, date, closeMinor, fetchedAt }
    if (existing >= 0) quotes[existing] = live
    else quotes.push(live)
    quotes.sort((left, right) => left.date.localeCompare(right.date))
  }
  return quotes
}

function mergeQuotes(...groups: PriceQuote[][]) {
  const byDate = new Map<string, PriceQuote>()
  groups.flat().forEach((quote) => byDate.set(quote.date, quote))
  return [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date))
}

async function readCachedQuotes(ticker: string, from: string, to: string) {
  const cached = recalledQuotes(ticker)
  try {
    const stored = (await readMarketQuoteCache([ticker], from, to))[ticker] ?? []
    const merged = mergeQuotes(cached, stored)
    if (merged.length) rememberQuotes(ticker, merged)
    return merged
  } catch {
    return cached
  }
}

async function fetchChart(path: string, ticker: string, signal?: AbortSignal): Promise<PriceQuote[]> {
  return parseYahooChart(await fetchYahooApi<YahooChart>(path, 'Quote', signal), ticker)
}

async function fetchYahooQuotes(ticker: string, from: string, to: string, signal?: AbortSignal): Promise<PriceQuote[]> {
  return (await fetchChart(quotePath(ticker, from, to), ticker, signal)).filter((quote) => quote.date >= from && quote.date <= to)
}

export async function getMarketDailyCloses(rawTicker: string, from: string, to: string, signal?: AbortSignal): Promise<DailyClose[]> {
  const end = to > todayIso() ? todayIso() : to
  if (!from || !end || from > end) return []
  const ticker = yahooTicker(rawTicker)
  const cached = (await readCachedQuotes(ticker, from, end)).filter((quote) => quote.date >= from && quote.date <= end)
  if (
    quoteRangeIsCovered(
      cached.map((quote) => quote.date),
      from,
      end,
    )
  ) {
    return cached.map((quote) => ({ date: quote.date, closeMinor: quote.closeMinor }))
  }

  const fetched = await fetchYahooQuotes(ticker, from, end, signal)
  const merged = mergeQuotes(recalledQuotes(ticker), fetched)
  rememberQuotes(ticker, merged)
  if (fetched.length) await writeMarketQuoteCache(fetched).catch(() => undefined)
  return merged
    .filter((quote) => quote.date >= from && quote.date <= end)
    .map((quote) => ({ date: quote.date, closeMinor: quote.closeMinor }))
}

export async function getDailyCloses(rawTicker: string, from: string, to: string): Promise<DailyClose[]> {
  const end = to > todayIso() ? todayIso() : to
  if (!from || !end || from > end) return []
  const ticker = yahooTicker(rawTicker)
  const cached = (await readCachedQuotes(ticker, from, end)).filter((quote) => quote.date >= from && quote.date <= end)
  if (
    quoteRangeIsCovered(
      cached.map((quote) => quote.date),
      from,
      end,
    )
  ) {
    return cached.map((quote) => ({ date: quote.date, closeMinor: quote.closeMinor }))
  }

  try {
    const fetched = await fetchYahooQuotes(ticker, from, end)
    const merged = mergeQuotes(cached, fetched)
    rememberQuotes(ticker, mergeQuotes(recalledQuotes(ticker), merged))
    if (fetched.length) await writeMarketQuoteCache(fetched).catch(() => undefined)
    return merged.map((quote) => ({ date: quote.date, closeMinor: quote.closeMinor }))
  } catch (error) {
    if (cached.length) return cached.map((quote) => ({ date: quote.date, closeMinor: quote.closeMinor }))
    throw error
  }
}
