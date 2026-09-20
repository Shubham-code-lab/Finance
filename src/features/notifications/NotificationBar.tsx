import { useState } from 'react'
import { ChatBubbleOutlined } from '@mui/icons-material'
import { Badge, Dialog, DialogActions, DialogContent, DialogTitle, Fab } from '@mui/material'
import { createUseStyles } from 'react-jss'
import { Button, Card, Row } from '@/components/ui'
import { formatDateLabel, formatMonthLabel } from '@/domain/money'
import { dateOnDay, pendingSipChecks, sipEventId } from '@/domain/sip'
import { SipStatus, StoreData } from '@/domain/types'
import { refreshInvestmentSnapshots } from '@/features/holdings/refreshSnapshots'
import { upsertSipEvent } from '@/storage/repository'
import { tokens } from '@/theme/tokens'

const useStyles = createUseStyles({
  launcher: { position: 'fixed', right: 24, bottom: 24, zIndex: tokens.z.modal - 1 },
  panel: {
    position: 'fixed',
    right: 24,
    bottom: 92,
    zIndex: tokens.z.modal - 1,
    width: 'min(380px, calc(100vw - 48px))',
    display: 'grid',
    gap: tokens.space.md,
  },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: tokens.space.md, marginBottom: tokens.space.sm },
  title: { fontWeight: tokens.font.weightMedium },
  item: { display: 'grid', gap: tokens.space.sm, paddingTop: tokens.space.sm, borderTop: `1px solid ${tokens.color.border}` },
  label: { color: tokens.color.text, lineHeight: 1.4 },
  empty: { color: tokens.color.textMuted, lineHeight: 1.4 },
})

type PendingAction = {
  holdingId: string
  holdingName: string
  month: string
  status: SipStatus
  amountMinor: number | null
}

export function NotificationBar({ data, onSaved }: { data: StoreData; onSaved: () => Promise<void> }) {
  const classes = useStyles()
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState<PendingAction | null>(null)
  const pending = pendingSipChecks(data.holdings, data.sipEvents).slice(0, 6)

  const answer = async () => {
    if (!confirm) return
    await upsertSipEvent({
      id: sipEventId(confirm.holdingId, confirm.month),
      holdingId: confirm.holdingId,
      month: confirm.month,
      status: confirm.status,
      amountMinor: confirm.status === 'paid' ? confirm.amountMinor : null,
      notedAt: new Date().toISOString(),
      origin: 'user',
    })
    setConfirm(null)
    await refreshInvestmentSnapshots()
    await onSaved()
  }

  const ask = (item: ReturnType<typeof pendingSipChecks>[number], status: SipStatus) => {
    setConfirm({
      holdingId: item.holding.id,
      holdingName: item.holding.name,
      month: item.month,
      status,
      amountMinor: item.holding.sipAmountMinor,
    })
  }

  return (
    <>
      {open ? (
        <div className={classes.panel}>
          <Card>
            <div className={classes.head}>
              <span className={classes.title}>SIP assistant</span>
              <Button onClick={() => setOpen(false)}>Close</Button>
            </div>
            {pending.length ? (
              pending.map((item) => (
                <div key={`${item.holding.id}:${item.month}`} className={classes.item}>
                  <span className={classes.label}>
                    Did you pay {item.holding.name} SIP due {formatDateLabel(dateOnDay(item.month, item.holding.sipDayOfMonth ?? 1))}?
                  </span>
                  <Row>
                    <Button variant="primary" onClick={() => ask(item, 'paid')}>
                      Paid
                    </Button>
                    <Button onClick={() => ask(item, 'skipped')}>Skipped</Button>
                    <Button onClick={() => ask(item, 'failed')}>Failed</Button>
                    <Button variant="danger" onClick={() => ask(item, 'cancelled')}>
                      Cancelled
                    </Button>
                  </Row>
                </div>
              ))
            ) : (
              <span className={classes.empty}>No SIP check-ins waiting.</span>
            )}
          </Card>
        </div>
      ) : null}
      <div className={classes.launcher}>
        <Badge badgeContent={pending.length} color="error">
          <Fab color="primary" aria-label="SIP assistant" onClick={() => setOpen(!open)}>
            <ChatBubbleOutlined />
          </Fab>
        </Badge>
      </div>
      <Dialog open={Boolean(confirm)} onClose={() => setConfirm(null)}>
        <DialogTitle>Confirm SIP update</DialogTitle>
        <DialogContent>
          Mark {confirm?.holdingName} for {confirm?.month ? formatMonthLabel(confirm.month) : ''} as {confirm?.status}?
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)}>Cancel</Button>
          <Button variant="primary" onClick={answer}>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
