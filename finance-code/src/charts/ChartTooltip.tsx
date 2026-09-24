import { createUseStyles } from 'react-jss'
import { formatDateLabel, formatMonthLabel } from '@/domain/money'
import { formatPrivateMoney, usePrivacy } from '@/privacy/privacy'
import { tokens } from '@/theme/tokens'

type Entry = { color?: string; dataKey?: string | number; name?: string | number; value?: string | number }
type MarketMovement = { date: string; kind: 'up' | 'down' | 'steady'; value: number }

const useStyles = createUseStyles({
  root: {
    minWidth: 190,
    maxHeight: 'min(360px, calc(100vh - 48px))',
    overflowY: 'auto',
    padding: tokens.space.md,
    border: `1px solid ${tokens.color.borderStrong}`,
    borderRadius: tokens.radius.md,
    background: tokens.color.bgCard,
    backgroundImage: 'none',
    opacity: '1 !important',
    isolation: 'isolate',
    zIndex: 10,
    boxShadow: '0 18px 48px rgba(0, 0, 0, 0.42)',
  },
  label: { marginBottom: tokens.space.sm, color: tokens.color.textMuted, fontSize: tokens.font.sizeXs },
  rows: { display: 'grid', gap: 7 },
  row: { display: 'grid', gridTemplateColumns: '8px minmax(0, 1fr) auto', alignItems: 'center', gap: tokens.space.sm },
  dot: { width: 8, height: 8, borderRadius: '50%' },
  dot0: { background: tokens.color.accent },
  dot1: { background: tokens.color.positive },
  dot2: { background: tokens.color.rose },
  dot3: { background: tokens.color.steady },
  dot4: { background: tokens.color.negative },
  name: { overflow: 'hidden', color: tokens.color.textMuted, fontSize: tokens.font.sizeSm, textOverflow: 'ellipsis' },
  value: {
    color: tokens.color.text,
    fontSize: tokens.font.sizeSm,
    fontWeight: tokens.font.weightMedium,
    fontVariantNumeric: 'tabular-nums',
  },
  positive: { color: tokens.color.positive },
  negative: { color: tokens.color.negative },
  steady: { color: tokens.color.textMuted },
  movement: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: tokens.space.md,
    marginBottom: tokens.space.sm,
    paddingBottom: tokens.space.sm,
    borderBottom: `1px dashed ${tokens.color.borderStrong}`,
    fontSize: tokens.font.sizeXs,
  },
  movementLabel: { color: tokens.color.textMuted },
})

export function ChartTooltip({
  active,
  label,
  payload,
  labelKind = 'month',
  valueKind = 'money',
  marketMovements = [],
  visibleDataKeys,
  movementBaseline = 'range',
}: {
  active?: boolean
  label?: string | number
  payload?: Entry[]
  labelKind?: 'date' | 'month' | 'plain'
  valueKind?: 'money' | 'percent'
  marketMovements?: MarketMovement[]
  visibleDataKeys?: Array<string | number>
  movementBaseline?: 'investment' | 'range'
}) {
  const classes = useStyles()
  const { masked } = usePrivacy()
  if (!active || !payload?.length) return null
  const formattedLabel =
    labelKind === 'date' ? formatDateLabel(String(label)) : labelKind === 'month' ? formatMonthLabel(String(label)) : String(label)
  const visible = visibleDataKeys?.length ? payload.filter((entry) => visibleDataKeys.includes(entry.dataKey ?? '')) : payload
  const entries = valueKind === 'percent' ? [...visible].sort((left, right) => Number(right.value) - Number(left.value)) : visible
  const movement = marketMovements.find((item) => item.date === String(label))
  const baselineLabel = movementBaseline === 'investment' ? 'investment' : 'range start'
  return (
    <div className={classes.root}>
      {movement ? (
        <div className={classes.movement}>
          <span className={classes.movementLabel}>
            {movement.kind === 'up' ? 'Up' : movement.kind === 'down' ? 'Down' : 'No change'} since {baselineLabel}
          </span>
          <strong className={movement.kind === 'down' ? classes.negative : movement.kind === 'up' ? classes.positive : classes.steady}>
            {movement.value > 0 ? '+' : ''}
            {movement.value.toFixed(2)}%
          </strong>
        </div>
      ) : null}
      <div className={classes.label}>{formattedLabel}</div>
      <div className={classes.rows}>
        {entries.map((entry, index) => {
          const numeric = Number(entry.value)
          const value =
            valueKind === 'percent'
              ? `${numeric >= 0 ? '+' : ''}${numeric.toFixed(2)}%`
              : formatPrivateMoney(Math.round(numeric * 100), 'INR', false, masked)
          return (
            <div className={classes.row} key={String(entry.dataKey ?? entry.name)}>
              <span className={`${classes.dot} ${classes[`dot${index % 5}` as keyof typeof classes]}`} />
              <span className={classes.name}>{entry.name}</span>
              <span
                className={`${classes.value} ${
                  valueKind !== 'percent' ? '' : numeric > 0 ? classes.positive : numeric < 0 ? classes.negative : classes.steady
                }`}
              >
                {value}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
