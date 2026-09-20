import { collection, doc, documentId, getDocs, getDocsFromCache, query, where, writeBatch } from 'firebase/firestore'
import { PriceQuote } from '@/domain/types'
import { auth, firestore } from '@/firebase/client'

const CACHE_VERSION = 1
const QUERY_BATCH_SIZE = 30

type TickerQuoteDocument = {
  version: number
  ticker: string
  quotes: Record<string, number>
  fetchedAt: string
  updatedAt: string
}

function normalizeTickers(tickers: string[]) {
  return [...new Set(tickers.map((ticker) => ticker.trim().toUpperCase()).filter(Boolean))]
}

export function marketTickerQuoteDocumentId(ticker: string) {
  return encodeURIComponent(ticker.trim().toUpperCase())
}

export function marketTickerQuoteBatches(tickers: string[]) {
  const normalized = normalizeTickers(tickers)
  return Array.from({ length: Math.ceil(normalized.length / QUERY_BATCH_SIZE) }, (_, index) =>
    normalized.slice(index * QUERY_BATCH_SIZE, (index + 1) * QUERY_BATCH_SIZE),
  )
}

function context() {
  const user = auth?.currentUser
  return firestore && user ? { db: firestore, uid: user.uid } : null
}

function quoteCollection(uid: string) {
  if (!firestore) throw new Error('Firebase is not configured.')
  return collection(firestore, 'users', uid, 'marketTickerQuoteCache')
}

function quoteReference(uid: string, ticker: string) {
  if (!firestore) throw new Error('Firebase is not configured.')
  return doc(firestore, 'users', uid, 'marketTickerQuoteCache', marketTickerQuoteDocumentId(ticker))
}

function expandDocument(document: TickerQuoteDocument, from: string, to: string): PriceQuote[] {
  return Object.entries(document.quotes ?? {})
    .flatMap(([date, closeMinor]) =>
      date >= from && date <= to && Number.isFinite(closeMinor)
        ? [{ id: `${document.ticker}:${date}`, ticker: document.ticker, date, closeMinor, fetchedAt: document.fetchedAt }]
        : [],
    )
    .sort((left, right) => left.date.localeCompare(right.date))
}

export async function readMarketTickerQuoteCache(tickers: string[], from: string, to: string): Promise<Record<string, PriceQuote[]>> {
  const normalized = normalizeTickers(tickers)
  const result: Record<string, PriceQuote[]> = Object.fromEntries(normalized.map((ticker) => [ticker, []]))
  const current = context()
  if (!current || !normalized.length) return result

  await Promise.all(
    marketTickerQuoteBatches(normalized).map(async (batch) => {
      const ids = batch.map(marketTickerQuoteDocumentId)
      const request = query(quoteCollection(current.uid), where(documentId(), 'in', ids))
      const cached = await getDocsFromCache(request).catch(() => null)
      const snapshots = cached?.size === batch.length ? cached : await getDocs(request)
      snapshots.forEach((snapshot) => {
        const document = snapshot.data() as TickerQuoteDocument
        const ticker = document.ticker?.trim().toUpperCase()
        if (ticker && ticker in result) result[ticker] = expandDocument(document, from, to)
      })
    }),
  )
  return result
}

export async function writeMarketTickerQuoteCache(quotes: PriceQuote[]) {
  const current = context()
  if (!current || !quotes.length) return 0
  const grouped = new Map<string, PriceQuote[]>()
  quotes.forEach((quote) => {
    const ticker = quote.ticker.trim().toUpperCase()
    if (ticker) grouped.set(ticker, [...(grouped.get(ticker) ?? []), quote])
  })
  if (!grouped.size) return 0

  const batch = writeBatch(current.db)
  const updatedAt = new Date().toISOString()
  grouped.forEach((tickerQuotes, ticker) => {
    const dates = Object.fromEntries(tickerQuotes.map((quote) => [quote.date, quote.closeMinor]))
    const fetchedAt = tickerQuotes.reduce((latest, quote) => (quote.fetchedAt > latest ? quote.fetchedAt : latest), '')
    batch.set(quoteReference(current.uid, ticker), { version: CACHE_VERSION, ticker, quotes: dates, fetchedAt, updatedAt }, { merge: true })
  })
  await batch.commit()
  return grouped.size
}
