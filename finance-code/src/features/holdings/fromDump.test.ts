import { describe, expect, it } from 'vitest'
import { snapshotsFromHoldings } from '@/features/holdings/fromDump'
import { Holding, SipEvent } from '@/domain/types'

const fund: Holding = {
  id: 'mf-1',
  name: 'Test fund',
  kind: 'mutual_fund',
  purchaseMode: 'sip',
  currentMinor: 120_000_00,
  investedMinor: 100_000_00,
  qty: null,
  avgPrice: null,
  marketPrice: null,
  sipAmountMinor: 10_000_00,
  sipDayOfMonth: 6,
  sipStartMonth: '2026-01',
  notes: '',
  origin: 'user',
}

function paid(month: string, amount: number): SipEvent {
  return {
    id: `sip:mf-1:${month}`,
    holdingId: 'mf-1',
    month,
    status: 'paid',
    amountMinor: amount,
    notedAt: '2026-09-06T00:00:00.000Z',
    origin: 'user',
  }
}

describe('investment snapshots from SIP dates', () => {
  it('steps cost up on each paid SIP date and uses market value as of today', () => {
    const snapshots = snapshotsFromHoldings([fund], '2026-09-06', [
      paid('2026-01', 10_000_00),
      paid('2026-02', 10_000_00),
      { ...paid('2026-03', 10_000_00), status: 'skipped', amountMinor: null },
    ])
    const mf = snapshots.filter((item) => item.accountId === 'mutual-funds')
    expect(mf.map((item) => [item.date, item.valueMinor])).toEqual([
      ['2026-01-06', 10_000_00],
      ['2026-02-06', 20_000_00],
      ['2026-09-06', 120_000_00],
    ])
    expect(mf[mf.length - 1].costBasisMinor).toBe(20_000_00)
  })

  it('falls back to a single live snapshot when there are no paid months', () => {
    const snapshots = snapshotsFromHoldings([fund], '2026-09-06', [])
    expect(snapshots.find((item) => item.accountId === 'mutual-funds')).toMatchObject({
      date: '2026-09-06',
      valueMinor: 120_000_00,
      costBasisMinor: 100_000_00,
    })
  })
})
