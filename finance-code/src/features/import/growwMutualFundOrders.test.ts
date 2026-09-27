import { describe, expect, it } from 'vitest'
import { growwMutualFundOrdersFromRows } from '@/features/import/growwMutualFundOrders'

describe('Groww mutual-fund order import', () => {
  it('ignores personal headers and builds positions plus paid SIP events', () => {
    const result = growwMutualFundOrdersFromRows([
      ['Personal Details'],
      ['Name', 'Private person'],
      ['Scheme Name', 'Transaction Type', 'Units', 'NAV', 'Amount', 'Date'],
      ['Example Direct Growth', 'PURCHASE', '10', '100', '1,000', '06 Jan 2026'],
      ['Example Direct Growth', 'PURCHASE', '8', '125', '1,000', '06 Feb 2026'],
    ])
    expect(result).toMatchObject({ orderCount: 2, periodFrom: '2026-01-06', periodTo: '2026-02-06' })
    expect(result.holdings[0]).toMatchObject({
      name: 'Example Direct Growth',
      purchaseMode: 'sip',
      qty: 18,
      investedMinor: 200_000,
      currentMinor: 225_000,
      sipDayOfMonth: 6,
      sipStartMonth: '2026-01',
    })
    expect(result.sipEvents.map((event) => [event.month, event.status, event.amountMinor])).toEqual([
      ['2026-01', 'paid', 100_000],
      ['2026-02', 'paid', 100_000],
    ])
  })

  it('reduces units and cost basis for redemptions', () => {
    const result = growwMutualFundOrdersFromRows([
      ['Scheme Name', 'Transaction Type', 'Units', 'NAV', 'Amount', 'Date'],
      ['Example Fund', 'PURCHASE', 10, 100, 1000, '06 Jan 2026'],
      ['Example Fund', 'REDEMPTION', 4, 120, 480, '06 Feb 2026'],
    ])
    expect(result.holdings[0]).toMatchObject({ qty: 6, investedMinor: 60_000, currentMinor: 72_000 })
  })

  it('removes a previously saved fund after a full redemption', () => {
    const existing = growwMutualFundOrdersFromRows([
      ['Scheme Name', 'Transaction Type', 'Units', 'NAV', 'Amount', 'Date'],
      ['Example Fund', 'PURCHASE', 10, 100, 1000, '06 Jan 2026'],
    ]).holdings[0]
    const result = growwMutualFundOrdersFromRows(
      [
        ['Scheme Name', 'Transaction Type', 'Units', 'NAV', 'Amount', 'Date'],
        ['Example Fund', 'PURCHASE', 10, 100, 1000, '06 Jan 2026'],
        ['Example Fund', 'REDEMPTION', 10, 120, 1200, '06 Feb 2026'],
      ],
      [existing],
    )
    expect(result.holdings).toEqual([])
    expect(result.closedHoldingIds).toEqual([existing.id])
  })
})
