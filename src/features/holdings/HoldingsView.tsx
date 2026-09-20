import { useState } from 'react'
import { createUseStyles } from 'react-jss'
import { useForm } from 'react-hook-form'
import { ToggleButton, ToggleButtonGroup } from '@mui/material'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { PaginationBar } from '@/components/PaginationBar'
import { Button, Card, Drawer, ErrorText, Field, Input, MoneyText, Row, Select } from '@/components/ui'
import { formatDateLabel, formatMonthLabel, toMinor, todayIso } from '@/domain/money'
import { currentMonth, dateOnDay, holdingDate, monthsInclusive, sipEventId } from '@/domain/sip'
import { Holding, HoldingKind, PurchaseMode, SipStatus, StoreData } from '@/domain/types'
import { refreshInvestmentSnapshots } from '@/features/holdings/refreshSnapshots'
import { deleteHolding, upsertHolding, upsertSipEvent } from '@/storage/repository'
import { tokens } from '@/theme/tokens'

const useStyles = createUseStyles({
  page: { display: 'grid', gap: tokens.space.md },
  hint: { color: tokens.color.textMuted, fontSize: tokens.font.sizeSm, lineHeight: 1.4 },
  form: { display: 'grid', gap: tokens.space.md },
  gridWrap: {
    overflow: 'auto',
    border: `1px solid ${tokens.color.border}`,
    borderRadius: tokens.radius.sm,
    background: tokens.color.bgPage,
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: tokens.font.sizeSm },
  th: {
    background: tokens.color.bgMuted,
    color: tokens.color.accent,
    textAlign: 'left',
    padding: [tokens.space.sm, tokens.space.md],
    borderBottom: `1px solid ${tokens.color.borderStrong}`,
  },
  td: { padding: [tokens.space.sm, tokens.space.md], borderBottom: `1px solid ${tokens.color.border}` },
  row: { '&:nth-child(even)': { background: tokens.color.bgCard }, '&:hover': { background: tokens.color.accentSoft } },
  totalRow: { background: tokens.color.bgMuted, borderTop: `2px solid ${tokens.color.borderStrong}` },
  head: { display: 'flex', justifyContent: 'space-between', gap: tokens.space.md, alignItems: 'center' },
  meta: { color: tokens.color.textMuted, fontSize: tokens.font.sizeSm },
  months: { display: 'grid', gap: tokens.space.sm },
  month: {
    display: 'grid',
    gridTemplateColumns: 'minmax(260px, 1fr) minmax(130px, auto) auto',
    gap: tokens.space.sm,
    alignItems: 'center',
    flexWrap: 'wrap',
    padding: tokens.space.sm,
    borderBottom: `1px solid ${tokens.color.border}`,
    '@media (max-width: 760px)': { gridTemplateColumns: '1fr' },
  },
  monthMeta: { display: 'grid', gap: 2 },
  status: { fontSize: tokens.font.sizeXs, color: tokens.color.textMuted, textTransform: 'capitalize' },
  sipSummary: {
    display: 'grid',
    justifyItems: 'start',
    gap: 3,
    padding: [tokens.space.xs, tokens.space.sm],
    borderRadius: tokens.radius.sm,
    background: tokens.color.bgMuted,
    '& span': { fontSize: tokens.font.sizeXs },
  },
  statusPill: {
    color: tokens.color.textMuted,
    fontSize: tokens.font.sizeXs,
    fontWeight: tokens.font.weightMedium,
    textTransform: 'capitalize',
  },
  sipActions: {
    '& .MuiToggleButton-root': {
      minHeight: 30,
      padding: '4px 9px',
      borderColor: tokens.color.borderStrong,
      color: tokens.color.textMuted,
      textTransform: 'none',
      fontSize: tokens.font.sizeXs,
    },
    '& .Mui-selected': { background: `${tokens.color.accentSoft} !important`, color: `${tokens.color.accent} !important` },
  },
})

function emptyForm() {
  const today = todayIso()
  return {
    name: '',
    purchaseMode: 'sip' as PurchaseMode,
    current: '',
    invested: '',
    qty: '',
    ticker: '',
    buyDate: today,
    sipAmount: '',
    sipDay: String(Number(today.slice(8, 10))),
    sipStartMonth: today.slice(0, 7),
  }
}

type HoldingForm = ReturnType<typeof emptyForm>

function formFromHolding(holding: Holding) {
  const today = todayIso()
  return {
    name: holding.name,
    purchaseMode: holding.purchaseMode,
    current: String(holding.currentMinor / 100),
    invested: String(holding.investedMinor / 100),
    qty: holding.qty === null ? '' : String(holding.qty),
    ticker: holding.ticker ?? '',
    buyDate: holdingDate(holding) || today,
    sipAmount: holding.sipAmountMinor === null ? '' : String(holding.sipAmountMinor / 100),
    sipDay: String(holding.sipDayOfMonth ?? Number(today.slice(8, 10))),
    sipStartMonth: holding.sipStartMonth ?? today.slice(0, 7),
  }
}

export function HoldingsView({ data, kind, onSaved }: { data: StoreData; kind: HoldingKind; onSaved: () => Promise<void> }) {
  const classes = useStyles()
  const [drawer, setDrawer] = useState<{ id?: string } | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(12)
  const [pendingRemove, setPendingRemove] = useState<Holding | null>(null)
  const [removing, setRemoving] = useState(false)
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<HoldingForm>({ defaultValues: emptyForm() })
  const items = data.holdings.filter((item) => item.kind === kind)
  const title = kind === 'mutual_fund' ? 'Mutual funds' : 'Stocks'
  const asOf = currentMonth()
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const activePage = Math.min(page, totalPages)
  const visibleItems = items.slice((activePage - 1) * pageSize, activePage * pageSize)
  const totalCurrent = items.reduce((sum, item) => sum + item.currentMinor, 0)
  const totalInvested = items.reduce((sum, item) => sum + item.investedMinor, 0)
  const totalGain = totalCurrent - totalInvested
  const totalReturn = totalInvested ? totalGain / totalInvested : 0

  const persistSnapshots = async () => {
    await refreshInvestmentSnapshots()
  }

  const purchaseMode = watch('purchaseMode')

  const saveHolding = async (values: HoldingForm) => {
    if (!drawer) return
    if (!values.name.trim()) return
    const existing = drawer.id ? data.holdings.find((holding) => holding.id === drawer.id) : null
    const holding: Holding = {
      ...(existing ?? {}),
      id: drawer.id ?? crypto.randomUUID(),
      name: values.name.trim(),
      kind,
      purchaseMode: values.purchaseMode,
      currentMinor: toMinor(values.current || 0),
      investedMinor: toMinor(values.invested || 0),
      qty: values.qty ? Number(values.qty) : null,
      ticker: kind === 'stock' ? values.ticker.trim().toUpperCase() || null : (existing?.ticker ?? null),
      buyDate: values.buyDate || null,
      avgPrice: existing?.avgPrice ?? null,
      marketPrice: existing?.marketPrice ?? null,
      sipAmountMinor: values.purchaseMode === 'sip' ? toMinor(values.sipAmount || 0) : null,
      sipDayOfMonth: values.purchaseMode === 'sip' ? Number(values.sipDay) || 1 : null,
      sipStartMonth: values.purchaseMode === 'sip' ? (values.buyDate ? values.buyDate.slice(0, 7) : values.sipStartMonth) : null,
      notes: existing?.notes ?? '',
      origin: 'user',
    }
    await upsertHolding(holding)
    await persistSnapshots()
    setDrawer(null)
    await onSaved()
  }

  const setStatus = async (holding: Holding, month: string, status: SipStatus) => {
    await upsertSipEvent({
      id: sipEventId(holding.id, month),
      holdingId: holding.id,
      month,
      status,
      amountMinor: status === 'paid' ? holding.sipAmountMinor : null,
      notedAt: new Date().toISOString(),
      origin: 'user',
    })
    await persistSnapshots()
    await onSaved()
  }

  const remove = async (holdingId: string) => {
    setRemoving(true)
    try {
      await deleteHolding(holdingId)
      await persistSnapshots()
      setPendingRemove(null)
      await onSaved()
    } finally {
      setRemoving(false)
    }
  }

  const sipRows = visibleItems.flatMap((holding) => {
    if (holding.purchaseMode !== 'sip' || !holding.sipStartMonth) return []
    return monthsInclusive(holding.sipStartMonth, asOf).map((month) => ({ holding, month }))
  })

  return (
    <div className={classes.page}>
      <Card>
        <div className={classes.head}>
          <p className={classes.hint}>
            {title} live on this screen. SIP answers are stored securely in Firebase and refresh dashboard snapshots.
          </p>
          <Button
            variant="primary"
            onClick={() => {
              reset(emptyForm())
              setDrawer({})
            }}
          >
            Add {kind === 'mutual_fund' ? 'fund' : 'stock'}
          </Button>
        </div>
      </Card>
      <Card>
        <div className={classes.gridWrap}>
          <table className={classes.table}>
            <thead>
              <tr>
                <th className={classes.th}>Name</th>
                <th className={classes.th}>Buy type</th>
                <th className={classes.th}>Invested on</th>
                <th className={classes.th}>Current</th>
                <th className={classes.th}>Invested</th>
                <th className={classes.th}>Gain/Loss</th>
                <th className={classes.th}>SIP</th>
                <th className={classes.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((holding) => (
                <tr className={classes.row} key={holding.id}>
                  <td className={classes.td}>
                    <strong>{holding.name}</strong>
                  </td>
                  <td className={classes.td}>{holding.purchaseMode === 'sip' ? 'SIP' : 'Lump sum'}</td>
                  <td className={classes.td}>{holdingDate(holding) ? formatDateLabel(holdingDate(holding)) : '—'}</td>
                  <td className={classes.td}>
                    <MoneyText amountMinor={holding.currentMinor} tone="steady" />
                  </td>
                  <td className={classes.td}>
                    <MoneyText amountMinor={holding.investedMinor} tone="steady" />
                  </td>
                  <td className={classes.td}>
                    <MoneyText amountMinor={holding.currentMinor - holding.investedMinor} tone="auto" />
                  </td>
                  <td className={classes.td}>
                    {holding.sipAmountMinor ? <MoneyText amountMinor={holding.sipAmountMinor} tone="steady" /> : '-'}
                  </td>
                  <td className={classes.td}>
                    <Row>
                      <Button
                        onClick={() => {
                          reset(formFromHolding(holding))
                          setDrawer({ id: holding.id })
                        }}
                      >
                        Edit
                      </Button>
                      <Button variant="danger" onClick={() => setPendingRemove(holding)}>
                        Remove
                      </Button>
                    </Row>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className={classes.totalRow}>
                <td className={classes.td}>
                  <strong>
                    Total ({new Intl.NumberFormat('en-IN', { style: 'percent', maximumFractionDigits: 2 }).format(totalReturn)})
                  </strong>
                </td>
                <td className={classes.td}>Portfolio</td>
                <td className={classes.td}>—</td>
                <td className={classes.td}>
                  <MoneyText amountMinor={totalCurrent} tone="steady" />
                </td>
                <td className={classes.td}>
                  <MoneyText amountMinor={totalInvested} tone="steady" />
                </td>
                <td className={classes.td}>
                  <MoneyText amountMinor={totalGain} tone="auto" />
                </td>
                <td className={classes.td}>-</td>
                <td className={classes.td} />
              </tr>
            </tfoot>
          </table>
        </div>
        <PaginationBar
          page={activePage}
          pageSize={pageSize}
          total={items.length}
          onPageChange={setPage}
          onPageSizeChange={(next) => {
            setPageSize(next)
            setPage(1)
          }}
        />
      </Card>
      {sipRows.length ? (
        <Card className={classes.months}>
          <strong>SIP months</strong>
          {sipRows.map(({ holding, month }) => {
            const event = data.sipEvents.find((item) => item.holdingId === holding.id && item.month === month)
            return (
              <div key={`${holding.id}:${month}`} className={classes.month}>
                <span className={classes.monthMeta}>
                  <strong>{holding.name}</strong>
                  <span className={classes.status}>
                    {formatMonthLabel(month)} · due {formatDateLabel(dateOnDay(month, holding.sipDayOfMonth ?? 1))}
                  </span>
                </span>
                <span className={classes.sipSummary}>
                  <MoneyText amountMinor={event?.amountMinor ?? holding.sipAmountMinor ?? 0} tone="steady" />
                  <span className={classes.statusPill}>{event ? event.status : 'Not recorded'}</span>
                </span>
                <span className={classes.sipActions}>
                  <ToggleButtonGroup
                    exclusive
                    size="small"
                    value={event?.status ?? null}
                    onChange={(_event, next: SipStatus | null) => {
                      if (next) void setStatus(holding, month, next)
                    }}
                    aria-label={`${holding.name} ${formatMonthLabel(month)} SIP status`}
                  >
                    <ToggleButton value="paid">Paid</ToggleButton>
                    <ToggleButton value="skipped">Skipped</ToggleButton>
                    <ToggleButton value="failed">Failed</ToggleButton>
                    <ToggleButton value="cancelled">Cancelled</ToggleButton>
                  </ToggleButtonGroup>
                </span>
              </div>
            )
          })}
        </Card>
      ) : null}
      {drawer ? (
        <Drawer
          title={drawer.id ? `Edit ${kind === 'mutual_fund' ? 'fund' : 'stock'}` : `Add ${kind === 'mutual_fund' ? 'fund' : 'stock'}`}
          onClose={() => setDrawer(null)}
          footer={
            <>
              <Button type="button" onClick={() => setDrawer(null)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" form="holding-form">
                Save
              </Button>
            </>
          }
        >
          <form id="holding-form" className={classes.form} onSubmit={handleSubmit(saveHolding)}>
            <Field label="Name">
              <Input {...register('name', { validate: (value) => value.trim().length > 0 || 'Name is required.' })} />
              <ErrorText>{errors.name?.message}</ErrorText>
            </Field>
            <Field label="Buy type">
              <Select {...register('purchaseMode', { required: 'Buy type is required.' })}>
                <option value="sip">SIP</option>
                <option value="lumpsum">Lump sum</option>
              </Select>
              <ErrorText>{errors.purchaseMode?.message}</ErrorText>
            </Field>
            <Field label="Current value (INR)">
              <Input
                type="number"
                {...register('current', { validate: (value) => value === '' || Number(value) >= 0 || 'Current value cannot be negative.' })}
              />
              <ErrorText>{errors.current?.message}</ErrorText>
            </Field>
            <Field label="Invested (INR)">
              <Input
                type="number"
                {...register('invested', {
                  validate: (value) => value === '' || Number(value) >= 0 || 'Invested value cannot be negative.',
                })}
              />
              <ErrorText>{errors.invested?.message}</ErrorText>
            </Field>
            {kind === 'stock' ? (
              <>
                <Field label="Quantity">
                  <Input
                    type="number"
                    {...register('qty', { validate: (value) => value === '' || Number(value) > 0 || 'Quantity must be greater than 0.' })}
                  />
                  <ErrorText>{errors.qty?.message}</ErrorText>
                </Field>
                <Field label="Ticker">
                  <Input
                    placeholder="TATAPOWER.NS"
                    {...register('ticker', {
                      validate: (value) => purchaseMode !== 'lumpsum' || Boolean(value.trim()) || 'Ticker is required.',
                    })}
                  />
                  <ErrorText>{errors.ticker?.message}</ErrorText>
                </Field>
              </>
            ) : null}
            <Field label="Invested on">
              <Input type="date" {...register('buyDate', { validate: (value) => Boolean(value) || 'Invested date is required.' })} />
              <ErrorText>{errors.buyDate?.message}</ErrorText>
            </Field>
            {purchaseMode === 'sip' ? (
              <>
                <Field label="SIP amount (INR)">
                  <Input
                    type="number"
                    {...register('sipAmount', {
                      validate: (value) => purchaseMode !== 'sip' || Number(value) > 0 || 'SIP amount must be greater than 0.',
                    })}
                  />
                  <ErrorText>{errors.sipAmount?.message}</ErrorText>
                </Field>
                <Field label="SIP day">
                  <Input
                    type="number"
                    min={1}
                    max={31}
                    {...register('sipDay', {
                      validate: (value) =>
                        purchaseMode !== 'sip' || (Number(value) >= 1 && Number(value) <= 31) || 'SIP day must be between 1 and 31.',
                    })}
                  />
                  <ErrorText>{errors.sipDay?.message}</ErrorText>
                </Field>
              </>
            ) : null}
          </form>
        </Drawer>
      ) : null}
      <ConfirmDialog
        open={Boolean(pendingRemove)}
        title={`Remove ${pendingRemove?.name ?? 'investment'}?`}
        message="This removes the holding and its SIP history from your portfolio. This cannot be undone."
        confirmLabel="Remove investment"
        busy={removing}
        onCancel={() => setPendingRemove(null)}
        onConfirm={() => {
          if (pendingRemove) void remove(pendingRemove.id)
        }}
      />
    </div>
  )
}
