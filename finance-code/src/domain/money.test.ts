import { describe, expect, it } from 'vitest'
import { formatDateLabel, formatMoney, formatMonthLabel } from '@/domain/money'

describe('money formatting', () => {
  it('rounds positive and negative paise without directional bias', () => {
    expect(formatMoney(1_321_925)).toBe('₹13,219')
    expect(formatMoney(-719_960)).toBe('-₹7,200')
  })
  it('can show paise for exact account reconciliation', () => {
    expect(formatMoney(1_321_925, 'INR', true)).toBe('\u20b913,219.25')
  })
  it('uses short month names in user-facing dates', () => {
    expect(formatMonthLabel('2026-09')).toBe('Sep 2026')
    expect(formatDateLabel('2026-09-15')).toBe('15 Sep 2026')
  })
})
