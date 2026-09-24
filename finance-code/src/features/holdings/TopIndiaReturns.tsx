import { FormEvent, useEffect, useMemo, useState } from 'react'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import SearchIcon from '@mui/icons-material/Search'
import { Tooltip as MuiTooltip } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { createUseStyles } from 'react-jss'
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { DateRangePicker } from '@/components/DateRangePicker'
import { DateRangeValue, isValidDateRange } from '@/components/dateRange'
import { ChartSkeleton } from '@/components/ChartSkeleton'
import { Button, Card, Input } from '@/components/ui'
import { formatDateLabel, formatMoney, todayIso } from '@/domain/money'
import { equalWeightPerformance, findMarketMoments, marketMovements } from '@/features/holdings/marketMoments'
import { rankIndiaReturns } from '@/features/holdings/topIndiaReturns.utils'
import { getNifty500Constituents } from '@/market/indiaUniverse'
import { getMarketBatchDailyCloses } from '@/market/stockQuotes'
import { tokens } from '@/theme/tokens'
import { ChartTooltip } from '@/charts/ChartTooltip'
import { sampleTimeSeries } from '@/charts/sampleTimeSeries'

const colors = [
  '#8db7ff',
  '#42b883',
  '#ff9fca',
  '#e5c463',
  '#ff7a76',
  '#72d6dd',
  '#b89cff',
  '#b8d97a',
  '#ffb36b',
  '#6fdb9f',
  '#d994ff',
  '#80a8ff',
  '#f58ba6',
  '#a4d96c',
  '#ffd166',
  '#5bd6c7',
  '#c3a6ff',
  '#ff8f70',
  '#78c6ff',
  '#d2cd70',
]
const storageKey = 'finance:top-india-returns-filters:v1'

function defaultRange(): DateRangeValue {
  return { from: dayjs().subtract(1, 'year').format('YYYY-MM-DD'), to: todayIso() }
}

function readFilters() {
  const fallback = { range: defaultRange(), count: 10 }
  try {
    const value = JSON.parse(window.localStorage.getItem(storageKey) ?? '') as { range?: DateRangeValue }
    const storedRange = value.range ? { ...value.range, to: value.range.to > todayIso() ? todayIso() : value.range.to } : null
    const range = storedRange?.from && storedRange.to && isValidDateRange(storedRange) ? storedRange : fallback.range
    return { range, count: 10 }
  } catch {
    return fallback
  }
}

const useStyles = createUseStyles({
  root: { display: 'grid', gap: tokens.space.md },
  workspaceCard: {
    boxSizing: 'border-box',
    minHeight: 'calc(100dvh - 148px)',
    display: 'flex',
    flexDirection: 'column',
    '@media (max-width: 720px)': { minHeight: 'calc(100dvh - 164px)' },
  },
  header: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr)',
    alignItems: 'center',
    gap: tokens.space.xl,
    '@media (max-width: 1100px)': { gridTemplateColumns: '1fr' },
  },
  title: { margin: 0, fontSize: tokens.font.sizeLg, whiteSpace: 'nowrap' },
  source: { color: tokens.color.textMuted, fontSize: tokens.font.sizeXs },
  filters: {
    display: 'grid',
    gridTemplateColumns: 'minmax(250px, 1fr) minmax(130px, 170px) minmax(130px, 170px) auto',
    gap: tokens.space.sm,
    alignItems: 'end',
    justifyContent: 'end',
    '@media (max-width: 900px)': { gridTemplateColumns: 'minmax(250px, 1fr) minmax(130px, 1fr)' },
    '@media (max-width: 560px)': { gridTemplateColumns: '1fr' },
  },
  countControl: { display: 'contents' },
  dateFilter: {
    minHeight: 40,
    display: 'flex',
    alignItems: 'stretch',
    '& button': { minHeight: '40px !important' },
    '@media (max-width: 900px)': { gridColumn: '1 / -1' },
  },
  countField: { display: 'grid', gap: tokens.space.xs, minWidth: 0, color: tokens.color.textMuted, fontSize: tokens.font.sizeSm },
  fieldLabel: {
    minHeight: 18,
    display: 'flex',
    alignItems: 'center',
    gap: tokens.space.xs,
    color: tokens.color.textMuted,
    fontSize: tokens.font.sizeSm,
  },
  infoIcon: { width: '15px !important', height: '15px !important', color: tokens.color.textMuted, cursor: 'help' },
  searchButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.space.xs,
    minWidth: '104px !important',
    minHeight: '40px !important',
    '@media (max-width: 560px)': { width: '100%' },
  },
  chart: { height: 360, minHeight: 300, marginTop: tokens.space.md, '@media (max-width: 720px)': { height: 320 } },
  empty: {
    minHeight: 280,
    flex: 1,
    display: 'grid',
    placeItems: 'center',
    padding: tokens.space.xl,
    color: tokens.color.textMuted,
    fontSize: tokens.font.sizeSm,
    textAlign: 'center',
  },
  grid: { overflowX: 'auto', marginTop: tokens.space.md, border: `1px solid ${tokens.color.border}`, borderRadius: tokens.radius.sm },
  table: { width: '100%', minWidth: 760, borderCollapse: 'collapse', fontSize: tokens.font.sizeSm },
  th: {
    padding: [tokens.space.sm, tokens.space.md],
    textAlign: 'left',
    color: tokens.color.accent,
    background: tokens.color.bgMuted,
    borderBottom: `1px solid ${tokens.color.borderStrong}`,
  },
  td: { padding: [tokens.space.sm, tokens.space.md], borderBottom: `1px solid ${tokens.color.border}`, fontVariantNumeric: 'tabular-nums' },
  rank: { color: tokens.color.textMuted, width: 36 },
  positive: { color: tokens.color.positive },
  negative: { color: tokens.color.negative },
  error: { color: tokens.color.danger, padding: tokens.space.md },
})

export function TopIndiaReturns() {
  const classes = useStyles()
  const [initial] = useState(readFilters)
  const [range, setRange] = useState(initial.range)
  const [universeSize, setUniverseSize] = useState(500)
  const [universeInput, setUniverseInput] = useState('500')
  const [count, setCount] = useState(initial.count)
  const [countInput, setCountInput] = useState(String(initial.count))
  const [appliedRange, setAppliedRange] = useState<DateRangeValue | null>(null)
  const [searchVersion, setSearchVersion] = useState(0)
  const validRange = Boolean(range.from && range.to && isValidDateRange(range))
  const searchedRange = appliedRange ?? range

  const universeQuery = useQuery({
    queryKey: ['nifty-500-constituents', searchVersion],
    queryFn: ({ signal }) => getNifty500Constituents(signal),
    enabled: searchVersion > 0,
    staleTime: 24 * 60 * 60_000,
    retry: 1,
  })
  const universe = universeQuery.data ?? []

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ range }))
    } catch {
      /* Keep the market view usable without storage. */
    }
  }, [range])

  const runSearch = (event: FormEvent) => {
    event.preventDefault()
    if (!validRange) return
    const nextUniverseSize = Math.min(500, Math.max(1, Math.trunc(Number(universeInput) || 500)))
    const nextCount = Math.min(nextUniverseSize, Math.max(1, Math.trunc(Number(countInput) || 10)))
    setUniverseSize(nextUniverseSize)
    setUniverseInput(String(nextUniverseSize))
    setCount(nextCount)
    setCountInput(String(nextCount))
    const nextRange = { ...range, to: range.to > todayIso() ? todayIso() : range.to }
    setRange(nextRange)
    setAppliedRange(nextRange)
    setSearchVersion((current) => current + 1)
  }

  const historyQuery = useQuery({
    queryKey: ['nifty-500-returns', searchVersion, universeSize, count, searchedRange.from, searchedRange.to],
    queryFn: async ({ signal }) => {
      const stocks = universe.slice(0, universeSize)
      const history = await getMarketBatchDailyCloses(
        stocks.map((stock) => stock.ticker),
        searchedRange.from,
        searchedRange.to,
        signal,
      )
      return rankIndiaReturns(stocks, history, searchedRange, count)
    },
    enabled: searchVersion > 0 && universe.length > 0,
    staleTime: 15 * 60_000,
    retry: 1,
  })
  const ranked = historyQuery.data ?? []
  const searching = searchVersion > 0 && (universeQuery.isFetching || historyQuery.isFetching)
  const chartData = useMemo(() => {
    const rows = new Map<string, Record<string, string | number>>()
    ranked.forEach((stock) =>
      stock.closes.forEach((close) => {
        const row = rows.get(close.date) ?? { date: close.date }
        row[stock.ticker] = (close.closeMinor / stock.first.closeMinor - 1) * 100
        rows.set(close.date, row)
      }),
    )
    return [...rows.values()].sort((left, right) => String(left.date).localeCompare(String(right.date)))
  }, [ranked])
  const rankedPerformance = useMemo(
    () =>
      equalWeightPerformance(
        ranked.map((stock) => ({
          id: stock.ticker,
          points: stock.closes.map((close) => ({ date: close.date, value: close.closeMinor })),
        })),
      ),
    [ranked],
  )
  const moments = useMemo(() => findMarketMoments(rankedPerformance), [rankedPerformance])
  const movements = useMemo(() => marketMovements(rankedPerformance), [rankedPerformance])
  const renderedChartData = useMemo(
    () =>
      sampleTimeSeries(
        chartData,
        600,
        moments.map((moment) => moment.date),
      ),
    [chartData, moments],
  )

  return (
    <div className={classes.root}>
      <Card className={classes.workspaceCard}>
        <div className={classes.header}>
          <form className={classes.filters} onSubmit={runSearch}>
            <div className={classes.dateFilter}>
              <DateRangePicker value={range} onChange={setRange} />
            </div>
            <div className={classes.countControl}>
              <label className={classes.countField}>
                <span className={classes.fieldLabel}>
                  Nifty stocks
                  <MuiTooltip title="Choose how many stocks from the live Nifty 500 list to scan." arrow>
                    <InfoOutlinedIcon className={classes.infoIcon} tabIndex={0} aria-label="About Nifty stocks" />
                  </MuiTooltip>
                </span>
                <Input
                  type="number"
                  min={1}
                  max={500}
                  step={1}
                  value={universeInput}
                  onChange={(event) => setUniverseInput(event.target.value)}
                  aria-label="Number of stocks to scan"
                />
              </label>
              <label className={classes.countField}>
                <span className={classes.fieldLabel}>
                  Top returns
                  <MuiTooltip title="Choose how many of the highest-return stocks to show." arrow>
                    <InfoOutlinedIcon className={classes.infoIcon} tabIndex={0} aria-label="About top returns" />
                  </MuiTooltip>
                </span>
                <Input
                  type="number"
                  min={1}
                  max={500}
                  step={1}
                  value={countInput}
                  onChange={(event) => setCountInput(event.target.value)}
                  aria-label="Number of top returning stocks"
                />
              </label>
              <Button type="submit" variant="primary" className={classes.searchButton} disabled={searching}>
                <SearchIcon fontSize="small" />
                {searching ? 'Searching' : 'Search'}
              </Button>
            </div>
          </form>
        </div>
        {!validRange ? <div className={classes.error}>Select a valid start and end date.</div> : null}
        {universeQuery.error ? (
          <div className={classes.error}>
            {universeQuery.error instanceof Error ? universeQuery.error.message : 'Could not load the Nifty 500 universe.'}
          </div>
        ) : null}
        {historyQuery.error ? (
          <div className={classes.error}>
            {historyQuery.error instanceof Error ? historyQuery.error.message : 'Could not load Indian market history.'}
          </div>
        ) : null}
        {searchVersion === 0 ? (
          <div className={classes.empty}>Choose the stocks to scan, date range, and result count, then press Search.</div>
        ) : universeQuery.isPending || historyQuery.isPending ? (
          <ChartSkeleton compact />
        ) : chartData.length ? (
          <>
            <div className={classes.chart}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={renderedChartData} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                  <CartesianGrid stroke={tokens.color.border} vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    minTickGap={30}
                    tickFormatter={(value) => formatDateLabel(String(value))}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={60}
                    domain={[(min: number) => Math.min(0, min), (max: number) => Math.max(0, max)]}
                    tickFormatter={(value) => `${Number(value).toFixed(0)}%`}
                  />
                  <ReferenceLine
                    y={0}
                    stroke={tokens.color.textMuted}
                    strokeWidth={2}
                    ifOverflow="extendDomain"
                    label={{ value: '0', position: 'insideLeft', fill: tokens.color.textMuted, fontSize: 11 }}
                  />
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
                    content={<ChartTooltip labelKind="date" valueKind="percent" marketMovements={movements} />}
                    cursor={{ stroke: tokens.color.borderStrong }}
                    isAnimationActive={false}
                  />
                  <Legend />
                  {ranked.map((stock, index) => (
                    <Line
                      key={stock.ticker}
                      dataKey={stock.ticker}
                      name={stock.name}
                      stroke={colors[index % colors.length]}
                      strokeWidth={2.4}
                      dot={false}
                      connectNulls
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          <div className={classes.empty}>No stocks have complete market history for this range.</div>
        )}
        {ranked.length ? (
          <div className={classes.grid}>
            <table className={classes.table}>
              <thead>
                <tr>
                  <th className={classes.th}>Rank</th>
                  <th className={classes.th}>Stock</th>
                  <th className={classes.th}>Industry</th>
                  <th className={classes.th}>From</th>
                  <th className={classes.th}>Start</th>
                  <th className={classes.th}>To</th>
                  <th className={classes.th}>Latest</th>
                  <th className={classes.th}>Return</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((stock, index) => (
                  <tr key={stock.ticker}>
                    <td className={`${classes.td} ${classes.rank}`}>{index + 1}</td>
                    <td className={classes.td}>
                      <strong>{stock.name}</strong>
                      <br />
                      <span className={classes.source}>{stock.ticker}</span>
                    </td>
                    <td className={classes.td}>{stock.industry}</td>
                    <td className={classes.td}>{formatDateLabel(stock.first.date)}</td>
                    <td className={classes.td}>{formatMoney(stock.first.closeMinor, 'INR', true)}</td>
                    <td className={classes.td}>{formatDateLabel(stock.last.date)}</td>
                    <td className={classes.td}>{formatMoney(stock.last.closeMinor, 'INR', true)}</td>
                    <td className={`${classes.td} ${stock.returnPct >= 0 ? classes.positive : classes.negative}`}>
                      <strong>
                        {stock.returnPct >= 0 ? '+' : ''}
                        {(stock.returnPct * 100).toFixed(2)}%
                      </strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Card>
    </div>
  )
}
