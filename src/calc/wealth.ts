import { Account, AccountSnapshot, MetricDef, WealthFlags } from '@/domain/types'

export const defaultWealthFlags: WealthFlags = {
  bankSavings: true,
  mutualFunds: true,
  stocks: true,
}

export const WEALTH_METRIC_IDS = {
  mutualFunds: 'mf_value',
  stocks: 'stocks_value',
} as const

export function isBankAccount(account: Account) {
  return (
    !account.archived && (account.type === 'checking' || account.type === 'savings' || account.type === 'cash' || account.type === 'other')
  )
}

export function bankAccounts(accounts: Account[]) {
  return accounts.filter(isBankAccount)
}

export function bankAccountIds(accounts: Account[]) {
  return bankAccounts(accounts).map((account) => account.id)
}

export function bankBalanceMetricId(accountId: string) {
  return `bank_${accountId}`
}

export function bankBalanceMetric(account: Account): MetricDef {
  return {
    id: bankBalanceMetricId(account.id),
    label: `${account.name} balance`,
    kind: 'neutral',
    includeTransfers: false,
    filter: { accountIds: [account.id] },
    aggregate: 'last',
    unit: 'money',
    currency: account.currency,
  }
}

export function latestSnapshotValue(accountIds: string[], snapshots: AccountSnapshot[], to: string): number {
  return accountIds.reduce((sum, accountId) => {
    const latest = snapshots
      .filter((snapshot) => snapshot.accountId === accountId && snapshot.date <= to)
      .sort((left, right) => right.date.localeCompare(left.date))[0]
    return sum + (latest?.valueMinor ?? 0)
  }, 0)
}

export function selectedWealthAccountIds(flags: WealthFlags, accounts: Account[]): string[] {
  const ids: string[] = []
  if (flags.bankSavings) ids.push(...bankAccountIds(accounts))
  if (flags.mutualFunds) ids.push('mutual-funds')
  if (flags.stocks) ids.push('stocks-portfolio')
  return ids
}

export function selectedWealthMetricIds(flags: WealthFlags, accounts: Account[]): string[] {
  const ids: string[] = []
  if (flags.bankSavings) ids.push(...bankAccounts(accounts).map((account) => bankBalanceMetricId(account.id)))
  if (flags.mutualFunds) ids.push(WEALTH_METRIC_IDS.mutualFunds)
  if (flags.stocks) ids.push(WEALTH_METRIC_IDS.stocks)
  return ids
}

export function calculateWealthTotal(snapshots: AccountSnapshot[], to: string, flags: WealthFlags, accounts: Account[]): number {
  return latestSnapshotValue(selectedWealthAccountIds(flags, accounts), snapshots, to)
}

export function withLiveBankMetrics(metrics: MetricDef[], accounts: Account[]): MetricDef[] {
  const withoutBank = metrics.filter((metric) => !metric.id.startsWith('bank_') && metric.id !== 'sbi_balance')
  return [...withoutBank, ...bankAccounts(accounts).map(bankBalanceMetric)]
}
