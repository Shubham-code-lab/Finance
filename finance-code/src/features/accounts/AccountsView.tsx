import { useCallback, useState } from 'react'
import { createUseStyles } from 'react-jss'
import { Controller, useForm } from 'react-hook-form'
import { PaginationBar } from '@/components/PaginationBar'
import { accountBalanceAt } from '@/calc/calculations'
import { Button, Card, DatePicker, Drawer, ErrorText, Field, Input, MoneyText, Select } from '@/components/ui'
import { toMinor, todayIso } from '@/domain/money'
import { Account, AccountType, StoreData } from '@/domain/types'
import { upsertAccount, upsertAccountSnapshot } from '@/storage/repository'
import { tokens } from '@/theme/tokens'
import { StatementCoverage } from '@/features/accounts/StatementCoverage'
import { portfolioMarketValueStatus } from '@/features/holdings/marketValueStatus'
import { usePageHeaderAction } from '@/app/PageHeaderAction'

const useStyles = createUseStyles({
  page: { display: 'grid', gap: tokens.space.md },
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
  meta: { color: tokens.color.textMuted, fontSize: tokens.font.sizeSm, marginTop: tokens.space.xs },
  balance: { display: 'grid', gap: 2 },
  balanceMeta: { color: tokens.color.textMuted, fontSize: tokens.font.sizeXs, whiteSpace: 'nowrap' },
  balanceFallback: { color: tokens.color.warning },
  totalRow: { background: tokens.color.bgMuted, fontWeight: tokens.font.weightMedium },
  form: { display: 'grid', gap: tokens.space.md },
})

const types: AccountType[] = ['checking', 'savings', 'credit', 'cash', 'investment', 'liability', 'other']
type AccountForm = { name: string; type: AccountType; balance: string; balanceDate: string }

function latestBalanceMinor(accountId: string, data: StoreData) {
  const account = data.accounts.find((item) => item.id === accountId)
  return account ? accountBalanceAt(account, data.transactions, data.snapshots, todayIso()) : 0
}

function latestBalanceDate(accountId: string, data: StoreData) {
  return (
    data.snapshots
      .filter((snapshot) => snapshot.accountId === accountId && snapshot.date <= todayIso())
      .sort((left, right) => right.date.localeCompare(left.date))[0]?.date ?? todayIso()
  )
}

function investmentValueStatus(accountId: string, data: StoreData) {
  const kind = accountId === 'mutual-funds' ? 'mutual_fund' : accountId === 'stocks-portfolio' ? 'stock' : null
  return kind ? portfolioMarketValueStatus(data.holdings.filter((holding) => holding.kind === kind)) : null
}

export function AccountsView({ data, onSaved, onOpenUpload }: { data: StoreData; onSaved: () => Promise<void>; onOpenUpload: () => void }) {
  const classes = useStyles()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(12)
  const [drawer, setDrawer] = useState<{ id?: string } | null>(null)
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AccountForm>({ defaultValues: { name: '', type: 'savings', balance: '', balanceDate: todayIso() } })
  const totalPages = Math.max(1, Math.ceil(data.accounts.length / pageSize))
  const activePage = Math.min(page, totalPages)
  const accounts = data.accounts.slice((activePage - 1) * pageSize, activePage * pageSize)
  const activeAccounts = data.accounts.filter((account) => !account.archived)
  const assetTotal = activeAccounts
    .filter((account) => !['credit', 'liability'].includes(account.type))
    .reduce((sum, account) => sum + latestBalanceMinor(account.id, data), 0)
  const liabilityTotal = activeAccounts
    .filter((account) => account.type === 'credit' || account.type === 'liability')
    .reduce((sum, account) => sum + latestBalanceMinor(account.id, data), 0)
  const netWorth = assetTotal - liabilityTotal

  const saveAccount = async (values: AccountForm) => {
    if (!drawer) return
    const trimmed = values.name.trim()
    if (!trimmed) return
    const existing = drawer.id ? data.accounts.find((account) => account.id === drawer.id) : null
    const accountId = drawer.id ?? crypto.randomUUID()
    await upsertAccount({
      ...(existing ?? {}),
      id: accountId,
      name: trimmed,
      type: values.type,
      currency: existing?.currency ?? 'INR',
      origin: existing?.origin ?? 'user',
      archived: existing?.archived ?? false,
    })
    if (values.balance.trim()) {
      await upsertAccountSnapshot({
        id: `manual-balance:${accountId}:${values.balanceDate || todayIso()}`,
        accountId,
        date: values.balanceDate || todayIso(),
        valueMinor: toMinor(values.balance),
        costBasisMinor: null,
        origin: 'user',
        sourceTableId: null,
      })
    }
    setDrawer(null)
    await onSaved()
  }

  const startEdit = (account: Account) => {
    reset({
      name: account.name,
      type: account.type,
      balance: String(latestBalanceMinor(account.id, data) / 100 || ''),
      balanceDate: latestBalanceDate(account.id, data),
    })
    setDrawer({ id: account.id })
  }

  const startAdd = useCallback(() => {
    reset({ name: '', type: 'cash', balance: '', balanceDate: todayIso() })
    setDrawer({})
  }, [reset])

  usePageHeaderAction('Add account', startAdd)

  return (
    <div className={classes.page}>
      <Card>
        <div className={classes.gridWrap}>
          <table className={classes.table}>
            <thead>
              <tr>
                <th className={classes.th}>Account</th>
                <th className={classes.th}>Type</th>
                <th className={classes.th}>Balance</th>
                <th className={classes.th}>Currency</th>
                <th className={classes.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => {
                const valueStatus = investmentValueStatus(account.id, data)
                return (
                  <tr className={classes.row} key={account.id}>
                    <td className={classes.td}>
                      <strong>{account.name}</strong>
                    </td>
                    <td className={classes.td}>{account.type}</td>
                    <td className={classes.td}>
                      <div className={classes.balance}>
                        <MoneyText amountMinor={latestBalanceMinor(account.id, data)} tone="steady" showPaise />
                        {valueStatus ? (
                          <span className={`${classes.balanceMeta} ${valueStatus.confirmed ? '' : classes.balanceFallback}`}>
                            {valueStatus.text}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className={classes.td}>{account.currency}</td>
                    <td className={classes.td}>
                      <Button onClick={() => startEdit(account)}>Edit</Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className={classes.totalRow}>
                <td className={classes.td} colSpan={2}>
                  Assets total
                </td>
                <td className={classes.td}>
                  <MoneyText amountMinor={assetTotal} tone="positive" showPaise />
                </td>
                <td className={classes.td} colSpan={2}>
                  All positive accounts
                </td>
              </tr>
              <tr className={classes.totalRow}>
                <td className={classes.td} colSpan={2}>
                  Liabilities
                </td>
                <td className={classes.td}>
                  <MoneyText amountMinor={liabilityTotal} tone="negative" showPaise />
                </td>
                <td className={classes.td} colSpan={2}>
                  Amounts owed
                </td>
              </tr>
              <tr className={classes.totalRow}>
                <td className={classes.td} colSpan={2}>
                  Net worth
                </td>
                <td className={classes.td}>
                  <MoneyText amountMinor={netWorth} tone="auto" showPaise />
                </td>
                <td className={classes.td} colSpan={2}>
                  Assets minus liabilities
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        <PaginationBar
          page={activePage}
          pageSize={pageSize}
          total={data.accounts.length}
          label="accounts"
          onPageChange={setPage}
          onPageSizeChange={(next) => {
            setPageSize(next)
            setPage(1)
          }}
        />
      </Card>
      <StatementCoverage data={data} onOpenUpload={onOpenUpload} />
      {drawer ? (
        <Drawer
          title={drawer.id ? 'Edit account' : 'Add account'}
          onClose={() => setDrawer(null)}
          footer={
            <Button variant="primary" type="submit" form="account-form">
              Save
            </Button>
          }
        >
          <form id="account-form" className={classes.form} onSubmit={handleSubmit(saveAccount)}>
            <Field label="Account name">
              <Input
                {...register('name', { validate: (value) => value.trim().length > 0 || 'Account name is required.' })}
                placeholder="HDFC salary"
              />
              <ErrorText>{errors.name?.message}</ErrorText>
            </Field>
            <Field label="Type">
              <Select {...register('type', { required: 'Type is required.' })}>
                {types.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </Select>
              <ErrorText>{errors.type?.message}</ErrorText>
            </Field>
            <Field label="Current balance">
              <Input
                type="number"
                {...register('balance', { validate: (value) => !value || Number(value) >= 0 || 'Balance cannot be negative.' })}
              />
              <ErrorText>{errors.balance?.message}</ErrorText>
            </Field>
            <Field label="Balance date">
              <Controller
                control={control}
                name="balanceDate"
                rules={{ validate: (value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value) || 'Choose a valid date.' }}
                render={({ field }) => <DatePicker value={field.value} onChange={field.onChange} onBlur={field.onBlur} />}
              />
              <ErrorText>{errors.balanceDate?.message}</ErrorText>
            </Field>
          </form>
        </Drawer>
      ) : null}
    </div>
  )
}
