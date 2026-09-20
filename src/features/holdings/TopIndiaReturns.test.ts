import { describe, expect, it } from 'vitest'
import { rankIndiaReturns } from '@/features/holdings/topIndiaReturns.utils'
import { IndiaStock } from '@/market/indiaUniverse'

const stocks: IndiaStock[] = [
  { name: 'Alpha', industry: 'Energy', ticker: 'ALPHA.NS' },
  { name: 'Beta', industry: 'Banking', ticker: 'BETA.NS' },
  { name: 'Recent listing', industry: 'Technology', ticker: 'RECENT.NS' },
]

describe('India top returns ranking', () => {
  it('ranks complete-period returns descending and applies the requested limit', () => {
    const ranked = rankIndiaReturns(
      stocks,
      {
        'ALPHA.NS': [
          { date: '2026-01-02', closeMinor: 10_000 },
          { date: '2026-09-14', closeMinor: 20_000 },
        ],
        'BETA.NS': [
          { date: '2026-01-03', closeMinor: 20_000 },
          { date: '2026-09-14', closeMinor: 25_000 },
        ],
        'RECENT.NS': [
          { date: '2026-04-01', closeMinor: 10_000 },
          { date: '2026-09-14', closeMinor: 30_000 },
        ],
      },
      { from: '2026-01-01', to: '2026-09-15' },
      1,
    )

    expect(ranked).toHaveLength(1)
    expect(ranked[0]).toMatchObject({ ticker: 'ALPHA.NS', returnPct: 1 })
  })

  it('excludes stocks without data near the selected end date', () => {
    const ranked = rankIndiaReturns(
      stocks.slice(0, 1),
      {
        'ALPHA.NS': [
          { date: '2026-01-02', closeMinor: 10_000 },
          { date: '2026-08-01', closeMinor: 30_000 },
        ],
      },
      { from: '2026-01-01', to: '2026-09-15' },
      5,
    )

    expect(ranked).toEqual([])
  })
})
