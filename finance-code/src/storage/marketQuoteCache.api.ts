import { doc, getDoc, getDocFromCache, runTransaction } from 'firebase/firestore'
import { PriceQuote } from '@/domain/types'
import { auth, firestore } from '@/firebase/client'

const CACHE_VERSION = 1
const SHARD_COUNT = 16
const MAX_DOCUMENT_BYTES = 850_000

type CompactSeries = { dates: string[]; closes: number[]; fetchedAt: string }
type QuoteShard = { version: number; year: number; shard: number; symbols: Record<string, CompactSeries>; updatedAt: string }

const shardReads = new Map<string, Promise<QuoteShard>>()
const shardWrites = new Map<string, Promise<void>>()

function stableHash(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function marketQuoteShard(ticker: string) {
  return stableHash(ticker.trim().toUpperCase()) % SHARD_COUNT
}

export function marketQuoteShardId(year: number, shard: number) {
  return `${year}-${String(shard).padStart(2, '0')}`
}

export function marketQuoteCachePlan(tickers: string[], from: string, to: string) {
  const startYear = Number(from.slice(0, 4))
  const endYear = Number(to.slice(0, 4))
  const ids = new Set<string>()
  if (!Number.isInteger(startYear) || !Number.isInteger(endYear) || startYear > endYear) return []
  for (let year = startYear; year <= endYear; year += 1) {
    tickers.forEach((ticker) => ids.add(marketQuoteShardId(year, marketQuoteShard(ticker))))
  }
  return [...ids].sort()
}

function emptyShard(year: number, shard: number): QuoteShard {
  return { version: CACHE_VERSION, year, shard, symbols: {}, updatedAt: '' }
}

function context() {
  const user = auth?.currentUser
  return firestore && user ? { db: firestore, uid: user.uid } : null
}

function shardRef(uid: string, id: string) {
  if (!firestore) throw new Error('Firebase is not configured.')
  return doc(firestore, 'users', uid, 'marketQuoteCache', id)
}

async function loadShard(year: number, shard: number) {
  const current = context()
  if (!current) return emptyShard(year, shard)
  const id = marketQuoteShardId(year, shard)
  const cacheKey = `${current.uid}:${id}`
  const existing = shardReads.get(cacheKey)
  if (existing) return existing
  const request = (async () => {
    const reference = shardRef(current.uid, id)
    const cached = await getDocFromCache(reference).catch(() => null)
    const snapshot = cached?.exists() ? cached : await getDoc(reference)
    return snapshot.exists() ? (snapshot.data() as QuoteShard) : emptyShard(year, shard)
  })().catch((error) => {
    shardReads.delete(cacheKey)
    throw error
  })
  shardReads.set(cacheKey, request)
  const release = () => {
    if (shardReads.get(cacheKey) === request) shardReads.delete(cacheKey)
  }
  void request.then(release, release)
  return request
}

function expandSeries(ticker: string, series?: CompactSeries): PriceQuote[] {
  if (!series) return []
  return series.dates.flatMap((date, index) => {
    const closeMinor = series.closes[index]
    return Number.isFinite(closeMinor) ? [{ id: `${ticker}:${date}`, ticker, date, closeMinor, fetchedAt: series.fetchedAt }] : []
  })
}

function compactSeries(quotes: PriceQuote[]): CompactSeries {
  const byDate = new Map(quotes.map((quote) => [quote.date, quote]))
  const sorted = [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date))
  return {
    dates: sorted.map((quote) => quote.date),
    closes: sorted.map((quote) => quote.closeMinor),
    fetchedAt: sorted.reduce((latest, quote) => (quote.fetchedAt > latest ? quote.fetchedAt : latest), ''),
  }
}

export async function readMarketQuoteCache(tickers: string[], from: string, to: string): Promise<Record<string, PriceQuote[]>> {
  const normalized = [...new Set(tickers.map((ticker) => ticker.trim().toUpperCase()).filter(Boolean))]
  const result: Record<string, PriceQuote[]> = Object.fromEntries(normalized.map((ticker) => [ticker, []]))
  const startYear = Number(from.slice(0, 4))
  const endYear = Number(to.slice(0, 4))
  if (!context() || !Number.isInteger(startYear) || !Number.isInteger(endYear) || startYear > endYear) return result

  await Promise.all(
    normalized.map(async (ticker) => {
      const shard = marketQuoteShard(ticker)
      for (let year = startYear; year <= endYear; year += 1) {
        const document = await loadShard(year, shard)
        result[ticker].push(...expandSeries(ticker, document.symbols[ticker]))
      }
      result[ticker] = result[ticker]
        .filter((quote) => quote.date >= from && quote.date <= to)
        .sort((left, right) => left.date.localeCompare(right.date))
    }),
  )
  return result
}

function withShardLock(key: string, operation: () => Promise<void>) {
  const previous = shardWrites.get(key) ?? Promise.resolve()
  const next = previous.then(operation, operation)
  shardWrites.set(key, next)
  return next.finally(() => {
    if (shardWrites.get(key) === next) shardWrites.delete(key)
  })
}

export async function writeMarketQuoteCache(quotes: PriceQuote[]) {
  const current = context()
  if (!current || !quotes.length) return 0
  const groups = new Map<string, { year: number; shard: number; quotes: PriceQuote[] }>()
  quotes.forEach((quote) => {
    const year = Number(quote.date.slice(0, 4))
    if (!Number.isInteger(year)) return
    const shard = marketQuoteShard(quote.ticker)
    const id = marketQuoteShardId(year, shard)
    const group = groups.get(id) ?? { year, shard, quotes: [] }
    group.quotes.push(quote)
    groups.set(id, group)
  })

  let writes = 0
  await Promise.all(
    [...groups.entries()].map(([id, group]) =>
      withShardLock(`${current.uid}:${id}`, async () => {
        const reference = shardRef(current.uid, id)
        const changed = await runTransaction(current.db, async (transaction) => {
          const snapshot = await transaction.get(reference)
          const existing = snapshot.exists() ? (snapshot.data() as QuoteShard) : emptyShard(group.year, group.shard)
          const symbols = { ...existing.symbols }
          let hasChanges = false
          const byTicker = new Map<string, PriceQuote[]>()
          group.quotes.forEach((quote) => byTicker.set(quote.ticker, [...(byTicker.get(quote.ticker) ?? []), quote]))
          byTicker.forEach((incoming, ticker) => {
            const merged = compactSeries([...expandSeries(ticker, symbols[ticker]), ...incoming])
            const previous = symbols[ticker]
            if (
              !previous ||
              JSON.stringify(previous.dates) !== JSON.stringify(merged.dates) ||
              JSON.stringify(previous.closes) !== JSON.stringify(merged.closes)
            ) {
              symbols[ticker] = merged
              hasChanges = true
            }
          })
          if (!hasChanges) return null
          const next: QuoteShard = {
            version: CACHE_VERSION,
            year: group.year,
            shard: group.shard,
            symbols,
            updatedAt: new Date().toISOString(),
          }
          if (new Blob([JSON.stringify(next)]).size > MAX_DOCUMENT_BYTES) throw new Error(`Market quote cache shard ${id} is too large.`)
          transaction.set(reference, next)
          return next
        })
        if (changed) {
          writes += 1
          shardReads.delete(`${current.uid}:${id}`)
        }
      }),
    ),
  )
  return writes
}
