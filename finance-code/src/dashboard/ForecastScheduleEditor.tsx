import { FormEvent, ReactNode, useState } from 'react'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import { IconButton, Menu, MenuItem, Tab, Tabs } from '@mui/material'
import { createUseStyles } from 'react-jss'
import { Button, Drawer, ErrorText, Field, Input, MoneyText, MonthPicker } from '@/components/ui'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { normalizeForecastAdjustments } from '@/calc/forecastAdjustments'
import { formatMonthLabel, toMinor, todayIso } from '@/domain/money'
import { ForecastAdjustment } from '@/domain/types'
import { addMonths } from '@/domain/sip'
import { tokens } from '@/theme/tokens'
import { ForecastInfoTip } from '@/dashboard/ForecastInfoTip'

type Draft = { effectiveMonth: string; salary: string; livingCost: string; mutualFundSip: string; stockSip: string }
export type PlannerSection = 'assumptions' | 'plans' | 'changes'

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
  heading: { display: 'flex', alignItems: 'center', gap: tokens.space.xs },
  title: { margin: 0, fontSize: tokens.font.sizeMd },
  form: { display: 'grid', gap: tokens.space.sm },
  fieldGrid: {
    display: 'grid',
    gap: tokens.space.sm,
  },
  field: {
    width: 296,
    minWidth: 0,
    maxWidth: '100%',
  },
  effectiveMonthField: { width: 320 },
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
  drawerLayout: { display: 'grid', gap: tokens.space.lg },
  drawerTabs: {
    position: 'sticky',
    top: -tokens.space.lg,
    zIndex: 2,
    margin: [-tokens.space.lg, -tokens.space.lg, 0],
    padding: [0, tokens.space.lg],
    borderBottom: `1px solid ${tokens.color.border}`,
    background: tokens.color.bgCard,
    '& .MuiTabs-root': { minHeight: 42 },
    '& .MuiTabs-flexContainer': { gap: tokens.space.xs },
    '& .MuiTab-root': {
      minHeight: 42,
      minWidth: 0,
      padding: [tokens.space.sm, tokens.space.md],
      color: tokens.color.textMuted,
      fontSize: tokens.font.sizeSm,
      textTransform: 'none',
    },
    '& .Mui-selected': { color: `${tokens.color.text} !important` },
    '& .MuiTabs-indicator': { height: 2, borderRadius: [2, 2, 0, 0], background: tokens.color.accent },
  },
  drawerPanel: { display: 'grid', gap: tokens.space.md },
  drawerSection: { display: 'grid', gap: tokens.space.md },
  drawerSectionHead: { display: 'flex', alignItems: 'center', gap: tokens.space.xs },
  drawerSectionTitle: { margin: 0, fontSize: tokens.font.sizeMd },
  infoButton: { color: `${tokens.color.textMuted} !important` },
  drawerSchedule: { display: 'grid', gap: tokens.space.sm, marginTop: tokens.space.lg },
  drawerScheduleTitle: { margin: 0, fontSize: tokens.font.sizeSm },
  drawerRow: {
    display: 'grid',
    gridTemplateColumns: '110px minmax(0, 1fr) auto',
    alignItems: 'center',
    gap: tokens.space.sm,
    padding: tokens.space.sm,
    border: `1px solid ${tokens.color.border}`,
    borderRadius: tokens.radius.sm,
  },
  drawerRowSummary: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.space.sm,
    minWidth: 0,
    overflow: 'hidden',
    color: tokens.color.textMuted,
    fontSize: tokens.font.sizeXs,
    whiteSpace: 'nowrap',
    '& > span': { display: 'inline-flex', gap: tokens.space.xs },
  },
  moreButton: {
    width: `${tokens.control.iconButtonSize}px !important`,
    height: `${tokens.control.iconButtonSize}px !important`,
  },
  deleteMenuItem: { color: `${tokens.color.danger} !important` },
})

export function ForecastScheduleEditor({
  adjustments,
  onChange,
  drawerOpen,
  onDrawerOpenChange,
  drawerContentBefore,
  drawerPlans,
  drawerAssumptionsAction,
  drawerPlansAction,
  activeSection,
  onActiveSectionChange,
}: {
  adjustments: ForecastAdjustment[]
  onChange: (next: ForecastAdjustment[]) => Promise<void>
  drawerOpen: boolean
  onDrawerOpenChange: (open: boolean) => void
  drawerContentBefore?: ReactNode
  drawerPlans?: ReactNode
  drawerAssumptionsAction?: ReactNode
  drawerPlansAction?: ReactNode
  activeSection: PlannerSection
  onActiveSectionChange: (section: PlannerSection) => void
}) {
  const classes = useStyles()
  const [draft, setDraft] = useState<Draft>(blankDraft)
  const [editingMonth, setEditingMonth] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [pendingRemoveMonth, setPendingRemoveMonth] = useState<string | null>(null)
  const [changeMenuAnchor, setChangeMenuAnchor] = useState<HTMLElement | null>(null)
  const [menuAdjustment, setMenuAdjustment] = useState<ForecastAdjustment | null>(null)
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

  const closeDrawer = () => {
    setDraft(blankDraft())
    setEditingMonth(null)
    setError('')
    setChangeMenuAnchor(null)
    setMenuAdjustment(null)
    onDrawerOpenChange(false)
  }

  return (
    <section className={classes.root}>
      <div className={classes.heading}>
        <h3 className={classes.title}>Future monthly changes</h3>
        <ForecastInfoTip className={classes.infoButton} label="Scheduled changes are applied from their effective month onward." />
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
          onClose={closeDrawer}
          cancelDisabled={saving}
          wide
          footer={
            activeSection === 'assumptions' ? (
              drawerAssumptionsAction
            ) : activeSection === 'plans' ? (
              drawerPlansAction
            ) : (
              <Button type="submit" form="forecast-change-form" variant="primary" disabled={saving}>
                {saving ? 'Saving' : editingMonth ? 'Update change' : 'Add change'}
              </Button>
            )
          }
        >
          <div className={classes.drawerLayout}>
            <div className={classes.drawerTabs}>
              <Tabs
                value={activeSection}
                onChange={(_event, section: PlannerSection) => onActiveSectionChange(section)}
                variant="fullWidth"
                aria-label="Wealth planner settings"
              >
                <Tab value="assumptions" label="Assumptions" />
                <Tab value="plans" label="Plans" />
                <Tab value="changes" label="Monthly changes" />
              </Tabs>
            </div>
            {activeSection === 'assumptions' ? (
              <div className={classes.drawerPanel} role="tabpanel">
                {drawerContentBefore}
              </div>
            ) : null}
            {activeSection === 'plans' ? (
              <div className={classes.drawerPanel} role="tabpanel">
                {drawerPlans}
              </div>
            ) : null}
            {activeSection === 'changes' ? (
              <section className={classes.drawerSection} role="tabpanel">
                <div className={classes.drawerSectionHead}>
                  <h3 className={classes.drawerSectionTitle}>Schedule a monthly change</h3>
                  <ForecastInfoTip
                    className={classes.infoButton}
                    label="Blank fields keep their previous value. Enter 0 to stop a cost or SIP from the effective month."
                  />
                </div>
                <form id="forecast-change-form" className={classes.form} onSubmit={save}>
                  <div className={classes.fieldGrid}>
                    <Field label="Effective month" className={`${classes.field} ${classes.effectiveMonthField}`}>
                      <MonthPicker
                        value={draft.effectiveMonth}
                        onChange={(effectiveMonth) => setDraft((current) => ({ ...current, effectiveMonth }))}
                      />
                    </Field>
                    <Field label="Salary / month" className={classes.field}>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={draft.salary}
                        onChange={(event) => setDraft((current) => ({ ...current, salary: event.target.value }))}
                      />
                    </Field>
                    <Field label="Living cost / month" className={classes.field}>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={draft.livingCost}
                        onChange={(event) => setDraft((current) => ({ ...current, livingCost: event.target.value }))}
                      />
                    </Field>
                    <Field label="MF SIP / month" className={classes.field}>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={draft.mutualFundSip}
                        onChange={(event) => setDraft((current) => ({ ...current, mutualFundSip: event.target.value }))}
                      />
                    </Field>
                    <Field label="Stock SIP / month" className={classes.field}>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={draft.stockSip}
                        onChange={(event) => setDraft((current) => ({ ...current, stockSip: event.target.value }))}
                      />
                    </Field>
                  </div>
                </form>
                <ErrorText>{error}</ErrorText>
                {sorted.length ? (
                  <section className={classes.drawerSchedule}>
                    <h4 className={classes.drawerScheduleTitle}>Scheduled changes</h4>
                    {sorted.map((adjustment) => (
                      <div className={classes.drawerRow} key={adjustment.effectiveMonth}>
                        <strong>{formatMonthLabel(adjustment.effectiveMonth)}</strong>
                        <span className={classes.drawerRowSummary}>
                          {adjustment.salaryMinor !== undefined ? (
                            <span>
                              Salary <MoneyText amountMinor={adjustment.salaryMinor} />
                            </span>
                          ) : null}
                          {adjustment.livingCostMinor !== undefined ? (
                            <span>
                              Living <MoneyText amountMinor={adjustment.livingCostMinor} />
                            </span>
                          ) : null}
                          {adjustment.mutualFundSipMinor !== undefined ? (
                            <span>
                              MF SIP <MoneyText amountMinor={adjustment.mutualFundSipMinor} />
                            </span>
                          ) : null}
                          {adjustment.stockSipMinor !== undefined ? (
                            <span>
                              Stock SIP <MoneyText amountMinor={adjustment.stockSipMinor} />
                            </span>
                          ) : null}
                        </span>
                        <IconButton
                          className={classes.moreButton}
                          disabled={saving}
                          aria-label={`Actions for ${formatMonthLabel(adjustment.effectiveMonth)}`}
                          onClick={(event) => {
                            setMenuAdjustment(adjustment)
                            setChangeMenuAnchor(event.currentTarget)
                          }}
                        >
                          <MoreVertIcon />
                        </IconButton>
                      </div>
                    ))}
                    <Menu anchorEl={changeMenuAnchor} open={Boolean(changeMenuAnchor)} onClose={() => setChangeMenuAnchor(null)}>
                      <MenuItem
                        onClick={() => {
                          if (menuAdjustment) edit(menuAdjustment)
                          setChangeMenuAnchor(null)
                        }}
                      >
                        <EditIcon fontSize="small" /> Edit
                      </MenuItem>
                      <MenuItem
                        className={classes.deleteMenuItem}
                        onClick={() => {
                          if (menuAdjustment) setPendingRemoveMonth(menuAdjustment.effectiveMonth)
                          setChangeMenuAnchor(null)
                        }}
                      >
                        <DeleteIcon fontSize="small" /> Delete
                      </MenuItem>
                    </Menu>
                  </section>
                ) : null}
              </section>
            ) : null}
          </div>
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
