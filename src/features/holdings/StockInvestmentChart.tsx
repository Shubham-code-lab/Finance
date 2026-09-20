import { useMemo, useState } from 'react'
import CheckBoxIcon from '@mui/icons-material/CheckBox'
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank'
import { Chip, ToggleButton, ToggleButtonGroup } from '@mui/material'
import { useQueries } from '@tanstack/react-query'
import { createUseStyles } from 'react-jss'
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { calculateStockPerformance, performanceHoldings } from '@/calc/stockPerformance'
import { ChartTooltip } from '@/charts/ChartTooltip'
import { DateRangePicker } from '@/components/DateRangePicker'
import { Card, MoneyText } from '@/components/ui'
import { formatDateLabel, todayIso } from '@/domain/money'
import { Holding, StoreData } from '@/domain/types'
import { InvestmentSectorTooltip } from '@/features/holdings/InvestmentSectorTooltip'
import { getMarketSymbolProfile } from '@/market/stockQuotes'
import { formatPrivateNumber, usePrivacy } from '@/privacy/privacy'
import { useStockCloses } from '@/query/useStockCloses'
import { tokens } from '@/theme/tokens'

type ChartMode = 'value' | 'price' | 'percent'

const colors = ['#8db7ff', '#42b883', '#ff9fca', '#e5c463', '#ff7a76', '#72d6dd', '#b89cff', '#b8d97a']
const seriesColorStyles = Object.fromEntries(
  colors.map((color, index) => [
    `series${index}`,
    { '&&': { borderColor: `${color} !important` }, '& .MuiChip-icon': { color: `${color} !important` } },
  ]),
)

const useStyles = createUseStyles({
  ...seriesColorStyles,
  root: { display: 'grid', gap: tokens.space.md },
  header: { display: 'flex', alignItems: 'end', justifyContent: 'space-between', gap: tokens.space.md, flexWrap: 'wrap' },
  controls: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: tokens.space.sm, flexWrap: 'wrap' },
  title: { margin: 0, fontSize: tokens.font.sizeLg },
  copy: { margin: [tokens.space.xs, 0, 0], color: tokens.color.textMuted, fontSize: tokens.font.sizeSm },
  chips: { display: 'flex', gap: tokens.space.xs, flexWrap: 'wrap' },
  chip: {
    height: '26px !important',
    background: `${tokens.color.bgMuted} !important`,
    color: `${tokens.color.text} !important`,
    cursor: 'pointer',
    '& .MuiChip-label': { padding: '0 7px', fontSize: tokens.font.sizeXs },
    '& .MuiChip-icon': { fontSize: '16px !important' },
  },
  chipOff: { opacity: 0.55, borderColor: `${tokens.color.border} !important` },
  chart: { height: 380, minWidth: 0, '@media (max-width: 720px)': { height: 330 } },
  empty: { padding: tokens.space.xl, color: tokens.color.textMuted, textAlign: 'center' },
  error: { color: tokens.color.negative, fontSize: tokens.font.sizeSm },
  tableWrap: { overflowX: 'auto', border: `1px solid ${tokens.color.border}`, borderRadius: tokens.radius.sm },
  table: { width: 'max-content', minWidth: '100%', borderCollapse: 'collapse', fontSize: tokens.font.sizeSm },
  th: {
    padding: [tokens.space.sm, tokens.space.md],
    color: tokens.color.accent,
    background: tokens.color.bgMuted,
    borderBottom: `1px solid ${tokens.color.borderStrong}`,
    textAlign: 'left',
    whiteSpace: 'nowrap',
  },
  td: { padding: [tokens.space.sm, tokens.space.md], borderBottom: `1px solid ${tokens.color.border}`, whiteSpace: 'nowrap' },
  company: { display: 'grid', gap: 2, '& small': { color: tokens.color.textMuted } },
  positive: { color: tokens.color.positive },
  negative: { color: tokens.color.negative },
  sections: {
    display: 'grid',
    gridTemplateColumns: 'minmax(360px, 0.9fr) minmax(420px, 1.1fr)',
    gap: tokens.space.lg,
    '@media (max-width: 1000px)': { gridTemplateColumns: '1fr' },
  },
  pie: { height: 360, minWidth: 0 },
  sectorList: { display: 'grid', alignContent: 'start', gap: tokens.space.sm },
  sectorRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    gap: tokens.space.md,
    paddingBottom: tokens.space.sm,
    borderBottom: `1px solid ${tokens.color.border}`,
  },
  sectorName: { display: 'grid', gap: 2, '& small': { color: tokens.color.textMuted } },
  sectorValue: { display: 'grid', justifyItems: 'end', gap: 2, '& small': { color: tokens.color.textMuted } },
})

export function StockInvestmentChart({ data }: { data: StoreData }) {
  const classes = useStyles()
  const seriesClasses = classes as typeof classes & Record<string, string>
  const { masked } = usePrivacy()
  const holdings = useMemo(() => performanceHoldings(data.holdings), [data.holdings])
  const today = todayIso()
  const earliest = holdings.map((holding) => holding.buyDate ?? today).sort()[0] ?? today
  const [range, setRange] = useState({ from: earliest, to: today })
  const [mode, setMode] = useState<ChartMode>('value')
  const [selectedIds, setSelectedIds] = useState(() => holdings.map((holding) => holding.id))
  const selected = useMemo(() => holdings.filter((holding) => selectedIds.includes(holding.id)), [holdings, selectedIds])
  const quotes = useStockCloses(selected, today)
  const results = quotes.data ?? {}
  const profiles = useQueries({
    queries: selected.map((holding) => ({
      queryKey: ['yahoo-symbol-profile', holding.ticker],
      queryFn: () => getMarketSymbolProfile(holding.ticker ?? ''),
      enabled: Boolean(holding.ticker),
      staleTime: Infinity,
      retry: 1,
    })),
  })

  const chartData = useMemo(() => {
    const dates = [
      ...new Set(
        selected.flatMap((holding) =>
          (results[holding.id]?.closes ?? [])
            .filter((point) => point.date >= range.from && point.date <= range.to)
            .map((point) => point.date),
        ),
      ),
    ].sort()
    const latestValues = new Map<string, number>()
    const series = new Map(
      selected.map((holding) => {
        const allCloses = results[holding.id]?.closes ?? []
        const closes = allCloses.filter((point) => point.date >= range.from && point.date <= range.to)
        const firstPrice = closes[0]?.closeMinor
        const purchasePrice = allCloses[0]?.closeMinor
        const quantity = holding.qty ?? (purchasePrice ? holding.investedMinor / purchasePrice : 0)
        return [holding.id, { holding, firstPrice, quantity, closes: new Map(closes.map((point) => [point.date, point.closeMinor])) }]
      }),
    )
    return dates.map((date) => {
      const row: Record<string, string | number> = { date }
      selected.forEach((holding) => {
        const item = series.get(holding.id)
        const close = item?.closes.get(date)
        if (close !== undefined && item) {
          const value =
            mode === 'percent' && item.firstPrice
              ? (close / item.firstPrice - 1) * 100
              : mode === 'price'
                ? close / 100
                : (item.quantity * close) / 100
          latestValues.set(holding.id, value)
        }
        const current = latestValues.get(holding.id)
        if (current !== undefined) row[holding.id] = current
      })
      if (mode === 'value') row.total = [...latestValues.values()].reduce((sum, value) => sum + value, 0)
      return row
    })
  }, [mode, range, results, selected])

  const tableRows = selected.map((holding) => {
    const closes = (results[holding.id]?.closes ?? []).filter((point) => point.date >= range.from && point.date <= range.to)
    const first = closes[0]
    const last = closes.at(-1)
    const performance = calculateStockPerformance(holding, results[holding.id]?.closes ?? [], range).at(-1)
    const rangeReturn = first && last ? last.closeMinor / first.closeMinor - 1 : null
    return { holding, first, last, performance, rangeReturn }
  })

  const sectorData = useMemo(() => {
    const grouped = new Map<string, { holdings: Holding[]; value: number }>()
    selected.forEach((holding, index) => {
      const profile = profiles[index]?.data
      const sector = profile?.sector || (profile?.type === 'ETF' ? 'ETF' : 'Unknown')
      const performance = calculateStockPerformance(holding, results[holding.id]?.closes ?? [], range).at(-1)
      const value = performance?.valueMinor ?? holding.currentMinor
      const existing = grouped.get(sector) ?? { holdings: [], value: 0 }
      grouped.set(sector, { holdings: [...existing.holdings, holding], value: existing.value + value })
    })
    const total = [...grouped.values()].reduce((sum, sector) => sum + sector.value, 0)
    return [...grouped.entries()]
      .map(([name, sector]) => ({
        name,
        value: sector.value,
        percent: total ? sector.value / total : 0,
        stocks: sector.holdings.map((holding) => holding.name),
      }))
      .sort((left, right) => right.value - left.value)
  }, [profiles, range, results, selected])

  const toggleStock = (id: string) =>
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  const errors = selected.flatMap((holding) => (results[holding.id]?.error ? [results[holding.id].error] : []))
  const tooltipKind = mode === 'percent' ? 'percent' : 'money'

  return (
    <div className={classes.root}>
      <Card className={classes.root}>
        <div className={classes.header}>
          <div>
            <h2 className={classes.title}>My stock investments</h2>
            <p className={classes.copy}>Select holdings to show or hide them on this graph. Remove holdings only from My investments.</p>
          </div>
          <div className={classes.controls}>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={mode}
              onChange={(_event, next: ChartMode | null) => {
                if (next) setMode(next)
              }}
              aria-label="Investment chart value"
            >
              <ToggleButton value="value">Value</ToggleButton>
              <ToggleButton value="price">Price</ToggleButton>
              <ToggleButton value="percent">Change %</ToggleButton>
            </ToggleButtonGroup>
            <DateRangePicker value={range} onChange={setRange} />
          </div>
        </div>
        <div className={classes.chips}>
          {holdings.map((holding, index) => {
            const active = selectedIds.includes(holding.id)
            return (
              <Chip
                key={holding.id}
                size="small"
                className={`${classes.chip} ${seriesClasses[`series${index % colors.length}`]} ${active ? '' : classes.chipOff}`}
                label={`${holding.name}  ${holding.ticker}`}
                icon={active ? <CheckBoxIcon /> : <CheckBoxOutlineBlankIcon />}
                variant="outlined"
                onClick={() => toggleStock(holding.id)}
              />
            )
          })}
        </div>
        {errors.length ? (
          <div className={classes.error}>
            {errors[0]}
            {errors.length > 1 ? ` (+${errors.length - 1} more)` : ''}
          </div>
        ) : null}
        {quotes.isLoading ? (
          <div className={classes.empty}>Loading investment history…</div>
        ) : chartData.length ? (
          <div className={classes.chart}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid stroke={tokens.color.border} vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={28} tickFormatter={formatDateLabel} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={88}
                  domain={mode === 'percent' ? [(min: number) => Math.min(0, min), (max: number) => Math.max(0, max)] : ['auto', 'auto']}
                  tickFormatter={(value) =>
                    mode === 'percent' ? `${Number(value).toFixed(0)}%` : formatPrivateNumber(Number(value), masked)
                  }
                />
                {mode === 'percent' ? (
                  <ReferenceLine
                    y={0}
                    stroke={tokens.color.textMuted}
                    strokeWidth={2}
                    ifOverflow="extendDomain"
                    label={{ value: '0', position: 'insideLeft', fill: tokens.color.textMuted, fontSize: 11 }}
                  />
                ) : null}
                <Tooltip
                  content={<ChartTooltip labelKind="date" valueKind={tooltipKind} />}
                  cursor={{ stroke: tokens.color.borderStrong, strokeDasharray: '4 4' }}
                />
                <Legend />
                {mode === 'value' ? (
                  <Line dataKey="total" name="Portfolio total" stroke={tokens.color.accent} strokeWidth={3} dot={false} connectNulls />
                ) : null}
                {selected.map((holding) => {
                  const index = holdings.findIndex((item) => item.id === holding.id)
                  return (
                    <Line
                      key={holding.id}
                      dataKey={holding.id}
                      name={holding.name}
                      stroke={colors[index % colors.length]}
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                    />
                  )
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className={classes.empty}>
            {selected.length ? 'No market prices are available in this date range.' : 'Select at least one stock to display the graph.'}
          </div>
        )}
      </Card>

      <Card className={classes.root}>
        <h2 className={classes.title}>Performance table</h2>
        <div className={classes.tableWrap}>
          <table className={classes.table}>
            <thead>
              <tr>
                <th className={classes.th}>Company</th>
                <th className={classes.th}>Purchased</th>
                <th className={classes.th}>Invested</th>
                <th className={classes.th}>Start price</th>
                <th className={classes.th}>End price</th>
                <th className={classes.th}>Range return</th>
                <th className={classes.th}>End value</th>
                <th className={classes.th}>P/L vs cost</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map(({ holding, first, last, performance, rangeReturn }) => (
                <tr key={holding.id}>
                  <td className={classes.td}>
                    <span className={classes.company}>
                      <strong>{holding.name}</strong>
                      <small>{holding.ticker}</small>
                    </span>
                  </td>
                  <td className={classes.td}>{holding.buyDate ? formatDateLabel(holding.buyDate) : '-'}</td>
                  <td className={classes.td}>
                    <MoneyText amountMinor={holding.investedMinor} tone="steady" />
                  </td>
                  <td className={classes.td}>{first ? <MoneyText amountMinor={first.closeMinor} tone="steady" showPaise /> : '-'}</td>
                  <td className={classes.td}>{last ? <MoneyText amountMinor={last.closeMinor} tone="steady" showPaise /> : '-'}</td>
                  <td className={`${classes.td} ${(rangeReturn ?? 0) >= 0 ? classes.positive : classes.negative}`}>
                    {rangeReturn === null ? '-' : `${rangeReturn >= 0 ? '+' : ''}${(rangeReturn * 100).toFixed(2)}%`}
                  </td>
                  <td className={classes.td}>{performance ? <MoneyText amountMinor={performance.valueMinor} tone="steady" /> : '-'}</td>
                  <td className={classes.td}>{performance ? <MoneyText amountMinor={performance.pnlMinor} tone="auto" /> : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className={classes.root}>
        <div>
          <h2 className={classes.title}>Sector diversification</h2>
          <p className={classes.copy}>Allocation by end-of-range market value for the selected holdings.</p>
        </div>
        {sectorData.length ? (
          <div className={classes.sections}>
            <div className={classes.pie}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sectorData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius="42%"
                    outerRadius="76%"
                    paddingAngle={2}
                  >
                    {sectorData.map((sector, index) => (
                      <Cell key={sector.name} fill={colors[index % colors.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<InvestmentSectorTooltip />} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className={classes.sectorList}>
              {sectorData.map((sector) => (
                <div className={classes.sectorRow} key={sector.name}>
                  <span className={classes.sectorName}>
                    <strong>{sector.name}</strong>
                    <small>{sector.stocks.join(', ')}</small>
                  </span>
                  <span className={classes.sectorValue}>
                    <MoneyText amountMinor={sector.value} tone="steady" />
                    <small>{(sector.percent * 100).toFixed(1)}%</small>
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className={classes.empty}>Select stocks to see sector diversification.</div>
        )}
      </Card>
    </div>
  )
}
