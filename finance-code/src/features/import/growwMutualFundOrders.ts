import { toMinor } from '@/domain/money'
import { Holding, SipEvent } from '@/domain/types'
import { sipEventId } from '@/domain/sip'

export type GrowwMutualFundImport = {
  holdings: Holding[]
  closedHoldingIds: string[]
  sipEvents: SipEvent[]
  orderCount: number
  ignoredCount: number
  periodFrom: string
  periodTo: string
}

type Order = { name: string; type: string; units: number; nav: number; amount: number; date: string }

function numberValue(value: unknown) {
  const parsed = Number(
    String(value ?? '')
      .replace(/,/g, '')
      .trim(),
  )
  return Number.isFinite(parsed) ? parsed : 0
}

function isoDate(value: unknown) {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  const match = String(value ?? '')
    .trim()
    .match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/)
  if (!match) return ''
  const month = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(match[2].toLowerCase()) + 1
  return month ? `${match[3]}-${String(month).padStart(2, '0')}-${match[1].padStart(2, '0')}` : ''
}

function normalized(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function stableSuffix(value: string) {
  let hash = 2166136261
  for (const character of value) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

function mode(values: number[]) {
  const counts = new Map<number, number>()
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1))
  return [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0] - right[0])[0]?.[0] ?? 1
}

export function growwMutualFundOrdersFromRows(rows: unknown[][], existing: Holding[] = []): GrowwMutualFundImport {
  const headerIndex = rows.findIndex((row) => row.map(String).includes('Scheme Name') && row.map(String).includes('Transaction Type'))
  if (headerIndex < 0) throw new Error('This is not a supported Groww mutual-fund order-history file.')
  const headers = rows[headerIndex].map((value) => String(value ?? '').trim())
  const index = (name: string) => headers.indexOf(name)
  const parsed = rows.slice(headerIndex + 1).flatMap((row): Order[] => {
    const order = {
      name: String(row[index('Scheme Name')] ?? '').trim(),
      type: String(row[index('Transaction Type')] ?? '')
        .trim()
        .toUpperCase(),
      units: numberValue(row[index('Units')]),
      nav: numberValue(row[index('NAV')]),
      amount: numberValue(row[index('Amount')]),
      date: isoDate(row[index('Date')]),
    }
    return order.name && order.date && order.units > 0 && order.amount > 0 ? [order] : []
  })
  if (!parsed.length) throw new Error('No valid mutual-fund orders were found in this file.')

  const existingByName = new Map(existing.filter((item) => item.kind === 'mutual_fund').map((item) => [normalized(item.name), item]))
  const grouped = new Map<string, Order[]>()
  parsed.forEach((order) => grouped.set(order.name, [...(grouped.get(order.name) ?? []), order]))
  const sipEvents: SipEvent[] = []
  const closedHoldingIds: string[] = []
  const holdings = [...grouped.entries()].flatMap(([name, unordered]): Holding[] => {
    const orders = [...unordered].sort((left, right) => left.date.localeCompare(right.date))
    let units = 0
    let cost = 0
    let positionStart = ''
    orders.forEach((order) => {
      const outgoing = /REDEMPTION|SELL|SWITCH[ -]?OUT/.test(order.type)
      if (outgoing) {
        const removed = Math.min(units, order.units)
        const averageCost = units > 0 ? cost / units : 0
        units -= removed
        cost = Math.max(0, cost - removed * averageCost)
        if (units < 0.000001) {
          units = 0
          cost = 0
          positionStart = ''
        }
      } else {
        if (!units) positionStart = order.date
        units += order.units
        cost += order.amount
      }
    })
    if (!units) {
      const previous = existingByName.get(normalized(name))
      if (previous) closedHoldingIds.push(previous.id)
      return []
    }
    const purchases = orders.filter((order) => !/REDEMPTION|SELL|SWITCH[ -]?OUT/.test(order.type))
    const latest = orders.at(-1) as Order
    const previous = existingByName.get(normalized(name))
    const id = previous?.id ?? `groww-mf-${stableSuffix(normalized(name))}`
    const purchaseMode = purchases.length > 1 ? 'sip' : 'lumpsum'
    const monthlyPurchases = new Map<string, Order[]>()
    purchases.forEach((order) =>
      monthlyPurchases.set(order.date.slice(0, 7), [...(monthlyPurchases.get(order.date.slice(0, 7)) ?? []), order]),
    )
    if (purchaseMode === 'sip') {
      monthlyPurchases.forEach((monthOrders, month) => {
        sipEvents.push({
          id: sipEventId(id, month),
          holdingId: id,
          month,
          status: 'paid',
          amountMinor: toMinor(monthOrders.reduce((sum, order) => sum + order.amount, 0)),
          notedAt: `${monthOrders.sort((left, right) => left.date.localeCompare(right.date))[0].date}T00:00:00.000Z`,
          origin: 'user',
        })
      })
    }
    const latestPurchase = purchases.at(-1) as Order
    return [
      {
        ...(previous ?? {}),
        id,
        name,
        kind: 'mutual_fund',
        purchaseMode,
        currentMinor: toMinor(units * latest.nav),
        investedMinor: toMinor(cost),
        qty: units,
        ticker: previous?.ticker ?? null,
        buyDate: positionStart || purchases[0]?.date || null,
        avgPrice: units ? cost / units : null,
        marketPrice: latest.nav,
        marketPriceAsOf: latest.date,
        marketPriceSource: 'import',
        sipAmountMinor: purchaseMode === 'sip' ? toMinor(latestPurchase.amount) : null,
        sipDayOfMonth: purchaseMode === 'sip' ? mode(purchases.map((order) => Number(order.date.slice(8, 10)))) : null,
        sipStartMonth: purchaseMode === 'sip' ? (positionStart || purchases[0].date).slice(0, 7) : null,
        notes: previous?.notes ?? 'Imported from Groww mutual-fund order history.',
        origin: 'user',
      },
    ]
  })
  const dates = parsed.map((order) => order.date).sort()
  return {
    holdings,
    closedHoldingIds,
    sipEvents,
    orderCount: parsed.length,
    ignoredCount: Math.max(0, rows.length - headerIndex - 1 - parsed.length),
    periodFrom: dates[0],
    periodTo: dates.at(-1) ?? dates[0],
  }
}

export async function parseGrowwMutualFundOrders(file: Blob, existing: Holding[] = []) {
  const { default: readXlsxFile } = await import('read-excel-file')
  return growwMutualFundOrdersFromRows(await readXlsxFile(file), existing)
}
