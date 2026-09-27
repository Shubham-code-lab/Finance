import { ParsedStatementRow, parseStatementTransactions, statementReference, tableRowsFromStatement } from '@/features/assets/fromLedgers'
import { toMinor } from '@/domain/money'
import { AccountSnapshot, CustomTable, CustomTableRow, TableColumn, Transaction } from '@/domain/types'

export const SBI_COLUMNS: TableColumn[] = [
  { id: 'date', name: 'Date', type: 'date', required: true },
  { id: 'amount', name: 'Amount', type: 'number', required: true },
  { id: 'flow', name: 'Flow', type: 'enum', required: true, enumValues: ['inflow', 'outflow', 'transfer'] },
  { id: 'account', name: 'Account', type: 'accountRef', required: true },
  { id: 'category', name: 'Category', type: 'categoryRef', required: false },
  { id: 'merchant', name: 'Merchant', type: 'text', required: false },
  { id: 'memo', name: 'Particulars', type: 'text', required: false },
  { id: 'balance', name: 'Balance', type: 'number', required: true },
]

export type SbiStatement = {
  accountNumberLast4: string
  periodFrom: string
  periodTo: string
  rows: ParsedStatementRow[]
}

export type SbiMergeResult = { rows: CustomTableRow[]; added: number; updated: number; unchanged: number; preserved: number }

function normalized(value: unknown) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function isoFromStatementDate(value: string) {
  const [day, month, year] = value.split(/[/-]/)
  return day && month && year ? `${year}-${month}-${day}` : ''
}

function withOpeningBalance(text: string) {
  const starts = [...text.matchAll(/(?:^|\s)(\d{2}\/\d{2}\/\d{4}\s+\d{2}\/\d{2}\/\d{4})/g)]
  if (!starts.length) return text
  const start = starts[0].index ?? 0
  const end = starts[1]?.index ?? text.length
  const block = text.slice(start, end)
  const values = [...block.matchAll(/(?:^|\s)([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.\d{2})|[0-9]+(?:\.\d{2}))(?=\s|$)/g)].map((match) =>
    Number(match[1].replace(/,/g, '')),
  )
  const amount = values.at(-2)
  const balance = values.at(-1)
  if (!amount || balance === undefined) return text
  const debit = /\b(?:WDL|DEBIT)\b/i.test(block)
  const openingBalance = debit ? balance + amount : balance - amount
  return `${text.slice(0, start)}\n01/01/1900 B/F ${openingBalance.toFixed(2)}\n${text.slice(start).trimStart()}`
}

export function parseSbiStatementText(rawText: string, accountId = 'sbi'): SbiStatement {
  const text = rawText
    .split('\u0000')
    .join('')
    .replace(/[ \t]+(?=\d{2}\/\d{2}\/\d{4}\s+\d{2}\/\d{2}\/\d{4})/g, '\n')
  const period = text.match(/Statement From\s*:\s*(\d{2}[/-]\d{2}[/-]\d{4})\s+to\s+(\d{2}[/-]\d{2}[/-]\d{4})/i)
  const account = text.match(/Account Number\s*:\s*([0-9]+)/i)?.[1] ?? ''
  const rows = parseStatementTransactions(withOpeningBalance(text), { tableId: 'sbi-statement', accountId, idPrefix: 'sbi' })
  if (!rows.length) throw new Error('No SBI transactions were found. Check the statement format and PDF password.')
  return {
    accountNumberLast4: account.slice(-4),
    periodFrom: period ? isoFromStatementDate(period[1]) : rows[0].date,
    periodTo: period ? isoFromStatementDate(period[2]) : (rows.at(-1)?.date ?? ''),
    rows,
  }
}

function rowIdentity(row: CustomTableRow) {
  const reference = statementReference(String(row.cells.memo ?? ''))
  return reference
    ? `ref:${row.cells.date}:${reference}`
    : [
        row.cells.date,
        row.cells.flow,
        Number(row.cells.amount ?? 0).toFixed(2),
        Number(row.cells.balance ?? 0).toFixed(2),
        normalized(row.cells.memo),
      ].join('|')
}

export function mergeSbiRows(existing: CustomTableRow[], incomingStatementRows: ParsedStatementRow[], tableId: string): SbiMergeResult {
  const incoming = tableRowsFromStatement(incomingStatementRows, tableId)
  const incomingByKey = new Map(incoming.map((row) => [rowIdentity(row), row]))
  const merged: CustomTableRow[] = []
  let updated = 0
  let unchanged = 0
  existing.forEach((row) => {
    const key = rowIdentity(row)
    const replacement = incomingByKey.get(key)
    if (!replacement) return void merged.push(row)
    const next = { ...replacement, id: row.id, tableId }
    if (JSON.stringify(row.cells) === JSON.stringify(next.cells)) unchanged += 1
    else updated += 1
    merged.push(next)
    incomingByKey.delete(key)
  })
  const additions = [...incomingByKey.values()]
  return {
    rows: [...merged, ...additions].sort(
      (left, right) => String(left.cells.date).localeCompare(String(right.cells.date)) || left.id.localeCompare(right.id),
    ),
    added: additions.length,
    updated,
    unchanged,
    preserved: merged.length - updated - unchanged,
  }
}

export function findSbiTable(tables: CustomTable[], rows: CustomTableRow[]) {
  const compatible = tables.filter(
    (table) => table.columns.some((column) => column.id === 'date') && table.columns.some((column) => column.id === 'memo'),
  )
  const counts = new Map<string, number>()
  rows
    .filter((row) => normalized(row.cells.account) === 'sbi')
    .forEach((row) => counts.set(row.tableId, (counts.get(row.tableId) ?? 0) + 1))
  return (
    compatible
      .filter((table) => (counts.get(table.id) ?? 0) > 0)
      .sort((left, right) => (counts.get(right.id) ?? 0) - (counts.get(left.id) ?? 0))[0] ??
    compatible.find((table) => /sbi/i.test(`${table.id} ${table.name}`))
  )
}

export function deriveSbiData(rows: CustomTableRow[], tableId: string, currency = 'INR') {
  const transactions: Transaction[] = rows.flatMap((row) => {
    const date = String(row.cells.date ?? '').slice(0, 10)
    const accountId = String(row.cells.account ?? '')
    const flow = String(row.cells.flow ?? '') as Transaction['flow']
    const amountMinor = Math.abs(toMinor(row.cells.amount ?? 0))
    if (!date || !accountId || !amountMinor || !['inflow', 'outflow', 'transfer'].includes(flow)) return []
    return [
      {
        id: `${tableId}:${row.id}`,
        sourceTableId: tableId,
        sourceRowId: row.id,
        date,
        accountId,
        counterpartyAccountId:
          row.cells.category === 'sip-mf' ? 'mutual-funds' : row.cells.category === 'stock-market' ? 'stocks-portfolio' : null,
        categoryId: String(row.cells.category ?? '') || null,
        amountMinor,
        flow,
        signedAmountMinor: flow === 'outflow' ? -amountMinor : flow === 'inflow' ? amountMinor : 0,
        memo: String(row.cells.memo ?? ''),
        origin: 'user' as const,
        currency,
      },
    ]
  })
  const closingByDate = new Map<string, CustomTableRow>()
  rows.forEach((row) => {
    const date = String(row.cells.date ?? '').slice(0, 10)
    if (date) closingByDate.set(date, row)
  })
  const snapshots: AccountSnapshot[] = [...closingByDate.entries()]
    .map(([date, row]) => ({
      id: `${tableId}:balance:${date}`,
      accountId: String(row.cells.account ?? ''),
      date,
      valueMinor: toMinor(row.cells.balance ?? 0),
      costBasisMinor: null,
      origin: 'user' as const,
      sourceTableId: tableId,
    }))
    .filter((snapshot) => snapshot.accountId)
  return { transactions, snapshots }
}
