import { FormEvent, ReactNode, useState } from 'react'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import { createUseStyles } from 'react-jss'
import { Button, Drawer, ErrorText, Input, MoneyText } from '@/components/ui'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { normalizeForecastAdjustments } from '@/calc/forecastAdjustments'
import { formatMonthLabel, toMinor, todayIso } from '@/domain/money'
import { ForecastAdjustment } from '@/domain/types'
import { addMonths } from '@/domain/sip'
import { tokens } from '@/theme/tokens'
import { EffectiveMonthPicker } from '@/dashboard/EffectiveMonthPicker'

type Draft = { effectiveMonth: string; salary: string; livingCost: string; mutualFundSip: string; stockSip: string }

function blankDraft(): Draft {
  return { effectiveMonth: addMonths(todayIso().slice(0, 7), 1), salary: '', livingCost: '', mutualFundSip: '', stockSip: '' }
}

function optionalMinor(value: string) {
  return value.trim() === '' ? undefined : toMinor(value)
}

const useStyles = createUseStyles({
  root: {
    display: 'grid',
    gap: tokens.space.md,
    padding: tokens.space.md,
    border: `1px solid ${tokens.color.border}`,
    borderRadius: tokens.radius.md,
    background: tokens.color.bgCard,
  },
  heading: { display: 'grid', gap: tokens.space.xs },
  title: { margin: 0, fontSize: tokens.font.sizeMd },
  help: { margin: 0, color: tokens.color.textMuted, fontSize: tokens.font.sizeXs, lineHeight: 1.45 },
  form: { display: 'grid', gap: tokens.space.sm },
  fieldGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: tokens.space.sm,
  },
  field: {
    display: 'grid',
    gap: tokens.space.xs,
    minWidth: 0,
    color: tokens.color.textMuted,
    fontSize: tokens.font.sizeXs,
    fontWeight: tokens.font.weightMedium,
  },
  list: { display: 'grid', gap: tokens.space.sm },
  row: {
    display: 'grid',
    gridTemplateColumns: '110px minmax(0, 1fr)',
    alignItems: 'center',
    gap: tokens.space.sm,
    padding: tokens.space.sm,
    border: `1px solid ${tokens.color.border}`,
    borderRadius: tokens.radius.sm,
    background: tokens.color.bgCard,
    fontSize: tokens.font.sizeSm,
    '@media (max-width: 720px)': { gridTemplateColumns: '1fr', '& > :last-child': { justifySelf: 'start' } },
  },
  changeValues: { display: 'flex', alignItems: 'center', gap: tokens.space.sm, flexWrap: 'wrap' },
  value: {
    display: 'grid',
    gap: 2,
    minWidth: 120,
    padding: [tokens.space.xs, tokens.space.sm],
    borderRadius: tokens.radius.sm,
    background: tokens.color.bgMuted,
    '& small': { color: tokens.color.textMuted },
  },
  drawerIntro: { margin: 0, color: tokens.color.textMuted, fontSize: tokens.font.sizeSm, lineHeight: 1.5 },
  drawerSection: { display: 'grid', gap: tokens.space.sm, paddingTop: tokens.space.md, borderTop: `1px solid ${tokens.color.border}` },
  drawerSectionTitle: { margin: 0, fontSize: tokens.font.sizeMd },
  drawerSchedule: { display: 'grid', gap: tokens.space.sm, marginTop: tokens.space.lg },
  drawerScheduleTitle: { margin: 0, fontSize: tokens.font.sizeSm },
  drawerRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    alignItems: 'center',
    gap: tokens.space.sm,
    padding: tokens.space.sm,
    border: `1px solid ${tokens.color.border}`,
    borderRadius: tokens.radius.sm,
  },
  rowActions: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: tokens.space.xs },
  editButton: { minWidth: '36px !important', width: 36, padding: '4px !important' },
  deleteButton: { minWidth: '36px !important', width: 36, padding: '4px !important' },
})

export function ForecastScheduleEditor({
  adjustments,
  onChange,
  drawerOpen,
  onDrawerOpenChange,
  drawerContentBefore,
}: {
  adjustments: ForecastAdjustment[]
  onChange: (next: ForecastAdjustment[]) => Promise<void>
  drawerOpen: boolean
  onDrawerOpenChange: (open: boolean) => void
  drawerContentBefore?: ReactNode
}) {
  const classes = useStyles()
  const [draft, setDraft] = useState<Draft>(blankDraft)
  const [editingMonth, setEditingMonth] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [pendingRemoveMonth, setPendingRemoveMonth] = useState<string | null>(null)
  const sorted = normalizeForecastAdjustments(adjustments)

  const save = async (event: FormEvent) => {
    event.preventDefault()
    const salaryMinor = optionalMinor(draft.salary)
    const livingCostMinor = optionalMinor(draft.livingCost)
    const mutualFundSipMinor = optionalMinor(draft.mutualFundSip)
    const stockSipMinor = optionalMinor(draft.stockSip)
    if (!draft.effectiveMonth) return setError('Choose the month this change starts.')
    if (salaryMinor === undefined && livingCostMinor === undefined && mutualFundSipMinor === undefined && stockSipMinor === undefined) {
      return setError('Enter at least one monthly amount. Use 0 to stop a cost or SIP.')
    }
    if ([salaryMinor, livingCostMinor, mutualFundSipMinor, stockSipMinor].some((amount) => amount !== undefined && amount < 0)) {
      return setError('Amounts cannot be negative.')
    }
    const existing = sorted.find((item) => item.effectiveMonth === draft.effectiveMonth)
    const entered = {
      effectiveMonth: draft.effectiveMonth,
      ...(salaryMinor !== undefined ? { salaryMinor } : {}),
      ...(livingCostMinor !== undefined ? { livingCostMinor } : {}),
      ...(mutualFundSipMinor !== undefined ? { mutualFundSipMinor } : {}),
      ...(stockSipMinor !== undefined ? { stockSipMinor } : {}),
    }
    const next = normalizeForecastAdjustments([
      ...sorted.filter((item) => item.effectiveMonth !== draft.effectiveMonth && item.effectiveMonth !== editingMonth),
      editingMonth === draft.effectiveMonth ? entered : { ...existing, ...entered },
    ])
    setSaving(true)
    setError('')
    try {
      await onChange(next)
      setDraft(blankDraft())
      setEditingMonth(null)
    } catch {
      setError('Could not save this forecast change.')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (month: string) => {
    setSaving(true)
    setError('')
    try {
      await onChange(sorted.filter((item) => item.effectiveMonth !== month))
      if (editingMonth === month) {
        setEditingMonth(null)
        setDraft(blankDraft())
      }
    } catch {
      setError('Could not remove this forecast change.')
    } finally {
      setSaving(false)
    }
  }

  const edit = (adjustment: ForecastAdjustment) => {
    onDrawerOpenChange(true)
    setEditingMonth(adjustment.effectiveMonth)
    setError('')
    setDraft({
      effectiveMonth: adjustment.effectiveMonth,
      salary: adjustment.salaryMinor === undefined ? '' : String(adjustment.salaryMinor / 100),
      livingCost: adjustment.livingCostMinor === undefined ? '' : String(adjustment.livingCostMinor / 100),
      mutualFundSip: adjustment.mutualFundSipMinor === undefined ? '' : String(adjustment.mutualFundSipMinor / 100),
      stockSip: adjustment.stockSipMinor === undefined ? '' : String(adjustment.stockSipMinor / 100),
    })
  }

  const cancelEdit = () => {
    setEditingMonth(null)
    setError('')
    setDraft(blankDraft())
  }

  return (
    <section className={classes.root}>
      <div className={classes.heading}>
        <h3 className={classes.title}>Future monthly changes</h3>
        <p className={classes.help}>Scheduled changes are applied from their effective month onward.</p>
      </div>
      <ErrorText>{error}</ErrorText>
      {sorted.length ? (
        <div className={classes.list}>
          {sorted.map((adjustment) => (
            <div className={classes.row} key={adjustment.effectiveMonth}>
              <strong>{formatMonthLabel(adjustment.effectiveMonth)}</strong>
              <span className={classes.changeValues}>
                {adjustment.salaryMinor !== undefined ? (
                  <span className={classes.value}>
                    <small>Salary</small>
                    <MoneyText amountMinor={adjustment.salaryMinor} />
                  </span>
                ) : null}
                {adjustment.livingCostMinor !== undefined ? (
                  <span className={classes.value}>
                    <small>Living cost</small>
                    <MoneyText amountMinor={adjustment.livingCostMinor} tone="negative" />
                  </span>
                ) : null}
                {adjustment.mutualFundSipMinor !== undefined ? (
                  <span className={classes.value}>
                    <small>MF SIP</small>
                    <MoneyText amountMinor={adjustment.mutualFundSipMinor} />
                  </span>
                ) : null}
                {adjustment.stockSipMinor !== undefined ? (
                  <span className={classes.value}>
                    <small>Stock SIP</small>
                    <MoneyText amountMinor={adjustment.stockSipMinor} />
                  </span>
                ) : null}
              </span>
            </div>
          ))}
        </div>
      ) : null}
      {drawerOpen ? (
        <Drawer
          title="Manage wealth planner"
          onClose={() => onDrawerOpenChange(false)}
          footer={
            <Button type="button" disabled={saving} onClick={() => onDrawerOpenChange(false)}>
              Close
            </Button>
          }
        >
          {drawerContentBefore}
          <section className={classes.drawerSection}>
            <h3 className={classes.drawerSectionTitle}>Future monthly changes</h3>
            <p className={classes.drawerIntro}>Blank fields keep the previous value. Enter 0 to stop a cost or SIP.</p>
            <form id="forecast-change-form" className={classes.form} onSubmit={save}>
              <div className={classes.fieldGrid}>
                <label className={classes.field}>
                  Effective month
                  <EffectiveMonthPicker
                    value={draft.effectiveMonth}
                    onChange={(effectiveMonth) => setDraft((current) => ({ ...current, effectiveMonth }))}
                  />
                </label>
                <label className={classes.field}>
                  Salary / month
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={draft.salary}
                    onChange={(event) => setDraft((current) => ({ ...current, salary: event.target.value }))}
                  />
                </label>
                <label className={classes.field}>
                  Living cost / month
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={draft.livingCost}
                    onChange={(event) => setDraft((current) => ({ ...current, livingCost: event.target.value }))}
                  />
                </label>
                <label className={classes.field}>
                  MF SIP / month
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={draft.mutualFundSip}
                    onChange={(event) => setDraft((current) => ({ ...current, mutualFundSip: event.target.value }))}
                  />
                </label>
                <label className={classes.field}>
                  Stock SIP / month
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={draft.stockSip}
                    onChange={(event) => setDraft((current) => ({ ...current, stockSip: event.target.value }))}
                  />
                </label>
              </div>
              <span className={classes.rowActions}>
                {editingMonth ? (
                  <Button type="button" disabled={saving} onClick={cancelEdit}>
                    Cancel edit
                  </Button>
                ) : null}
                <Button type="submit" variant="primary" disabled={saving}>
                  {saving ? 'Saving' : editingMonth ? 'Update change' : 'Add change'}
                </Button>
              </span>
            </form>
            <ErrorText>{error}</ErrorText>
            {sorted.length ? (
              <section className={classes.drawerSchedule}>
                <h4 className={classes.drawerScheduleTitle}>Scheduled changes</h4>
                {sorted.map((adjustment) => (
                  <div className={classes.drawerRow} key={adjustment.effectiveMonth}>
                    <strong>{formatMonthLabel(adjustment.effectiveMonth)}</strong>
                    <span className={classes.rowActions}>
                      <Button
                        type="button"
                        className={classes.editButton}
                        disabled={saving}
                        onClick={() => edit(adjustment)}
                        aria-label={`Edit change from ${formatMonthLabel(adjustment.effectiveMonth)}`}
                      >
                        <EditIcon fontSize="small" />
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        className={classes.deleteButton}
                        disabled={saving}
                        onClick={() => setPendingRemoveMonth(adjustment.effectiveMonth)}
                        aria-label={`Remove change from ${formatMonthLabel(adjustment.effectiveMonth)}`}
                      >
                        <DeleteIcon fontSize="small" />
                      </Button>
                    </span>
                  </div>
                ))}
              </section>
            ) : null}
          </section>
        </Drawer>
      ) : null}
      <ConfirmDialog
        open={Boolean(pendingRemoveMonth)}
        title="Remove this monthly change?"
        message={`The change from ${pendingRemoveMonth ? formatMonthLabel(pendingRemoveMonth) : ''} will no longer affect the forecast.`}
        confirmLabel="Remove change"
        busy={saving}
        onCancel={() => setPendingRemoveMonth(null)}
        onConfirm={() => {
          if (!pendingRemoveMonth) return
          void remove(pendingRemoveMonth).then(() => setPendingRemoveMonth(null))
        }}
      />
    </section>
  )
}
