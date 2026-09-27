import { describe, expect, it } from 'vitest'
import { Holding } from '@/domain/types'
import { dedupeCanonicalStockHoldings, holdingAtMarketPrice } from '@/features/holdings/syncInvestmentPortfolio'

const holding: Holding = {
  id: 'stock',
  name: 'Example',
  kind: 'stock',
  purchaseMode: 'lumpsum',
  currentMinor: 10_000,
  investedMinor: 8_000,
  qty: 2.5,
  ticker: 'EXAMPLE.NS',
  buyDate: '2026-01-01',
  avgPrice: 32,
  marketPrice: 40,
  sipAmountMinor: null,
  sipDayOfMonth: null,
  sipStartMonth: null,
  notes: '',
  origin: 'user',
}

describe('investment market-value sync', () => {
  it('calculates the holding value from quantity and the latest API price', () => {
    expect(holdingAtMarketPrice(holding, 123.45)).toMatchObject({ marketPrice: 123.45, currentMinor: 30_863 })
  })

  it('preserves a holding that has no quantity', () => {
    const withoutQuantity = { ...holding, qty: null }
    expect(holdingAtMarketPrice(withoutQuantity, 123.45)).toBe(withoutQuantity)
  })

  it('removes an exact canonical alias duplicate and keeps the earliest position date', () => {
    const later = { ...holding, id: 'modern-later', name: 'MODERN ENGINEERING AND PROJECT', ticker: 'MEAPL.BO', buyDate: '2024-07-08' }
    const earlier = {
      ...holding,
      id: 'modern-earlier',
      name: 'Modern Engineering and Projects Limited',
      ticker: '539762.BO',
      buyDate: '2024-07-07',
    }

    expect(dedupeCanonicalStockHoldings([later, earlier])).toMatchObject({
      holdings: [{ id: 'modern-earlier' }],
      removedIds: ['modern-later'],
    })
  })
})
