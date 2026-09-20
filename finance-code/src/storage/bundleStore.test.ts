import { describe, expect, it } from 'vitest'
import { bundlePlan } from '@/storage/bundleStore'

describe('Firestore bundle layout', () => {
  it('groups transaction documents by month instead of writing one Firestore document per row', () => {
    const transactions = Array.from({ length: 614 }, (_, index) => ({
      id: `transaction-${index}`,
      date: `2026-${String((index % 12) + 1).padStart(2, '0')}-${String((index % 28) + 1).padStart(2, '0')}`,
      memo: `ICICI transaction ${index}`,
    }))
    const plan = bundlePlan('transactions', transactions)
    expect(plan).toHaveLength(24)
    expect(plan.reduce((sum, bundle) => sum + bundle.records, 0)).toBe(614)
    expect(Math.max(...plan.map((bundle) => bundle.bytes))).toBeLessThan(850_000)
  })

  it('keeps small settings collections in one document', () => {
    expect(
      bundlePlan('accounts', [
        { id: 'icici', name: 'ICICI' },
        { id: 'sbi', name: 'SBI' },
      ]),
    ).toHaveLength(1)
    expect(bundlePlan('forecastSettings', [{ id: 'default', months: 12 }])).toHaveLength(1)
  })
})
