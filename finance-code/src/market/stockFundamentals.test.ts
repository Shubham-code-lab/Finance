import { describe, expect, it } from 'vitest'
import { parseMarketFundamentals } from './stockQuotes'

describe('parseMarketFundamentals', () => {
  it('extracts available raw values and ignores missing fields', () => {
    const result = parseMarketFundamentals({
      timeseries: {
        result: [
          {
            meta: { type: ['trailingMarketCap'] },
            trailingMarketCap: [{ asOfDate: '2026-09-15', reportedValue: { raw: 125_000_000_000 } }],
          },
          { meta: { type: ['trailingPeRatio'] }, trailingPeRatio: [{ asOfDate: '2026-09-15', reportedValue: { raw: 18.4 } }] },
          {
            meta: { type: ['trailingAnnualDividendYield'] },
            trailingAnnualDividendYield: [{ asOfDate: '2026-09-15', reportedValue: { raw: 0.012 } }],
          },
          { meta: { type: ['trailingPbRatio'] }, trailingPbRatio: [{ asOfDate: '2026-09-15', reportedValue: { raw: 3.2 } }] },
          { meta: { type: ['trailingDilutedEPS'] }, trailingDilutedEPS: [{ asOfDate: '2026-09-15', reportedValue: { raw: 14.75 } }] },
          {
            meta: { type: ['trailingReturnOnEquity'] },
            trailingReturnOnEquity: [{ asOfDate: '2026-09-15', reportedValue: { raw: 0.164 } }],
          },
          {
            meta: { type: ['quarterlyTotalRevenue'] },
            quarterlyTotalRevenue: [
              { asOfDate: '2025-06-30', reportedValue: { raw: 100 } },
              { asOfDate: '2025-09-30', reportedValue: { raw: 104 } },
              { asOfDate: '2025-12-31', reportedValue: { raw: 108 } },
              { asOfDate: '2026-03-31', reportedValue: { raw: 110 } },
              { asOfDate: '2026-06-30', reportedValue: { raw: 108 } },
            ],
          },
        ],
      },
    })

    expect(result).toMatchObject({
      marketCap: 125_000_000_000,
      trailingPE: 18.4,
      dividendYield: 0.012,
      priceToBook: 3.2,
      trailingEps: 14.75,
      returnOnEquity: 0.164,
      revenueGrowth: 0.08,
    })
    expect(result.totalDebt).toBeUndefined()
  })

  it('returns an empty object when Yahoo has no result', () => {
    expect(parseMarketFundamentals({ timeseries: { result: [] } })).toEqual({})
  })
})
