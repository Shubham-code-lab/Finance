import { createUseStyles } from 'react-jss'
import { formatDateLabel } from '@/domain/money'
import { MarketMoment } from '@/features/holdings/marketMoments'
import { tokens } from '@/theme/tokens'

const useStyles = createUseStyles({
  root: {
    display: 'grid',
    gap: tokens.space.sm,
    paddingTop: tokens.space.sm,
    borderTop: `1px solid ${tokens.color.border}`,
  },
  head: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: tokens.space.md, flexWrap: 'wrap' },
  title: { fontSize: tokens.font.sizeSm, fontWeight: tokens.font.weightMedium },
  help: { color: tokens.color.textMuted, fontSize: tokens.font.sizeXs },
  groups: { display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', gap: [tokens.space.xs, tokens.space.sm], alignItems: 'center' },
  groupLabel: { color: tokens.color.textMuted, fontSize: tokens.font.sizeXs },
  scroller: { display: 'flex', gap: tokens.space.xs, overflowX: 'auto', paddingBottom: 2 },
  moment: {
    flex: '0 0 auto',
    minHeight: 26,
    padding: [3, 8],
    border: `1px solid ${tokens.color.borderStrong}`,
    borderRadius: tokens.radius.sm,
    background: tokens.color.bgMuted,
    color: tokens.color.text,
    font: 'inherit',
    fontSize: tokens.font.sizeXs,
    cursor: 'pointer',
    '&:hover': { borderColor: tokens.color.accent },
    '&:focus-visible': { outline: `3px solid ${tokens.color.focus}`, outlineOffset: 2 },
  },
  drop: { color: tokens.color.negative },
  high: { color: tokens.color.positive },
  pinned: { background: `${tokens.color.accentSoft} !important`, borderColor: `${tokens.color.accent} !important` },
  empty: { color: tokens.color.textMuted, fontSize: tokens.font.sizeXs },
})

export function MarketMomentsBar({
  moments,
  pinnedId,
  onPin,
  emptyMessage,
}: {
  moments: MarketMoment[]
  pinnedId: string | null
  onPin: (id: string | null) => void
  emptyMessage: string
}) {
  const classes = useStyles()
  const groups = [
    { kind: 'drop' as const, label: 'Drops' },
    { kind: 'high' as const, label: 'Highs' },
  ]

  return (
    <div className={classes.root}>
      <div className={classes.head}>
        <span className={classes.title}>Market moments</span>
        <span className={classes.help}>Drops from prior peak · highs from range start · select one to pin · not advice</span>
      </div>
      {moments.length ? (
        <div className={classes.groups}>
          {groups.map(({ kind, label }) => {
            const items = moments.filter((moment) => moment.kind === kind)
            return [
              <span className={classes.groupLabel} key={`${kind}:label`}>
                {label}
              </span>,
              <div className={classes.scroller} key={`${kind}:items`}>
                {items.length ? (
                  items.map((moment) => {
                    const pinned = moment.id === pinnedId
                    return (
                      <button
                        className={`${classes.moment} ${kind === 'drop' ? classes.drop : classes.high} ${pinned ? classes.pinned : ''}`}
                        type="button"
                        key={moment.id}
                        aria-pressed={pinned}
                        onClick={() => onPin(pinned ? null : moment.id)}
                      >
                        {kind === 'drop' ? '' : '+'}
                        {moment.value.toFixed(1)}% · {formatDateLabel(moment.date)}
                      </button>
                    )
                  })
                ) : (
                  <span className={classes.empty}>None above 3%</span>
                )}
              </div>,
            ]
          })}
        </div>
      ) : (
        <span className={classes.empty}>{emptyMessage}</span>
      )}
    </div>
  )
}
