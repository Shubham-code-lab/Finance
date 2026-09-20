import { describe, expect, it } from 'vitest'
import { marketQuoteCachePlan, marketQuoteShard, marketQuoteShardId } from '@/storage/marketQuoteCache.api'

describe('market quote cache layout', () => {
  it('uses a stable annual shard for a ticker', () => {
    expect(marketQuoteShard('TATAPOWER.NS')).toBe(marketQuoteShard('tatapower.ns'))
    expect(marketQuoteShardId(2026, 3)).toBe('2026-03')
  })

  it('caps a 500-stock one-year scan at sixteen Firestore documents', () => {
    const tickers = Array.from({ length: 500 }, (_, index) => `STOCK${index}.NS`)
    expect(marketQuoteCachePlan(tickers, '2026-01-01', '2026-12-31').length).toBeLessThanOrEqual(16)
  })

  it('uses independent annual documents for multi-year ranges', () => {
    const plan = marketQuoteCachePlan(['TATAPOWER.NS'], '2024-01-01', '2026-12-31')
    expect(plan).toHaveLength(3)
  })
})
