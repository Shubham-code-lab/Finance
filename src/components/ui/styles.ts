import { createUseStyles } from 'react-jss'
import { tokens } from '@/theme/tokens'

export const useUiStyles = createUseStyles({
  card: { borderRadius: tokens.radius.md, padding: tokens.space.lg, boxShadow: tokens.shadow.card },
  button: { textTransform: 'none', minHeight: 32 },
  input: { width: '100%' },
  label: { display: 'grid', gap: tokens.space.xs, color: tokens.color.textMuted, fontSize: tokens.font.sizeSm },
  error: { color: tokens.color.danger, fontSize: tokens.font.sizeSm, lineHeight: 1.35 },
  money: { fontVariantNumeric: 'tabular-nums', fontWeight: tokens.font.weightMedium },
  moneyPositive: { color: tokens.color.positive },
  moneyNegative: { color: tokens.color.negative },
  moneySteady: { color: tokens.color.steady },
  row: { display: 'flex', gap: tokens.space.sm, alignItems: 'center', flexWrap: 'wrap' },
  drawer: {
    width: 'min(420px, 100vw)',
    height: '100%',
    display: 'grid',
    gridTemplateRows: 'auto minmax(0, 1fr) auto',
    background: tokens.color.bgCard,
  },
  drawerHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.space.md,
    padding: tokens.space.lg,
    borderBottom: `1px solid ${tokens.color.border}`,
  },
  drawerTitle: { margin: 0, fontSize: tokens.font.sizeLg },
  drawerBody: { overflowY: 'auto', padding: tokens.space.lg },
  drawerFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: tokens.space.sm,
    padding: tokens.space.lg,
    borderTop: `1px solid ${tokens.color.border}`,
    background: tokens.color.bgMuted,
  },
})
