import { useMemo, useState, useTransition } from 'react'
import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
import DeleteIcon from '@mui/icons-material/Delete'
import RestoreIcon from '@mui/icons-material/Restore'
import EditIcon from '@mui/icons-material/Edit'
import { Chip, Tooltip as MuiTooltip } from '@mui/material'
import { createUseStyles } from 'react-jss'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { buildWealthProjection, SpendLookback } from '@/calc/forecast'
import { normalizeForecastAdjustments } from '@/calc/forecastAdjustments'
import { FilterStatus } from '@/components/FilterStatus'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Button, ErrorText, Field, Input, MoneyText, Select } from '@/components/ui'
import { formatMonthLabel, toMinor, todayIso } from '@/domain/money'
import { ForecastAdjustment, ForecastSettings, PlannedExpense, PlannedExpenseCategory, StoreData } from '@/domain/types'
import { addMonths } from '@/domain/sip'
import { ForecastInfoTip } from '@/dashboard/ForecastInfoTip'
import { ForecastHorizonPicker } from '@/dashboard/ForecastHorizonPicker'
import { ForecastChartTooltip } from '@/dashboard/ForecastChartTooltip'
import { ForecastPercentInput } from '@/dashboard/ForecastPercentInput'
import { ForecastScheduleEditor } from '@/dashboard/ForecastScheduleEditor'
import { deletePlannedExpense, upsertForecastSettings, upsertPlannedExpense } from '@/storage/repository'
import { tokens } from '@/theme/tokens'
import { formatPrivateMoney, formatPrivateNumber, usePrivacy } from '@/privacy/privacy'

const useStyles = createUseStyles({
  root: { display: 'grid', gap: tokens.space.lg },
  toolbar: { display: 'flex', alignItems: 'end', justifyContent: 'space-between', gap: tokens.space.md, flexWrap: 'wrap' },
  toolbarGroup: { display: 'flex', alignItems: 'end', gap: tokens.space.sm, flexWrap: 'wrap' },
  controlLabel: { display: 'grid', gap: tokens.space.xs, color: tokens.color.textMuted, fontSize: tokens.font.sizeXs },
  assumptions: {
    display: 'grid',
    gap: tokens.space.sm,
    paddingBottom: tokens.space.md,
  },
  assumptionsHead: {
    display: 'flex',
    alignItems: 'start',
    justifyContent: 'space-between',
    gap: tokens.space.md,
    '& p': { margin: [tokens.space.xs, 0, 0], color: tokens.color.textMuted, fontSize: tokens.font.sizeXs },
  },
  assumptionsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: tokens.space.sm,
  },
  assumptionField: { minWidth: 0 },
  assumptionsFooter: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: tokens.space.sm },
  selectWrap: { width: '100%' },
  rateInput: {
    boxSizing: 'border-box',
    width: '100%',
    minHeight: 38,
    border: `1px solid ${tokens.color.borderStrong}`,
    borderRadius: tokens.radius.sm,
    padding: [tokens.space.sm, 28, tokens.space.sm, tokens.space.md],
    background: tokens.color.bgMuted,
    color: tokens.color.text,
    font: 'inherit',
    fontSize: tokens.font.sizeSm,
    outline: 0,
    '&:focus': { borderColor: tokens.color.accent },
  },
  rateWrap: { position: 'relative', width: '100%' },
  rateSuffix: {
    position: 'absolute',
    right: 10,
    top: '50%',
    transform: 'translateY(-50%)',
    color: tokens.color.textMuted,
    pointerEvents: 'none',
    fontSize: tokens.font.sizeSm,
  },
  monthInput: {
    boxSizing: 'border-box',
    width: '100%',
    minHeight: 38,
    border: `1px solid ${tokens.color.borderStrong}`,
    borderRadius: tokens.radius.sm,
    padding: [tokens.space.sm, tokens.space.md],
    background: tokens.color.bgMuted,
    color: tokens.color.text,
    colorScheme: 'dark',
    font: 'inherit',
    fontSize: tokens.font.sizeSm,
    outline: 0,
    '&:focus': { borderColor: tokens.color.accent },
  },
  plans: { display: 'grid', gap: tokens.space.sm },
  plansHead: { display: 'flex', alignItems: 'center', gap: tokens.space.xs, color: tokens.color.textMuted, fontSize: tokens.font.sizeSm },
  chipRow: { display: 'flex', alignItems: 'center', gap: tokens.space.sm, flexWrap: 'wrap' },
  chip: {
    maxWidth: '100%',
    color: `${tokens.color.text} !important`,
    background: `${tokens.color.accentSoft} !important`,
    border: `1px solid ${tokens.color.borderStrong} !important`,
    borderRadius: `${tokens.radius.sm}px !important`,
    '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' },
    '& .MuiChip-deleteIcon': { color: `${tokens.color.textMuted} !important` },
  },
  emptyPlans: { color: tokens.color.textMuted, fontSize: tokens.font.sizeSm },
  restore: { display: 'flex', alignItems: 'end', gap: tokens.space.sm, flexWrap: 'wrap' },
  restoreSelect: { width: 240, maxWidth: '100%' },
  summaryBand: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    background: tokens.color.bgMuted,
    borderTop: `1px solid ${tokens.color.border}`,
    borderBottom: `1px solid ${tokens.color.border}`,
    '@media (max-width: 900px)': { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
    '@media (max-width: 520px)': { gridTemplateColumns: '1fr' },
  },
  summaryMetric: {
    minWidth: 0,
    padding: tokens.space.md,
    display: 'grid',
    gap: tokens.space.xs,
    borderRight: `1px solid ${tokens.color.border}`,
  },
  summaryLabel: { display: 'flex', alignItems: 'center', gap: 2, color: tokens.color.textMuted, fontSize: tokens.font.sizeXs },
  summaryValue: { fontSize: 19, fontWeight: tokens.font.weightMedium, '& span': { fontSize: 19 } },
  breakdown: { display: 'flex', flexWrap: 'wrap', gap: tokens.space.lg, color: tokens.color.textMuted, fontSize: tokens.font.sizeSm },
  infoButton: { color: `${tokens.color.textMuted} !important`, padding: '2px !important', '& svg': { fontSize: 15 } },
  frame: { height: 390, minWidth: 0, '@media (max-width: 720px)': { height: 330 } },
  detailsButton: { justifySelf: 'start' },
  wrap: { overflowX: 'auto', maxHeight: 440, overflowY: 'auto' },
  table: { width: '100%', minWidth: 1000, borderCollapse: 'collapse', fontSize: tokens.font.sizeSm },
  cell: {
    borderBottom: `1px solid ${tokens.color.border}`,
    padding: [tokens.space.sm, tokens.space.sm],
    textAlign: 'right',
    whiteSpace: 'nowrap',
  },
  headerCell: { position: 'sticky', top: 0, zIndex: 1, background: tokens.color.bgMuted, color: tokens.color.textMuted },
  left: { textAlign: 'left' },
  drawerSection: { display: 'grid', gap: tokens.space.sm, paddingBottom: tokens.space.md },
  drawerSectionBorder: { paddingTop: tokens.space.md, borderTop: `1px solid ${tokens.color.border}` },
  drawerSectionHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: tokens.space.sm },
  drawerSectionTitle: { margin: 0, fontSize: tokens.font.sizeMd },
  form: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: tokens.space.sm },
  formActions: { gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: tokens.space.xs },
  saveStatus: { color: tokens.color.positive, fontSize: tokens.font.sizeXs, alignSelf: 'center' },
})

const categoryLabels: Record<PlannedExpenseCategory, string> = {
  phone: 'Mobile phone',
  trip: 'Trip',
  bike: 'Bike',
  other: 'Other',
}

type PlanDraft = { name: string; amount: string; date: string; category: PlannedExpenseCategory }

function blankPlan(): PlanDraft {
  return { name: '', amount: '', date: `${addMonths(todayIso().slice(0, 7), 1)}-01`, category: 'other' }
}

function horizonLabel(months: number) {
  if (months === 12) return 'after 1 year'
  if (months % 12 === 0) return `after ${months / 12} years`
  return `after ${months} months`
}

function planDate(date: string) {
  return formatMonthLabel(date)
}

export function ForecastPanel({ data, onSaved = async () => {} }: { data: StoreData; onSaved?: () => Promise<void> }) {
  const classes = useStyles()
  const { masked } = usePrivacy()
  const privateMoney = (amountMinor: number) => formatPrivateMoney(amountMinor, 'INR', false, masked)
  const savedSettings = data.forecastSettings
  const [months, setMonths] = useState(savedSettings?.months ?? 12)
  const [spendLookback, setSpendLookback] = useState<SpendLookback>(savedSettings?.spendLookback ?? 6)
  const [mutualFundReturn, setMutualFundReturn] = useState(savedSettings?.mutualFundAnnualReturnPct ?? 10)
  const [stockReturn, setStockReturn] = useState(savedSettings?.stockAnnualReturnPct ?? 8)
  const [salaryGrowth, setSalaryGrowth] = useState(savedSettings?.salaryAnnualGrowthPct ?? 0)
  const [firstSalaryGrowthMonth, setFirstSalaryGrowthMonth] = useState(
    () => savedSettings?.salaryGrowthStartMonth ?? addMonths(todayIso().slice(0, 7), 12),
  )
  const [adjustments, setAdjustments] = useState<ForecastAdjustment[]>(() => normalizeForecastAdjustments(savedSettings?.adjustments))
  const [plannerDrawerOpen, setPlannerDrawerOpen] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [drawerId, setDrawerId] = useState<string | null | undefined>(undefined)
  const [draft, setDraft] = useState<PlanDraft>(blankPlan)
  const [formError, setFormError] = useState('')
  const [restoreId, setRestoreId] = useState('')
  const [hiddenPlanIds, setHiddenPlanIds] = useState<string[]>([])
  const [actionError, setActionError] = useState('')
  const [pendingPlanAction, setPendingPlanAction] = useState<{ plan: PlannedExpense; kind: 'exclude' | 'delete' } | null>(null)
  const [settingsSaved, setSettingsSaved] = useState(Boolean(savedSettings))
  const [isPending, startTransition] = useTransition()
  const today = todayIso()
  const activePlans = useMemo(
    () =>
      (data.plannedExpenses ?? [])
        .filter((plan) => plan.active && !hiddenPlanIds.includes(plan.id))
        .sort((a, b) => a.date.localeCompare(b.date)),
    [data.plannedExpenses, hiddenPlanIds],
  )
  const excludedPlans = useMemo(
    () => (data.plannedExpenses ?? []).filter((plan) => !plan.active).sort((a, b) => a.date.localeCompare(b.date)),
    [data.plannedExpenses],
  )
  const projection = useMemo(
    () =>
      buildWealthProjection(data, today, {
        months,
        spendLookback,
        mutualFundAnnualReturnPct: mutualFundReturn,
        stockAnnualReturnPct: stockReturn,
        salaryAnnualGrowthPct: salaryGrowth,
        salaryGrowthStartMonth: firstSalaryGrowthMonth,
        adjustments,
      }),
    [adjustments, data, firstSalaryGrowthMonth, months, mutualFundReturn, salaryGrowth, spendLookback, stockReturn, today],
  )
  const end = projection.points.at(-1)
  const horizonEndMonth = addMonths(today.slice(0, 7), months)
  const monthlySip = projection.monthlyMutualFundSipMinor + projection.monthlyStockSipMinor
  const projectedIncrease = (end?.netWorthMinor ?? projection.currentNetWorthMinor) - projection.currentNetWorthMinor
  const livingExpenses = projection.points.reduce((sum, point) => sum + point.livingSpendMinor, 0)
  const plannedExpenses = end?.cumulativePlannedExpenseMinor ?? 0
  const rows = [
    {
      month: 'Today',
      'Net worth': Math.round(projection.currentNetWorthMinor / 100),
      'Net worth change': 0,
      'Available bank': Math.round(projection.currentBankMinor / 100),
      'Mutual funds': Math.round(projection.currentMutualFundsMinor / 100),
      Stocks: Math.round(projection.currentStocksMinor / 100),
      'Total investments': Math.round((projection.currentMutualFundsMinor + projection.currentStocksMinor) / 100),
      'Reserved savings': Math.round(projection.reservedSavingsMinor / 100),
      Liabilities: Math.round(projection.liabilityMinor / 100),
    },
    ...projection.points.map((point) => ({
      month: formatMonthLabel(point.month),
      'Net worth': Math.round(point.netWorthMinor / 100),
      'Net worth change': Math.round((point.netWorthMinor - projection.currentNetWorthMinor) / 100),
      'Available bank': Math.round(point.bankMinor / 100),
      'Mutual funds': Math.round(point.mutualFundsMinor / 100),
      Stocks: Math.round(point.stocksMinor / 100),
      'Total investments': Math.round((point.mutualFundsMinor + point.stocksMinor) / 100),
      'Reserved savings': Math.round(projection.reservedSavingsMinor / 100),
      Liabilities: Math.round(projection.liabilityMinor / 100),
    })),
  ]

  const openNewPlan = () => {
    setDraft(blankPlan())
    setFormError('')
    setDrawerId(null)
    setPlannerDrawerOpen(true)
  }

  const openPlan = (plan: PlannedExpense) => {
    setDraft({ name: plan.name, amount: String(plan.amountMinor / 100), date: plan.date, category: plan.category })
    setFormError('')
    setDrawerId(plan.id)
    setPlannerDrawerOpen(true)
  }

  const savePlan = async () => {
    const amountMinor = toMinor(draft.amount || 0)
    if (!draft.name.trim()) return setFormError('Plan name is required.')
    if (amountMinor <= 0) return setFormError('Amount must be greater than 0.')
    if (!draft.date) return setFormError('Purchase date is required.')
    const existing = drawerId ? (data.plannedExpenses ?? []).find((plan) => plan.id === drawerId) : undefined
    await upsertPlannedExpense({
      id: drawerId ?? crypto.randomUUID(),
      name: draft.name.trim(),
      amountMinor,
      date: draft.date,
      category: draft.category,
      active: existing?.active ?? true,
      origin: 'user',
    })
    setDrawerId(undefined)
    setDraft(blankPlan())
    await onSaved()
  }

  const setPlanActive = async (plan: PlannedExpense, active: boolean) => {
    await upsertPlannedExpense({ ...plan, active })
    await onSaved()
  }

  const excludePlan = async (plan: PlannedExpense) => {
    setActionError('')
    setHiddenPlanIds((current) => [...current, plan.id])
    try {
      await setPlanActive(plan, false)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not exclude this plan.')
    } finally {
      setHiddenPlanIds((current) => current.filter((id) => id !== plan.id))
    }
  }

  const confirmPlanAction = async () => {
    if (!pendingPlanAction) return
    const { plan, kind } = pendingPlanAction
    if (kind === 'exclude') await excludePlan(plan)
    else {
      await deletePlannedExpense(plan.id)
      setDrawerId(undefined)
      await onSaved()
    }
    setPendingPlanAction(null)
  }

  const saveSettings = async (overrides: Partial<ForecastSettings> = {}) => {
    setActionError('')
    setSettingsSaved(false)
    const settings: ForecastSettings = {
      id: 'default',
      months,
      spendLookback,
      mutualFundAnnualReturnPct: mutualFundReturn,
      stockAnnualReturnPct: stockReturn,
      salaryAnnualGrowthPct: salaryGrowth,
      salaryGrowthStartMonth: firstSalaryGrowthMonth,
      adjustments,
      updatedAt: new Date().toISOString(),
      ...overrides,
    }
    try {
      await upsertForecastSettings(settings)
      setSettingsSaved(true)
      await onSaved()
      return true
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not save forecast assumptions.')
      return false
    }
  }

  const saveAdjustments = async (next: ForecastAdjustment[]) => {
    const previous = adjustments
    setAdjustments(next)
    const saved = await saveSettings({ adjustments: next })
    if (!saved) {
      setAdjustments(previous)
      throw new Error('Could not save forecast changes.')
    }
  }

  const restorePlan = async () => {
    const plan = excludedPlans.find((item) => item.id === restoreId)
    if (!plan) return
    await setPlanActive(plan, true)
    setRestoreId('')
  }

  return (
    <div className={classes.root}>
      <div className={classes.toolbar}>
        <div className={classes.toolbarGroup}>
          <FilterStatus fetching={isPending} ready={!isPending} />
          <label className={classes.controlLabel}>
            Time horizon
            <ForecastHorizonPicker
              baseMonth={today.slice(0, 7)}
              months={months}
              onChange={(next) => {
                startTransition(() => setMonths(next))
                void saveSettings({ months: next })
              }}
            />
          </label>
        </div>
        <div className={classes.toolbarGroup}>
          <Button variant="primary" onClick={() => setPlannerDrawerOpen(true)} aria-expanded={plannerDrawerOpen}>
            <EditIcon fontSize="small" /> Manage planner
          </Button>
        </div>
      </div>

      <ForecastScheduleEditor
        adjustments={adjustments}
        onChange={saveAdjustments}
        drawerOpen={plannerDrawerOpen}
        onDrawerOpenChange={(open) => {
          setPlannerDrawerOpen(open)
          if (!open) {
            setDrawerId(undefined)
            setDraft(blankPlan())
            setFormError('')
          }
        }}
        drawerContentBefore={
          <>
            <section className={classes.assumptions}>
              <div className={classes.assumptionsHead}>
                <strong>Assumptions</strong>
                <ForecastInfoTip
                  className={classes.infoButton}
                  label="Living costs repeat from your selected history. Returns compound monthly and salary raises repeat yearly."
                />
              </div>
              <div className={classes.assumptionsGrid}>
                <label className={`${classes.controlLabel} ${classes.assumptionField}`}>
                  Spending history
                  <span className={classes.selectWrap}>
                    <Select
                      value={String(spendLookback)}
                      onChange={(event) => {
                        setSettingsSaved(false)
                        startTransition(() =>
                          setSpendLookback(event.target.value === 'all' ? 'all' : (Number(event.target.value) as SpendLookback)),
                        )
                      }}
                    >
                      <option value="3">Last 3 months</option>
                      <option value="6">Last 6 months</option>
                      <option value="12">Last 1 year</option>
                      <option value="all">All data</option>
                    </Select>
                  </span>
                </label>
                <label className={`${classes.controlLabel} ${classes.assumptionField}`}>
                  Mutual fund return
                  <ForecastPercentInput
                    classNames={{ wrap: classes.rateWrap, input: classes.rateInput, suffix: classes.rateSuffix }}
                    value={mutualFundReturn}
                    onChange={(value) => {
                      setMutualFundReturn(value)
                      setSettingsSaved(false)
                    }}
                  />
                </label>
                <label className={`${classes.controlLabel} ${classes.assumptionField}`}>
                  Stock return
                  <ForecastPercentInput
                    classNames={{ wrap: classes.rateWrap, input: classes.rateInput, suffix: classes.rateSuffix }}
                    value={stockReturn}
                    onChange={(value) => {
                      setStockReturn(value)
                      setSettingsSaved(false)
                    }}
                  />
                </label>
                <label className={`${classes.controlLabel} ${classes.assumptionField}`}>
                  Salary increase / year
                  <ForecastPercentInput
                    classNames={{ wrap: classes.rateWrap, input: classes.rateInput, suffix: classes.rateSuffix }}
                    value={salaryGrowth}
                    onChange={(value) => {
                      setSalaryGrowth(value)
                      setSettingsSaved(false)
                    }}
                  />
                </label>
                <label className={`${classes.controlLabel} ${classes.assumptionField}`}>
                  First salary increase
                  <input
                    className={classes.monthInput}
                    type="month"
                    value={firstSalaryGrowthMonth}
                    onChange={(event) => {
                      setFirstSalaryGrowthMonth(event.target.value)
                      setSettingsSaved(false)
                    }}
                  />
                </label>
              </div>
              <div className={classes.assumptionsFooter}>
                <span className={classes.saveStatus}>{settingsSaved ? 'Saved' : 'Unsaved'}</span>
                <Button variant="primary" disabled={settingsSaved} onClick={() => saveSettings()}>
                  Save assumptions
                </Button>
              </div>
            </section>
            <section className={`${classes.drawerSection} ${classes.drawerSectionBorder}`}>
              <div className={classes.drawerSectionHead}>
                <h3 className={classes.drawerSectionTitle}>{drawerId ? 'Edit plan' : 'Planned purchase'}</h3>
                {drawerId ? (
                  <Button type="button" onClick={openNewPlan}>
                    <AddIcon fontSize="small" /> New
                  </Button>
                ) : null}
              </div>
              <div className={classes.form}>
                <Field label="Plan">
                  <Input
                    value={draft.name}
                    placeholder="Phone, trip, bike..."
                    onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                  />
                </Field>
                <Field label="Amount (INR)">
                  <Input
                    type="number"
                    min="1"
                    value={draft.amount}
                    onChange={(event) => setDraft((current) => ({ ...current, amount: event.target.value }))}
                  />
                </Field>
                <Field label="Purchase date">
                  <Input
                    type="date"
                    min={today}
                    value={draft.date}
                    onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))}
                  />
                </Field>
                <Field label="Type">
                  <Select
                    value={draft.category}
                    onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value as PlannedExpenseCategory }))}
                  >
                    {Object.entries(categoryLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <ErrorText>{formError}</ErrorText>
                <span className={classes.formActions}>
                  {drawerId ? (
                    <Button
                      variant="danger"
                      onClick={() => {
                        const plan = (data.plannedExpenses ?? []).find((item) => item.id === drawerId)
                        if (plan) setPendingPlanAction({ plan, kind: 'delete' })
                      }}
                    >
                      <DeleteIcon fontSize="small" /> Delete
                    </Button>
                  ) : null}
                  <Button variant="primary" onClick={savePlan}>
                    {drawerId ? 'Update plan' : 'Add plan'}
                  </Button>
                </span>
              </div>
            </section>
          </>
        }
      />

      <div className={classes.plans}>
        <div className={classes.plansHead}>
          Upcoming plans{' '}
          <ForecastInfoTip
            className={classes.infoButton}
            label="Active plans reduce your bank balance once, in their scheduled month. Select a chip to edit it or use its cross to exclude it from the forecast."
          />
        </div>
        <div className={classes.chipRow}>
          {activePlans.length ? (
            activePlans.map((plan) => {
              const status =
                plan.date < today
                  ? 'This date has passed, so it is not included.'
                  : plan.date.slice(0, 7) > horizonEndMonth
                    ? 'This plan is beyond the selected horizon.'
                    : 'Included in this forecast.'
              return (
                <MuiTooltip key={plan.id} title={status} arrow>
                  <Chip
                    className={classes.chip}
                    label={`${plan.name} | ${privateMoney(plan.amountMinor)} | ${planDate(plan.date)}`}
                    onClick={() => openPlan(plan)}
                    deleteIcon={<CloseIcon />}
                    onDelete={(event) => {
                      event.stopPropagation()
                      setPendingPlanAction({ plan, kind: 'exclude' })
                    }}
                  />
                </MuiTooltip>
              )
            })
          ) : (
            <span className={classes.emptyPlans}>No purchases planned yet.</span>
          )}
        </div>
        {excludedPlans.length ? (
          <div className={classes.restore}>
            <label className={classes.controlLabel}>
              Excluded plans
              <span className={classes.restoreSelect}>
                <Select value={restoreId} onChange={(event) => setRestoreId(event.target.value)}>
                  <option value="">Choose a plan</option>
                  {excludedPlans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} | {privateMoney(plan.amountMinor)}
                    </option>
                  ))}
                </Select>
              </span>
            </label>
            <Button disabled={!restoreId} onClick={restorePlan}>
              <RestoreIcon fontSize="small" /> Restore
            </Button>
          </div>
        ) : null}
        <ErrorText>{actionError}</ErrorText>
      </div>

      <div className={classes.summaryBand}>
        <div className={classes.summaryMetric}>
          <span className={classes.summaryLabel}>Net worth today</span>
          <span className={classes.summaryValue}>
            <MoneyText amountMinor={projection.currentNetWorthMinor} tone="positive" />
          </span>
        </div>
        <div className={classes.summaryMetric}>
          <span className={classes.summaryLabel}>
            Projected {horizonLabel(months)}{' '}
            <ForecastInfoTip
              className={classes.infoButton}
              label="Projected available bank, reserved savings, mutual funds, and stocks minus liabilities at the end of this period."
            />
          </span>
          <span className={classes.summaryValue}>
            <MoneyText amountMinor={end?.netWorthMinor ?? projection.currentNetWorthMinor} tone="positive" />
          </span>
        </div>
        <div className={classes.summaryMetric}>
          <span className={classes.summaryLabel}>Net worth change</span>
          <span className={classes.summaryValue}>
            <MoneyText amountMinor={projectedIncrease} tone="auto" />
          </span>
        </div>
        <div className={classes.summaryMetric}>
          <span className={classes.summaryLabel}>
            Total expenses{' '}
            <ForecastInfoTip
              className={classes.infoButton}
              label="Your estimated repeating living costs plus active one-time plans inside this forecast."
            />
          </span>
          <span className={classes.summaryValue}>
            <MoneyText amountMinor={livingExpenses + plannedExpenses} tone="negative" />
          </span>
        </div>
      </div>

      <div className={classes.breakdown}>
        <span>Living costs: {privateMoney(livingExpenses)}</span>
        <span>Planned purchases: {privateMoney(plannedExpenses)}</span>
        <span>Available bank now: {privateMoney(projection.currentBankMinor)}</span>
        <span>Reserved savings: {privateMoney(projection.reservedSavingsMinor)}</span>
        <span>SIP invested: {privateMoney(end?.cumulativeSipMinor ?? 0)}</span>
        <span>Estimated market growth: {privateMoney(end?.cumulativeGrowthMinor ?? 0)}</span>
        <span>Income this period: {privateMoney(projection.points[0]?.incomeMinor ?? 0)}</span>
        <span>Monthly SIP: {privateMoney(monthlySip)}</span>
      </div>

      <div className={classes.frame}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows}>
            <CartesianGrid stroke={tokens.color.border} vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis tickLine={false} axisLine={false} width={88} tickFormatter={(value) => formatPrivateNumber(Number(value), masked)} />
            <Tooltip content={<ForecastChartTooltip />} cursor={{ stroke: tokens.color.borderStrong, strokeDasharray: '4 4' }} />
            <Legend />
            <Line dataKey="Net worth" stroke={tokens.color.accent} dot={false} strokeWidth={3} />
            <Line dataKey="Available bank" stroke={tokens.color.neutral} dot={false} strokeWidth={2} />
            <Line dataKey="Mutual funds" stroke={tokens.color.positive} dot={false} strokeWidth={2} />
            <Line dataKey="Stocks" stroke={tokens.color.rose} dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <Button className={classes.detailsButton} onClick={() => setShowDetails((current) => !current)}>
        {showDetails ? 'Hide monthly details' : 'Show monthly details'}
      </Button>
      {showDetails ? (
        <div className={classes.wrap}>
          <table className={classes.table}>
            <thead>
              <tr>
                <th className={`${classes.cell} ${classes.headerCell} ${classes.left}`}>Month</th>
                <th className={`${classes.cell} ${classes.headerCell}`}>Income</th>
                <th className={`${classes.cell} ${classes.headerCell}`}>Living cost</th>
                <th className={`${classes.cell} ${classes.headerCell}`}>Planned expense</th>
                <th className={`${classes.cell} ${classes.headerCell}`}>MF SIP</th>
                <th className={`${classes.cell} ${classes.headerCell}`}>Stock SIP</th>
                <th className={`${classes.cell} ${classes.headerCell}`}>Growth</th>
                <th className={`${classes.cell} ${classes.headerCell}`}>Available bank</th>
                <th className={`${classes.cell} ${classes.headerCell}`}>Investments</th>
                <th className={`${classes.cell} ${classes.headerCell}`}>Net worth</th>
              </tr>
            </thead>
            <tbody>
              {projection.points.map((point) => (
                <tr key={point.month}>
                  <td className={`${classes.cell} ${classes.left}`}>{formatMonthLabel(point.month)}</td>
                  <td className={classes.cell}>
                    <MoneyText amountMinor={point.incomeMinor} tone="positive" />
                  </td>
                  <td className={classes.cell}>
                    <MoneyText amountMinor={point.livingSpendMinor} tone="negative" />
                  </td>
                  <td className={classes.cell}>
                    <MoneyText amountMinor={point.plannedExpenseMinor} tone={point.plannedExpenseMinor ? 'negative' : 'steady'} />
                  </td>
                  <td className={classes.cell}>
                    <MoneyText amountMinor={point.mutualFundSipMinor} tone="steady" />
                  </td>
                  <td className={classes.cell}>
                    <MoneyText amountMinor={point.stockSipMinor} tone="steady" />
                  </td>
                  <td className={classes.cell}>
                    <MoneyText amountMinor={point.growthThisMonthMinor} tone="auto" />
                  </td>
                  <td className={classes.cell}>
                    <MoneyText amountMinor={point.bankMinor} tone="steady" />
                  </td>
                  <td className={classes.cell}>
                    <MoneyText amountMinor={point.mutualFundsMinor + point.stocksMinor} tone="positive" />
                  </td>
                  <td className={classes.cell}>
                    <MoneyText amountMinor={point.netWorthMinor} tone="positive" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(pendingPlanAction)}
        title={pendingPlanAction?.kind === 'delete' ? 'Delete this plan?' : 'Exclude this plan?'}
        message={
          pendingPlanAction?.kind === 'delete'
            ? 'This permanently deletes the planned expense.'
            : 'The plan will be removed from the forecast. You can restore it later from Excluded plans.'
        }
        confirmLabel={pendingPlanAction?.kind === 'delete' ? 'Delete plan' : 'Exclude plan'}
        onCancel={() => setPendingPlanAction(null)}
        onConfirm={() => void confirmPlanAction()}
      />
    </div>
  )
}
