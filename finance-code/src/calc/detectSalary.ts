import { Transaction } from '@/domain/types'

export type RecurringCredit = {
  amountMinor: number
  occurrences: number
  days: number[]
  typicalDay: number
  dates: string[]
}

function roundBucket(amountMinor: number) {
  return Math.round(amountMinor / 10000) * 10000
}

export function detectRecurringCredits(credits: Transaction[]): RecurringCredit[] {
  const groups = new Map<number, Transaction[]>()
  credits
    .filter((tx) => tx.flow === 'inflow' && tx.amountMinor >= 20_000_00)
    .forEach((tx) => {
      const key = roundBucket(tx.amountMinor)
      const list = groups.get(key) ?? []
      list.push(tx)
      groups.set(key, list)
    })
  return [...groups.entries()]
    .map(([, list]) => {
      const days = list.map((tx) => Number(tx.date.slice(8, 10))).sort((a, b) => a - b)
      const typicalDay = days[Math.floor(days.length / 2)]
      const amounts = list.map((tx) => tx.amountMinor).sort((a, b) => a - b)
      return {
        amountMinor: amounts[Math.floor(amounts.length / 2)],
        occurrences: list.length,
        days,
        typicalDay,
        dates: list.map((tx) => tx.date).sort(),
      }
    })
    .sort((left, right) => right.occurrences - left.occurrences || right.amountMinor - left.amountMinor)
}
