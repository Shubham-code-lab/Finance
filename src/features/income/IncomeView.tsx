import { useState } from 'react'
import { createUseStyles } from 'react-jss'
import { useForm } from 'react-hook-form'
import { PaginationBar } from '@/components/PaginationBar'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Button, Card, Drawer, ErrorText, Field, Input, MoneyText, Row, Select } from '@/components/ui'
import { formatDateLabel, formatMonthLabel, toMinor, todayIso } from '@/domain/money'
import { IncomeSchedule, IncomeSource, StoreData } from '@/domain/types'
import { deleteIncomeSource, upsertAccount, upsertAccountSnapshot, upsertIncomeSource } from '@/storage/repository'
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
  head: { display: 'flex', justifyContent: 'space-between', gap: tokens.space.md, alignItems: 'center' },
  meta: { color: tokens.color.textMuted, fontSize: tokens.font.sizeSm },
  formHint: { color: tokens.color.textMuted, fontSize: tokens.font.sizeXs, lineHeight: 1.4, marginTop: tokens.space.xs },
})

function blankForm(accountId: string) {
  const today = todayIso()
  return {
    name: 'Salary',
    amount: '',
    accountId,
    schedule: 'monthly' as IncomeSchedule,
    startDate: today,
    dayOfMonth: String(Number(today.slice(8, 10))),
  }
}

type IncomeForm = ReturnType<typeof blankForm>

export function IncomeView({ data, onSaved }: { data: StoreData; onSaved: () => Promise<void> }) {
  const classes = useStyles()
  const bankId = data.accounts.find((account) => account.id === 'icici')?.id ?? data.accounts[0]?.id ?? ''
  const [drawer, setDrawer] = useState<{ id?: string } | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(12)
  const [pendingRemove, setPendingRemove] = useState<IncomeSource | null>(null)
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<IncomeForm>({ defaultValues: blankForm(bankId) })
  const incomeSources = data.incomeSources
  const totalPages = Math.max(1, Math.ceil(incomeSources.length / pageSize))
  const activePage = Math.min(page, totalPages)
  const rows = incomeSources.slice((activePage - 1) * pageSize, activePage * pageSize)

  const schedule = watch('schedule')

  const saveIncome = async (values: IncomeForm) => {
    if (!drawer) return
    if (!values.name.trim() || !values.accountId) return
    const source: IncomeSource = {
      id: drawer.id ?? crypto.randomUUID(),
      name: values.name.trim(),
      amountMinor: toMinor(values.amount || 0),
      accountId: values.accountId,
      schedule: values.schedule,
      startDate: values.startDate || todayIso(),
      dayOfMonth: values.schedule === 'monthly' ? Number(values.dayOfMonth) || Number(values.startDate.slice(8, 10)) : null,
      origin: 'user',
    }
    await upsertIncomeSource(source)
    setDrawer(null)
    await onSaved()
  }

  const editSource = (source: IncomeSource) => {
    reset({
      name: source.name,
      amount: String(source.amountMinor / 100),
      accountId: source.accountId,
      schedule: source.schedule,
      startDate: source.startDate,
      dayOfMonth: String(source.dayOfMonth ?? Number(source.startDate.slice(8, 10))),
    })
    setDrawer({ id: source.id })
  }

  const addSource = () => {
    reset(blankForm(bankId))
    setDrawer({})
  }

  const moveToSaving = async (source: IncomeSource) => {
    const accountId = crypto.randomUUID()
    await upsertAccount({
      id: accountId,
      name: source.name,
      type: 'cash',
      currency: 'INR',
      origin: 'user',
      archived: false,
    })
    await upsertAccountSnapshot({
      id: `manual-balance:${accountId}:${source.startDate}`,
      accountId,
      date: source.startDate,
      valueMinor: source.amountMinor,
      costBasisMinor: null,
      origin: 'user',
      sourceTableId: null,
    })
    await deleteIncomeSource(source.id)
    await onSaved()
  }

  return (
    <div className={classes.page}>
      <Card>
        <div className={classes.head}>
          <p className={classes.hint}>
            Income is only salary or real earning you declare here. If a one-time row is actually money kept somewhere else, move it to
            saving so it becomes a cash account balance instead of income.
          </p>
          <Button variant="primary" onClick={addSource}>
            Add income
          </Button>
        </div>
      </Card>
      <Card>
        <div className={classes.gridWrap}>
          <table className={classes.table}>
            <thead>
              <tr>
                <th className={classes.th}>Name</th>
                <th className={classes.th}>Amount</th>
                <th className={classes.th}>Schedule</th>
                <th className={classes.th}>Account</th>
                <th className={classes.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((source) => {
                const account = data.accounts.find((item) => item.id === source.accountId)
                return (
                  <tr className={classes.row} key={source.id}>
                    <td className={classes.td}>
                      <strong>{source.name}</strong>
                    </td>
                    <td className={classes.td}>
                      <MoneyText amountMinor={source.amountMinor} tone="positive" />
                    </td>
                    <td className={classes.td}>
                      {source.schedule === 'monthly'
                        ? `Monthly on day ${source.dayOfMonth === 31 ? 'last' : source.dayOfMonth}, starting ${formatMonthLabel(source.startDate)}`
                        : `Once on ${formatDateLabel(source.startDate)}`}
                    </td>
                    <td className={classes.td}>{account?.name ?? source.accountId}</td>
                    <td className={classes.td}>
                      <Row>
                        <Button onClick={() => editSource(source)}>Edit</Button>
                        {source.schedule === 'once' ? <Button onClick={() => moveToSaving(source)}>Move to saving</Button> : null}
                        <Button variant="danger" onClick={() => setPendingRemove(source)}>
                          Remove
                        </Button>
                      </Row>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <PaginationBar
          page={activePage}
          pageSize={pageSize}
          total={incomeSources.length}
          label="income rows"
          onPageChange={setPage}
          onPageSizeChange={(next) => {
            setPageSize(next)
            setPage(1)
          }}
        />
      </Card>
      <ConfirmDialog
        open={Boolean(pendingRemove)}
        title={`Remove ${pendingRemove?.name ?? 'income'}?`}
        message="This income source will no longer be included in dashboard or forecast calculations."
        confirmLabel="Remove income"
        onCancel={() => setPendingRemove(null)}
        onConfirm={() => {
          if (!pendingRemove) return
          void deleteIncomeSource(pendingRemove.id).then(async () => {
            setPendingRemove(null)
            await onSaved()
          })
        }}
      />
      {drawer ? (
        <Drawer
          title={drawer.id ? 'Edit income' : 'Add income'}
          onClose={() => setDrawer(null)}
          footer={
            <>
              <Button type="button" onClick={() => setDrawer(null)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" form="income-form">
                Save
              </Button>
            </>
          }
        >
          <form id="income-form" className={classes.form} onSubmit={handleSubmit(saveIncome)}>
            <Field label="Name">
              <Input {...register('name', { validate: (value) => value.trim().length > 0 || 'Income name is required.' })} />
              <ErrorText>{errors.name?.message}</ErrorText>
            </Field>
            <Field label="Amount (INR)">
              <Input
                type="number"
                {...register('amount', {
                  required: 'Amount is required.',
                  validate: (value) => Number(value) > 0 || 'Amount must be greater than 0.',
                })}
              />
              <ErrorText>{errors.amount?.message}</ErrorText>
            </Field>
            <Field label="Into account">
              <Select {...register('accountId', { required: 'Account is required.' })}>
                {data.accounts
                  .filter((account) => account.type === 'checking' || account.type === 'savings')
                  .map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
              </Select>
              <ErrorText>{errors.accountId?.message}</ErrorText>
            </Field>
            <Field label="Type">
              <Select {...register('schedule', { required: 'Income type is required.' })}>
                <option value="monthly">Monthly salary</option>
                <option value="once">Lump sum</option>
              </Select>
              <ErrorText>{errors.schedule?.message}</ErrorText>
            </Field>
            <Field label={schedule === 'monthly' ? 'Schedule starts' : 'Payment date'}>
              <Input
                type="date"
                {...register('startDate', {
                  required: schedule === 'monthly' ? 'Schedule start date is required.' : 'Payment date is required.',
                })}
              />
              <span className={classes.formHint}>
                {schedule === 'monthly'
                  ? 'The first month this salary is included in the dashboard and future projection.'
                  : 'The date this one-time income is received.'}
              </span>
              <ErrorText>{errors.startDate?.message}</ErrorText>
            </Field>
            {schedule === 'monthly' ? (
              <Field label="Salary day">
                <Input
                  type="number"
                  min={1}
                  max={31}
                  {...register('dayOfMonth', {
                    validate: (value) =>
                      schedule !== 'monthly' || (Number(value) >= 1 && Number(value) <= 31) || 'Day must be between 1 and 31.',
                  })}
                />
                <span className={classes.formHint}>Use 31 when salary arrives on the last calendar day.</span>
                <ErrorText>{errors.dayOfMonth?.message}</ErrorText>
              </Field>
            ) : null}
          </form>
        </Drawer>
      ) : null}
    </div>
  )
}
