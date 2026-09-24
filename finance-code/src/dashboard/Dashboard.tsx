import { useEffect, useMemo, useState, useTransition } from 'react'
import { AccountBalanceWallet, ChevronLeft, ChevronRight, Home, Save, Savings, ShowChart, Undo } from '@mui/icons-material'
import { ToggleButton, ToggleButtonGroup } from '@mui/material'
import {
  ComposedChart,
  Bar,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts'
import { createUseStyles } from 'react-jss'
import { lifestyleAmountMinor } from '@/calc/classify'
import {
  accountBalanceAt,
  calculateNetWorth,
  lifestyleDataMonthCount,
  lifestyleSpendByCategory,
  sumInvested,
  sumLifestyleSpend,
} from '@/calc/calculations'
import { incomeForRange } from '@/calc/income'
import { calculateStockPerformance, performanceHoldings } from '@/calc/stockPerformance'
import { bankAccounts, calculateWealthTotal, latestSnapshotValue } from '@/calc/wealth'
import { Button, ErrorText, MoneyText, Select } from '@/components/ui'
import { DateRangePicker } from '@/components/DateRangePicker'
import { isValidDateRange, lastThreeMonthsRange } from '@/components/dateRange'
import { FilterStatus } from '@/components/FilterStatus'
import { PanelSkeleton } from '@/components/PanelSkeleton'
import { SearchMultiSelect } from '@/components/SearchMultiSelect'
import { ForecastPanel } from '@/dashboard/ForecastPanel'
import { formatDateLabel, formatMonthLabel, todayIso } from '@/domain/money'
import { DashboardViewSettings, StoreData, defaultWealthView } from '@/domain/types'
import { useStockCloses } from '@/query/useStockCloses'
import { tokens } from '@/theme/tokens'
import { ChartTooltip } from '@/charts/ChartTooltip'
import { formatPrivateMoney, formatPrivateNumber, usePrivacy } from '@/privacy/privacy'

const useStyles = createUseStyles({
  page: { display: 'grid', gap: tokens.space.lg },
  cards: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: tokens.space.md },
  card: {
    minWidth: 0,
    border: `1px solid ${tokens.color.border}`,
    borderRadius: tokens.radius.md,
    padding: tokens.space.md,
    background: tokens.color.bgCard,
    boxShadow: tokens.shadow.card,
    display: 'grid',
    alignContent: 'start',
    gridAutoRows: 'max-content',
    gap: tokens.space.xs,
  },
  cardTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: tokens.space.sm },
  label: { color: tokens.color.textMuted, fontSize: tokens.font.sizeSm },
  value: { fontSize: 23, fontWeight: tokens.font.weightMedium, lineHeight: 1.1, '& span': { fontSize: 23 } },
  sub: { color: tokens.color.textMuted, fontSize: tokens.font.sizeXs, lineHeight: 1.35 },
  cardDetails: {
    display: 'grid',
    gap: tokens.space.xs,
    paddingTop: tokens.space.sm,
    marginTop: tokens.space.xs,
    borderTop: `1px solid ${tokens.color.border}`,
  },
  cardDetail: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: tokens.space.sm,
    color: tokens.color.textMuted,
    fontSize: tokens.font.sizeXs,
  },
  cardDetailValue: { whiteSpace: 'nowrap', '& span': { fontSize: tokens.font.sizeXs } },
  icon: {
    width: 32,
    height: 32,
    borderRadius: tokens.radius.sm,
    display: 'grid',
    placeItems: 'center',
    background: tokens.color.accentSoft,
    color: tokens.color.accent,
  },
  positive: { background: tokens.color.greenSoft, color: tokens.color.positive },
  negative: { background: tokens.color.dangerSoft, color: tokens.color.negative },
  steady: { background: tokens.color.goldSoft, color: tokens.color.steady },
  panel: {
    border: `1px solid ${tokens.color.border}`,
    borderRadius: tokens.radius.md,
    background: tokens.color.bgCard,
    boxShadow: tokens.shadow.card,
    overflow: 'visible',
  },
  panelHead: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: tokens.space.md,
    alignItems: 'center',
    padding: tokens.space.lg,
    borderBottom: `1px solid ${tokens.color.border}`,
    '@media (max-width: 760px)': { display: 'grid' },
  },
  panelTitle: { margin: 0, fontSize: tokens.font.sizeLg },
  filterBar: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: tokens.space.sm,
    alignItems: 'center',
    padding: [tokens.space.md, tokens.space.lg],
    borderBottom: `1px solid ${tokens.color.border}`,
    background: tokens.color.bgMuted,
  },
  checks: { display: 'flex', flexWrap: 'wrap', gap: tokens.space.sm, alignItems: 'center' },
  sectionActions: { display: 'flex', flexWrap: 'wrap', gap: tokens.space.sm, alignItems: 'center', justifyContent: 'flex-end' },
  compactSelect: { width: 168, minWidth: 168, flex: '0 0 168px' },
  metricToggle: {
    '& .MuiToggleButtonGroup-root': { background: tokens.color.bgMuted },
    '& .MuiToggleButton-root': {
      color: tokens.color.textMuted,
      borderColor: tokens.color.borderStrong,
      textTransform: 'none',
      padding: '6px 12px',
      fontSize: tokens.font.sizeSm,
    },
    '& .Mui-selected': {
      backgroundColor: `${tokens.color.accentSoft} !important`,
      color: `${tokens.color.accent} !important`,
    },
  },
  chart: { height: 430, padding: [tokens.space.sm, tokens.space.md, tokens.space.lg], '@media (max-width: 720px)': { height: 340 } },
  sections: { display: 'grid', gap: tokens.space.lg },
  section: {
    border: `1px solid ${tokens.color.border}`,
    borderRadius: tokens.radius.md,
    background: tokens.color.bgCard,
    boxShadow: tokens.shadow.card,
    overflow: 'visible',
  },
  sectionHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.space.md,
    padding: tokens.space.lg,
    borderBottom: `1px solid ${tokens.color.border}`,
    '@media (max-width: 760px)': { display: 'grid' },
  },
  sectionTitle: { margin: 0, fontSize: tokens.font.sizeMd },
  sectionTitleGroup: { display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: tokens.space.md },
  sectionAverage: {
    display: 'flex',
    alignItems: 'baseline',
    gap: tokens.space.xs,
    color: tokens.color.textMuted,
    fontSize: tokens.font.sizeSm,
    '& span': { fontSize: tokens.font.sizeSm },
  },
  sectionBody: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.4fr) minmax(300px, 0.8fr)',
    gap: tokens.space.lg,
    padding: tokens.space.lg,
    '@media (max-width: 980px)': { gridTemplateColumns: '1fr' },
  },
  lifestyleBody: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.4fr) auto minmax(300px, 0.8fr)',
    gap: tokens.space.md,
    padding: tokens.space.lg,
    '@media (max-width: 980px)': { gridTemplateColumns: '1fr', '& $tableToggle': { justifySelf: 'start' } },
  },
  lifestyleBodyCollapsed: { gridTemplateColumns: 'minmax(0, 1fr) auto' },
  tableToggle: {
    alignSelf: 'center',
    minWidth: '34px !important',
    width: 34,
    height: 34,
    padding: '4px !important',
  },
  fullSectionBody: { display: 'block', padding: tokens.space.lg },
  graphSide: { display: 'grid', gap: tokens.space.md, minWidth: 0 },
  tableSide: {
    minWidth: 0,
    border: `1px solid ${tokens.color.border}`,
    borderRadius: tokens.radius.sm,
    overflow: 'hidden',
    alignSelf: 'start',
  },
  investmentCanvas: { width: '100%', minWidth: 0 },
  investmentTable: { width: '100%', overflowX: 'auto', '& table': { minWidth: 690 } },
  miniChart: { height: 300, minWidth: 0 },
  wideChart: { width: '100%', height: 420, minWidth: 0, '@media (max-width: 720px)': { height: 340 } },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: tokens.font.sizeSm },
  th: {
    textAlign: 'left',
    color: tokens.color.textMuted,
    background: tokens.color.bgMuted,
    padding: [tokens.space.sm, tokens.space.md],
    borderBottom: `1px solid ${tokens.color.border}`,
  },
  td: { padding: [tokens.space.sm, tokens.space.md], borderBottom: `1px solid ${tokens.color.border}` },
  rows: { display: 'grid', gap: tokens.space.sm },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: tokens.space.md,
    alignItems: 'center',
    color: tokens.color.text,
    fontSize: tokens.font.sizeSm,
  },
  empty: { color: tokens.color.textMuted, fontSize: tokens.font.sizeSm },
  chartMessage: {
    minHeight: 300,
    display: 'grid',
    placeItems: 'center',
    color: tokens.color.textMuted,
    fontSize: tokens.font.sizeSm,
    textAlign: 'center',
    padding: tokens.space.lg,
  },
  tooltip: {
    border: `1px solid ${tokens.color.borderStrong}`,
    borderRadius: tokens.radius.sm,
    background: tokens.color.bgCard,
    boxShadow: tokens.shadow.card,
    padding: tokens.space.md,
    display: 'grid',
    gap: tokens.space.sm,
  },
  tooltipDate: { color: tokens.color.textMuted, fontSize: tokens.font.sizeXs },
  tooltipRow: { display: 'grid', gap: 2, fontSize: tokens.font.sizeSm },
  tooltipPnl: { color: tokens.color.textMuted, fontSize: tokens.font.sizeXs },
})

type GraphKey = 'icici' | 'sbi' | 'parkedSavings' | 'mutualFunds' | 'stocks' | 'sip' | 'income' | 'rent' | 'lifestyle'
type InvestmentView = 'table' | 'line' | 'pie'
type InvestmentMetric = 'value' | 'percent'

const moneyFlowKeys: GraphKey[] = ['icici', 'sbi', 'parkedSavings', 'mutualFunds', 'stocks', 'sip', 'income', 'rent', 'lifestyle']
const savingKeys: GraphKey[] = ['icici', 'sbi', 'parkedSavings', 'mutualFunds', 'stocks']
const lifestyleKeys: GraphKey[] = ['rent', 'lifestyle']

const graphLabels: Record<GraphKey, string> = {
  icici: 'ICICI',
  sbi: 'SBI',
  parkedSavings: 'Other saving',
  mutualFunds: 'Mutual funds',
  stocks: 'Stocks',
  sip: 'SIP',
  income: 'Income',
  rent: 'Rent',
  lifestyle: 'Lifestyle',
}

const colors: Record<GraphKey, string> = {
  icici: tokens.color.accent,
  sbi: tokens.color.steady,
  parkedSavings: tokens.color.focus,
  mutualFunds: tokens.color.positive,
  stocks: tokens.color.rose,
  sip: tokens.color.steady,
  income: tokens.color.positive,
  rent: tokens.color.negative,
  lifestyle: tokens.color.warning,
}

const stockColors = [
  tokens.color.accent,
  tokens.color.positive,
  tokens.color.rose,
  tokens.color.steady,
  tokens.color.focus,
  tokens.color.warning,
]

function monthRange(month: string) {
  const year = Number(month.slice(0, 4))
  const monthNumber = Number(month.slice(5, 7))
  const lastDay = new Date(year, monthNumber, 0).getDate()
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, '0')}` }
}

function monthsBetween(from: string, to: string) {
  const months: string[] = []
  let year = Number(from.slice(0, 4))
  let month = Number(from.slice(5, 7))
  const endYear = Number(to.slice(0, 4))
  const endMonth = Number(to.slice(5, 7))
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

function currentMonthRange() {
  const today = todayIso()
  return monthRange(today.slice(0, 7))
}

function rangeEnd(range: { from: string; to: string }) {
  return range.to || todayIso()
}

function rentSpend(data: StoreData, range: { from?: string; to?: string } = {}) {
  return data.transactions
    .filter(
      (tx) =>
        tx.flow === 'outflow' &&
        tx.categoryId === 'rent-home' &&
        (!range.from || tx.date >= range.from) &&
        (!range.to || tx.date <= range.to),
    )
    .reduce((sum, tx) => sum + lifestyleAmountMinor(tx.categoryId, tx.amountMinor), 0)
}

function otherIncome(data: StoreData, range: { from?: string; to?: string } = {}) {
  return data.transactions
    .filter(
      (tx) =>
        tx.flow === 'inflow' && tx.categoryId !== 'salary' && (!range.from || tx.date >= range.from) && (!range.to || tx.date <= range.to),
    )
    .reduce((sum, tx) => sum + tx.amountMinor, 0)
}

function incomeByCategory(data: StoreData, range: { from?: string; to?: string } = {}) {
  const names = new Map(data.categories.map((category) => [category.id, category.name]))
  const totals = new Map<string, number>()
  data.transactions
    .filter((tx) => tx.flow === 'inflow' && (!range.from || tx.date >= range.from) && (!range.to || tx.date <= range.to))
    .forEach((tx) => {
      const id = tx.categoryId ?? 'other-credit'
      totals.set(id, (totals.get(id) ?? 0) + tx.amountMinor)
    })
  return [...totals.entries()]
    .map(([categoryId, amountMinor]) => ({ categoryId, name: names.get(categoryId) ?? categoryId, amountMinor }))
    .sort((left, right) => right.amountMinor - left.amountMinor)
}

function latest(accountId: string, data: StoreData, to: string) {
  return latestSnapshotValue([accountId], data.snapshots, to)
}

function parkedSavingAccounts(data: StoreData) {
  return data.accounts.filter((account) => !account.archived && (account.type === 'cash' || account.type === 'other'))
}

function defaultDashboardViews(range: { from: string; to: string }, stockIds: string[]): DashboardViewSettings {
  return {
    moneyFlow: { range, series: moneyFlowKeys },
    saving: { range, series: savingKeys },
    investment: { range, stockIds, view: 'line', metric: 'percent' },
    income: { range },
    lifestyle: { range, series: lifestyleKeys },
  }
}

export function Dashboard({
  data,
  onDataChange,
  onLayoutChange,
}: {
  data: StoreData
  onDataChange: () => Promise<void>
  onLayoutChange: (layout: StoreData['dashboard']) => Promise<void>
}) {
  const classes = useStyles()
  const { masked } = usePrivacy()
  const privateMoney = (amountMinor: number) => formatPrivateMoney(amountMinor, 'INR', false, masked)
  const [today] = useState(todayIso)
  const [month] = useState(currentMonthRange)
  const [defaultRange] = useState(lastThreeMonthsRange)
  const wealth = data.dashboard.wealth ?? defaultWealthView
  const eligibleStocks = useMemo(() => performanceHoldings(data.holdings), [data.holdings])
  const [savedViews, setSavedViews] = useState<DashboardViewSettings>(() => {
    const initial =
      data.dashboard.views ??
      defaultDashboardViews(
        defaultRange,
        eligibleStocks.map((holding) => holding.id),
      )
    return { ...initial, investment: { ...initial.investment, metric: 'percent' } }
  })
  const [mainRange, setMainRange] = useState(savedViews.moneyFlow.range)
  const [savingRange, setSavingRange] = useState(savedViews.saving.range)
  const [investmentRange, setInvestmentRange] = useState(savedViews.investment.range)
  const [selectedStockIds, setSelectedStockIds] = useState<string[]>(savedViews.investment.stockIds)
  const [investmentView, setInvestmentView] = useState<InvestmentView>(savedViews.investment.view)
  const [investmentMetric, setInvestmentMetric] = useState<InvestmentMetric>(savedViews.investment.metric)
  const [isFilterPending, startFilterTransition] = useTransition()
  const [incomeRange, setIncomeRange] = useState(savedViews.income.range)
  const [lifestyleRange, setLifestyleRange] = useState(savedViews.lifestyle.range)
  const [savingSelection, setSavingSelection] = useState<GraphKey[]>(savedViews.saving.series as GraphKey[])
  const [lifestyleSelection, setLifestyleSelection] = useState<GraphKey[]>(savedViews.lifestyle.series as GraphKey[])
  const [showLifestyleTable, setShowLifestyleTable] = useState(true)
  const [graph, setGraph] = useState<Record<GraphKey, boolean>>(() => {
    const selected = new Set(savedViews.moneyFlow.series)
    return Object.fromEntries(moneyFlowKeys.map((key) => [key, selected.has(key)])) as Record<GraphKey, boolean>
  })
  const [savingView, setSavingView] = useState<keyof DashboardViewSettings | null>(null)
  const [viewError, setViewError] = useState('')
  const selectedStocks = useMemo(
    () => eligibleStocks.filter((holding) => selectedStockIds.includes(holding.id)),
    [eligibleStocks, selectedStockIds],
  )

  const asOf = today
  const quotesQuery = useStockCloses(selectedStocks, asOf)
  const stockCloses = useMemo(
    () => Object.fromEntries(Object.entries(quotesQuery.data ?? {}).map(([id, item]) => [id, item.closes])),
    [quotesQuery.data],
  )
  const quoteErrors = Object.values(quotesQuery.data ?? {})
    .map((item) => item.error)
    .filter(Boolean)
  const quotesLoading = quotesQuery.isFetching
  const showQuoteSkeleton = selectedStocks.length > 0 && quotesQuery.isPending && !quotesQuery.data
  const filtersBusy = quotesQuery.isFetching || isFilterPending
  const filtersReady = !filtersBusy

  useEffect(() => {
    const available = new Set(eligibleStocks.map((holding) => holding.id))
    setSelectedStockIds((current) => {
      const next = current.filter((id) => available.has(id))
      return next.length === current.length && next.every((id, index) => id === current[index]) ? current : next
    })
  }, [eligibleStocks])
  const parkedAccounts = useMemo(() => parkedSavingAccounts(data), [data.accounts])
  const rentPerMonth = 1_500_000
  const {
    parkedSaving,
    mutualFunds,
    stocks,
    netWorth,
    investedMonth,
    investmentTotal,
    liabilityTotal,
    assetTotal,
    dataMonthCount,
    rentAcrossData,
    lifestyleAcrossData,
    spendingAcrossData,
    spendingAverageAcrossData,
  } = useMemo(() => {
    const nextParkedSaving = latestSnapshotValue(
      parkedAccounts.map((account) => account.id),
      data.snapshots,
      today,
    )
    const nextMutualFunds = latest('mutual-funds', data, today)
    const nextStocks = latest('stocks-portfolio', data, today)
    const nextNetWorth = calculateNetWorth(data.accounts, data.transactions, data.snapshots, today)
    const nextInvestedMonth = sumInvested(data.transactions, data.categories, month)
    const nextLiabilityTotal = data.accounts
      .filter((account) => !account.archived && (account.type === 'credit' || account.type === 'liability'))
      .reduce((sum, account) => sum + accountBalanceAt(account, data.transactions, data.snapshots, today), 0)
    const transactionDates = data.transactions
      .map((transaction) => transaction.date)
      .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))
      .sort()
    const firstDataDate = transactionDates[0] ?? today
    const lastDataDate = transactionDates.at(-1) ?? today
    const nextDataMonthCount = transactionDates.length ? monthsBetween(firstDataDate.slice(0, 7), lastDataDate.slice(0, 7)).length : 0
    const fullDataRange = { from: firstDataDate, to: lastDataDate }
    const nextRentAcrossData = rentPerMonth * nextDataMonthCount
    const nextLifestyleAcrossData = Math.max(
      0,
      sumLifestyleSpend(data.transactions, data.categories, fullDataRange) - rentSpend(data, fullDataRange),
    )
    const nextSpendingAcrossData = nextRentAcrossData + nextLifestyleAcrossData
    return {
      parkedSaving: nextParkedSaving,
      mutualFunds: nextMutualFunds,
      stocks: nextStocks,
      netWorth: nextNetWorth,
      investedMonth: nextInvestedMonth,
      investmentTotal: nextMutualFunds + nextStocks,
      liabilityTotal: nextLiabilityTotal,
      assetTotal: nextNetWorth + nextLiabilityTotal,
      dataMonthCount: nextDataMonthCount,
      rentAcrossData: nextRentAcrossData,
      lifestyleAcrossData: nextLifestyleAcrossData,
      spendingAcrossData: nextSpendingAcrossData,
      spendingAverageAcrossData: nextDataMonthCount ? Math.round(nextSpendingAcrossData / nextDataMonthCount) : 0,
    }
  }, [data, month, parkedAccounts, today])
  const mainValidRange = isValidDateRange(mainRange)
  const buildGraphData = (selectedRange: { from: string; to: string }) => {
    if (!isValidDateRange(selectedRange)) return []
    const fromMonth = (selectedRange.from || month.from).slice(0, 7)
    const toMonth = (selectedRange.to || today).slice(0, 7)
    return monthsBetween(fromMonth, toMonth).map((item) => {
      const span = monthRange(item)
      const point: Record<string, string | number> = { period: item }
      point[graphLabels.icici] = latest('icici', data, span.to) / 100
      point[graphLabels.sbi] = latest('sbi', data, span.to) / 100
      point[graphLabels.parkedSavings] =
        latestSnapshotValue(
          parkedAccounts.map((account) => account.id),
          data.snapshots,
          span.to,
        ) / 100
      point[graphLabels.mutualFunds] = latest('mutual-funds', data, span.to) / 100
      point[graphLabels.stocks] = latest('stocks-portfolio', data, span.to) / 100
      point[graphLabels.sip] = sumInvested(data.transactions, data.categories, span) / 100
      point[graphLabels.income] = incomeForRange(data.incomeSources, data.transactions, span, span.to) / 100
      point[graphLabels.rent] = rentSpend(data, span) / 100
      point[graphLabels.lifestyle] = Math.max(0, sumLifestyleSpend(data.transactions, data.categories, span) - rentSpend(data, span)) / 100
      return point
    })
  }
  const graphData = useMemo(() => buildGraphData(mainRange), [data, parkedAccounts, mainRange, month.from, today])
  const savingTo = rangeEnd(savingRange)
  const { savingTotal, savingMutualFunds, savingStocks } = useMemo(
    () => ({
      savingTotal: calculateWealthTotal(data.snapshots, savingTo, wealth, data.accounts),
      savingMutualFunds: latest('mutual-funds', data, savingTo),
      savingStocks: latest('stocks-portfolio', data, savingTo),
    }),
    [data, savingTo, wealth],
  )
  const stockPerformance = useMemo(
    () =>
      Object.fromEntries(
        selectedStocks.map((holding) => [holding.id, calculateStockPerformance(holding, stockCloses[holding.id] ?? [], investmentRange)]),
      ),
    [selectedStocks, stockCloses, investmentRange],
  )
  const stockChartData = useMemo(() => {
    const rows = new Map<string, Record<string, string | number>>()
    selectedStocks.forEach((holding) => {
      const points = stockPerformance[holding.id] ?? []
      const first = points[0]
      if (!first?.valueMinor) return
      points.forEach((point) => {
        const row = rows.get(point.date) ?? { date: point.date }
        const valueChange = (point.valueMinor - first.valueMinor) / 100
        const pctChange = (point.valueMinor / first.valueMinor - 1) * 100
        row[holding.id] = investmentMetric === 'percent' ? pctChange : valueChange
        row[`${holding.id}:pnl`] = point.pnlMinor
        row[`${holding.id}:pct`] = point.pnlPct ?? Number.NaN
        rows.set(point.date, row)
      })
    })
    return [...rows.values()].sort((left, right) => String(left.date).localeCompare(String(right.date)))
  }, [investmentMetric, selectedStocks, stockPerformance])
  const stockPieData = useMemo(
    () =>
      selectedStocks.flatMap((holding, index) => {
        const latestPoint = calculateStockPerformance(holding, stockCloses[holding.id] ?? [], {
          from: holding.buyDate || asOf,
          to: asOf,
        }).at(-1)
        const valueMinor = latestPoint?.valueMinor ?? holding.currentMinor
        if (valueMinor <= 0) return []
        return [
          {
            id: holding.id,
            name: holding.name,
            value: valueMinor / 100,
            color: stockColors[index % stockColors.length],
          },
        ]
      }),
    [asOf, selectedStocks, stockCloses],
  )
  const { incomeTotal, incomeRows, incomeOtherTotal } = useMemo(
    () => ({
      incomeTotal: incomeForRange(data.incomeSources, data.transactions, incomeRange, rangeEnd(incomeRange)),
      incomeRows: incomeByCategory(data, incomeRange),
      incomeOtherTotal: otherIncome(data, incomeRange),
    }),
    [data, incomeRange],
  )
  const incomeStatementSalary = incomeRows.find((row) => row.categoryId === 'salary')?.amountMinor ?? 0
  const { lifestyleRent, lifestyleRows, lifestyleWithoutRent, lifestyleMonthCount } = useMemo(() => {
    const nextLifestyleRent = rentSpend(data, lifestyleRange)
    return {
      lifestyleRent: nextLifestyleRent,
      lifestyleRows: lifestyleSpendByCategory(data.transactions, data.categories, lifestyleRange).filter(
        (row) => row.categoryId !== 'rent-home',
      ),
      lifestyleWithoutRent: Math.max(0, sumLifestyleSpend(data.transactions, data.categories, lifestyleRange) - nextLifestyleRent),
      lifestyleMonthCount: lifestyleDataMonthCount(data.transactions, data.categories, lifestyleRange),
    }
  }, [data, lifestyleRange])
  const averageLifestyle = lifestyleMonthCount ? Math.round((lifestyleRent + lifestyleWithoutRent) / lifestyleMonthCount) : 0
  const averageLifestyleWithoutRent = lifestyleMonthCount ? Math.round(lifestyleWithoutRent / lifestyleMonthCount) : 0
  const selectedLifestyleAverage = lifestyleMonthCount
    ? Math.round(
        ((lifestyleSelection.includes('rent') ? lifestyleRent : 0) +
          (lifestyleSelection.includes('lifestyle') ? lifestyleWithoutRent : 0)) /
          lifestyleMonthCount,
      )
    : 0
  const mainGraphSelection = moneyFlowKeys.filter((key) => graph[key])
  const graphOptions = (keys: GraphKey[]) => keys.map((key) => ({ id: key, label: graphLabels[key] }))
  const setMainGraphSelection = (selection: string[]) =>
    startFilterTransition(() => {
      const selected = new Set(selection)
      setGraph((current) => Object.fromEntries(Object.keys(current).map((key) => [key, selected.has(key)])) as Record<GraphKey, boolean>)
    })
  const saveDashboardView = async (key: keyof DashboardViewSettings) => {
    setSavingView(key)
    setViewError('')
    const next: DashboardViewSettings = {
      ...savedViews,
      ...(key === 'moneyFlow' ? { moneyFlow: { range: mainRange, series: mainGraphSelection } } : {}),
      ...(key === 'saving' ? { saving: { range: savingRange, series: savingSelection } } : {}),
      ...(key === 'investment'
        ? { investment: { range: investmentRange, stockIds: selectedStockIds, view: investmentView, metric: investmentMetric } }
        : {}),
      ...(key === 'income' ? { income: { range: incomeRange } } : {}),
      ...(key === 'lifestyle' ? { lifestyle: { range: lifestyleRange, series: lifestyleSelection } } : {}),
    }
    try {
      await onLayoutChange({ ...data.dashboard, views: next })
      setSavedViews(next)
    } catch (error) {
      setViewError(error instanceof Error ? error.message : 'Could not save this dashboard view.')
    } finally {
      setSavingView(null)
    }
  }
  const cancelDashboardChanges = (key: keyof DashboardViewSettings) =>
    startFilterTransition(() => {
      if (key === 'moneyFlow') {
        setMainRange(savedViews.moneyFlow.range)
        const selected = new Set(savedViews.moneyFlow.series)
        setGraph(Object.fromEntries(moneyFlowKeys.map((item) => [item, selected.has(item)])) as Record<GraphKey, boolean>)
      }
      if (key === 'saving') {
        setSavingRange(savedViews.saving.range)
        setSavingSelection(savedViews.saving.series as GraphKey[])
      }
      if (key === 'investment') {
        setInvestmentRange(savedViews.investment.range)
        setSelectedStockIds(savedViews.investment.stockIds)
        setInvestmentView(savedViews.investment.view)
        setInvestmentMetric(savedViews.investment.metric)
      }
      if (key === 'income') setIncomeRange(savedViews.income.range)
      if (key === 'lifestyle') {
        setLifestyleRange(savedViews.lifestyle.range)
        setLifestyleSelection(savedViews.lifestyle.series as GraphKey[])
      }
      setViewError('')
    })
  const viewActions = (key: keyof DashboardViewSettings) => (
    <div className={classes.sectionActions}>
      <Button disabled={savingView === key} onClick={() => cancelDashboardChanges(key)}>
        <Undo fontSize="small" /> Cancel changes
      </Button>
      <Button variant="primary" disabled={savingView === key} onClick={() => saveDashboardView(key)}>
        <Save fontSize="small" /> {savingView === key ? 'Saving...' : 'Save view'}
      </Button>
    </div>
  )
  const renderMiniChart = (keys: GraphKey[], selectedRange: { from: string; to: string }, selectedKeys: GraphKey[] = keys) => (
    <div className={classes.miniChart}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={buildGraphData(selectedRange)}>
          <CartesianGrid stroke={tokens.color.border} vertical={false} />
          <XAxis dataKey="period" tickLine={false} axisLine={false} tickFormatter={formatMonthLabel} />
          <YAxis tickLine={false} axisLine={false} width={72} tickFormatter={(value) => formatPrivateNumber(Number(value), masked)} />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: tokens.color.borderStrong, strokeDasharray: '4 4' }} />
          <Legend />
          {keys.map((key) => {
            if (!selectedKeys.includes(key)) return null
            const label = graphLabels[key]
            if (key === 'sip' || key === 'rent' || key === 'lifestyle' || key === 'income')
              return <Bar key={key} dataKey={label} fill={colors[key]} radius={[4, 4, 0, 0]} />
            return <Line key={key} dataKey={label} stroke={colors[key]} dot={false} strokeWidth={2.5} />
          })}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )

  const stockOptions = useMemo(
    () =>
      eligibleStocks
        .map((holding) => {
          const latestPoint = calculateStockPerformance(holding, stockCloses[holding.id] ?? [], {
            from: holding.buyDate || asOf,
            to: asOf,
          }).at(-1)
          const pct = latestPoint?.pnlPct ?? null
          const pnlMinor = latestPoint?.pnlMinor
          const detail =
            pct == null ? (holding.ticker ?? '') : `${pct >= 0 ? '+' : ''}${(pct * 100).toFixed(1)}% · ${privateMoney(pnlMinor ?? 0)}`
          return {
            id: holding.id,
            label: holding.name,
            detail,
            tone: (pct == null ? 'steady' : pct > 0 ? 'positive' : pct < 0 ? 'negative' : 'steady') as 'positive' | 'negative' | 'steady',
            sort: pct ?? Number.NEGATIVE_INFINITY,
          }
        })
        .sort((left, right) => right.sort - left.sort || left.label.localeCompare(right.label)),
    [asOf, eligibleStocks, stockCloses],
  )
  const renderStockTooltip = ({ active, label, payload }: TooltipContentProps) => {
    if (!active || !payload?.length) return null
    return (
      <div className={classes.tooltip}>
        <div className={classes.tooltipDate}>{formatDateLabel(String(label))}</div>
        {payload.map((entry) => {
          const id = String(entry.dataKey ?? '')
          const point = entry.payload as Record<string, string | number> | undefined
          const pnlMinor = Number(point?.[`${id}:pnl`] ?? 0)
          const pnlPct = Number(point?.[`${id}:pct`])
          return (
            <div className={classes.tooltipRow} key={id}>
              <strong>
                {entry.name}:{' '}
                {investmentMetric === 'percent'
                  ? `${Number(entry.value) >= 0 ? '+' : ''}${Number(entry.value).toFixed(2)}%`
                  : privateMoney(Math.round(Number(entry.value) * 100))}
              </strong>
              <span className={classes.tooltipPnl}>
                vs cost {privateMoney(pnlMinor)} {Number.isFinite(pnlPct) ? `(${pnlPct >= 0 ? '+' : ''}${(pnlPct * 100).toFixed(2)}%)` : ''}
              </span>
            </div>
          )
        })}
      </div>
    )
  }

  const summary = [
    {
      label: 'Net worth',
      value: netWorth,
      sub: 'Everything you own minus amounts owed',
      tone: 'auto' as const,
      icon: <AccountBalanceWallet fontSize="small" />,
      showPaise: true,
      details: [
        { label: 'Total assets', value: assetTotal, tone: 'positive' as const },
        { label: 'Liabilities', value: liabilityTotal, tone: 'negative' as const },
      ],
    },
    {
      label: 'Investments',
      value: investmentTotal,
      sub: 'Current market value',
      tone: 'steady' as const,
      icon: <ShowChart fontSize="small" />,
      showPaise: false,
      details: [
        { label: 'Mutual funds', value: mutualFunds, tone: 'steady' as const },
        { label: 'Stocks', value: stocks, tone: 'steady' as const },
        { label: 'Added this month', value: investedMonth, tone: 'positive' as const },
      ],
    },
    {
      label: 'Other savings',
      value: parkedSaving,
      sub: 'Cash, deposits, and money held elsewhere',
      tone: 'steady' as const,
      icon: <Savings fontSize="small" />,
      showPaise: false,
      details: [],
    },
    {
      label: 'Rent + lifestyle',
      value: spendingAcrossData,
      sub: `${privateMoney(spendingAverageAcrossData)} average per month | ${dataMonthCount} months`,
      tone: 'negative' as const,
      icon: <Home fontSize="small" />,
      showPaise: false,
      details: [
        { label: `Rent (${privateMoney(rentPerMonth)} x ${dataMonthCount})`, value: rentAcrossData, tone: 'negative' as const },
        { label: 'Lifestyle', value: lifestyleAcrossData, tone: 'negative' as const },
      ],
    },
  ]

  return (
    <div className={classes.page}>
      <div className={classes.cards}>
        {summary.map((item) => (
          <section className={classes.card} key={item.label}>
            <div className={classes.cardTop}>
              <span className={classes.label}>{item.label}</span>
              <span
                className={`${classes.icon} ${item.tone === 'negative' || (item.tone === 'auto' && item.value < 0) ? classes.negative : item.tone === 'steady' ? classes.steady : classes.positive}`}
              >
                {item.icon}
              </span>
            </div>
            <div className={classes.value}>
              <MoneyText amountMinor={item.value} tone={item.tone} showPaise={'showPaise' in item && item.showPaise} />
            </div>
            <div className={classes.sub}>{item.sub}</div>
            {item.details.length ? (
              <div className={classes.cardDetails}>
                {item.details.map((detail) => (
                  <div className={classes.cardDetail} key={detail.label}>
                    <span>{detail.label}</span>
                    <span className={classes.cardDetailValue}>
                      <MoneyText amountMinor={detail.value} tone={detail.tone} />
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        ))}
      </div>

      <ErrorText>{viewError}</ErrorText>

      <section className={classes.panel}>
        <div className={classes.panelHead}>
          <h2 className={classes.panelTitle}>Money flow</h2>
          {viewActions('moneyFlow')}
        </div>
        <div className={classes.filterBar}>
          <FilterStatus fetching={isFilterPending} ready={!isFilterPending} />
          <SearchMultiSelect
            options={graphOptions(moneyFlowKeys)}
            value={mainGraphSelection}
            onChange={setMainGraphSelection}
            label="Select money flow"
            selectionNoun="series"
          />
          <DateRangePicker value={mainRange} onChange={(next) => startFilterTransition(() => setMainRange(next))} />
        </div>
        <div className={classes.chart}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={mainValidRange ? graphData : []}>
              <CartesianGrid stroke={tokens.color.border} vertical={false} />
              <XAxis dataKey="period" tickLine={false} axisLine={false} tickFormatter={formatMonthLabel} />
              <YAxis tickLine={false} axisLine={false} width={82} tickFormatter={(value) => formatPrivateNumber(Number(value), masked)} />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: tokens.color.borderStrong, strokeDasharray: '4 4' }} />
              <Legend />
              {(Object.keys(graphLabels) as GraphKey[]).map((key) => {
                const label = graphLabels[key]
                if (!graph[key]) return null
                if (key === 'income' || key === 'rent' || key === 'lifestyle' || key === 'sip') {
                  return <Bar key={key} dataKey={label} fill={colors[key]} radius={[4, 4, 0, 0]} />
                }
                return <Line key={key} dataKey={label} stroke={colors[key]} dot={false} strokeWidth={2.5} />
              })}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className={classes.sections}>
        <section className={classes.section}>
          <div className={classes.sectionHead}>
            <h3 className={classes.sectionTitle}>Saving</h3>
            {viewActions('saving')}
          </div>
          <div className={classes.filterBar}>
            <FilterStatus fetching={isFilterPending} ready={!isFilterPending} />
            <SearchMultiSelect
              options={graphOptions(savingKeys)}
              value={savingSelection}
              onChange={(next) => startFilterTransition(() => setSavingSelection(next as GraphKey[]))}
              label="Select savings"
              selectionNoun="series"
            />
            <DateRangePicker value={savingRange} onChange={(next) => startFilterTransition(() => setSavingRange(next))} />
          </div>
          <div className={classes.sectionBody}>
            <div className={classes.graphSide}>{renderMiniChart(savingKeys, savingRange, savingSelection)}</div>
            <div className={classes.tableSide}>
              <table className={classes.table}>
                <thead>
                  <tr>
                    <th className={classes.th}>Saving bucket</th>
                    <th className={classes.th}>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {bankAccounts(data.accounts)
                    .filter((account) => account.type === 'checking' || account.type === 'savings')
                    .map((account) => (
                      <tr key={account.id}>
                        <td className={classes.td}>{account.name} balance</td>
                        <td className={classes.td}>
                          <MoneyText amountMinor={latest(account.id, data, savingTo)} tone="steady" />
                        </td>
                      </tr>
                    ))}
                  {parkedAccounts.map((account) => (
                    <tr key={account.id}>
                      <td className={classes.td}>{account.name}</td>
                      <td className={classes.td}>
                        <MoneyText amountMinor={latest(account.id, data, savingTo)} tone="steady" />
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td className={classes.td}>Mutual funds</td>
                    <td className={classes.td}>
                      <MoneyText amountMinor={savingMutualFunds} tone="positive" />
                    </td>
                  </tr>
                  <tr>
                    <td className={classes.td}>Stocks</td>
                    <td className={classes.td}>
                      <MoneyText amountMinor={savingStocks} tone="positive" />
                    </td>
                  </tr>
                  <tr>
                    <td className={classes.td}>Selected total</td>
                    <td className={classes.td}>
                      <MoneyText amountMinor={savingTotal} tone="positive" />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className={classes.section}>
          <div className={classes.sectionHead}>
            <h3 className={classes.sectionTitle}>Investment</h3>
            {viewActions('investment')}
          </div>
          <div className={classes.filterBar}>
            <FilterStatus fetching={filtersBusy} ready={filtersReady} />
            <SearchMultiSelect
              options={stockOptions}
              value={selectedStockIds}
              onChange={(next) => startFilterTransition(() => setSelectedStockIds(next))}
            />
            <div className={classes.compactSelect}>
              <Select
                aria-label="Investment view"
                value={investmentView}
                onChange={(event) => startFilterTransition(() => setInvestmentView(event.target.value as InvestmentView))}
              >
                <option value="table">Table</option>
                <option value="line">Line graph</option>
                <option value="pie">Pie chart</option>
              </Select>
            </div>
            {investmentView === 'line' ? (
              <div className={classes.metricToggle}>
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={investmentMetric}
                  onChange={(_event, next: InvestmentMetric | null) => {
                    if (next) startFilterTransition(() => setInvestmentMetric(next))
                  }}
                  aria-label="Investment scale"
                >
                  <ToggleButton value="percent">Change %</ToggleButton>
                  <ToggleButton value="value">Value</ToggleButton>
                </ToggleButtonGroup>
              </div>
            ) : null}
            <DateRangePicker value={investmentRange} onChange={(next) => startFilterTransition(() => setInvestmentRange(next))} />
          </div>
          <div className={classes.fullSectionBody}>
            <div className={classes.investmentCanvas}>
              {showQuoteSkeleton ? (
                <PanelSkeleton />
              ) : (
                <>
                  {investmentView === 'table' ? (
                    <div className={`${classes.tableSide} ${classes.investmentTable}`}>
                      <table className={classes.table}>
                        <thead>
                          <tr>
                            <th className={classes.th}>Stock</th>
                            <th className={classes.th}>Invested</th>
                            <th className={classes.th}>Live value</th>
                            <th className={classes.th}>P/L</th>
                            <th className={classes.th}>P/L %</th>
                            <th className={classes.th}>Buy date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedStocks.map((holding) => {
                            const latestPoint = calculateStockPerformance(holding, stockCloses[holding.id] ?? [], {
                              from: holding.buyDate || asOf,
                              to: asOf,
                            }).at(-1)
                            return (
                              <tr key={holding.id}>
                                <td className={classes.td}>
                                  <strong>{holding.name}</strong>
                                </td>
                                <td className={classes.td}>
                                  <MoneyText amountMinor={holding.investedMinor} tone="steady" />
                                </td>
                                <td className={classes.td}>
                                  {latestPoint ? <MoneyText amountMinor={latestPoint.valueMinor} tone="steady" /> : '-'}
                                </td>
                                <td className={classes.td}>
                                  {latestPoint ? <MoneyText amountMinor={latestPoint.pnlMinor} tone="auto" /> : '-'}
                                </td>
                                <td className={classes.td}>
                                  {latestPoint?.pnlPct == null
                                    ? '-'
                                    : `${latestPoint.pnlPct >= 0 ? '+' : ''}${(latestPoint.pnlPct * 100).toFixed(2)}%`}
                                </td>
                                <td className={classes.td}>{holding.buyDate ? formatDateLabel(holding.buyDate) : '-'}</td>
                              </tr>
                            )
                          })}
                          {!selectedStocks.length ? (
                            <tr>
                              <td className={classes.td} colSpan={6}>
                                <span className={classes.empty}>No stocks selected.</span>
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                  {investmentView === 'line' ? (
                    stockChartData.length ? (
                      <div className={classes.wideChart}>
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={stockChartData}>
                            <CartesianGrid stroke={tokens.color.border} vertical={false} />
                            <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={28} tickFormatter={formatDateLabel} />
                            <YAxis
                              tickLine={false}
                              axisLine={false}
                              width={84}
                              domain={[(min: number) => Math.min(0, min), (max: number) => Math.max(0, max)]}
                              tickFormatter={(value) =>
                                investmentMetric === 'percent' ? `${Number(value).toFixed(0)}%` : formatPrivateNumber(Number(value), masked)
                              }
                            />
                            <ReferenceLine
                              y={0}
                              stroke={tokens.color.textMuted}
                              strokeWidth={2}
                              ifOverflow="extendDomain"
                              label={{ value: '0', position: 'insideLeft', fill: tokens.color.textMuted, fontSize: 11 }}
                            />
                            <Tooltip content={renderStockTooltip} />
                            <Legend />
                            {selectedStocks.map((holding, index) => (
                              <Line
                                key={holding.id}
                                dataKey={holding.id}
                                name={holding.name}
                                stroke={stockColors[index % stockColors.length]}
                                dot={false}
                                strokeWidth={2.5}
                                connectNulls={false}
                              />
                            ))}
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className={classes.chartMessage}>
                        {quotesLoading
                          ? 'Loading market prices...'
                          : selectedStocks.length
                            ? 'No market prices are available in this range.'
                            : eligibleStocks.length
                              ? 'Select stocks to compare.'
                              : 'Add a ticker and invested date to a lump-sum stock.'}
                      </div>
                    )
                  ) : null}
                  {investmentView === 'pie' ? (
                    stockPieData.length ? (
                      <div className={classes.wideChart}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={stockPieData}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              innerRadius="42%"
                              outerRadius="72%"
                              paddingAngle={2}
                            >
                              {stockPieData.map((slice) => (
                                <Cell key={slice.id} fill={slice.color} />
                              ))}
                            </Pie>
                            <Tooltip content={<ChartTooltip labelKind="plain" />} />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className={classes.chartMessage}>
                        {quotesLoading
                          ? 'Loading market prices...'
                          : selectedStocks.length
                            ? 'No live values to chart yet.'
                            : eligibleStocks.length
                              ? 'Select stocks to compare.'
                              : 'Add a ticker and invested date to a lump-sum stock.'}
                      </div>
                    )
                  ) : null}
                  {quoteErrors.length ? (
                    <div className={classes.empty}>
                      {quoteErrors[0]}
                      {quoteErrors.length > 1 ? ` (+${quoteErrors.length - 1} more)` : ''}
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </section>

        <section className={classes.section}>
          <div className={classes.sectionHead}>
            <h3 className={classes.sectionTitle}>Income</h3>
            {viewActions('income')}
          </div>
          <div className={classes.filterBar}>
            <FilterStatus fetching={isFilterPending} ready={!isFilterPending} />
            <DateRangePicker value={incomeRange} onChange={(next) => startFilterTransition(() => setIncomeRange(next))} />
          </div>
          <div className={classes.sectionBody}>
            <div className={classes.graphSide}>{renderMiniChart(['income'], incomeRange)}</div>
            <div className={classes.tableSide}>
              <table className={classes.table}>
                <thead>
                  <tr>
                    <th className={classes.th}>Income source</th>
                    <th className={classes.th}>Selected range</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className={classes.td}>Declared income</td>
                    <td className={classes.td}>
                      <MoneyText amountMinor={incomeTotal} tone="positive" />
                    </td>
                  </tr>
                  <tr>
                    <td className={classes.td}>Salary in statement</td>
                    <td className={classes.td}>
                      <MoneyText amountMinor={incomeStatementSalary} tone="positive" />
                    </td>
                  </tr>
                  {incomeRows
                    .filter((row) => row.categoryId !== 'salary')
                    .map((row) => (
                      <tr key={row.categoryId}>
                        <td className={classes.td}>{row.name}</td>
                        <td className={classes.td}>
                          <MoneyText amountMinor={row.amountMinor} tone="positive" />
                        </td>
                      </tr>
                    ))}
                  <tr>
                    <td className={classes.td}>Other income total</td>
                    <td className={classes.td}>
                      <MoneyText amountMinor={incomeOtherTotal} tone="positive" />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className={classes.section}>
          <div className={classes.sectionHead}>
            <div className={classes.sectionTitleGroup}>
              <h3 className={classes.sectionTitle}>Lifestyle</h3>
              <div className={classes.sectionAverage}>
                <span>Average / month</span>
                <MoneyText amountMinor={selectedLifestyleAverage} tone="negative" />
              </div>
            </div>
            {viewActions('lifestyle')}
          </div>
          <div className={classes.filterBar}>
            <FilterStatus fetching={isFilterPending} ready={!isFilterPending} />
            <SearchMultiSelect
              options={graphOptions(lifestyleKeys)}
              value={lifestyleSelection}
              onChange={(next) => startFilterTransition(() => setLifestyleSelection(next as GraphKey[]))}
              label="Select spending"
              selectionNoun="series"
            />
            <DateRangePicker value={lifestyleRange} onChange={(next) => startFilterTransition(() => setLifestyleRange(next))} />
          </div>
          <div className={`${classes.lifestyleBody} ${showLifestyleTable ? '' : classes.lifestyleBodyCollapsed}`}>
            <div className={classes.graphSide}>{renderMiniChart(lifestyleKeys, lifestyleRange, lifestyleSelection)}</div>
            <Button
              className={classes.tableToggle}
              title={showLifestyleTable ? 'Hide lifestyle table' : 'Show lifestyle table'}
              aria-label={showLifestyleTable ? 'Hide lifestyle table' : 'Show lifestyle table'}
              aria-expanded={showLifestyleTable}
              onClick={() => setShowLifestyleTable((current) => !current)}
            >
              {showLifestyleTable ? <ChevronRight fontSize="small" /> : <ChevronLeft fontSize="small" />}
            </Button>
            {showLifestyleTable ? (
              <div className={classes.tableSide}>
                <table className={classes.table}>
                  <thead>
                    <tr>
                      <th className={classes.th}>Spending more on</th>
                      <th className={classes.th}>Selected range</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className={classes.td}>Rent counted</td>
                      <td className={classes.td}>
                        <MoneyText amountMinor={lifestyleRent} tone="negative" />
                      </td>
                    </tr>
                    <tr>
                      <td className={classes.td}>Average lifestyle / month</td>
                      <td className={classes.td}>
                        <MoneyText amountMinor={averageLifestyle} tone="negative" />
                      </td>
                    </tr>
                    {lifestyleRows.length ? (
                      lifestyleRows.slice(0, 8).map((row) => (
                        <tr key={row.categoryId}>
                          <td className={classes.td}>{row.name}</td>
                          <td className={classes.td}>
                            <MoneyText amountMinor={row.amountMinor} tone="negative" />
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className={classes.td} colSpan={2}>
                          <span className={classes.empty}>No lifestyle spending this month.</span>
                        </td>
                      </tr>
                    )}
                    <tr>
                      <td className={classes.td}>Lifestyle without rent</td>
                      <td className={classes.td}>
                        <MoneyText amountMinor={lifestyleWithoutRent} tone="negative" />
                      </td>
                    </tr>
                    <tr>
                      <td className={classes.td}>Average without rent / month</td>
                      <td className={classes.td}>
                        <MoneyText amountMinor={averageLifestyleWithoutRent} tone="negative" />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </section>

        <section className={classes.section}>
          <div className={classes.sectionHead}>
            <h3 className={classes.sectionTitle}>Upcoming Wealth Planner</h3>
          </div>
          <div className={classes.fullSectionBody}>
            <ForecastPanel data={data} onSaved={onDataChange} />
          </div>
        </section>
      </div>
    </div>
  )
}
