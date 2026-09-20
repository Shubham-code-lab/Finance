import { monthsInclusive } from '@/domain/sip'
import { Account, StoreData } from '@/domain/types'

export type StatementMonthCoverage = {
  month: string
  covered: boolean
  transactionCount: number
  lastRecordedDate: string | null
  closingBalanceMinor: number | null
}

export type AccountStatementCoverage = {
  account: Account
  firstRecordedDate: string | null
  lastRecordedDate: string | null
  months: StatementMonthCoverage[]
  missingCount: number
}

function isStatementAccount(account: Account, data: StoreData) {
  if (account.archived || !['checking', 'savings'].includes(account.type)) return false
  const hasImportedData =
    data.transactions.some((transaction) => transaction.accountId === account.id && transaction.sourceTableId) ||
    data.snapshots.some((snapshot) => snapshot.accountId === account.id && snapshot.sourceTableId)
  return hasImportedData || /bank|icici|sbi|hdfc|axis|kotak/i.test(account.name)
}

export function buildStatementCoverage(data: StoreData, asOf: string): AccountStatementCoverage[] {
  const currentMonth = asOf.slice(0, 7)
  return data.accounts
    .filter((account) => isStatementAccount(account, data))
    .map((account) => {
      const transactions = data.transactions.filter(
        (transaction) => transaction.accountId === account.id && transaction.sourceTableId && transaction.date <= asOf,
      )
      const snapshots = data.snapshots.filter(
        (snapshot) => snapshot.accountId === account.id && snapshot.sourceTableId && snapshot.date <= asOf,
      )
      const dates = [...transactions.map((transaction) => transaction.date), ...snapshots.map((snapshot) => snapshot.date)].sort()
      const firstRecordedDate = dates[0] ?? null
      const lastRecordedDate = dates.at(-1) ?? null
      const months = firstRecordedDate ? monthsInclusive(firstRecordedDate.slice(0, 7), currentMonth) : []
      const coverageMonths = months.map((month) => {
        const monthTransactions = transactions.filter((transaction) => transaction.date.startsWith(month))
        const monthSnapshots = snapshots.filter((snapshot) => snapshot.date.startsWith(month)).sort((a, b) => a.date.localeCompare(b.date))
        const monthDates = [
          ...monthTransactions.map((transaction) => transaction.date),
          ...monthSnapshots.map((snapshot) => snapshot.date),
        ].sort()
        return {
          month,
          covered: monthDates.length > 0,
          transactionCount: monthTransactions.length,
          lastRecordedDate: monthDates.at(-1) ?? null,
          closingBalanceMinor: monthSnapshots.at(-1)?.valueMinor ?? null,
        }
      })
      return {
        account,
        firstRecordedDate,
        lastRecordedDate,
        months: coverageMonths,
        missingCount: coverageMonths.filter((month) => !month.covered).length,
      }
    })
}
