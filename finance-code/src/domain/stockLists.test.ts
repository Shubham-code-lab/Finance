import { describe, expect, it } from 'vitest'
import { normalizeStockListState, recoverStockListState } from '@/domain/stockLists'

describe('stock list persistence', () => {
  it('recovers an empty cloud list from portfolio stocks', () => {
    expect(recoverStockListState({ watchlists: [] }, [], [{ name: 'Tata Power', ticker: 'TATAPOWER.NS' }])).toEqual({
      watchlists: [
        {
          id: 'recovered-investments',
          name: 'Recovered investments',
          stocks: [{ name: 'Tata Power', ticker: 'TATAPOWER.NS' }],
        },
      ],
    })
  })

  it('normalizes named watchlists and ignores temporary selections', () => {
    expect(
      normalizeStockListState({
        currentStocks: [{ name: ' Tata Power ', ticker: 'tatapower.ns' }],
        watchlists: [{ id: 'power', name: ' Power ', stocks: [{ name: 'NHPC', ticker: 'nhpc.ns' }] }],
      }),
    ).toEqual({
      watchlists: [{ id: 'power', name: 'Power', stocks: [{ name: 'NHPC', ticker: 'NHPC.NS' }] }],
    })
  })

  it('removes invalid and duplicate watchlist symbols', () => {
    expect(
      normalizeStockListState({
        watchlists: [
          {
            id: 'power',
            name: 'Power',
            stocks: [
              { name: 'NHPC', ticker: 'NHPC.NS' },
              { name: 'Duplicate', ticker: 'nhpc.ns' },
              { name: '', ticker: 'BAD.NS' },
            ],
          },
        ],
      }).watchlists[0].stocks,
    ).toEqual([{ name: 'NHPC', ticker: 'NHPC.NS' }])
  })
})
