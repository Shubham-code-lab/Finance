import { describe, expect, it } from 'vitest'
import { formatPrivateMoney, formatPrivateNumber } from '@/privacy/privacy'

describe('privacy formatting', () => {
  it('reveals only the final three whole-unit digits for money', () => {
    expect(formatPrivateMoney(12_882_600, 'INR', false, true)).toBe('₹xxxxx826')
    expect(formatPrivateMoney(-4_000_000, 'INR', false, true)).toBe('-₹xxxxx000')
  })

  it('leaves values unchanged when privacy mode is off', () => {
    expect(formatPrivateMoney(12_882_600, 'INR', false, false)).toBe('₹1,28,826')
    expect(formatPrivateNumber(128_826, false)).toBe('1,28,826')
  })

  it('masks chart-axis values while preserving their sign', () => {
    expect(formatPrivateNumber(128_826, true)).toBe('xxxxx826')
    expect(formatPrivateNumber(-40_000, true)).toBe('-xxxxx000')
  })
})
