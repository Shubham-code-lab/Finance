import { useMemo, useState } from 'react'
import { createUseStyles } from 'react-jss'
import { Controller, useForm } from 'react-hook-form'
import { PaginationBar } from '@/components/PaginationBar'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Button, Card, Drawer, ErrorText, Field, Input, MoneyText, Row, Select } from '@/components/ui'
import { formatDisplayValue, toMinor } from '@/domain/money'
import { CustomTable, CustomTableRow, StoreData, TableColumn } from '@/domain/types'
import { tokens } from '@/theme/tokens'

const useStyles = createUseStyles({
  layout: {
    display: 'grid',
    gridTemplateColumns: '240px minmax(0, 1fr)',
    gap: tokens.space.md,
    '@media (max-width: 820px)': { gridTemplateColumns: '1fr' },
  },
  list: { display: 'grid', gap: tokens.space.sm },
  tableButton: { textAlign: 'left' },
  gridWrap: {
    overflow: 'auto',
    maxHeight: 'calc(100vh - 250px)',
    border: `1px solid ${tokens.color.border}`,
    borderRadius: tokens.radius.sm,
    background: tokens.color.bgPage,
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: tokens.font.sizeSm },
  cell: { borderBottom: `1px solid ${tokens.color.border}`, padding: [tokens.space.sm, tokens.space.md], minWidth: 120 },
  th: {
    position: 'sticky',
    top: 0,
    background: tokens.color.bgMuted,
    color: tokens.color.accent,
    zIndex: 1,
    textAlign: 'left',
    padding: [tokens.space.sm, tokens.space.md],
    borderBottom: `1px solid ${tokens.color.borderStrong}`,
  },
  row: { '&:nth-child(even)': { background: tokens.color.bgCard }, '&:hover': { background: tokens.color.accentSoft } },
  head: { display: 'flex', justifyContent: 'space-between', gap: tokens.space.sm, alignItems: 'center', marginBottom: tokens.space.md },
  forms: { display: 'grid', gap: tokens.space.sm, marginTop: tokens.space.md },
  drawerForm: { display: 'grid', gap: tokens.space.md },
  muted: { color: tokens.color.textMuted, fontSize: tokens.font.sizeSm },
})

const templates: Record<string, { label: string; columns: TableColumn[] }> = {
  transactions: {
    label: 'Transactions',
    columns: [
      { id: 'date', name: 'Date', type: 'date', required: true },
      { id: 'amount', name: 'Amount', type: 'number', required: true },
      { id: 'flow', name: 'Flow', type: 'enum', required: true, enumValues: ['inflow', 'outflow', 'transfer', 'neutral'] },
      { id: 'account', name: 'Account', type: 'accountRef', required: true },
      { id: 'category', name: 'Category', type: 'categoryRef', required: false },
      { id: 'memo', name: 'Memo', type: 'text', required: false },
    ],
  },
  stocks: {
    label: 'Stock holdings',
    columns: [
      { id: 'company', name: 'Company', type: 'text', required: true },
      { id: 'qty', name: 'Qty', type: 'number', required: true },
      { id: 'avgPrice', name: 'Avg Price', type: 'number', required: true },
      { id: 'marketPrice', name: 'Market Price', type: 'number', required: true },
      { id: 'currentValue', name: 'Current Value', type: 'number', required: true },
      { id: 'investedValue', name: 'Invested Value', type: 'number', required: true },
      { id: 'profitLoss', name: 'Profit/Loss', type: 'number', required: false },
    ],
  },
  mutualFunds: {
    label: 'Mutual funds',
    columns: [
      { id: 'scheme', name: 'Scheme', type: 'text', required: true },
      { id: 'folio', name: 'Folio', type: 'text', required: false },
      { id: 'units', name: 'Units', type: 'number', required: true },
      { id: 'avgNav', name: 'Avg NAV', type: 'number', required: true },
      { id: 'currentNav', name: 'Current NAV', type: 'number', required: true },
      { id: 'sipAmount', name: 'SIP Amount', type: 'number', required: false },
      { id: 'investedValue', name: 'Invested Value', type: 'number', required: true },
      { id: 'currentValue', name: 'Current Value', type: 'number', required: true },
      { id: 'profitLoss', name: 'Profit/Loss', type: 'number', required: false },
    ],
  },
  savings: {
    label: 'Savings goals',
    columns: [
      { id: 'goal', name: 'Goal', type: 'text', required: true },
      { id: 'account', name: 'Account', type: 'accountRef', required: true },
      { id: 'target', name: 'Target', type: 'number', required: true },
      { id: 'saved', name: 'Saved', type: 'number', required: true },
      { id: 'monthlyContribution', name: 'Monthly Contribution', type: 'number', required: false },
      { id: 'targetDate', name: 'Target Date', type: 'date', required: false },
      { id: 'notes', name: 'Notes', type: 'text', required: false },
    ],
  },
}

type CellValue = CustomTableRow['cells'][string]
type RowForm = { cells: Record<string, CellValue> }
type TableForm = { name: string; templateId: string }

function isMoneyColumn(column: TableColumn) {
  const key = `${column.id} ${column.name}`.toLowerCase()
  return ['amount', 'value', 'invested', 'profit', 'loss', 'target', 'saved', 'contribution', 'sip'].some((item) => key.includes(item))
}

function moneyTone(column: TableColumn) {
  const key = `${column.id} ${column.name}`.toLowerCase()
  if (['profit', 'loss', 'gain'].some((item) => key.includes(item))) return 'auto'
  if (['spend', 'debit', 'expense'].some((item) => key.includes(item))) return 'negative'
  if (['income', 'credit'].some((item) => key.includes(item))) return 'positive'
  return 'steady'
}

export function TablesView({
  data,
  onCreateTable,
  onRowsChange,
  onDeleteTable,
}: {
  data: StoreData
  onCreateTable: (table: CustomTable, rows: CustomTableRow[]) => void
  onRowsChange: (table: CustomTable, rows: CustomTableRow[]) => void
  onDeleteTable: (table: CustomTable) => void
}) {
  const classes = useStyles()
  const [selectedId, setSelectedId] = useState(data.customTables[0]?.id ?? '')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(12)
  const [drawer, setDrawer] = useState<{ mode: 'add' | 'edit'; rowId?: string; cells: Record<string, CellValue> } | null>(null)
  const [pendingDelete, setPendingDelete] = useState<CustomTable | null>(null)
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RowForm>({ defaultValues: { cells: {} } })
  const {
    register: registerTable,
    handleSubmit: handleTableSubmit,
    reset: resetTable,
    formState: { errors: tableErrors },
  } = useForm<TableForm>({ defaultValues: { name: '', templateId: 'transactions' } })
  const selected = useMemo(
    () => data.customTables.find((table) => table.id === selectedId) ?? data.customTables[0],
    [data.customTables, selectedId],
  )
  const rows = selected ? data.customTableRows.filter((row) => row.tableId === selected.id) : []
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  const activePage = Math.min(page, totalPages)
  const visibleRows = rows.slice((activePage - 1) * pageSize, activePage * pageSize)
  const openAddRow = () => {
    if (!selected) return
    const cells = Object.fromEntries(selected.columns.map((column) => [column.id, ''])) as Record<string, CellValue>
    reset({ cells })
    setDrawer({ mode: 'add', cells })
  }
  const openEditRow = (row: CustomTableRow) => {
    reset({ cells: row.cells })
    setDrawer({ mode: 'edit', rowId: row.id, cells: row.cells })
  }
  const saveRow = (values: RowForm) => {
    if (!selected || !drawer) return
    if (drawer.mode === 'add') {
      onRowsChange(selected, [...rows, { id: crypto.randomUUID(), tableId: selected.id, origin: 'user', cells: values.cells }])
      setPage(Math.max(1, Math.ceil((rows.length + 1) / pageSize)))
    } else {
      onRowsChange(
        selected,
        rows.map((row) => (row.id === drawer.rowId ? { ...row, cells: values.cells } : row)),
      )
    }
    setDrawer(null)
  }
  const createTable = (values: TableForm) => {
    const id = crypto.randomUUID()
    const template = templates[values.templateId]
    const table: CustomTable = {
      id,
      name: values.name.trim() || template.label,
      description: '',
      origin: 'user',
      createdAt: new Date().toISOString(),
      columns: template.columns,
    }
    onCreateTable(table, [])
    setSelectedId(id)
    resetTable({ name: '', templateId: values.templateId })
  }
  return (
    <div className={classes.layout}>
      <Card>
        <div className={classes.list}>
          {data.customTables.map((table) => (
            <Button
              key={table.id}
              className={classes.tableButton}
              variant={table.id === selected?.id ? 'primary' : undefined}
              onClick={() => {
                setSelectedId(table.id)
                setPage(1)
              }}
            >
              {table.name}
            </Button>
          ))}
        </div>
        <form className={classes.forms} onSubmit={handleTableSubmit(createTable)}>
          <Field label="New transaction table">
            <Input
              {...registerTable('name', { validate: (value) => value.trim().length <= 80 || 'Table name must be 80 characters or less.' })}
              placeholder="Table name"
            />
            <ErrorText>{tableErrors.name?.message}</ErrorText>
          </Field>
          <Field label="Template">
            <Select {...registerTable('templateId', { validate: (value) => Boolean(templates[value]) || 'Choose a valid template.' })}>
              {Object.entries(templates).map(([id, template]) => (
                <option key={id} value={id}>
                  {template.label}
                </option>
              ))}
            </Select>
            <ErrorText>{tableErrors.templateId?.message}</ErrorText>
          </Field>
          <Button variant="primary" type="submit">
            Create
          </Button>
        </form>
      </Card>
      <Card>
        {selected ? (
          <>
            <div className={classes.head}>
              <div>
                <strong>{selected.name}</strong>
                <div className={classes.muted}>
                  Mapped tables feed dashboard calculations. Edit cells here; canonical transactions rebuild on save.
                </div>
              </div>
              <Row>
                <Button variant="primary" onClick={openAddRow}>
                  Add row
                </Button>
                <Button variant="danger" onClick={() => setPendingDelete(selected)}>
                  Delete
                </Button>
              </Row>
            </div>
            <div className={classes.gridWrap}>
              <table className={classes.table}>
                <thead>
                  <tr>
                    {selected.columns.map((column) => (
                      <th className={classes.th} key={column.id}>
                        {column.name}
                      </th>
                    ))}
                    <th className={classes.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row) => (
                    <tr className={classes.row} key={row.id}>
                      {selected.columns.map((column) => (
                        <td className={classes.cell} key={column.id}>
                          {column.type === 'number' && isMoneyColumn(column) ? (
                            <MoneyText amountMinor={toMinor(row.cells[column.id] ?? 0)} tone={moneyTone(column)} />
                          ) : (
                            formatDisplayValue(row.cells[column.id], column.type)
                          )}
                        </td>
                      ))}
                      <td className={classes.cell}>
                        <Button onClick={() => openEditRow(row)}>Edit</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationBar
              page={activePage}
              pageSize={pageSize}
              total={rows.length}
              onPageChange={setPage}
              onPageSizeChange={(next) => {
                setPageSize(next)
                setPage(1)
              }}
            />
            {drawer ? (
              <Drawer
                title={drawer.mode === 'add' ? `Add row to ${selected.name}` : `Edit row in ${selected.name}`}
                onClose={() => setDrawer(null)}
                footer={
                  <>
                    <Button type="button" onClick={() => setDrawer(null)}>
                      Cancel
                    </Button>
                    <Button variant="primary" type="submit" form="table-row-form">
                      Save
                    </Button>
                  </>
                }
              >
                <form id="table-row-form" className={classes.drawerForm} onSubmit={handleSubmit(saveRow)}>
                  {selected.columns.map((column) => (
                    <Field key={column.id} label={column.name}>
                      <Controller
                        control={control}
                        name={`cells.${column.id}`}
                        rules={{
                          validate: (value) => {
                            if (column.required && (value === '' || value === null || value === undefined))
                              return `${column.name} is required.`
                            if (column.type === 'number' && value !== '' && value !== null && Number.isNaN(Number(value)))
                              return `${column.name} must be a number.`
                            return true
                          },
                        }}
                        render={({ field }) =>
                          column.type === 'accountRef' ? (
                            <Select value={String(field.value ?? '')} onChange={field.onChange}>
                              <option value="">Account</option>
                              {data.accounts.map((account) => (
                                <option key={account.id}>{account.name}</option>
                              ))}
                            </Select>
                          ) : column.type === 'categoryRef' ? (
                            <Select value={String(field.value ?? '')} onChange={field.onChange}>
                              <option value="">Category</option>
                              {data.categories.map((category) => (
                                <option key={category.id}>{category.name}</option>
                              ))}
                            </Select>
                          ) : column.type === 'enum' ? (
                            <Select value={String(field.value ?? '')} onChange={field.onChange}>
                              <option value="">Choose</option>
                              {(column.enumValues ?? []).map((value) => (
                                <option key={value} value={value}>
                                  {value}
                                </option>
                              ))}
                            </Select>
                          ) : (
                            <Input
                              type={column.type === 'date' ? 'date' : column.type === 'number' ? 'number' : 'text'}
                              value={String(field.value ?? '')}
                              onChange={field.onChange}
                            />
                          )
                        }
                      />
                      {errors.cells?.[column.id]?.message ? <ErrorText>{String(errors.cells[column.id]?.message)}</ErrorText> : null}
                    </Field>
                  ))}
                </form>
              </Drawer>
            ) : null}
          </>
        ) : (
          <span>No tables yet.</span>
        )}
      </Card>
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={`Delete ${pendingDelete?.name ?? 'table'}?`}
        message="This deletes the table and all of its rows. Dashboard calculations sourced from it may change."
        confirmLabel="Delete table"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!pendingDelete) return
          onDeleteTable(pendingDelete)
          setPendingDelete(null)
        }}
      />
    </div>
  )
}
