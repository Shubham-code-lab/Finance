import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { DailyClose } from '@/calc/stockPerformance'
import { Holding } from '@/domain/types'
import { getDailyCloses } from '@/market/stockQuotes'
import { canonicalStockAlias } from '@/market/stockAliases'

export type StockCloseResult = { closes: DailyClose[]; error: string; warning: string }

export function useStockCloses(holdings: Holding[], asOf: string) {
  const key = holdings
    .map((holding) => `${holding.id}:${holding.ticker}:${holding.buyDate}`)
    .sort()
    .join('|')
  return useQuery({
    queryKey: ['stock-closes', asOf, key],
    enabled: holdings.length > 0 && Boolean(asOf),
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const entries = await Promise.all(
        holdings.map(async (holding) => {
          try {
            const closes = await getDailyCloses(holding.ticker!, holding.buyDate!, asOf)
            return [holding.id, { closes, error: '', warning: '' }] as const
          } catch (error) {
            const alias = canonicalStockAlias(holding)
            if (alias && holding.marketPrice && holding.marketPrice > 0) {
              return [
                holding.id,
                {
                  closes: [
                    {
                      date: holding.marketPriceAsOf ?? holding.buyDate ?? asOf,
                      closeMinor: Math.round(holding.marketPrice * 100),
                    },
                  ],
                  error: '',
                  warning: `${holding.name}: live quote unavailable; showing the last imported price${
                    holding.marketPriceAsOf ? ` from ${holding.marketPriceAsOf}` : ''
                  }.`,
                },
              ] as const
            }
            return [
              holding.id,
              {
                closes: [] as DailyClose[],
                error: `${holding.name}: ${error instanceof Error ? error.message : 'Quote request failed'}`,
                warning: '',
              },
            ] as const
          }
        }),
      )
      return Object.fromEntries(entries) as Record<string, StockCloseResult>
    },
  })
}
