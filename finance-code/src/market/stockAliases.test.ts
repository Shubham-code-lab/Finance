import { describe, expect, it } from 'vitest'
import { Holding } from '@/domain/types'
import { canonicalStockHolding } from '@/market/stockAliases'

const holding: Holding = {
  id: 'modern',
  name: 'MODERN ENGINEERING AND PROJECT',
  kind: 'stock',
  purchaseMode: 'lumpsum',
  currentMinor: 25_000,
  investedMinor: 20_000,
  qty: 10,
  ticker: 'MEAPL.BO',
  buyDate: '2026-01-01',
  avgPrice: 20,
  marketPrice: 25,
  sipAmountMinor: null,
  sipDayOfMonth: null,
  sipStartMonth: null,
  notes: '',
  origin: 'user',
}

describe('stock aliases', () => {
  it('canonicalizes Modern Engineering to its BSE scrip code', () => {
    expect(canonicalStockHolding(holding)).toMatchObject({
      ticker: '539762.BO',
      name: 'Modern Engineering and Projects Limited',
    })
  })
})
