import { dateOnDay, monthsInclusive } from '@/domain/sip'
import { IncomeSource, Transaction } from '@/domain/types'
import { todayIso } from '@/domain/money'

export function incomeOccurrences(source: IncomeSource, from: string, to: string) {
  if (source.schedule === 'once') {
    if (source.startDate >= from && source.startDate <= to) {
      return [{ date: source.startDate, amountMinor: source.amountMinor }]
    }
    return []
  }
  const startMonth = source.startDate.slice(0, 7)
  const endMonth = to.slice(0, 7)
  if (endMonth < startMonth) return []
  const fromMonth = from.slice(0, 7) > startMonth ? from.slice(0, 7) : startMonth
  return monthsInclusive(fromMonth, endMonth)
    .map((month) => ({
      date: dateOnDay(month, source.dayOfMonth ?? Number(source.startDate.slice(8, 10))),
      amountMinor: source.amountMinor,
    }))
    .filter((item) => item.date >= source.startDate && item.date >= from && item.date <= to)
}

export function sumScheduledIncome(sources: IncomeSource[], range: { from?: string; to?: string } = {}, asOf = todayIso()) {
  const from = range.from ?? '0000-01-01'
  const to = range.to ?? asOf
  return sources.reduce((sum, source) => sum + incomeOccurrences(source, from, to).reduce((inner, item) => inner + item.amountMinor, 0), 0)
}

export function incomeForRange(
  sources: IncomeSource[] | undefined,
  transactions: Transaction[],
  range: { from?: string; to?: string } = {},
  asOf = todayIso(),
) {
  const list = sources ?? []
  if (list.length) return sumScheduledIncome(list, range, asOf)
  return transactions
    .filter((tx) => tx.flow === 'inflow' && (!range.from || tx.date >= range.from) && (!range.to || tx.date <= range.to))
    .reduce((sum, tx) => sum + tx.amountMinor, 0)
}
