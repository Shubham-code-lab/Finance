import { createUseStyles } from 'react-jss'
import { lifestyleSpendByCategory } from '@/calc/calculations'
import { MoneyText } from '@/components/ui'
import { StoreData } from '@/domain/types'
import { tokens } from '@/theme/tokens'

const useStyles = createUseStyles({
  list: { display: 'grid', gap: tokens.space.sm },
  item: { display: 'grid', gap: 6 },
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: tokens.space.md, fontSize: tokens.font.sizeSm },
  name: { color: tokens.color.text },
  bar: {
    width: '100%',
    height: 7,
    border: 0,
    borderRadius: 999,
    overflow: 'hidden',
    background: tokens.color.bgMuted,
    '&::-webkit-progress-bar': { background: tokens.color.bgMuted },
    '&::-webkit-progress-value': { background: tokens.color.positive, borderRadius: 999 },
    '&::-moz-progress-bar': { background: tokens.color.positive, borderRadius: 999 },
  },
  empty: { color: tokens.color.textMuted, fontSize: tokens.font.sizeSm },
})

export function LifestyleBreakdown({ data }: { data: StoreData }) {
  const classes = useStyles()
  const rows = lifestyleSpendByCategory(data.transactions, data.categories).slice(0, 8)
  const total = rows.reduce((sum, row) => sum + row.amountMinor, 0)
  if (!rows.length) return <div className={classes.empty}>No lifestyle spend found.</div>
  return (
    <div className={classes.list}>
      {rows.map((row) => (
        <div className={classes.item} key={row.categoryId}>
          <div className={classes.row}>
            <span className={classes.name}>{row.name}</span>
            <MoneyText amountMinor={row.amountMinor} tone="negative" />
          </div>
          <progress
            className={classes.bar}
            value={row.amountMinor}
            max={total || 1}
            aria-label={`${row.name} share of lifestyle spending`}
          />
        </div>
      ))}
    </div>
  )
}
