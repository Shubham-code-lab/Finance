import { describe, expect, it } from 'vitest'
import { isRecurringTransferAmount } from '@/calc/classify'
import { ledgerEvents } from '@/features/assets/fromLedgers'

describe('SBI xlsx', () => {
  it('classifies recurring SIP amounts from an anonymized ledger fixture', () => {
    const rows = [
      { date: '2025-10-06', spend: 10_000, balance: 90_000, sourceRowId: 'r1' },
      { date: '2025-11-06', spend: 10_000, balance: 80_000, sourceRowId: 'r2' },
      { date: '2025-12-06', spend: 40_000, balance: 40_000, sourceRowId: 'r3' },
      { date: '2026-01-06', spend: 10_000, balance: 30_000, sourceRowId: 'r4' },
      { date: '2026-02-06', spend: 10_000, balance: 20_000, sourceRowId: 'r5' },
    ]
    const { transactions } = ledgerEvents({
      rows,
      tableId: 'sbi',
      accountId: 'sbi',
      spendCategoryId: 'sbi-spend',
      sipCategoryId: 'sip-mf',
      incomeCategoryId: 'salary',
      classifyOutflow: (rupees) => (isRecurringTransferAmount(rupees) ? 'sip' : 'spend'),
    })
    const sips = transactions.filter((tx) => tx.categoryId === 'sip-mf')
    const tenK = sips.filter((tx) => tx.amountMinor === 1_000_000)
    const fortyK = sips.filter((tx) => tx.amountMinor === 4_000_000)
    expect(tenK.length).toBeGreaterThan(fortyK.length)
    expect(fortyK.length).toBeGreaterThan(0)
    const sipMonths = [...new Set(sips.map((tx) => tx.date.slice(0, 7)))]
    expect(sipMonths).toContain('2026-01')
    expect(sipMonths.length).toBeGreaterThan(3)
  })
})
