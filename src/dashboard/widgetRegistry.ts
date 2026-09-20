import { createElement, ReactElement } from 'react'
import { ChartPanel } from '@/charts/ChartPanel'
import { calculateNetWorth, calculateSavings, sumInvested, sumLifestyleSpend } from '@/calc/calculations'
import { calculateWealthTotal, latestSnapshotValue, withLiveBankMetrics } from '@/calc/wealth'
import { MoneyText } from '@/components/ui'
import { todayIso } from '@/domain/money'
import { defaultWealthView, StoreData, WidgetInstance, WidgetTypeId } from '@/domain/types'
import { ForecastPanel } from '@/dashboard/ForecastPanel'
import { LifestyleBreakdown } from '@/dashboard/LifestyleBreakdown'
import { TablePreview } from '@/features/tables/TablePreview'
import { incomeForRange } from '@/calc/income'

export type WidgetRenderer = (widget: WidgetInstance, data: StoreData) => ReactElement

function money(amountMinor: number, tone: 'auto' | 'positive' | 'negative' | 'steady') {
  return createElement(MoneyText, { amountMinor, tone })
}

function metricKpi(metricId: string, data: StoreData) {
  const today = todayIso()
  const wealth = data.dashboard.wealth ?? defaultWealthView
  const metrics = withLiveBankMetrics(data.metrics, data.accounts)
  if (metricId === 'income') return money(incomeForRange(data.incomeSources, data.transactions, {}, today), 'positive')
  if (metricId === 'spend') return money(sumLifestyleSpend(data.transactions, data.categories), 'negative')
  if (metricId === 'invest_out') return money(sumInvested(data.transactions, data.categories), 'steady')
  if (metricId === 'savings') return money(calculateSavings(data.transactions, data.categories), 'auto')
  if (metricId === 'wealth_total') return money(calculateWealthTotal(data.snapshots, today, wealth, data.accounts), 'steady')
  if (metricId === 'net_worth') return money(calculateNetWorth(data.accounts, data.transactions, data.snapshots, today), 'steady')
  const metric = metrics.find((item) => item.id === metricId)
  if (metric?.aggregate === 'last' && metric.filter.accountIds?.length) {
    return money(latestSnapshotValue(metric.filter.accountIds, data.snapshots, today), 'steady')
  }
  return '—'
}

export const widgetRegistry: Record<WidgetTypeId, WidgetRenderer> = {
  kpi: (widget, data) => createElement('strong', null, metricKpi(String(widget.config.metricId), data)),
  chart: (widget, data) => {
    const spec = data.chartSpecs.find((chart) => chart.id === widget.config.chartId)
    return spec
      ? createElement(ChartPanel, { spec, data: { ...data, metrics: withLiveBankMetrics(data.metrics, data.accounts) } })
      : createElement('span', null, 'Missing chart')
  },
  tablePreview: (widget, data) => createElement(TablePreview, { tableId: String(widget.config.tableId), data }),
  trend: (_widget, data) => createElement(ForecastPanel, { data }),
  customBlock: (widget, data) =>
    widget.config.variant === 'lifestyleBreakdown'
      ? createElement(LifestyleBreakdown, { data })
      : createElement('span', null, 'Custom block registry slot'),
}
