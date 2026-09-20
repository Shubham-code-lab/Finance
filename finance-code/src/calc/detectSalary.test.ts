import { describe, expect, it } from 'vitest'
import { detectRecurringCredits } from '@/calc/detectSalary'
import { ledgerEvents } from '@/features/assets/fromLedgers'

describe('ICICI recurring credits', () => {
  it('finds month-end salary from an anonymized ledger fixture', () => {
    const rows = [
      { date: '2026-06-30', spend: 0, balance: 100_000, sourceRowId: 'r0' },
      { date: '2026-07-31', spend: 0, balance: 175_000, sourceRowId: 'r1' },
      { date: '2026-08-31', spend: 0, balance: 250_000, sourceRowId: 'r2' },
    ]
    const { transactions } = ledgerEvents({
      rows,
      tableId: 'icici',
      accountId: 'icici',
      spendCategoryId: 'google-spend',
      incomeCategoryId: 'salary',
      classifyOutflow: () => 'spend',
    })
    const detected = detectRecurringCredits(transactions.filter((tx) => tx.flow === 'inflow'))
    const salary = detected.find((item) => item.dates.includes('2026-07-31') && item.dates.includes('2026-08-31'))
    expect(salary?.typicalDay).toBe(31)
    expect(salary?.dates).toEqual(['2026-07-31', '2026-08-31'])
  })
})
