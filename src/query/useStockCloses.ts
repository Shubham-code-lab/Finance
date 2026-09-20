import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { DailyClose } from '@/calc/stockPerformance'
import { Holding } from '@/domain/types'
import { getDailyCloses } from '@/market/stockQuotes'

export type StockCloseResult = { closes: DailyClose[]; error: string }

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
            return [holding.id, { closes, error: '' }] as const
          } catch (error) {
            return [
              holding.id,
              {
                closes: [] as DailyClose[],
                error: `${holding.name}: ${error instanceof Error ? error.message : 'Quote request failed'}`,
              },
            ] as const
          }
        }),
      )
      return Object.fromEntries(entries) as Record<string, StockCloseResult>
    },
  })
}
