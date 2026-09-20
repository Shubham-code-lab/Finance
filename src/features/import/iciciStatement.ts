import { ParsedStatementRow, parseStatementTransactions, statementReference, tableRowsFromStatement } from '@/features/assets/fromLedgers'
import { toMinor } from '@/domain/money'
import { AccountSnapshot, CustomTable, CustomTableRow, TableColumn, Transaction } from '@/domain/types'

export const ICICI_COLUMNS: TableColumn[] = [
  { id: 'date', name: 'Date', type: 'date', required: true },
  { id: 'amount', name: 'Amount', type: 'number', required: true },
  { id: 'flow', name: 'Flow', type: 'enum', required: true, enumValues: ['inflow', 'outflow', 'transfer'] },
  { id: 'account', name: 'Account', type: 'accountRef', required: true },
  { id: 'category', name: 'Category', type: 'categoryRef', required: false },
  { id: 'merchant', name: 'Merchant', type: 'text', required: false },
  { id: 'memo', name: 'Particulars', type: 'text', required: false },
  { id: 'balance', name: 'Balance', type: 'number', required: true },
]

export type IciciStatement = {
  accountNumberLast4: string
  periodFrom: string
  periodTo: string
  rows: ParsedStatementRow[]
}

export type MergeResult = {
  rows: CustomTableRow[]
  added: number
  updated: number
  unchanged: number
  preserved: number
}

function isoFromLongDate(day: string, monthName: string, year: string) {
  const month =
    ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'].indexOf(
      monthName.toLowerCase(),
    ) + 1
  return month ? `${year}-${String(month).padStart(2, '0')}-${day.padStart(2, '0')}` : ''
}

export function parseIciciStatementText(rawText: string, accountId = 'icici'): IciciStatement {
  const text = rawText
    .split('\u0000')
    .join('')
    .replace(/[ \t]+(?=\d{2}-\d{2}-\d{4}\s)/g, '\n')
  const account = text.match(/Savings Account Number:\s*([0-9]+)/i)?.[1] ?? text.match(/Savings A\/c\s+([0-9]+)/i)?.[1] ?? ''
  const period = text.match(/period\s+([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})\s*-\s*([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/i)
  const periodFrom = period ? isoFromLongDate(period[2], period[1], period[3]) : ''
  const periodTo = period ? isoFromLongDate(period[5], period[4], period[6]) : ''
  const rows = parseStatementTransactions(text, { tableId: 'icici-statement', accountId, idPrefix: 'icici' })
  if (!rows.length) throw new Error('No ICICI transactions were found. Check the password and statement format.')
  return { accountNumberLast4: account.slice(-4), periodFrom, periodTo, rows }
}

function normalized(value: unknown) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
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

export function mergeIciciRows(existing: CustomTableRow[], incomingStatementRows: ParsedStatementRow[], tableId: string): MergeResult {
  const incoming = tableRowsFromStatement(incomingStatementRows, tableId)
  const incomingByKey = new Map(incoming.map((row) => [rowIdentity(row), row]))
  const merged: CustomTableRow[] = []
  let updated = 0
  let unchanged = 0

  existing.forEach((row) => {
    const key = rowIdentity(row)
    const replacement = incomingByKey.get(key)
    if (!replacement) {
      merged.push(row)
      return
    }
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

export function findIciciTable(tables: CustomTable[], rows: CustomTableRow[]) {
  const accountCounts = new Map<string, number>()
  rows
    .filter((row) => normalized(row.cells.account) === 'icici')
    .forEach((row) => accountCounts.set(row.tableId, (accountCounts.get(row.tableId) ?? 0) + 1))
  const compatible = tables.filter(
    (table) => table.columns.some((column) => column.id === 'date') && table.columns.some((column) => column.id === 'memo'),
  )
  return (
    compatible
      .filter((table) => (accountCounts.get(table.id) ?? 0) > 0)
      .sort((left, right) => (accountCounts.get(right.id) ?? 0) - (accountCounts.get(left.id) ?? 0))[0] ??
    compatible.find((table) => /icici/i.test(`${table.id} ${table.name}`))
  )
}

export function deriveIciciData(rows: CustomTableRow[], tableId: string, currency = 'INR') {
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
        counterpartyAccountId: null,
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
