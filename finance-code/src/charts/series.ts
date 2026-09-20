import { calculateNetWorth, sumInvested, sumLifestyleSpend } from '@/calc/calculations'
import { incomeForRange } from '@/calc/income'
import { latestSnapshotValue } from '@/calc/wealth'
import { ChartSpec, MetricDef, StoreData, Transaction, AccountSnapshot } from '@/domain/types'

export type ChartDateRange = { from?: string; to?: string }

function inDateRange(date: string, range: ChartDateRange = {}) {
  return (!range.from || date >= range.from) && (!range.to || date <= range.to)
}

export function monthsFromTransactions(transactions: Transaction[], snapshots: AccountSnapshot[], range: ChartDateRange = {}) {
  const dates = [...transactions.map((tx) => tx.date), ...snapshots.map((snapshot) => snapshot.date)].filter((date) =>
    /^\d{4}-\d{2}-\d{2}$/.test(date),
  )
  const sorted = dates.filter((date) => inDateRange(date, range)).sort()
  if (!sorted.length) return []
  const min = sorted[0].slice(0, 7)
  const max = sorted[sorted.length - 1].slice(0, 7)
  const months: string[] = []
  let year = Number(min.slice(0, 4))
  let month = Number(min.slice(5, 7))
  const endYear = Number(max.slice(0, 4))
  const endMonth = Number(max.slice(5, 7))
  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push(`${year}-${String(month).padStart(2, '0')}`)
    month += 1
    if (month === 13) {
      month = 1
      year += 1
    }
  }
  return months
}

function monthRange(month: string) {
  const year = Number(month.slice(0, 4))
  const monthNumber = Number(month.slice(5, 7))
  const lastDay = new Date(year, monthNumber, 0).getDate()
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, '0')}` }
}

function metricValue(metric: MetricDef, month: string, data: StoreData) {
  const range = monthRange(month)
  if (metric.id === 'income') return incomeForRange(data.incomeSources ?? [], data.transactions, range, range.to) / 100
  if (metric.id === 'spend') return sumLifestyleSpend(data.transactions, data.categories, range) / 100
  if (metric.id === 'invest_out') return sumInvested(data.transactions, data.categories, range) / 100
  if (metric.id === 'net_cashflow')
    return (
      (incomeForRange(data.incomeSources, data.transactions, range, range.to) -
        sumLifestyleSpend(data.transactions, data.categories, range)) /
      100
    )
  if (metric.id === 'net_worth') return calculateNetWorth(data.accounts, data.transactions, data.snapshots, range.to) / 100
  if (metric.aggregate === 'last' && metric.filter.accountIds?.length) {
    return latestSnapshotValue(metric.filter.accountIds, data.snapshots, range.to) / 100
  }
  if (metric.filter.categoryIds?.length) {
    return data.transactions
      .filter((tx) => metric.filter.categoryIds?.includes(tx.categoryId ?? '') && tx.date >= range.from && tx.date <= range.to)
      .reduce((sum, tx) => sum + tx.amountMinor / 100, 0)
  }
  return 0
}

export function buildChartData(data: StoreData, spec: ChartSpec, range: ChartDateRange = {}) {
  const months = monthsFromTransactions(data.transactions, data.snapshots, range)
  const combine = spec.combineMode === 'combine'
  const metricIds = spec.series.flatMap((series) => (combine ? (series.combinedFrom ?? [series.metricId]) : [series.metricId]))
  const uniqueIds = [...new Set(metricIds)]
  const metrics = uniqueIds
    .map((id) => data.metrics.find((metric) => metric.id === id))
    .filter((metric): metric is MetricDef => Boolean(metric))
  const combinedLabel = spec.series[0]?.labelOverride ?? metrics.map((metric) => metric.label).join(' + ')
  return months.map((month) => {
    const point: Record<string, string | number> = { period: month }
    metrics.forEach((metric) => {
      point[metric.label] = metricValue(metric, month, data)
    })
    if (combine) {
      point[combinedLabel] = metrics.reduce((sum, metric) => sum + Number(point[metric.label] ?? 0), 0)
    }
    return point
  })
}

export function seriesKeys(spec: ChartSpec, data: StoreData) {
  const combine = spec.combineMode === 'combine'
  const metrics = [...new Set(spec.series.flatMap((series) => (combine ? (series.combinedFrom ?? [series.metricId]) : [series.metricId])))]
    .map((id) => data.metrics.find((metric) => metric.id === id))
    .filter((metric): metric is MetricDef => Boolean(metric))
  if (combine) return [spec.series[0]?.labelOverride ?? metrics.map((metric) => metric.label).join(' + ')]
  return metrics.map((metric) => metric.label)
}
