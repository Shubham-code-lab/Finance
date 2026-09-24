import { startTransition, useEffect, useMemo, useState } from 'react'
import CheckBoxIcon from '@mui/icons-material/CheckBox'
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank'
import { Chip, ToggleButton, ToggleButtonGroup } from '@mui/material'
import { useQueries } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { createUseStyles } from 'react-jss'
import { Area, CartesianGrid, ComposedChart, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartTooltip } from '@/charts/ChartTooltip'
import { sampleTimeSeries } from '@/charts/sampleTimeSeries'
import { ChartSkeleton } from '@/components/ChartSkeleton'
import { DateRangePicker } from '@/components/DateRangePicker'
import { Card, MoneyText } from '@/components/ui'
import { formatDateLabel, todayIso } from '@/domain/money'
import { holdingDate } from '@/domain/sip'
import { StoreData } from '@/domain/types'
import { equalWeightPerformance, findMarketMoments, marketMovements } from '@/features/holdings/marketMoments'
import { getMutualFundNavHistory } from '@/market/mutualFundNav.api'
import { formatPrivateNumber, usePrivacy } from '@/privacy/privacy'
import { tokens } from '@/theme/tokens'

type ChartMode = 'price' | 'percent'

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
  controls: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: tokens.space.sm,
    flexWrap: 'wrap',
    marginLeft: 'auto',
  },
  title: { margin: 0, fontSize: tokens.font.sizeLg },
  copy: { margin: [tokens.space.xs, 0, 0], color: tokens.color.textMuted, fontSize: tokens.font.sizeSm },
  chips: { display: 'flex', flexWrap: 'wrap', gap: tokens.space.sm, minHeight: 32 },
  chip: {
    height: '26px !important',
    borderRadius: `${tokens.radius.sm}px !important`,
    background: `${tokens.color.bgMuted} !important`,
    color: `${tokens.color.text} !important`,
    cursor: 'pointer',
    '& .MuiChip-label': { padding: '0 7px', fontSize: tokens.font.sizeXs },
    '& .MuiChip-icon': { fontSize: '16px !important' },
  },
  chipFocused: { background: `${tokens.color.accentSoft} !important` },
  chart: { height: 380, minWidth: 0, '@media (max-width: 720px)': { height: 330 } },
  empty: { minHeight: 260, display: 'grid', placeItems: 'center', color: tokens.color.textMuted, textAlign: 'center' },
  error: { color: tokens.color.negative, fontSize: tokens.font.sizeSm },
  tableWrap: { overflowX: 'auto', border: `1px solid ${tokens.color.border}`, borderRadius: tokens.radius.sm },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: tokens.font.sizeSm },
  cell: { padding: [tokens.space.sm, tokens.space.md], borderBottom: `1px solid ${tokens.color.border}`, textAlign: 'left' },
  head: { color: tokens.color.accent, background: tokens.color.bgMuted },
})

export function MutualFundInvestmentChart({ data }: { data: StoreData }) {
  const classes = useStyles()
  const seriesClasses = classes as typeof classes & Record<string, string>
  const { masked } = usePrivacy()
  const holdings = useMemo(() => data.holdings.filter((holding) => holding.kind === 'mutual_fund'), [data.holdings])
  const earliestInvestment = holdings.map(holdingDate).filter(Boolean).sort()[0]
  const [highlightedIds, setHighlightedIds] = useState<string[]>([])
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [range, setRange] = useState({
    from: earliestInvestment ?? dayjs().subtract(1, 'year').format('YYYY-MM-DD'),
    to: todayIso(),
  })
  const [mode, setMode] = useState<ChartMode>('percent')
  const navQueries = useQueries({
    queries: holdings.map((holding) => ({
      queryKey: ['mutual-fund-nav', holding.name],
      queryFn: ({ signal }: { signal: AbortSignal }) => getMutualFundNavHistory(holding.name, signal),
      staleTime: 24 * 60 * 60_000,
      retry: 1,
    })),
  })
  const histories = useMemo(
    () =>
      holdings.map((holding, index) => ({
        holding,
        history: navQueries[index]?.data,
        error: navQueries[index]?.error,
      })),
    [holdings, navQueries],
  )
  const marketSeries = useMemo(
    () =>
      histories.flatMap(({ holding, history }) => {
        const investedFrom = holdingDate(holding)
        const points = (history?.points ?? [])
          .filter((point) => (!investedFrom || point.date >= investedFrom) && point.date <= range.to)
          .map((point) => ({ date: point.date, value: point.nav }))
        return points.length ? [{ id: holding.id, points, weight: holding.investedMinor }] : []
      }),
    [histories, range.from, range.to],
  )
  const chartData = useMemo(() => {
    const rows = new Map<string, Record<string, string | number>>()
    marketSeries.forEach((series) => {
      const first = series.points[0]?.value
      series.points
        .filter((point) => point.date >= range.from)
        .forEach((point) => {
          const row = rows.get(point.date) ?? { date: point.date }
          row[series.id] = mode === 'percent' && first ? (point.value / first - 1) * 100 : point.value
          rows.set(point.date, row)
        })
    })
    return [...rows.values()].sort((left, right) => String(left.date).localeCompare(String(right.date)))
  }, [marketSeries, mode, range.from])
  const movementSeries = useMemo(
    () => (highlightedIds.length ? marketSeries.filter((series) => highlightedIds.includes(series.id)) : marketSeries),
    [highlightedIds, marketSeries],
  )
  const aggregate = useMemo(
    () => equalWeightPerformance(movementSeries).filter((point) => point.date >= range.from),
    [movementSeries, range.from],
  )
  const moments = useMemo(() => findMarketMoments(aggregate), [aggregate])
  const movements = useMemo(() => marketMovements(aggregate), [aggregate])
  const renderedChartData = useMemo(
    () =>
      sampleTimeSeries(
        chartData,
        600,
        moments.map((moment) => moment.date),
      ),
    [chartData, moments],
  )
  const previewedId = hoveredId && holdings.some((holding) => holding.id === hoveredId) ? hoveredId : null
  const effectiveHighlightedIds = previewedId ? [previewedId] : highlightedIds
  const hasFocusedFunds = effectiveHighlightedIds.length > 0
  const loading = navQueries.some((query) => query.isPending)
  const errors = histories.flatMap(({ holding, error }) =>
    error ? [`${holding.name}: ${error instanceof Error ? error.message : 'NAV history failed'}`] : [],
  )

  useEffect(() => {
    setHighlightedIds((current) => current.filter((id) => holdings.some((holding) => holding.id === id)))
  }, [holdings])

  return (
    <div className={classes.root}>
      <Card className={classes.root}>
        <div className={classes.header}>
          <div className={classes.controls}>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={mode}
              onChange={(_event, next: ChartMode | null) => {
                if (next) setMode(next)
              }}
              aria-label="Mutual fund chart value"
            >
              <ToggleButton value="percent">Change %</ToggleButton>
              <ToggleButton value="price">Price</ToggleButton>
            </ToggleButtonGroup>
            <DateRangePicker value={range} onChange={setRange} />
          </div>
        </div>
        <div className={classes.chips}>
          {holdings.map((holding, index) => {
            const focused = highlightedIds.includes(holding.id)
            return (
              <Chip
                key={holding.id}
                size="small"
                className={`${classes.chip} ${seriesClasses[`series${index % colors.length}`]} ${focused ? classes.chipFocused : ''}`}
                label={holding.name}
                icon={focused ? <CheckBoxIcon /> : <CheckBoxOutlineBlankIcon />}
                variant="outlined"
                onClick={() =>
                  setHighlightedIds((current) =>
                    current.includes(holding.id) ? current.filter((id) => id !== holding.id) : [...current, holding.id],
                  )
                }
                onMouseEnter={() => startTransition(() => setHoveredId(holding.id))}
                onMouseLeave={() => startTransition(() => setHoveredId(null))}
                title={focused ? `Stop highlighting ${holding.name}` : `Highlight ${holding.name}`}
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
        {loading ? (
          <ChartSkeleton />
        ) : chartData.length ? (
          <>
            <div className={classes.chart}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={renderedChartData}>
                  <CartesianGrid stroke={tokens.color.border} vertical={false} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={28} tickFormatter={formatDateLabel} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={88}
                    domain={mode === 'percent' ? [(min: number) => Math.min(0, min), (max: number) => Math.max(0, max)] : ['auto', 'auto']}
                    tickFormatter={(value) =>
                      mode === 'percent' ? `${Number(value).toFixed(0)}%` : `₹${formatPrivateNumber(Number(value), masked)}`
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
                  {moments.map((moment) => (
                    <ReferenceLine
                      key={moment.id}
                      x={moment.date}
                      stroke={moment.kind === 'drop' ? tokens.color.negative : tokens.color.positive}
                      strokeWidth={1.5}
                      strokeOpacity={0.7}
                      strokeDasharray="4 4"
                    />
                  ))}
                  <Tooltip
                    content={
                      <ChartTooltip
                        labelKind="date"
                        valueKind={mode === 'percent' ? 'percent' : 'money'}
                        marketMovements={movements}
                        visibleDataKeys={highlightedIds}
                        movementBaseline="investment"
                      />
                    }
                    isAnimationActive={false}
                  />
                  <Legend />
                  {holdings.map((holding, index) => {
                    const focused = effectiveHighlightedIds.includes(holding.id)
                    return (
                      <Area
                        key={holding.id}
                        dataKey={holding.id}
                        name={holding.name}
                        stroke={colors[index % colors.length]}
                        fill={colors[index % colors.length]}
                        fillOpacity={focused ? 0.14 : 0}
                        strokeOpacity={hasFocusedFunds && !focused ? 0.2 : 1}
                        strokeWidth={focused ? 4 : 2.25}
                        activeDot={{ r: focused ? 6 : 4 }}
                        dot={false}
                        connectNulls
                        isAnimationActive={false}
                      />
                    )
                  })}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          <div className={classes.empty}>
            {holdings.length ? 'No NAV history is available in this date range.' : 'Add mutual funds in My investments.'}
          </div>
        )}
      </Card>
      <Card className={classes.root}>
        <h2 className={classes.title}>Fund summary</h2>
        <div className={classes.tableWrap}>
          <table className={classes.table}>
            <thead className={classes.head}>
              <tr>
                <th className={classes.cell}>Fund</th>
                <th className={classes.cell}>Invested</th>
                <th className={classes.cell}>Current</th>
                <th className={classes.cell}>Gain / loss</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((holding) => (
                <tr key={holding.id}>
                  <td className={classes.cell}>{holding.name}</td>
                  <td className={classes.cell}>
                    <MoneyText amountMinor={holding.investedMinor} />
                  </td>
                  <td className={classes.cell}>
                    <MoneyText amountMinor={holding.currentMinor} />
                  </td>
                  <td className={classes.cell}>
                    <MoneyText amountMinor={holding.currentMinor - holding.investedMinor} tone="auto" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
