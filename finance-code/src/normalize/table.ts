import { Account, AccountSnapshot, Category, ColumnMapping, CustomTable, CustomTableRow, FlowKind, Transaction } from '@/domain/types'
import { toMinor } from '@/domain/money'

export type MappingError = { rowId: string; message: string }

function cell(row: CustomTableRow, columnId?: string) {
  if (!columnId) return null
  return row.cells[columnId] ?? null
}

function normalizeFlow(value: unknown, fallback?: FlowKind): FlowKind | null {
  const text = String(value ?? '')
    .trim()
    .toLowerCase()
  if (!text && fallback) return fallback
  if (['in', 'income', 'inflow', 'credit'].includes(text)) return 'inflow'
  if (['out', 'expense', 'spend', 'outflow', 'debit'].includes(text)) return 'outflow'
  if (['neutral', 'balance'].includes(text)) return 'neutral'
  if (['transfer', 'move'].includes(text)) return 'transfer'
  return fallback ?? null
}

function idFromName<T extends { id: string; name: string }>(items: T[], value: unknown) {
  const text = String(value ?? '').trim()
  return items.find((item) => item.id === text || item.name.toLowerCase() === text.toLowerCase())?.id ?? null
}

export function normalizeTransactions(
  table: CustomTable,
  mapping: ColumnMapping,
  rows: CustomTableRow[],
  accounts: Account[],
  categories: Category[],
) {
  const transactions: Transaction[] = []
  const errors: MappingError[] = []

  if (mapping.kind !== 'transactions') return { transactions, errors }
  if (!mapping.roles.date || !mapping.roles.amount) {
    return { transactions, errors: [{ rowId: table.id, message: 'Transaction mapping needs date and amount columns.' }] }
  }

  rows.forEach((row) => {
    const date = String(cell(row, mapping.roles.date) ?? '').slice(0, 10)
    const rawAmount = cell(row, mapping.roles.amount)
    const accountId = idFromName(accounts, cell(row, mapping.roles.account))
    const categoryId = idFromName(categories, cell(row, mapping.roles.category))
    const category = categories.find((item) => item.id === categoryId)
    const flow = normalizeFlow(cell(row, mapping.roles.flow), mapping.defaultFlow ?? category?.defaultFlow)
    const amountMinor = Math.abs(toMinor(rawAmount ?? 0))
    if (!date) errors.push({ rowId: row.id, message: 'Missing date.' })
    if (!accountId) errors.push({ rowId: row.id, message: 'Unknown account.' })
    if (!flow) errors.push({ rowId: row.id, message: 'Unknown flow.' })
    if (!amountMinor) errors.push({ rowId: row.id, message: 'Missing or zero amount.' })
    if (!date || !accountId || !flow || !amountMinor) return
    transactions.push({
      id: `${table.id}:${row.id}`,
      sourceTableId: table.id,
      sourceRowId: row.id,
      date,
      accountId,
      counterpartyAccountId: idFromName(accounts, cell(row, mapping.roles.counterpartyAccount)),
      categoryId,
      amountMinor,
      flow,
      signedAmountMinor: flow === 'outflow' ? -amountMinor : flow === 'transfer' ? 0 : amountMinor,
      memo: String(cell(row, mapping.roles.memo) ?? ''),
      origin: row.origin,
      currency: accounts.find((account) => account.id === accountId)?.currency ?? 'INR',
    })
  })

  return { transactions, errors }
}

export function normalizeSnapshots(table: CustomTable, mapping: ColumnMapping, rows: CustomTableRow[], accounts: Account[]) {
  const snapshots: AccountSnapshot[] = []
  const errors: MappingError[] = []
  if (mapping.kind !== 'snapshots' || !mapping.snapshotRoles) return { snapshots, errors }
  const roles = mapping.snapshotRoles
  rows.forEach((row) => {
    const date = String(cell(row, roles.date) ?? '').slice(0, 10)
    const accountId = idFromName(accounts, cell(row, roles.account))
    const valueMinor = toMinor(cell(row, roles.value) ?? 0)
    if (!date || !accountId) {
      errors.push({ rowId: row.id, message: 'Snapshot needs date and account.' })
      return
    }
    snapshots.push({
      id: `${table.id}:${row.id}`,
      accountId,
      date,
      valueMinor,
      costBasisMinor: roles.costBasis ? toMinor(cell(row, roles.costBasis) ?? 0) : null,
      origin: row.origin,
      sourceTableId: table.id,
    })
  })
  return { snapshots, errors }
}
