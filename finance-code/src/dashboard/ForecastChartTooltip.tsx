import { createUseStyles } from 'react-jss'
import { MoneyText } from '@/components/ui'
import { tokens } from '@/theme/tokens'

type TooltipData = Record<string, unknown>

type TooltipEntry = {
  payload?: TooltipData
}

const useStyles = createUseStyles({
  root: {
    minWidth: 240,
    padding: tokens.space.md,
    border: `1px solid ${tokens.color.borderStrong}`,
    borderRadius: tokens.radius.md,
    background: tokens.color.bgCard,
    boxShadow: '0 18px 48px rgba(0, 0, 0, 0.42)',
  },
  month: { marginBottom: tokens.space.sm, color: tokens.color.textMuted, fontSize: tokens.font.sizeXs },
  netWorth: {
    display: 'grid',
    gap: 2,
    paddingBottom: tokens.space.sm,
    marginBottom: tokens.space.sm,
    borderBottom: `1px solid ${tokens.color.border}`,
    '& small': { color: tokens.color.textMuted, fontSize: tokens.font.sizeXs },
    '& span': { color: `${tokens.color.accent} !important`, fontSize: 18, fontWeight: tokens.font.weightMedium },
  },
  change: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.space.md,
    marginBottom: tokens.space.sm,
    fontSize: tokens.font.sizeSm,
    color: tokens.color.textMuted,
  },
  sectionLabel: {
    marginBottom: tokens.space.xs,
    color: tokens.color.textMuted,
    fontSize: tokens.font.sizeXs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rows: { display: 'grid', gap: 6 },
  row: {
    display: 'grid',
    gridTemplateColumns: '8px minmax(0, 1fr) auto',
    alignItems: 'center',
    gap: tokens.space.sm,
    fontSize: tokens.font.sizeSm,
  },
  label: { color: tokens.color.textMuted },
  value: { color: tokens.color.text, fontVariantNumeric: 'tabular-nums', fontWeight: tokens.font.weightMedium },
  dot: { width: 8, height: 8, borderRadius: '50%' },
  bank: { background: tokens.color.neutral },
  investments: { background: tokens.color.positive },
  mutualFunds: { background: tokens.color.positive },
  stocks: { background: tokens.color.rose },
  reserved: { background: tokens.color.accent },
  liabilities: { background: tokens.color.negative },
  subRow: { paddingLeft: tokens.space.md },
})

function amount(data: TooltipData, key: string) {
  const value = Number(data[key])
  return Number.isFinite(value) ? Math.round(value * 100) : 0
}

export function ForecastChartTooltip({ active, label, payload }: { active?: boolean; label?: string; payload?: TooltipEntry[] }) {
  const classes = useStyles()
  if (!active || !payload?.length || !payload[0].payload) return null
  const data = payload[0].payload
  const reserved = amount(data, 'Reserved savings')
  const liabilities = amount(data, 'Liabilities')
  const rows = [
    { label: 'Available bank', amount: amount(data, 'Available bank'), color: classes.bank, subRow: false },
    { label: 'Total investments', amount: amount(data, 'Total investments'), color: classes.investments, subRow: false },
    { label: 'Mutual funds', amount: amount(data, 'Mutual funds'), color: classes.mutualFunds, subRow: true },
    { label: 'Stocks', amount: amount(data, 'Stocks'), color: classes.stocks, subRow: true },
    ...(reserved ? [{ label: 'Reserved savings', amount: reserved, color: classes.reserved, subRow: false }] : []),
    ...(liabilities ? [{ label: 'Liabilities', amount: liabilities, color: classes.liabilities, subRow: false }] : []),
  ]

  return (
    <div className={classes.root}>
      <div className={classes.month}>{label}</div>
      <div className={classes.netWorth}>
        <small>Net worth</small>
        <MoneyText amountMinor={amount(data, 'Net worth')} />
      </div>
      <div className={classes.change}>
        <span>Change from today</span>
        <MoneyText amountMinor={amount(data, 'Net worth change')} tone="auto" />
      </div>
      <div className={classes.sectionLabel}>Breakdown</div>
      <div className={classes.rows}>
        {rows.map((row) => (
          <div className={`${classes.row} ${row.subRow ? classes.subRow : ''}`} key={row.label}>
            <span className={`${classes.dot} ${row.color}`} />
            <span className={classes.label}>{row.label}</span>
            <span className={classes.value}>
              <MoneyText amountMinor={row.amount} tone={row.label === 'Liabilities' ? 'negative' : 'steady'} />
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
