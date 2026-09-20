import { createUseStyles } from 'react-jss'
import { MoneyText } from '@/components/ui'
import { tokens } from '@/theme/tokens'

type SectorPayload = {
  name: string
  value: number
  percent: number
  stocks: string[]
}

const useStyles = createUseStyles({
  root: {
    display: 'grid',
    gap: tokens.space.xs,
    maxWidth: 280,
    padding: tokens.space.md,
    border: `1px solid ${tokens.color.borderStrong}`,
    borderRadius: tokens.radius.md,
    background: tokens.color.bgCard,
    boxShadow: '0 18px 48px rgba(0, 0, 0, 0.42)',
  },
  title: { color: tokens.color.text, fontWeight: tokens.font.weightMedium },
  value: { display: 'flex', alignItems: 'center', gap: tokens.space.xs, color: tokens.color.textMuted, fontSize: tokens.font.sizeSm },
  stocks: { color: tokens.color.textMuted, fontSize: tokens.font.sizeXs, lineHeight: 1.45 },
})

export function InvestmentSectorTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload?: SectorPayload }> }) {
  const classes = useStyles()
  const sector = payload?.[0]?.payload
  if (!active || !sector) return null
  return (
    <div className={classes.root}>
      <span className={classes.title}>{sector.name}</span>
      <span className={classes.value}>
        <MoneyText amountMinor={sector.value} tone="steady" /> · {(sector.percent * 100).toFixed(1)}%
      </span>
      <span className={classes.stocks}>{sector.stocks.join(', ')}</span>
    </div>
  )
}
