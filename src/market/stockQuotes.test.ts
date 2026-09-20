import { describe, expect, it } from 'vitest'
import { addDays, parseYahooChart, quoteRangeIsCovered, yahooTicker } from '@/market/stockQuotes'

describe('stock quotes', () => {
  it('adds .NS when the ticker has no exchange suffix', () => {
    expect(yahooTicker('tatapower')).toBe('TATAPOWER.NS')
    expect(yahooTicker('539762.BO')).toBe('539762.BO')
  })

  it('parses Yahoo daily closes and skips empty bars', () => {
    const quotes = parseYahooChart(
      {
        chart: {
          result: [
            {
              timestamp: [1757648700, 1757735100],
              indicators: {
                quote: [{ close: [388.2, null] }],
                adjclose: [{ adjclose: [388.2, 386.5] }],
              },
            },
          ],
        },
      },
      'TATAPOWER.NS',
      '2026-09-13T00:00:00.000Z',
    )
    expect(quotes).toEqual([
      {
        id: 'TATAPOWER.NS:2025-09-12',
        ticker: 'TATAPOWER.NS',
        date: '2025-09-12',
        closeMinor: 38_820,
        fetchedAt: '2026-09-13T00:00:00.000Z',
      },
      {
        id: 'TATAPOWER.NS:2025-09-13',
        ticker: 'TATAPOWER.NS',
        date: '2025-09-13',
        closeMinor: 38_650,
        fetchedAt: '2026-09-13T00:00:00.000Z',
      },
    ])
  })

  it('adds Yahoo regularMarketPrice as the latest close', () => {
    const quotes = parseYahooChart(
      {
        chart: {
          result: [
            {
              meta: { regularMarketPrice: 76.38, regularMarketTime: 1789119903 },
              timestamp: [1767152700],
              indicators: { quote: [{ close: [79.22] }] },
            },
          ],
        },
      },
      'NHPC.NS',
      '2026-09-13T00:00:00.000Z',
    )
    expect(quotes.at(-1)).toMatchObject({ ticker: 'NHPC.NS', closeMinor: 7_638 })
    expect(quotes.at(-1)?.date).toBe('2026-09-11')
  })

  it('treats a cache as current across a weekend at month end', () => {
    expect(quoteRangeIsCovered(['2026-09-01', '2026-09-11'], '2026-09-01', '2026-09-30', '2026-09-13')).toBe(true)
    expect(quoteRangeIsCovered(['2026-08-01'], '2026-09-01', '2026-09-30', '2026-09-13')).toBe(false)
    expect(quoteRangeIsCovered(['2026-09-11'], '2026-01-01', '2026-09-30', '2026-09-13')).toBe(false)
    expect(addDays('2026-09-13', 1)).toBe('2026-09-14')
  })
})
