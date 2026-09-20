import { describe, expect, it } from 'vitest'
import { calculateStockPerformance, performanceHoldings } from '@/calc/stockPerformance'
import { Holding } from '@/domain/types'

const holding = (overrides: Partial<Holding> = {}): Holding => ({
  id: 'stock-a',
  name: 'Stock A',
  kind: 'stock',
  purchaseMode: 'lumpsum',
  currentMinor: 0,
  investedMinor: 10_000,
  qty: null,
  ticker: 'A.NS',
  buyDate: '2026-01-01',
  avgPrice: null,
  marketPrice: null,
  sipAmountMinor: null,
  sipDayOfMonth: null,
  sipStartMonth: null,
  notes: '',
  origin: 'user',
  ...overrides,
})

describe('stock performance', () => {
  it('excludes SIP and incomplete stocks from options', () => {
    expect(
      performanceHoldings([
        holding(),
        holding({ id: 'sip', purchaseMode: 'sip' }),
        holding({ id: 'missing-ticker', ticker: null }),
        holding({ id: 'missing-date', buyDate: null }),
      ]).map((item) => item.id),
    ).toEqual(['stock-a'])
  })

  it('uses the next trading bar as buy close and derives quantity from invested amount', () => {
    const points = calculateStockPerformance(
      holding(),
      [
        { date: '2026-01-02', closeMinor: 2_000 },
        { date: '2026-01-05', closeMinor: 2_200 },
      ],
      { from: '2026-01-01', to: '2026-01-31' },
    )
    expect(points).toEqual([
      { date: '2026-01-02', valueMinor: 10_000, costMinor: 10_000, pnlMinor: 0, pnlPct: 0 },
      { date: '2026-01-05', valueMinor: 11_000, costMinor: 10_000, pnlMinor: 1_000, pnlPct: 0.1 },
    ])
  })

  it('does not emit points before a later purchase date', () => {
    const points = calculateStockPerformance(
      holding({ buyDate: '2026-02-01', qty: 2 }),
      [
        { date: '2026-01-30', closeMinor: 2_000 },
        { date: '2026-02-02', closeMinor: 2_100 },
      ],
      { from: '2026-01-01', to: '2026-02-28' },
    )
    expect(points.map((point) => point.date)).toEqual(['2026-02-02'])
    expect(points[0].valueMinor).toBe(4_200)
  })

  it('returns no points for empty bars', () => {
    expect(calculateStockPerformance(holding(), [], { from: '2026-01-01', to: '2026-01-31' })).toEqual([])
  })
})
