import { describe, expect, it } from 'vitest'
import { fundHoldingsFromSheet, fundSipEventsFromSheet, holdingDate, parseFundSheet } from '@/migrations/fundPositions'

const fundCsv = `Name,Current,Invested,SIP Amount,SIP Day,Start Date,Skipped,Failed,Amount ladder
Balanced Fund A,120000,100000,10000,6,2024-05-06,,,2024-05:10000
Index Fund B,80000,70000,5000,10,2025-01-10,,,2025-01:5000
Gold Index Fund,45000,40000,15000,26,2025-05-26,2025-06,2026-07,2025-05:15000`

describe('mutual fund asset sheet', () => {
  it('parses the three SIPs with start dates', () => {
    const rows = parseFundSheet(fundCsv)
    expect(rows.map((row) => row.name)).toHaveLength(3)
    const holdings = fundHoldingsFromSheet(rows, [])
    expect(holdingDate(holdings[0])).toBe('2024-05-06')
    expect(holdings.find((item) => item.name.includes('Gold'))?.buyDate).toBe('2025-05-26')
  })

  it('marks skipped and failed months instead of inventing paid SIPs', () => {
    const rows = parseFundSheet(fundCsv)
    const holdings = fundHoldingsFromSheet(rows, [])
    const events = fundSipEventsFromSheet(rows, holdings, '2026-09')
    const gold = holdings.find((item) => item.name.includes('Gold'))!
    const goldEvents = events.filter((item) => item.holdingId === gold.id)
    expect(goldEvents.find((item) => item.month === '2025-06')?.status).toBe('skipped')
    expect(goldEvents.find((item) => item.month === '2026-07')?.status).toBe('failed')
    expect(goldEvents.find((item) => item.month === '2025-05')?.amountMinor).toBe(15_000_00)
  })
})
