import { toIsoDate, toRupees } from '@/domain/dates'
import { toMinor } from '@/domain/money'
import { classifyStatementMemo } from '@/calc/classify'
import { AccountSnapshot, CustomTable, CustomTableRow, FlowKind, Transaction } from '@/domain/types'

export type LedgerRow = { date: string; spend: number; balance: number; sourceRowId: string }
export type ParsedStatementRow = {
  id: string
  date: string
  amount: number
  balance: number
  flow: 'inflow' | 'outflow' | 'transfer'
  accountId: string
  categoryId: string
  merchant: string
  memo: string
}

function parseMoney(value: string) {
  return Number(value.replace(/,/g, ''))
}

function parseStatementDate(value: string) {
  const separator = value.includes('/') ? '/' : '-'
  const [day, month, year] = value.split(separator)
  return `${year}-${month}-${day}`
}

function moneyValues(block: string) {
  return [...block.matchAll(/(?:^|\s)-?\s*([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.\d{2})|[0-9]+(?:\.\d{2}))(?=\s|$)/g)].map((match) =>
    parseMoney(match[1]),
  )
}

function findAmountAndBalance(values: number[], previousBalance: number | null) {
  if (values.length === 1) return { amount: 0, balance: values[0], flow: null as 'inflow' | 'outflow' | null }
  for (let index = values.length - 2; index >= 0; index -= 1) {
    const amount = values[index]
    const balance = values[index + 1]
    if (!amount || Number.isNaN(amount) || Number.isNaN(balance)) continue
    if (previousBalance === null) return { amount, balance, flow: null }
    const delta = Math.round((balance - previousBalance) * 100) / 100
    if (Math.abs(delta - amount) < 0.02) return { amount, balance, flow: 'inflow' as const }
    if (Math.abs(delta + amount) < 0.02) return { amount, balance, flow: 'outflow' as const }
  }
  return null
}

function compactMemo(block: string) {
  return block
    .replace(/Your Base Branch:[\s\S]*$/i, '')
    .replace(/DATE MODE\*\* PARTICULARS DEPOSITS WITHDRAWALS BALANCE/gi, '')
    .replace(/Page(?: no\.)?\.?\s*\d+\s*(?:of\s*)?\d*/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function stableHash(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

export function statementReference(memo: string) {
  const normalized = memo.replace(/\s+/g, '')
  return (
    normalized.match(/(?:UPI|INFT|NEFT|IMPS|ACH)[/-][A-Z]*([0-9]{9,})/i)?.[1] ??
    normalized.match(/\b([0-9]{12})\b/)?.[1] ??
    normalized.match(/\b((?:ICI|AXI|HDF|SBI|PPPL)[A-Z0-9]{12,})\b/i)?.[1] ??
    null
  )
}

function statementRowId(idPrefix: string, row: Omit<ParsedStatementRow, 'id' | 'accountId'>) {
  const reference = statementReference(row.memo)
  const fingerprint =
    reference ??
    `${row.date}|${row.flow}|${row.amount.toFixed(2)}|${row.balance.toFixed(2)}|${row.memo.toLowerCase().replace(/\s+/g, ' ').trim()}`
  return `${idPrefix}-${row.date}-${stableHash(fingerprint)}`
}

export function parseStatementTransactions(
  text: string,
  params: { tableId: string; accountId: string; idPrefix: string },
): ParsedStatementRow[] {
  const starts = [...text.matchAll(/^(?:\d{2}-\d{2}-\d{4}|\d{2}\/\d{2}\/\d{4}(?:\s+\d{2}\/\d{2}\/\d{4})?)/gm)]
  const rows: ParsedStatementRow[] = []
  let previousBalance: number | null = null

  starts.forEach((match, index) => {
    const next = starts[index + 1]?.index ?? text.length
    const rawBlock = text.slice(match.index, next)
    const values = moneyValues(rawBlock)
    const parsed = findAmountAndBalance(values, previousBalance)
    if (!parsed) return
    previousBalance = parsed.balance
    if (!parsed.amount || !parsed.flow) return
    const rawDate = match[0].slice(0, 10)
    const date = parseStatementDate(rawDate)
    const memo = compactMemo(rawBlock)
    const classified = classifyStatementMemo(memo, parsed.flow, parsed.amount)
    const row = {
      date,
      amount: parsed.amount,
      balance: parsed.balance,
      flow: classified.flow,
      accountId: params.accountId,
      categoryId: classified.categoryId,
      merchant: classified.merchant,
      memo,
    }
    rows.push({ ...row, id: statementRowId(params.idPrefix, row), accountId: params.accountId })
  })

  return rows
}

export function statementRowsToTransactions(rows: ParsedStatementRow[], tableId: string): Transaction[] {
  return rows.map((row) => {
    const amountMinor = toMinor(row.amount)
    return {
      id: `${tableId}:${row.id}`,
      sourceTableId: tableId,
      sourceRowId: row.id,
      date: row.date,
      accountId: row.accountId,
      counterpartyAccountId: row.categoryId === 'sip-mf' || row.categoryId === 'stock-market' ? 'mutual-funds' : null,
      categoryId: row.categoryId,
      amountMinor,
      flow: row.flow,
      signedAmountMinor: row.flow === 'outflow' ? -amountMinor : row.flow === 'inflow' ? amountMinor : 0,
      memo: row.memo,
      origin: 'user',
      currency: 'INR',
    }
  })
}

export function tableRowsFromStatement(rows: ParsedStatementRow[], tableId: string): CustomTableRow[] {
  return rows.map((row) => ({
    id: row.id,
    tableId,
    origin: 'user',
    cells: {
      date: row.date,
      amount: row.amount,
      flow: row.flow,
      account: row.accountId,
      category: row.categoryId,
      merchant: row.merchant,
      memo: row.memo,
      balance: row.balance,
    },
  }))
}

export function recordsToLedger(rows: CustomTableRow[], dateKey: string, spendKey: string, balanceKey: string): LedgerRow[] {
  return rows
    .map((row) => ({
      date: toIsoDate(row.cells[dateKey]),
      spend: toRupees(row.cells[spendKey]),
      balance: toRupees(row.cells[balanceKey]),
      sourceRowId: row.id,
    }))
    .filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.date))
    .sort((left, right) => left.date.localeCompare(right.date) || left.sourceRowId.localeCompare(right.sourceRowId))
}

export function ledgerEvents(params: {
  rows: LedgerRow[]
  tableId: string
  accountId: string
  spendCategoryId: string
  sipCategoryId?: string
  incomeCategoryId: string
  classifyOutflow: (rupees: number) => 'sip' | 'spend' | 'transfer'
}): { transactions: Transaction[]; snapshots: AccountSnapshot[] } {
  const transactions: Transaction[] = []
  const snapshots: AccountSnapshot[] = []
  let previousBalance: number | null = null

  params.rows.forEach((row) => {
    if (row.spend > 0) {
      const kind = params.classifyOutflow(row.spend)
      const amountMinor = toMinor(row.spend)
      const flow: FlowKind = kind === 'transfer' ? 'transfer' : 'outflow'
      transactions.push({
        id: `${params.tableId}:spend:${row.sourceRowId}`,
        sourceTableId: params.tableId,
        sourceRowId: row.sourceRowId,
        date: row.date,
        accountId: params.accountId,
        counterpartyAccountId: kind === 'sip' ? 'mutual-funds' : null,
        categoryId:
          kind === 'sip'
            ? (params.sipCategoryId ?? params.spendCategoryId)
            : kind === 'transfer'
              ? 'large-transfer'
              : params.spendCategoryId,
        amountMinor,
        flow,
        signedAmountMinor: flow === 'outflow' ? -amountMinor : 0,
        memo: kind === 'sip' ? 'SIP / investment' : kind === 'transfer' ? 'Large transfer (not lifestyle spend)' : 'Card / UPI spend',
        origin: 'user',
        currency: 'INR',
      })
    }
    if (previousBalance !== null) {
      const inflowRupees = row.balance - previousBalance + row.spend
      if (inflowRupees > 1) {
        const amountMinor = toMinor(inflowRupees)
        transactions.push({
          id: `${params.tableId}:in:${row.sourceRowId}`,
          sourceTableId: params.tableId,
          sourceRowId: row.sourceRowId,
          date: row.date,
          accountId: params.accountId,
          counterpartyAccountId: null,
          categoryId: params.incomeCategoryId,
          amountMinor,
          flow: 'inflow',
          signedAmountMinor: amountMinor,
          memo: 'Inferred credit from balance change',
          origin: 'user',
          currency: 'INR',
        })
      }
    }
    snapshots.push({
      id: `${params.tableId}:bal:${row.sourceRowId}`,
      accountId: params.accountId,
      date: row.date,
      valueMinor: toMinor(row.balance),
      costBasisMinor: null,
      origin: 'user',
      sourceTableId: params.tableId,
    })
    previousBalance = row.balance
  })

  return { transactions, snapshots }
}

export function cumulativeInvestmentSnapshots(sipTransactions: Transaction[], accountId: string, sourceTableId: string): AccountSnapshot[] {
  let cost = 0
  return sipTransactions
    .filter((tx) => tx.counterpartyAccountId === accountId || tx.categoryId === 'sip-mf')
    .sort((left, right) => left.date.localeCompare(right.date))
    .map((tx) => {
      cost += tx.amountMinor
      return {
        id: `mf-cum:${tx.id}`,
        accountId,
        date: tx.date,
        valueMinor: cost,
        costBasisMinor: cost,
        origin: 'user' as const,
        sourceTableId,
      }
    })
}

export function tableRowsFromMatrix(
  table: CustomTable,
  records: Record<string, string | number | null>[],
  idPrefix: string,
): CustomTableRow[] {
  return records.map((record, index) => ({
    id: `${idPrefix}-${index + 1}`,
    tableId: table.id,
    origin: 'user',
    cells: Object.fromEntries(table.columns.map((column) => [column.id, record[column.name] ?? record[column.id] ?? null])),
  }))
}
