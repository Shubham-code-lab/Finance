import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import { Dialog } from '@mui/material'
import { createUseStyles } from 'react-jss'
import { Button } from '@/components/ui'
import { tokens } from '@/theme/tokens'

const useStyles = createUseStyles({
  paper: {
    width: 430,
    maxWidth: 'calc(100vw - 24px)',
    border: `1px solid ${tokens.color.borderStrong}`,
    borderRadius: `${tokens.radius.md}px !important`,
    background: `${tokens.color.bgCard} !important`,
    color: `${tokens.color.text} !important`,
  },
  content: { display: 'grid' },
  header: {
    display: 'grid',
    gridTemplateColumns: '40px minmax(0, 1fr)',
    gap: tokens.space.md,
    alignItems: 'center',
    padding: [tokens.space.lg, tokens.space.lg, tokens.space.md],
  },
  icon: {
    width: 40,
    height: 40,
    display: 'grid',
    placeItems: 'center',
    borderRadius: '50%',
    color: tokens.color.negative,
    background: tokens.color.dangerSoft,
  },
  title: { margin: 0, fontSize: tokens.font.sizeLg },
  body: {
    margin: 0,
    padding: [0, tokens.space.lg, tokens.space.lg, 68],
    color: tokens.color.textMuted,
    fontSize: tokens.font.sizeSm,
    lineHeight: 1.55,
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: tokens.space.sm,
    padding: tokens.space.md,
    borderTop: `1px solid ${tokens.color.border}`,
    background: tokens.color.bgMuted,
  },
})

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Remove',
  busy = false,
  onCancel,
  onConfirm,
}: {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  busy?: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const classes = useStyles()
  return (
    <Dialog open={open} onClose={busy ? undefined : onCancel} slotProps={{ paper: { className: classes.paper } }}>
      <div className={classes.content}>
        <div className={classes.header}>
          <span className={classes.icon} aria-hidden="true">
            <WarningAmberIcon />
          </span>
          <h2 className={classes.title}>{title}</h2>
        </div>
        <p className={classes.body}>{message}</p>
        <div className={classes.actions}>
          <Button disabled={busy} onClick={onCancel}>
            Keep it
          </Button>
          <Button variant="danger" disabled={busy} onClick={onConfirm}>
            {busy ? 'Removing...' : confirmLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
