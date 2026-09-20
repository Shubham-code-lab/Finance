import { Account, AccountSnapshot, Category, Transaction } from '@/domain/types'
import { isLifestyleCategory, lifestyleAmountMinor } from '@/calc/classify'

export type DateRange = { from?: string; to?: string }

function inRange(date: string, range: DateRange) {
  return (!range.from || date >= range.from) && (!range.to || date <= range.to)
}

export function sumIncome(transactions: Transaction[], range: DateRange = {}) {
  return transactions.filter((tx) => tx.flow === 'inflow' && inRange(tx.date, range)).reduce((sum, tx) => sum + tx.amountMinor, 0)
}

function investmentCategoryIds(categories: Category[]) {
  return new Set(
    categories.filter((category) => /invest|brokerage|fund|sip|mutual|stock/i.test(category.name)).map((category) => category.id),
  )
}

const nonLifestyleCategoryIds = new Set([
  'large-transfer',
  'stock-market',
  'salary',
  'bank-interest',
  'other-credit',
  'roommate-reimbursement',
  'friend-reimbursement',
  'sip-mf',
])

function countsAsLifestyle(tx: Transaction, investmentIds: Set<string>) {
  const categoryId = tx.categoryId ?? ''
  if (investmentIds.has(categoryId) || nonLifestyleCategoryIds.has(categoryId)) return false
  return isLifestyleCategory(categoryId) || tx.flow === 'outflow'
}

export function sumLifestyleSpend(transactions: Transaction[], categories: Category[], range: DateRange = {}) {
  const investmentIds = investmentCategoryIds(categories)
  return transactions
    .filter((tx) => tx.flow === 'outflow' && countsAsLifestyle(tx, investmentIds) && inRange(tx.date, range))
    .reduce((sum, tx) => sum + lifestyleAmountMinor(tx.categoryId, tx.amountMinor), 0)
}

export function lifestyleSpendByCategory(transactions: Transaction[], categories: Category[], range: DateRange = {}) {
  const names = new Map(categories.map((category) => [category.id, category.name]))
  const investmentIds = investmentCategoryIds(categories)
  const totals = new Map<string, number>()
  transactions
    .filter((tx) => tx.flow === 'outflow' && countsAsLifestyle(tx, investmentIds) && inRange(tx.date, range))
    .forEach((tx) => {
      const id = tx.categoryId ?? 'uncategorized-spend'
      totals.set(id, (totals.get(id) ?? 0) + lifestyleAmountMinor(id, tx.amountMinor))
    })
  return [...totals.entries()]
    .map(([categoryId, amountMinor]) => ({ categoryId, name: names.get(categoryId) ?? categoryId, amountMinor }))
    .sort((left, right) => right.amountMinor - left.amountMinor)
}

export function lifestyleDataMonthCount(transactions: Transaction[], categories: Category[], range: DateRange = {}) {
  const investmentIds = investmentCategoryIds(categories)
  return new Set(
    transactions
      .filter((tx) => tx.flow === 'outflow' && countsAsLifestyle(tx, investmentIds) && inRange(tx.date, range))
      .map((tx) => tx.date.slice(0, 7)),
  ).size
}

export function sumInvested(transactions: Transaction[], categories: Category[], range: DateRange = {}) {
  const investmentIds = investmentCategoryIds(categories)
  return transactions
    .filter((tx) => tx.flow === 'outflow' && investmentIds.has(tx.categoryId ?? '') && inRange(tx.date, range))
    .reduce((sum, tx) => sum + tx.amountMinor, 0)
}

export function calculateSavings(transactions: Transaction[], categories: Category[], range: DateRange = {}) {
  return sumIncome(transactions, range) - sumLifestyleSpend(transactions, categories, range)
}

export function calculateSavingsRate(transactions: Transaction[], categories: Category[], range: DateRange = {}) {
  const income = sumIncome(transactions, range)
  if (income === 0) return null
  return calculateSavings(transactions, categories, range) / income
}

function latestSnapshotFor(accountId: string, snapshots: AccountSnapshot[], to: string) {
  return snapshots
    .filter((snapshot) => snapshot.accountId === accountId && snapshot.date <= to)
    .sort((left, right) => right.date.localeCompare(left.date))[0]
}

export function accountBalanceAt(account: Account, transactions: Transaction[], snapshots: AccountSnapshot[], to: string) {
  const latest = latestSnapshotFor(account.id, snapshots, to)
  return latest ? latest.valueMinor : balanceFromTransactions(account.id, transactions, to)
}

export function balanceFromTransactions(accountId: string, transactions: Transaction[], to: string) {
  return transactions
    .filter((tx) => tx.accountId === accountId && tx.date <= to && tx.flow !== 'transfer')
    .reduce((sum, tx) => sum + tx.signedAmountMinor, 0)
}

export function calculateNetWorth(accounts: Account[], transactions: Transaction[], snapshots: AccountSnapshot[], to: string) {
  return accounts.reduce((total, account) => {
    if (account.archived) return total
    const value = accountBalanceAt(account, transactions, snapshots, to)
    if (account.type === 'credit' || account.type === 'liability') return total - value
    return total + value
  }, 0)
}

export function calculateInvestmentPL(account: Account, transactions: Transaction[], snapshots: AccountSnapshot[], to: string) {
  const latest = latestSnapshotFor(account.id, snapshots, to)
  if (!latest) return null
  const costBasis =
    latest.costBasisMinor ??
    transactions
      .filter((tx) => tx.counterpartyAccountId === account.id && tx.flow === 'outflow' && tx.date <= to)
      .reduce((sum, tx) => sum + tx.amountMinor, 0)
  if (costBasis === 0) return null
  return latest.valueMinor - costBasis
}

export function netWorthSeriesByMonth(
  accounts: Account[],
  transactions: Transaction[],
  snapshots: AccountSnapshot[],
  from: string,
  to: string,
) {
  const months: { period: string; value: number }[] = []
  let year = Number(from.slice(0, 4))
  let month = Number(from.slice(5, 7))
  const endYear = Number(to.slice(0, 4))
  const endMonth = Number(to.slice(5, 7))
  while (year < endYear || (year === endYear && month <= endMonth)) {
    const period = `${year}-${String(month).padStart(2, '0')}`
    const lastDayDate = new Date(year, month, 0)
    const lastDay = `${year}-${String(month).padStart(2, '0')}-${String(lastDayDate.getDate()).padStart(2, '0')}`
    months.push({ period, value: calculateNetWorth(accounts, transactions, snapshots, lastDay <= to ? lastDay : to) })
    month += 1
    if (month === 13) {
      month = 1
      year += 1
    }
  }
  return months
}
