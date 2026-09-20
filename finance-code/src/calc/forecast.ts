import { accountBalanceAt, sumLifestyleSpend } from '@/calc/calculations'
import { forecastAmountsForMonth, normalizeForecastAdjustments, salaryAdjustmentForMonth } from '@/calc/forecastAdjustments'
import { incomeForRange, incomeOccurrences } from '@/calc/income'
import { bankAccountIds, latestSnapshotValue } from '@/calc/wealth'
import { todayIso } from '@/domain/money'
import { addMonths, dateOnDay, lastDayOfMonth, monthsInclusive } from '@/domain/sip'
import { ForecastAdjustment, HoldingKind, StoreData } from '@/domain/types'

export type SpendLookback = number | 'all'

export type WealthProjectionAssumptions = {
  months: number
  spendLookback: SpendLookback
  mutualFundAnnualReturnPct: number
  stockAnnualReturnPct: number
  salaryAnnualGrowthPct?: number
  salaryGrowthStartMonth?: string
  adjustments?: ForecastAdjustment[]
}

export type WealthProjectionPoint = {
  month: string
  incomeMinor: number
  livingSpendMinor: number
  plannedExpenseMinor: number
  spendMinor: number
  mutualFundSipMinor: number
  stockSipMinor: number
  bankMinor: number
  mutualFundsMinor: number
  stocksMinor: number
  growthThisMonthMinor: number
  cumulativeSipMinor: number
  cumulativeGrowthMinor: number
  cumulativePlannedExpenseMinor: number
  netWorthMinor: number
}

export type WealthProjection = {
  currentNetWorthMinor: number
  currentBankMinor: number
  reservedSavingsMinor: number
  currentMutualFundsMinor: number
  currentStocksMinor: number
  liabilityMinor: number
  monthlySpendMinor: number
  monthlyMutualFundSipMinor: number
  monthlyStockSipMinor: number
  points: WealthProjectionPoint[]
}

function monthRange(month: string) {
  return { from: `${month}-01`, to: dateOnDay(month, 31) }
}

export function typicalMonthlySpend(data: StoreData, asOfMonth: string, lookback: SpendLookback = 6) {
  const transactionMonths = data.transactions
    .map((tx) => tx.date.slice(0, 7))
    .filter(Boolean)
    .sort()
  const firstMonth = transactionMonths[0] ?? asOfMonth
  const start = lookback === 'all' ? firstMonth : addMonths(asOfMonth, -lookback)
  const months = monthsInclusive(start, addMonths(asOfMonth, -1))
  if (!months.length) return sumLifestyleSpend(data.transactions, data.categories)
  const total = months.reduce((sum, month) => sum + sumLifestyleSpend(data.transactions, data.categories, monthRange(month)), 0)
  return Math.round(total / months.length)
}

export function configuredMonthlySip(data: StoreData, kind?: HoldingKind) {
  return data.holdings
    .filter((holding) => holding.purchaseMode === 'sip' && (!kind || holding.kind === kind))
    .reduce((sum, holding) => sum + Math.max(0, holding.sipAmountMinor ?? 0), 0)
}

function cashflowBankAccountIds(data: StoreData) {
  const ledgerAccountIds = new Set(data.snapshots.filter((snapshot) => snapshot.sourceTableId).map((snapshot) => snapshot.accountId))
  const incomeAccountIds = new Set(data.incomeSources.map((source) => source.accountId))
  const eligible = data.accounts.filter((account) => !account.archived && (account.type === 'checking' || account.type === 'savings'))
  const connected = eligible.filter((account) => ledgerAccountIds.has(account.id) || incomeAccountIds.has(account.id))
  return (connected.length ? connected : eligible).map((account) => account.id)
}

function configuredSipForMonth(data: StoreData, kind: HoldingKind, month: string, fromDate: string) {
  return data.holdings
    .filter(
      (holding) => holding.kind === kind && holding.purchaseMode === 'sip' && (!holding.sipStartMonth || holding.sipStartMonth <= month),
    )
    .filter((holding) => {
      const history = data.sipEvents.filter((event) => event.holdingId === holding.id)
      if (history.some((event) => event.status === 'cancelled' && event.month <= month)) return false
      if (history.some((event) => event.month === month)) return false
      return dateOnDay(month, holding.sipDayOfMonth ?? 1) >= fromDate
    })
    .reduce((sum, holding) => sum + Math.max(0, holding.sipAmountMinor ?? 0), 0)
}

function monthlyRate(annualPercent: number) {
  const bounded = Math.max(-99, annualPercent) / 100
  return Math.pow(1 + bounded, 1 / 12) - 1
}

function currentInvestmentValue(data: StoreData, accountId: string, kind: HoldingKind, asOf: string) {
  const snapshot = latestSnapshotValue([accountId], data.snapshots, asOf)
  if (snapshot) return snapshot
  return data.holdings.filter((holding) => holding.kind === kind).reduce((sum, holding) => sum + holding.currentMinor, 0)
}

function salaryGrowthCount(month: string, firstGrowthMonth?: string) {
  if (!firstGrowthMonth || month < firstGrowthMonth) return 0
  const yearGap = Number(month.slice(0, 4)) - Number(firstGrowthMonth.slice(0, 4))
  const monthGap = Number(month.slice(5, 7)) - Number(firstGrowthMonth.slice(5, 7))
  return Math.floor((yearGap * 12 + monthGap) / 12) + 1
}

function projectedIncomeForMonth(
  data: StoreData,
  month: string,
  range: { from: string; to: string },
  assumptions: WealthProjectionAssumptions,
  adjustments: ForecastAdjustment[],
) {
  const salaryAdjustment = salaryAdjustmentForMonth(month, adjustments)
  if (salaryAdjustment) {
    const annualGrowth = 1 + (assumptions.salaryAnnualGrowthPct ?? 0) / 100
    const growthSinceChange = Math.max(
      0,
      salaryGrowthCount(month, assumptions.salaryGrowthStartMonth) -
        salaryGrowthCount(salaryAdjustment.effectiveMonth, assumptions.salaryGrowthStartMonth),
    )
    const salaryMinor = Math.round(salaryAdjustment.salaryMinor * Math.pow(annualGrowth, growthSinceChange))
    const otherIncomeMinor = data.incomeSources
      .filter((source) => source.schedule !== 'monthly')
      .reduce(
        (total, source) =>
          total + incomeOccurrences(source, range.from, range.to).reduce((sum, occurrence) => sum + occurrence.amountMinor, 0),
        0,
      )
    return salaryMinor + otherIncomeMinor
  }
  if (!data.incomeSources.length) return incomeForRange(data.incomeSources, data.transactions, range, range.to)
  const growthCount = salaryGrowthCount(month, assumptions.salaryGrowthStartMonth)
  const salaryFactor = Math.pow(1 + (assumptions.salaryAnnualGrowthPct ?? 0) / 100, growthCount)
  return data.incomeSources.reduce((total, source) => {
    const base = incomeOccurrences(source, range.from, range.to).reduce((sum, occurrence) => sum + occurrence.amountMinor, 0)
    return total + (source.schedule === 'monthly' ? Math.round(base * salaryFactor) : base)
  }, 0)
}

export function buildWealthProjection(data: StoreData, asOf = todayIso(), assumptions: WealthProjectionAssumptions): WealthProjection {
  const asOfMonth = asOf.slice(0, 7)
  const monthlySpendMinor = typicalMonthlySpend(data, asOfMonth, assumptions.spendLookback)
  const monthlyMutualFundSipMinor = configuredMonthlySip(data, 'mutual_fund')
  const monthlyStockSipMinor = configuredMonthlySip(data, 'stock')
  const allSavingsMinor = latestSnapshotValue(bankAccountIds(data.accounts), data.snapshots, asOf)
  const currentBankMinor = latestSnapshotValue(cashflowBankAccountIds(data), data.snapshots, asOf)
  const reservedSavingsMinor = allSavingsMinor - currentBankMinor
  const currentMutualFundsMinor = currentInvestmentValue(data, 'mutual-funds', 'mutual_fund', asOf)
  const currentStocksMinor = currentInvestmentValue(data, 'stocks-portfolio', 'stock', asOf)
  const liabilityMinor = data.accounts
    .filter((account) => !account.archived && (account.type === 'credit' || account.type === 'liability'))
    .reduce((sum, account) => sum + accountBalanceAt(account, data.transactions, data.snapshots, asOf), 0)
  const currentNetWorthMinor = currentBankMinor + reservedSavingsMinor + currentMutualFundsMinor + currentStocksMinor - liabilityMinor
  const mutualFundMonthlyRate = monthlyRate(assumptions.mutualFundAnnualReturnPct)
  const stockMonthlyRate = monthlyRate(assumptions.stockAnnualReturnPct)
  const adjustments = normalizeForecastAdjustments(assumptions.adjustments)

  let bankMinor = currentBankMinor
  let mutualFundsMinor = currentMutualFundsMinor
  let stocksMinor = currentStocksMinor
  let cumulativeSipMinor = 0
  let cumulativeGrowthMinor = 0
  let cumulativePlannedExpenseMinor = 0
  const points: WealthProjectionPoint[] = []

  for (let offset = 0; offset <= assumptions.months; offset += 1) {
    const month = addMonths(asOfMonth, offset)
    const fullRange = monthRange(month)
    const range = offset === 0 ? { from: asOf, to: fullRange.to } : fullRange
    const incomeMinor = projectedIncomeForMonth(data, month, range, assumptions, adjustments)
    const monthFraction = offset === 0 ? (lastDayOfMonth(month) - Number(asOf.slice(8, 10)) + 1) / lastDayOfMonth(month) : 1
    const mutualFundGrowthMinor = Math.round(mutualFundsMinor * (Math.pow(1 + mutualFundMonthlyRate, monthFraction) - 1))
    const stockGrowthMinor = Math.round(stocksMinor * (Math.pow(1 + stockMonthlyRate, monthFraction) - 1))
    const growthThisMonthMinor = mutualFundGrowthMinor + stockGrowthMinor
    const amounts = forecastAmountsForMonth(
      month,
      {
        livingCostMinor: monthlySpendMinor,
        mutualFundSipMinor: configuredSipForMonth(data, 'mutual_fund', month, range.from),
        stockSipMinor: configuredSipForMonth(data, 'stock', month, range.from),
      },
      adjustments,
    )
    const mutualFundSipMinor = amounts.mutualFundSipMinor
    const stockSipMinor = amounts.stockSipMinor
    const sipMinor = mutualFundSipMinor + stockSipMinor
    const plannedExpenseMinor = (data.plannedExpenses ?? [])
      .filter((expense) => expense.active && expense.date >= range.from && expense.date <= range.to)
      .reduce((sum, expense) => sum + Math.max(0, expense.amountMinor), 0)
    const livingSpendMinor = Math.round(amounts.livingCostMinor * monthFraction)
    const spendMinor = livingSpendMinor + plannedExpenseMinor

    bankMinor += incomeMinor - spendMinor - sipMinor
    mutualFundsMinor += mutualFundGrowthMinor + mutualFundSipMinor
    stocksMinor += stockGrowthMinor + stockSipMinor
    cumulativeSipMinor += sipMinor
    cumulativeGrowthMinor += growthThisMonthMinor
    cumulativePlannedExpenseMinor += plannedExpenseMinor

    points.push({
      month,
      incomeMinor,
      livingSpendMinor,
      plannedExpenseMinor,
      spendMinor,
      mutualFundSipMinor,
      stockSipMinor,
      bankMinor,
      mutualFundsMinor,
      stocksMinor,
      growthThisMonthMinor,
      cumulativeSipMinor,
      cumulativeGrowthMinor,
      cumulativePlannedExpenseMinor,
      netWorthMinor: bankMinor + reservedSavingsMinor + mutualFundsMinor + stocksMinor - liabilityMinor,
    })
  }

  return {
    currentNetWorthMinor,
    currentBankMinor,
    reservedSavingsMinor,
    currentMutualFundsMinor,
    currentStocksMinor,
    liabilityMinor,
    monthlySpendMinor,
    monthlyMutualFundSipMinor,
    monthlyStockSipMinor,
    points,
  }
}
