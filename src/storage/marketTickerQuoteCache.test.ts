import { describe, expect, it } from 'vitest'
import { marketTickerQuoteBatches, marketTickerQuoteDocumentId } from '@/storage/marketTickerQuoteCache.api'

describe('market ticker quote cache layout', () => {
  it('uses one stable document for every ticker and all of its years', () => {
    expect(marketTickerQuoteDocumentId('BRK.B')).toBe('BRK.B')
    expect(marketTickerQuoteDocumentId(' tatapower.ns ')).toBe('TATAPOWER.NS')
  })

  it('reads a normal comparison in one Firestore query', () => {
    expect(marketTickerQuoteBatches(['A.NS', 'B.NS', 'C.NS'])).toEqual([['A.NS', 'B.NS', 'C.NS']])
  })

  it('respects Firestore in-query limits for unusually large comparisons', () => {
    const tickers = Array.from({ length: 31 }, (_, index) => `STOCK${index}.NS`)
    expect(marketTickerQuoteBatches(tickers).map((batch) => batch.length)).toEqual([30, 1])
  })
})
