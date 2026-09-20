import { describe, expect, it } from 'vitest'
import { normalizeStockListState, recoverStockListState } from '@/domain/stockLists'

describe('stock list persistence', () => {
  it('recovers an empty cloud list from portfolio stocks', () => {
    expect(recoverStockListState({ currentStocks: [], watchlists: [] }, [], [{ name: 'Tata Power', ticker: 'TATAPOWER.NS' }])).toEqual({
      currentStocks: [{ name: 'Tata Power', ticker: 'TATAPOWER.NS' }],
      watchlists: [
        {
          id: 'recovered-investments',
          name: 'Recovered investments',
          stocks: [{ name: 'Tata Power', ticker: 'TATAPOWER.NS' }],
        },
      ],
    })
  })

  it('normalizes current stocks and named watchlists', () => {
    expect(
      normalizeStockListState({
        currentStocks: [{ name: ' Tata Power ', ticker: 'tatapower.ns' }],
        watchlists: [{ id: 'power', name: ' Power ', stocks: [{ name: 'NHPC', ticker: 'nhpc.ns' }] }],
      }),
    ).toEqual({
      currentStocks: [{ name: 'Tata Power', ticker: 'TATAPOWER.NS' }],
      watchlists: [{ id: 'power', name: 'Power', stocks: [{ name: 'NHPC', ticker: 'NHPC.NS' }] }],
    })
  })

  it('removes invalid and duplicate symbols', () => {
    expect(
      normalizeStockListState({
        currentStocks: [
          { name: 'NHPC', ticker: 'NHPC.NS' },
          { name: 'Duplicate', ticker: 'nhpc.ns' },
          { name: '', ticker: 'BAD.NS' },
        ],
      }).currentStocks,
    ).toEqual([{ name: 'NHPC', ticker: 'NHPC.NS' }])
  })
})
