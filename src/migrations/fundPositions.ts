import Papa from 'papaparse'
import { dateOnDay, monthsInclusive, sipEventId } from '@/domain/sip'
import { toMinor } from '@/domain/money'
import { Holding, SipEvent, SipStatus } from '@/domain/types'

export type FundSheetRow = {
  name: string
  current: number
  invested: number
  sipAmount: number
  sipDay: number
  startDate: string
  skipped: string[]
  failed: string[]
  amounts: { fromMonth: string; rupees: number }[]
}

export function parseFundSheet(csv: string): FundSheetRow[] {
  return Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true }).data.map((row) => ({
    name: row.Name.trim(),
    current: Number(row.Current),
    invested: Number(row.Invested),
    sipAmount: Number(row['SIP Amount']),
    sipDay: Number(row['SIP Day']),
    startDate: row['Start Date'],
    skipped: splitList(row.Skipped),
    failed: splitList(row.Failed),
    amounts: (row['Amount ladder'] || '').split(';').flatMap((part) => {
      const [fromMonth, rupees] = part.split(':')
      if (!fromMonth || !rupees) return []
      return [{ fromMonth, rupees: Number(rupees) }]
    }),
  }))
}

function splitList(value = '') {
  return value
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)
}

export function amountAt(amounts: FundSheetRow['amounts'], month: string) {
  let rupees = 0
  for (const change of amounts) {
    if (change.fromMonth <= month) rupees = change.rupees
  }
  return rupees
}

export function fundHoldingsFromSheet(rows: FundSheetRow[], existing: Holding[]): Holding[] {
  const byName = new Map(existing.filter((item) => item.kind === 'mutual_fund').map((item) => [item.name, item]))
  return rows.map((row, index) => {
    const previous = byName.get(row.name)
    return {
      ...previous,
      id: previous?.id ?? `holding-mf-${index + 1}`,
      name: row.name,
      kind: 'mutual_fund' as const,
      purchaseMode: 'sip' as const,
      currentMinor: toMinor(row.current),
      investedMinor: toMinor(row.invested),
      qty: null,
      ticker: previous?.ticker ?? null,
      buyDate: row.startDate,
      avgPrice: null,
      marketPrice: null,
      sipAmountMinor: toMinor(row.sipAmount),
      sipDayOfMonth: row.sipDay,
      sipStartMonth: row.startDate.slice(0, 7),
      notes: previous?.notes ?? 'Imported fund position.',
      origin: 'user' as const,
    }
  })
}

export function fundSipEventsFromSheet(rows: FundSheetRow[], holdings: Holding[], asOfMonth: string): SipEvent[] {
  const byName = new Map(holdings.map((item) => [item.name, item]))
  return rows.flatMap((row) => {
    const holding = byName.get(row.name)
    if (!holding) return []
    const skipped = new Set(row.skipped)
    const failed = new Set(row.failed)
    return monthsInclusive(row.startDate.slice(0, 7), asOfMonth).map((month) => {
      const status: SipStatus = failed.has(month) ? 'failed' : skipped.has(month) ? 'skipped' : 'paid'
      const rupees = amountAt(row.amounts, month) || row.sipAmount
      return {
        id: sipEventId(holding.id, month),
        holdingId: holding.id,
        month,
        status,
        amountMinor: status === 'paid' ? toMinor(rupees) : null,
        notedAt: `${dateOnDay(month, row.sipDay)}T00:00:00.000Z`,
        origin: 'user' as const,
      }
    })
  })
}

export { holdingDate } from '@/domain/sip'
