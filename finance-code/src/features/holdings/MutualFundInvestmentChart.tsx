import { useMemo, useState } from 'react'
import CheckBoxIcon from '@mui/icons-material/CheckBox'
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank'
import { Chip } from '@mui/material'
import { createUseStyles } from 'react-jss'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartTooltip } from '@/charts/ChartTooltip'
import { Card, MoneyText } from '@/components/ui'
import { dateOnDay } from '@/domain/sip'
import { StoreData } from '@/domain/types'
import { formatDateLabel, todayIso } from '@/domain/money'
import { formatPrivateNumber, usePrivacy } from '@/privacy/privacy'
import { tokens } from '@/theme/tokens'

const colors = ['#8db7ff', '#42b883', '#ff9fca', '#e5c463', '#ff7a76', '#72d6dd']
const useStyles = createUseStyles({
  root: { display: 'grid', gap: tokens.space.md },
  title: { margin: 0, fontSize: tokens.font.sizeLg },
  copy: { margin: [tokens.space.xs, 0, 0], color: tokens.color.textMuted, fontSize: tokens.font.sizeSm },
  chips: { display: 'flex', flexWrap: 'wrap', gap: tokens.space.xs },
  chip: {
    height: '26px !important',
    background: `${tokens.color.bgMuted} !important`,
    color: `${tokens.color.text} !important`,
    cursor: 'pointer',
    '& .MuiChip-label': { padding: '0 7px', fontSize: tokens.font.sizeXs },
    '& .MuiChip-icon': { fontSize: '16px !important' },
  },
  chipOff: { opacity: 0.55 },
  chart: { height: 420, minWidth: 0, '@media (max-width: 720px)': { height: 340 } },
  empty: { padding: tokens.space.xl, color: tokens.color.textMuted, textAlign: 'center' },
  tableWrap: { overflowX: 'auto', border: `1px solid ${tokens.color.border}`, borderRadius: tokens.radius.sm },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: tokens.font.sizeSm },
  cell: { padding: [tokens.space.sm, tokens.space.md], borderBottom: `1px solid ${tokens.color.border}`, textAlign: 'left' },
  head: { color: tokens.color.accent, background: tokens.color.bgMuted },
})

export function MutualFundInvestmentChart({ data }: { data: StoreData }) {
  const classes = useStyles()
  const { masked } = usePrivacy()
  const holdings = useMemo(() => data.holdings.filter((holding) => holding.kind === 'mutual_fund'), [data.holdings])
  const [selectedIds, setSelectedIds] = useState(() => holdings.map((holding) => holding.id))
  const selected = holdings.filter((holding) => selectedIds.includes(holding.id))
  const chartData = useMemo(() => {
    const rows = new Map<string, Record<string, string | number>>()
    selected.forEach((holding) => {
      let cumulative = 0
      if (holding.purchaseMode === 'lumpsum' && holding.buyDate) {
        cumulative = holding.investedMinor
        rows.set(holding.buyDate, { ...(rows.get(holding.buyDate) ?? { date: holding.buyDate }), [holding.id]: cumulative / 100 })
      }
      data.sipEvents
        .filter((event) => event.holdingId === holding.id && event.status === 'paid')
        .sort((left, right) => left.month.localeCompare(right.month))
        .forEach((event) => {
          cumulative += event.amountMinor ?? holding.sipAmountMinor ?? 0
          const date = dateOnDay(event.month, holding.sipDayOfMonth ?? 1)
          rows.set(date, { ...(rows.get(date) ?? { date }), [holding.id]: cumulative / 100 })
        })
      const today = todayIso()
      rows.set(today, { ...(rows.get(today) ?? { date: today }), [holding.id]: holding.currentMinor / 100 })
    })
    const latest = new Map<string, number>()
    return [...rows.values()]
      .sort((left, right) => String(left.date).localeCompare(String(right.date)))
      .map((row) => {
        selected.forEach((holding) => {
          const value = row[holding.id]
          if (typeof value === 'number') latest.set(holding.id, value)
          else if (latest.has(holding.id)) row[holding.id] = latest.get(holding.id)!
        })
        return row
      })
  }, [data.sipEvents, selected])

  return (
    <div className={classes.root}>
      <Card className={classes.root}>
        <div>
          <h2 className={classes.title}>My mutual funds</h2>
          <p className={classes.copy}>Paid SIPs build the historical line; the latest point uses your current fund value.</p>
        </div>
        <div className={classes.chips}>
          {holdings.map((holding) => {
            const active = selectedIds.includes(holding.id)
            return (
              <Chip
                key={holding.id}
                size="small"
                className={`${classes.chip} ${active ? '' : classes.chipOff}`}
                label={holding.name}
                icon={active ? <CheckBoxIcon /> : <CheckBoxOutlineBlankIcon />}
                variant="outlined"
                onClick={() =>
                  setSelectedIds((current) =>
                    current.includes(holding.id) ? current.filter((id) => id !== holding.id) : [...current, holding.id],
                  )
                }
              />
            )
          })}
        </div>
        {chartData.length && selected.length ? (
          <div className={classes.chart}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid stroke={tokens.color.border} vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={28} tickFormatter={formatDateLabel} />
                <YAxis tickLine={false} axisLine={false} width={88} tickFormatter={(value) => formatPrivateNumber(Number(value), masked)} />
                <Tooltip content={<ChartTooltip labelKind="date" />} />
                <Legend />
                {selected.map((holding, index) => (
                  <Line
                    key={holding.id}
                    dataKey={holding.id}
                    name={holding.name}
                    stroke={colors[index % colors.length]}
                    dot={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className={classes.empty}>{holdings.length ? 'Select at least one fund.' : 'Add mutual funds in My investments.'}</div>
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
              {selected.map((holding) => (
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
