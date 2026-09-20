import { dateOnDay } from '@/domain/sip'
import { AccountSnapshot, Holding, SipEvent } from '@/domain/types'

function snap(id: string, accountId: string, date: string, valueMinor: number, costBasisMinor: number): AccountSnapshot {
  return { id, accountId, date, valueMinor, costBasisMinor, origin: 'user', sourceTableId: null }
}

function accountSnapshots(accountId: string, holdings: Holding[], sipEvents: SipEvent[], asOf: string): AccountSnapshot[] {
  if (!holdings.length) return []
  const ids = new Set(holdings.map((holding) => holding.id))
  const byId = new Map(holdings.map((holding) => [holding.id, holding]))
  const addedByDate = new Map<string, number>()
  for (const event of sipEvents) {
    if (!ids.has(event.holdingId) || event.status !== 'paid' || !event.amountMinor) continue
    const date = dateOnDay(event.month, byId.get(event.holdingId)?.sipDayOfMonth ?? 1)
    if (date > asOf) continue
    addedByDate.set(date, (addedByDate.get(date) ?? 0) + event.amountMinor)
  }
  const snapshots: AccountSnapshot[] = []
  let cost = 0
  for (const date of [...addedByDate.keys()].sort()) {
    cost += addedByDate.get(date) ?? 0
    snapshots.push(snap(`${accountId}-${date}`, accountId, date, cost, cost))
  }
  const current = holdings.reduce((sum, holding) => sum + holding.currentMinor, 0)
  const invested = holdings.reduce((sum, holding) => sum + holding.investedMinor, 0)
  const costBasis = cost || invested
  if (!snapshots.length || snapshots[snapshots.length - 1].date !== asOf) {
    snapshots.push(snap(`${accountId}-live`, accountId, asOf, current, costBasis))
    return snapshots
  }
  snapshots[snapshots.length - 1] = { ...snapshots[snapshots.length - 1], valueMinor: current, costBasisMinor: costBasis }
  return snapshots
}

/** Historical points are cumulative paid SIP (cost). The as-of point is live market value. */
export function snapshotsFromHoldings(holdings: Holding[], asOf: string, sipEvents: SipEvent[] = []): AccountSnapshot[] {
  return [
    ...accountSnapshots(
      'mutual-funds',
      holdings.filter((item) => item.kind === 'mutual_fund'),
      sipEvents,
      asOf,
    ),
    ...accountSnapshots(
      'stocks-portfolio',
      holdings.filter((item) => item.kind === 'stock'),
      sipEvents,
      asOf,
    ),
  ]
}
