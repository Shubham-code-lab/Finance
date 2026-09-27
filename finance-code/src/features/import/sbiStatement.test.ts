import { describe, expect, it } from 'vitest'
import { deriveSbiData, mergeSbiRows, parseSbiStatementText } from '@/features/import/sbiStatement'
import { tableRowsFromStatement } from '@/features/assets/fromLedgers'

const statementText = `
Statement From : 01/01/2026 to 31/03/2026
Account Number : 0000000250
05/01/2026 05/01/2026 WDL TFR UPI/DR/123456789012/Groww/growwstock - 10,000.00 - 57,154.47
06/01/2026 06/01/2026 WDL TFR UPI/DR/123456789013/Indian/mutualfund - 15,000.00 - 42,154.47
25/03/2026 25/03/2026 INTEREST CREDIT - - 89.00 42,243.47
`

describe('SBI statement import', () => {
  it('parses the first transaction without requiring a balance-forward row', () => {
    const statement = parseSbiStatementText(statementText)
    expect(statement).toMatchObject({ accountNumberLast4: '0250', periodFrom: '2026-01-01', periodTo: '2026-03-31' })
    expect(statement.rows.map((row) => [row.date, row.flow, row.amount, row.balance, row.categoryId])).toEqual([
      ['2026-01-05', 'transfer', 10_000, 57_154.47, 'stock-market'],
      ['2026-01-06', 'outflow', 15_000, 42_154.47, 'sip-mf'],
      ['2026-03-25', 'inflow', 89, 42_243.47, 'bank-interest'],
    ])
  })

  it('merges overlapping statements and derives Firebase records', () => {
    const statement = parseSbiStatementText(statementText)
    const incoming = tableRowsFromStatement(statement.rows, 'sbi-statement')
    const merged = mergeSbiRows(incoming, statement.rows, 'sbi-statement')
    expect(merged).toMatchObject({ added: 0, unchanged: 3 })
    const derived = deriveSbiData(merged.rows, 'sbi-statement')
    expect(derived.transactions).toHaveLength(3)
    expect(derived.snapshots).toHaveLength(3)
  })
})
