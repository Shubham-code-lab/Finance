import { Holding, SipEvent } from '@/domain/types'
import { todayIso } from '@/domain/money'

export function currentMonth(date = new Date()) {
  return todayIso(date).slice(0, 7)
}

export function lastDayOfMonth(month: string) {
  const year = Number(month.slice(0, 4))
  const monthNumber = Number(month.slice(5, 7))
  return new Date(year, monthNumber, 0).getDate()
}

export function dateOnDay(month: string, day: number) {
  const last = lastDayOfMonth(month)
  const clamped = Math.min(Math.max(day || 1, 1), last)
  return `${month}-${String(clamped).padStart(2, '0')}`
}

export function addMonths(month: string, count: number) {
  const date = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + count, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function monthsInclusive(fromMonth: string, toMonth: string): string[] {
  if (!/^\d{4}-\d{2}$/.test(fromMonth) || !/^\d{4}-\d{2}$/.test(toMonth) || fromMonth > toMonth) return []
  const months: string[] = []
  let year = Number(fromMonth.slice(0, 4))
  let month = Number(fromMonth.slice(5, 7))
  const endYear = Number(toMonth.slice(0, 4))
  const endMonth = Number(toMonth.slice(5, 7))
  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push(`${year}-${String(month).padStart(2, '0')}`)
    month += 1
    if (month === 13) {
      month = 1
      year += 1
    }
  }
  return months
}

export function sipEventId(holdingId: string, month: string) {
  return `sip:${holdingId}:${month}`
}

export function holdingDate(holding: Pick<Holding, 'buyDate' | 'sipStartMonth' | 'sipDayOfMonth'>) {
  if (holding.buyDate) return holding.buyDate
  if (holding.sipStartMonth) return dateOnDay(holding.sipStartMonth, holding.sipDayOfMonth ?? 1)
  return ''
}

export type PendingSip = { holding: Holding; month: string }

export function pendingSipChecks(holdings: Holding[], events: SipEvent[], asOf = todayIso()): PendingSip[] {
  const asOfMonth = asOf.slice(0, 7)
  const byHolding = new Map<string, SipEvent[]>()
  events.forEach((event) => {
    const list = byHolding.get(event.holdingId) ?? []
    list.push(event)
    byHolding.set(event.holdingId, list)
  })
  const pending: PendingSip[] = []
  holdings
    .filter((holding) => holding.purchaseMode === 'sip' && holding.sipStartMonth)
    .forEach((holding) => {
      const start = holding.sipStartMonth as string
      const history = byHolding.get(holding.id) ?? []
      const cancelledMonth = history
        .filter((event) => event.status === 'cancelled')
        .map((event) => event.month)
        .sort()[0]
      const end = cancelledMonth && cancelledMonth < asOfMonth ? cancelledMonth : asOfMonth
      const answered = new Set(history.map((event) => event.month))
      monthsInclusive(start, end).forEach((month) => {
        if (cancelledMonth && month >= cancelledMonth) return
        if (answered.has(month)) return
        const due = dateOnDay(month, holding.sipDayOfMonth ?? 1)
        if (due > asOf) return
        pending.push({ holding, month })
      })
    })
  return pending.sort((left, right) => left.month.localeCompare(right.month) || left.holding.name.localeCompare(right.holding.name))
}
