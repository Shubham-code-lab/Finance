import { useEffect, useMemo, useState } from 'react'
import CheckBoxIcon from '@mui/icons-material/CheckBox'
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank'
import { Chip, ToggleButton, ToggleButtonGroup } from '@mui/material'
import { useQueries } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { createUseStyles } from 'react-jss'
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartTooltip } from '@/charts/ChartTooltip'
import { DateRangePicker } from '@/components/DateRangePicker'
import { Card, MoneyText } from '@/components/ui'
import { formatDateLabel, todayIso } from '@/domain/money'
import { StoreData } from '@/domain/types'
import { MarketMomentsBar } from '@/features/holdings/MarketMomentsBar'
import { equalWeightPerformance, findMarketMoments } from '@/features/holdings/marketMoments'
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
  controls: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: tokens.space.sm, flexWrap: 'wrap' },
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

function initialRange() {
  return { from: dayjs().subtract(1, 'year').format('YYYY-MM-DD'), to: todayIso() }
}

export function MutualFundInvestmentChart({ data }: { data: StoreData }) {
  const classes = useStyles()
  const seriesClasses = classes as typeof classes & Record<string, string>
  const { masked } = usePrivacy()
  const holdings = useMemo(() => data.holdings.filter((holding) => holding.kind === 'mutual_fund'), [data.holdings])
  const [highlightedIds, setHighlightedIds] = useState<string[]>([])
  const [range, setRange] = useState(initialRange)
  const [mode, setMode] = useState<ChartMode>('percent')
  const [pinnedMomentId, setPinnedMomentId] = useState<string | null>(null)
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
        const points = (history?.points ?? [])
          .filter((point) => point.date >= range.from && point.date <= range.to)
          .map((point) => ({ date: point.date, value: point.nav }))
        return points.length ? [{ id: holding.id, points }] : []
      }),
    [histories, range.from, range.to],
  )
  const chartData = useMemo(() => {
    const rows = new Map<string, Record<string, string | number>>()
    marketSeries.forEach((series) => {
      const first = series.points[0]?.value
      series.points.forEach((point) => {
        const row = rows.get(point.date) ?? { date: point.date }
        row[series.id] = mode === 'percent' && first ? (point.value / first - 1) * 100 : point.value
        rows.set(point.date, row)
      })
    })
    return [...rows.values()].sort((left, right) => String(left.date).localeCompare(String(right.date)))
  }, [marketSeries, mode])
  const aggregate = useMemo(() => equalWeightPerformance(marketSeries), [marketSeries])
  const moments = useMemo(() => findMarketMoments(aggregate), [aggregate])
  const pinnedMoment = moments.find((moment) => moment.id === pinnedMomentId) ?? null
  const hasFocusedFunds = highlightedIds.length > 0
  const loading = navQueries.some((query) => query.isPending)
  const errors = histories.flatMap(({ holding, error }) =>
    error ? [`${holding.name}: ${error instanceof Error ? error.message : 'NAV history failed'}`] : [],
  )
  const rangeDays = Math.round((Date.parse(`${range.to}T00:00:00Z`) - Date.parse(`${range.from}T00:00:00Z`)) / 86_400_000)

  useEffect(() => {
    setHighlightedIds((current) => current.filter((id) => holdings.some((holding) => holding.id === id)))
  }, [holdings])

  useEffect(() => {
    if (pinnedMomentId && !moments.some((moment) => moment.id === pinnedMomentId)) setPinnedMomentId(null)
  }, [moments, pinnedMomentId])

  return (
    <div className={classes.root}>
      <Card className={classes.root}>
        <div className={classes.header}>
          <div>
            <h2 className={classes.title}>My mutual funds</h2>
            <p className={classes.copy}>Historical NAV from MFAPI. Select a fund chip only when you want to emphasize its line.</p>
          </div>
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
              <ToggleButton value="price">Price</ToggleButton>
              <ToggleButton value="percent">Change %</ToggleButton>
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
          <div className={classes.empty}>Loading mutual-fund NAV history…</div>
        ) : chartData.length ? (
          <>
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
                  {pinnedMoment ? (
                    <ReferenceLine
                      x={pinnedMoment.date}
                      stroke={pinnedMoment.kind === 'drop' ? tokens.color.negative : tokens.color.positive}
                      strokeWidth={2}
                      strokeDasharray="5 4"
                      label={{
                        value: `${pinnedMoment.kind === 'drop' ? 'Drop' : 'High'} ${pinnedMoment.value > 0 ? '+' : ''}${pinnedMoment.value.toFixed(1)}%`,
                        position: 'insideTopRight',
                        fill: pinnedMoment.kind === 'drop' ? tokens.color.negative : tokens.color.positive,
                        fontSize: 11,
                      }}
                    />
                  ) : null}
                  <Tooltip content={<ChartTooltip labelKind="date" valueKind={mode === 'percent' ? 'percent' : 'money'} />} />
                  <Legend />
                  {holdings.map((holding, index) => {
                    const focused = highlightedIds.includes(holding.id)
                    return (
                      <Line
                        key={holding.id}
                        dataKey={holding.id}
                        name={holding.name}
                        stroke={colors[index % colors.length]}
                        strokeOpacity={hasFocusedFunds && !focused ? 0.2 : 1}
                        strokeWidth={focused ? 4 : 2.25}
                        activeDot={{ r: focused ? 6 : 4 }}
                        dot={false}
                        connectNulls
                      />
                    )
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <MarketMomentsBar
              moments={moments}
              pinnedId={pinnedMomentId}
              onPin={setPinnedMomentId}
              emptyMessage={
                rangeDays < 90
                  ? 'Choose a range of at least 3 months to detect meaningful drops and highs.'
                  : 'No separated drop or high above 3% was found in this range.'
              }
            />
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
