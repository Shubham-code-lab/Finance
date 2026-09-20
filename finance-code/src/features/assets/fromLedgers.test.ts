import { describe, expect, it } from 'vitest'
import { isRecurringTransferAmount } from '@/calc/classify'
import { ledgerEvents, parseStatementTransactions, recordsToLedger, statementRowsToTransactions } from '@/features/assets/fromLedgers'
import { CustomTableRow } from '@/domain/types'

describe('SBI ledger SIP months', () => {
  it('records SIPs on 10k/40k months and skips when those amounts are absent', () => {
    const rows: CustomTableRow[] = [
      { id: 'a', tableId: 'sbi-ledger', origin: 'user', cells: { date: 46027, spend: 10000, balance: 57154.47 } },
      { id: 'b', tableId: 'sbi-ledger', origin: 'user', cells: { date: 46028, spend: 40000, balance: 17154.47 } },
      { id: 'c', tableId: 'sbi-ledger', origin: 'user', cells: { date: 46033, spend: 1314, balance: 15840.47 } },
      { id: 'd', tableId: 'sbi-ledger', origin: 'user', cells: { date: 46058, spend: 10000, balance: 5840.47 } },
    ]
    const ledger = recordsToLedger(rows, 'date', 'spend', 'balance')
    const { transactions } = ledgerEvents({
      rows: ledger,
      tableId: 'sbi-ledger',
      accountId: 'sbi',
      spendCategoryId: 'sbi-spend',
      sipCategoryId: 'sip-mf',
      incomeCategoryId: 'salary',
      classifyOutflow: (rupees) => (isRecurringTransferAmount(rupees) ? 'sip' : 'spend'),
    })
    const sips = transactions.filter((tx) => tx.categoryId === 'sip-mf')
    const spends = transactions.filter((tx) => tx.categoryId === 'sbi-spend')
    expect(sips.map((tx) => tx.date)).toEqual(['2026-01-05', '2026-01-06', '2026-02-05'])
    expect(sips.map((tx) => tx.amountMinor)).toEqual([1_000_000, 4_000_000, 1_000_000])
    expect(spends).toHaveLength(1)
    expect(spends[0].date).toBe('2026-01-11')
  })
})

describe('parseStatementTransactions', () => {
  it('infers flow from balance movement and labels vendors', () => {
    const rows = parseStatementTransactions(
      `
01-01-2026 B/F 2,03,241.52
09-01-2026
UPI/ZOMATO LIM/zomatoorder1.g/UPI/AXIS BANK/ZOMATO LIMITED
219.25 2,03,022.27
30-01-2026
NEFT-HDFCH00765838751-AMAGI MEDIA LABS PRIVATE LIMITED
1,02,022.00 3,05,044.27
04-02-2026
UPI/S J ARUN K/9739009054@ybl/January rent/S J ARUN KUMAR
28,000.00 2,77,044.27
`,
      { tableId: 'statement', accountId: 'icici', idPrefix: 'icici' },
    )

    expect(rows.map((row) => [row.flow, row.categoryId, row.amount])).toEqual([
      ['outflow', 'lifestyle-food', 219.25],
      ['inflow', 'salary', 102022],
      ['outflow', 'rent-home', 28000],
    ])
    const transactions = statementRowsToTransactions(rows, 'statement')
    expect(transactions[0]).toMatchObject({ sourceTableId: 'statement', signedAmountMinor: -21_925 })
    expect(transactions[0].sourceRowId).toMatch(/^icici-2026-01-09-/)
  })
})
