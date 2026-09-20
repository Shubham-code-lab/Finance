import { describe, expect, it } from 'vitest'
import { pendingSipChecks } from '@/domain/sip'
import { Holding, SipEvent } from '@/domain/types'

const holding = (id: string, start: string): Holding => ({
  id,
  name: id,
  kind: 'mutual_fund',
  purchaseMode: 'sip',
  currentMinor: 100,
  investedMinor: 100,
  qty: null,
  avgPrice: null,
  marketPrice: null,
  sipAmountMinor: 1000_00,
  sipDayOfMonth: 5,
  sipStartMonth: start,
  notes: '',
  origin: 'user',
})

describe('SIP month dump', () => {
  it('asks for months with no stored paid/skipped/cancelled row', () => {
    const funds = [holding('ppfc', '2026-07')]
    const events: SipEvent[] = [
      {
        id: 'sip:ppfc:2026-07',
        holdingId: 'ppfc',
        month: '2026-07',
        status: 'paid',
        amountMinor: 1000_00,
        notedAt: '2026-07-05T00:00:00.000Z',
        origin: 'user',
      },
    ]
    const pending = pendingSipChecks(funds, events, '2026-09-30')
    expect(pending.map((item) => item.month)).toEqual(['2026-08', '2026-09'])
  })

  it('stops asking after a cancelled month', () => {
    const funds = [holding('gold', '2026-06')]
    const events: SipEvent[] = [
      {
        id: 'sip:gold:2026-07',
        holdingId: 'gold',
        month: '2026-07',
        status: 'cancelled',
        amountMinor: null,
        notedAt: '2026-07-01T00:00:00.000Z',
        origin: 'user',
      },
    ]
    const pending = pendingSipChecks(funds, events, '2026-09-30')
    expect(pending.map((item) => item.month)).toEqual(['2026-06'])
  })

  it('does not ask before the SIP day of the month', () => {
    expect(pendingSipChecks([holding('gold', '2026-09')], [], '2026-09-04')).toHaveLength(0)
    expect(pendingSipChecks([holding('gold', '2026-09')], [], '2026-09-05')).toHaveLength(1)
  })
})
