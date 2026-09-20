import { Holding } from '@/domain/types'

export type DailyClose = { date: string; closeMinor: number }

export type StockPerformancePoint = {
  date: string
  valueMinor: number
  costMinor: number
  pnlMinor: number
  pnlPct: number | null
}

export function performanceHoldings(holdings: Holding[]) {
  return holdings.filter(
    (holding) => holding.kind === 'stock' && holding.purchaseMode !== 'sip' && Boolean(holding.ticker?.trim()) && Boolean(holding.buyDate),
  )
}

export function calculateStockPerformance(
  holding: Pick<Holding, 'buyDate' | 'investedMinor' | 'qty'>,
  closes: DailyClose[],
  range: { from: string; to: string },
): StockPerformancePoint[] {
  const buyDate = holding.buyDate
  if (!buyDate || !closes.length || range.from > range.to) return []
  const ordered = [...closes]
    .filter((bar) => bar.date >= buyDate && bar.closeMinor > 0)
    .sort((left, right) => left.date.localeCompare(right.date))
  const buyClose = ordered[0]?.closeMinor
  if (!buyClose) return []
  const qty = holding.qty ?? holding.investedMinor / buyClose
  if (!Number.isFinite(qty) || qty < 0) return []

  return ordered
    .filter((bar) => bar.date >= range.from && bar.date <= range.to)
    .map((bar) => {
      const valueMinor = Math.round(qty * bar.closeMinor)
      const pnlMinor = valueMinor - holding.investedMinor
      return {
        date: bar.date,
        valueMinor,
        costMinor: holding.investedMinor,
        pnlMinor,
        pnlPct: holding.investedMinor ? pnlMinor / holding.investedMinor : null,
      }
    })
}
