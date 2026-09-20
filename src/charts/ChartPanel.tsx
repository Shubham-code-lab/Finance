import { useMemo, useState, useTransition } from 'react'
import { createUseStyles } from 'react-jss'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { DateRangePicker } from '@/components/DateRangePicker'
import { isValidDateRange } from '@/components/dateRange'
import { FilterStatus } from '@/components/FilterStatus'
import { formatMonthLabel } from '@/domain/money'
import { ChartSpec, StoreData } from '@/domain/types'
import { buildChartData, monthsFromTransactions, seriesKeys } from '@/charts/series'
import { tokens } from '@/theme/tokens'
import { ChartTooltip } from '@/charts/ChartTooltip'
import { formatPrivateNumber, usePrivacy } from '@/privacy/privacy'

const useStyles = createUseStyles({
  root: { display: 'grid', gap: tokens.space.sm },
  filters: { display: 'flex', alignItems: 'center', gap: tokens.space.sm, flexWrap: 'wrap' },
  frame: { height: 340, minWidth: 0, '@media (min-width: 1440px)': { height: 400 } },
  empty: { color: tokens.color.textMuted, padding: tokens.space.md },
})

const colors = [tokens.color.steady, tokens.color.positive, tokens.color.negative, tokens.color.accent, tokens.color.rose]

export function ChartPanel({ spec, data }: { spec: ChartSpec; data: StoreData }) {
  const classes = useStyles()
  const { masked } = usePrivacy()
  const availableMonths = useMemo(() => monthsFromTransactions(data.transactions, data.snapshots), [data.transactions, data.snapshots])
  const defaultFromMonth = availableMonths.at(-6) ?? availableMonths[0] ?? ''
  const defaultToMonth = availableMonths.at(-1) ?? ''
  const [range, setRange] = useState({
    from: defaultFromMonth ? `${defaultFromMonth}-01` : '',
    to: defaultToMonth
      ? `${defaultToMonth}-${String(new Date(Number(defaultToMonth.slice(0, 4)), Number(defaultToMonth.slice(5, 7)), 0).getDate()).padStart(2, '0')}`
      : '',
  })
  const [isFilterPending, startFilterTransition] = useTransition()
  const validRange = isValidDateRange(range)
  const chartData = validRange ? buildChartData(data, spec, { from: range.from || undefined, to: range.to || undefined }) : []
  const keys = seriesKeys(spec, data)
  if (!availableMonths.length) return <div className={classes.empty}>No chart data yet.</div>
  const common = (
    <>
      <CartesianGrid stroke={tokens.color.border} vertical={false} />
      <XAxis dataKey="period" tickLine={false} axisLine={false} tickFormatter={formatMonthLabel} />
      <YAxis tickLine={false} axisLine={false} width={82} tickFormatter={(value) => formatPrivateNumber(Number(value), masked)} />
      <Tooltip content={<ChartTooltip />} cursor={{ stroke: tokens.color.borderStrong, strokeDasharray: '4 4' }} />
      <Legend />
    </>
  )
  return (
    <div className={classes.root}>
      <div className={classes.filters}>
        <FilterStatus fetching={isFilterPending} ready={!isFilterPending} />
        <DateRangePicker value={range} onChange={(next) => startFilterTransition(() => setRange(next))} />
      </div>
      {chartData.length ? (
        <div className={classes.frame}>
          <ResponsiveContainer width="100%" height="100%">
            {spec.chartType === 'bar' ? (
              <BarChart data={chartData}>
                {common}
                {keys.map((key, index) => (
                  <Bar key={key} dataKey={key} fill={colors[index % colors.length]} />
                ))}
              </BarChart>
            ) : spec.chartType === 'area' ? (
              <AreaChart data={chartData}>
                {common}
                {keys.map((key, index) => (
                  <Area
                    key={key}
                    dataKey={key}
                    stroke={colors[index % colors.length]}
                    fill={colors[index % colors.length]}
                    fillOpacity={0.12}
                  />
                ))}
              </AreaChart>
            ) : (
              <LineChart data={chartData}>
                {common}
                {keys.map((key, index) => (
                  <Line key={key} dataKey={key} stroke={colors[index % colors.length]} dot={false} strokeWidth={2} />
                ))}
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      ) : (
        <div className={classes.empty}>No chart data in this range.</div>
      )}
    </div>
  )
}
