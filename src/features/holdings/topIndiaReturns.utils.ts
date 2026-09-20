import { DailyClose } from '@/calc/stockPerformance'
import { DateRangeValue } from '@/components/dateRange'
import { IndiaStock } from '@/market/indiaUniverse'
import { addDays } from '@/market/stockQuotes'

export type RankedIndiaStock = IndiaStock & {
  closes: DailyClose[]
  first: DailyClose
  last: DailyClose
  changeMinor: number
  returnPct: number
}

export function rankIndiaReturns(stocks: IndiaStock[], history: Record<string, DailyClose[]>, range: DateRangeValue, count: number) {
  const startLimit = addDays(range.from, 7)
  const endLimit = addDays(range.to, -7)
  return stocks
    .flatMap((stock): RankedIndiaStock[] => {
      const closes = history[stock.ticker] ?? []
      const first = closes[0]
      const last = closes.at(-1)
      if (!first || !last || first.date > startLimit || last.date < endLimit || first.closeMinor <= 0) return []
      const changeMinor = last.closeMinor - first.closeMinor
      return [{ ...stock, closes, first, last, changeMinor, returnPct: changeMinor / first.closeMinor }]
    })
    .sort((left, right) => right.returnPct - left.returnPct)
    .slice(0, count)
}
