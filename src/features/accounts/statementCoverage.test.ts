import { describe, expect, it } from 'vitest'
import { buildStatementCoverage } from '@/features/accounts/statementCoverage.utils'
import { StoreData } from '@/domain/types'

describe('statement coverage', () => {
  it('shows holes from the first imported month through the current month', () => {
    const data = {
      accounts: [{ id: 'sbi', name: 'SBI', type: 'savings', currency: 'INR', origin: 'user', archived: false }],
      transactions: [
        { accountId: 'sbi', sourceTableId: 'sbi-ledger', date: '2026-06-10' },
        { accountId: 'sbi', sourceTableId: 'sbi-ledger', date: '2026-08-04' },
      ],
      snapshots: [
        { accountId: 'sbi', sourceTableId: 'sbi-ledger', date: '2026-06-30', valueMinor: 10_000_00 },
        { accountId: 'sbi', sourceTableId: 'sbi-ledger', date: '2026-08-31', valueMinor: 12_000_00 },
      ],
    } as unknown as StoreData

    const coverage = buildStatementCoverage(data, '2026-09-18')[0]
    expect(coverage.missingCount).toBe(2)
    expect(coverage.months.map((month) => [month.month, month.covered])).toEqual([
      ['2026-06', true],
      ['2026-07', false],
      ['2026-08', true],
      ['2026-09', false],
    ])
    expect(coverage.months[2]).toMatchObject({ transactionCount: 1, closingBalanceMinor: 12_000_00 })
  })

  it('includes a known bank account even before its first statement is uploaded', () => {
    const data = {
      accounts: [{ id: 'icici', name: 'ICICI Bank', type: 'checking', currency: 'INR', origin: 'user', archived: false }],
      transactions: [],
      snapshots: [],
    } as unknown as StoreData
    expect(buildStatementCoverage(data, '2026-09-18')[0]).toMatchObject({ firstRecordedDate: null, months: [], missingCount: 0 })
  })
})
