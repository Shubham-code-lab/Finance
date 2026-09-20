import { describe, expect, it } from 'vitest'
import { deriveIciciData, mergeIciciRows, parseIciciStatementText } from '@/features/import/iciciStatement'
import { tableRowsFromStatement } from '@/features/assets/fromLedgers'

const statementText = `
Statement for period August 01, 2025 - August 31, 2025
Savings Account Number: 0000000250
01-08-2025 B/F 1,000.00
02-08-2025 UPI/521491676386/CAFE PAYMENT 100.00 900.00
03-08-2025 NEFT-HDFCH00765838751-SALARY 500.00 1,400.00
`

describe('ICICI statement import', () => {
  it('parses encrypted-PDF text into stable transaction rows', () => {
    const first = parseIciciStatementText(statementText)
    const second = parseIciciStatementText(statementText)
    expect(first).toMatchObject({ accountNumberLast4: '0250', periodFrom: '2025-08-01', periodTo: '2025-08-31' })
    expect(first.rows.map((row) => [row.date, row.flow, row.amount, row.balance])).toEqual([
      ['2025-08-02', 'outflow', 100, 900],
      ['2025-08-03', 'inflow', 500, 1400],
    ])
    expect(first.rows.map((row) => row.id)).toEqual(second.rows.map((row) => row.id))
  })

  it('preserves older history and does not duplicate overlapping rows', () => {
    const statement = parseIciciStatementText(statementText)
    const incoming = tableRowsFromStatement(statement.rows, 'icici-statement')
    const older = { ...incoming[0], id: 'older', cells: { ...incoming[0].cells, date: '2024-08-02' } }
    const merged = mergeIciciRows([older, ...incoming], statement.rows, 'icici-statement')
    expect(merged).toMatchObject({ added: 0, updated: 0, unchanged: 2, preserved: 1 })
    expect(merged.rows).toHaveLength(3)

    const derived = deriveIciciData(merged.rows, 'icici-statement')
    expect(derived.transactions).toHaveLength(3)
    expect(derived.snapshots.map((snapshot) => snapshot.date)).toEqual(['2024-08-02', '2025-08-02', '2025-08-03'])
  })
})
