import { describe, expect, it } from 'vitest'
import { excelSerialToIso, toIsoDate } from '@/domain/dates'

describe('excel dates', () => {
  it('converts SBI and ICICI serials to 2026 calendar dates', () => {
    expect(excelSerialToIso(46023)).toBe('2026-01-01')
    expect(toIsoDate(46027)).toBe('2026-01-05')
    expect(toIsoDate('46027')).toBe('2026-01-05')
    expect(toIsoDate('2026-03-01')).toBe('2026-03-01')
  })
})
