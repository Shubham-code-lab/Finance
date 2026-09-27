import { useRef, useState } from 'react'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty'
import LockIcon from '@mui/icons-material/Lock'
import PendingIcon from '@mui/icons-material/Pending'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import { LinearProgress } from '@mui/material'
import { createUseStyles } from 'react-jss'
import { Button, Card, Drawer, ErrorText, Field, Input, Row, Select } from '@/components/ui'
import { statementCategoryOptions } from '@/calc/classify'
import { Category, ColumnMapping, CustomTable, FlowKind, StoreData } from '@/domain/types'
import { tableRowsFromStatement } from '@/features/assets/fromLedgers'
import { parseImportFile } from '@/ingest/parse'
import {
  deriveIciciData,
  findIciciTable,
  ICICI_COLUMNS,
  IciciStatement,
  mergeIciciRows,
  MergeResult,
  parseIciciStatementText,
} from '@/features/import/iciciStatement'
import { GrowwMutualFundImport, parseGrowwMutualFundOrders } from '@/features/import/growwMutualFundOrders'
import { GrowwStockImport, parseGrowwStockOrders } from '@/features/import/growwStockOrders'
import { deriveSbiData, findSbiTable, mergeSbiRows, parseSbiStatementText, SBI_COLUMNS, SbiStatement } from '@/features/import/sbiStatement'
import { syncInvestmentPortfolio } from '@/features/holdings/syncInvestmentPortfolio'
import { deleteHolding, putMany, upsertTable, WriteProgress } from '@/storage/repository'
import { tokens } from '@/theme/tokens'

const useStyles = createUseStyles({
  layout: {
    display: 'grid',
    gap: tokens.space.lg,
    gridTemplateColumns: 'minmax(0, 1fr)',
    width: '100%',
    minHeight: 'calc(100vh - 150px)',
  },
  card: { display: 'grid', alignContent: 'start', gap: tokens.space.md },
  uploadCard: { gridColumn: '1 / -1', width: '100%', minHeight: 'calc(100vh - 150px)' },
  fullWidth: { gridColumn: '1 / -1' },
  cardTitle: { margin: 0, fontSize: tokens.font.sizeLg },
  copy: { margin: 0, color: tokens.color.textMuted, lineHeight: 1.5 },
  hidden: { display: 'none' },
  dropZone: {
    minHeight: 220,
    width: '100%',
    display: 'grid',
    placeItems: 'center',
    alignContent: 'center',
    gap: tokens.space.sm,
    padding: tokens.space.xl,
    border: `2px dashed ${tokens.color.borderStrong}`,
    borderRadius: tokens.radius.md,
    background: tokens.color.bgMuted,
    color: tokens.color.textMuted,
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'border-color 140ms ease, background-color 140ms ease, color 140ms ease',
    '&:hover, &:focus-visible': {
      borderColor: tokens.color.accent,
      background: tokens.color.accentSoft,
      color: tokens.color.text,
      outline: 0,
    },
    '& svg': { fontSize: 38, color: tokens.color.accent },
  },
  dropZoneActive: {
    borderColor: `${tokens.color.accent} !important`,
    background: `${tokens.color.accentSoft} !important`,
    color: `${tokens.color.text} !important`,
  },
  dropZoneDisabled: { opacity: 0.56, cursor: 'not-allowed' },
  dropTitle: { color: tokens.color.text, fontSize: tokens.font.sizeLg },
  dropHint: { fontSize: tokens.font.sizeSm },
  summary: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: tokens.space.sm,
    '@media (max-width: 620px)': { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
  },
  stat: {
    padding: tokens.space.md,
    border: `1px solid ${tokens.color.border}`,
    borderRadius: tokens.radius.sm,
    background: tokens.color.bgMuted,
  },
  statLabel: { display: 'block', color: tokens.color.textMuted, fontSize: tokens.font.sizeXs, marginBottom: tokens.space.xs },
  statValue: { fontWeight: tokens.font.weightMedium, fontVariantNumeric: 'tabular-nums' },
  details: { display: 'grid', gap: tokens.space.sm, padding: tokens.space.md, borderTop: `1px solid ${tokens.color.border}` },
  categoryReview: { display: 'grid', gap: tokens.space.sm },
  categoryReviewHead: { display: 'flex', justifyContent: 'space-between', gap: tokens.space.md, alignItems: 'baseline' },
  categoryList: {
    display: 'grid',
    gap: tokens.space.xs,
    maxHeight: 320,
    overflowY: 'auto',
    paddingRight: tokens.space.xs,
  },
  categoryRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) minmax(190px, 0.65fr)',
    gap: tokens.space.md,
    alignItems: 'center',
    padding: tokens.space.sm,
    border: `1px solid ${tokens.color.border}`,
    borderRadius: tokens.radius.sm,
    '@media (max-width: 620px)': { gridTemplateColumns: '1fr' },
  },
  merchantName: { display: 'block', fontWeight: tokens.font.weightMedium },
  merchantMeta: { color: tokens.color.textMuted, fontSize: tokens.font.sizeXs },
  passwordBody: { display: 'grid', gap: tokens.space.md },
  passwordWrap: {
    position: 'relative',
    '& .MuiInputBase-input': { paddingRight: '36px !important' },
  },
  passwordVisibility: {
    position: 'absolute',
    top: '50%',
    right: 5,
    zIndex: 1,
    display: 'grid',
    placeItems: 'center',
    width: tokens.control.iconButtonSize,
    height: tokens.control.iconButtonSize,
    padding: 0,
    transform: 'translateY(-50%)',
    border: 0,
    borderRadius: '50%',
    background: 'transparent',
    color: tokens.color.textMuted,
    cursor: 'pointer',
    '&:hover': { color: tokens.color.text, background: tokens.color.accentSoft },
    '&:focus-visible': { outline: `2px solid ${tokens.color.focus}`, outlineOffset: 1 },
    '& svg': { fontSize: tokens.control.iconSize },
  },
  monitor: {
    display: 'grid',
    gap: tokens.space.sm,
    padding: tokens.space.md,
    border: `1px solid ${tokens.color.border}`,
    borderRadius: tokens.radius.sm,
    background: tokens.color.bgPage,
  },
  monitorHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: tokens.space.md },
  progressValue: { color: tokens.color.textMuted, fontSize: tokens.font.sizeSm, fontVariantNumeric: 'tabular-nums' },
  log: { display: 'grid', gap: tokens.space.xs, margin: 0, padding: 0, listStyle: 'none' },
  logItem: {
    display: 'grid',
    gridTemplateColumns: '20px minmax(0, 1fr) auto',
    alignItems: 'center',
    gap: tokens.space.sm,
    minHeight: 28,
    fontSize: tokens.font.sizeSm,
  },
  logIcon: { display: 'grid', placeItems: 'center', color: tokens.color.textMuted, '& svg': { fontSize: 17 } },
  logActive: { color: tokens.color.accent },
  logSuccess: { color: tokens.color.positive },
  logFailed: { color: tokens.color.danger },
  logCount: { color: tokens.color.textMuted, fontVariantNumeric: 'tabular-nums' },
})

type BankName = 'ICICI' | 'SBI'
type UploadKind = 'icici' | 'sbi' | 'mutual_fund' | 'stock' | 'spreadsheet'
const uploadKinds: Array<{ id: UploadKind; label: string; accept: string; help: string }> = [
  {
    id: 'icici',
    label: 'ICICI bank statement',
    accept: '.pdf,application/pdf',
    help: 'Password-protected ICICI statement PDF.',
  },
  {
    id: 'sbi',
    label: 'SBI bank statement',
    accept: '.pdf,application/pdf',
    help: 'SBI statement PDF. A password is requested only when required.',
  },
  {
    id: 'mutual_fund',
    label: 'Groww mutual-fund orders',
    accept: '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    help: 'Groww mutual-fund order-history XLSX.',
  },
  {
    id: 'stock',
    label: 'Groww stock orders',
    accept: '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    help: 'Groww stock order-history XLSX.',
  },
  {
    id: 'spreadsheet',
    label: 'Other CSV or Excel',
    accept: '.csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    help: 'Create a custom table from another CSV or XLSX export.',
  },
]
type Preview = {
  bank: BankName
  statement: IciciStatement | SbiStatement
  merge: MergeResult
  table: CustomTable
  isNewTable: boolean
}
type InvestmentPreview = ({ kind: 'mutual_fund'; file: File } & GrowwMutualFundImport) | ({ kind: 'stock'; file: File } & GrowwStockImport)
type UploadStatus = 'pending' | 'uploading' | 'success' | 'failed'
type UploadStep = { id: string; label: string; status: UploadStatus; completed: number; total: number; error?: string }

type StatementCategory = { id: string; name: string; flow: FlowKind | null }

function statementGroupKey(row: { merchant: string; memo: string }) {
  if (row.merchant !== 'Unknown recipient') return row.merchant
  return `${row.merchant}:${row.memo.toLowerCase().replace(/\s+/g, ' ').trim()}`
}

function statementGroupLabel(row: { merchant: string; memo: string }) {
  if (row.merchant !== 'Unknown recipient') return row.merchant
  const memo = row.memo.replace(/\s+/g, ' ').trim()
  return memo ? `Unknown recipient · ${memo.slice(0, 54)}${memo.length > 54 ? '…' : ''}` : row.merchant
}

const passwordVisibilityKey = 'finance:icici-password-visible'

function savedPasswordVisibility() {
  try {
    return window.localStorage.getItem(passwordVisibilityKey) === 'true'
  } catch {
    return false
  }
}

function savePasswordVisibility(visible: boolean) {
  try {
    window.localStorage.setItem(passwordVisibilityKey, String(visible))
  } catch {
    // The preference can remain session-only when browser storage is unavailable.
  }
}

export function ImportView({
  data,
  onSaved,
  onOpenTables,
}: {
  data: StoreData
  onSaved: () => Promise<unknown>
  onOpenTables: () => void
}) {
  const classes = useStyles()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploadKind, setUploadKind] = useState<UploadKind>('icici')
  const [file, setFile] = useState<File | null>(null)
  const [pdfBank, setPdfBank] = useState<BankName>('ICICI')
  const [password, setPassword] = useState('')
  const [passwordVisible, setPasswordVisible] = useState(savedPasswordVisibility)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [saved, setSaved] = useState('')
  const [saveStage, setSaveStage] = useState('')
  const [uploadSteps, setUploadSteps] = useState<UploadStep[]>([])
  const [investmentPreview, setInvestmentPreview] = useState<InvestmentPreview | null>(null)
  const [dragging, setDragging] = useState(false)

  const categoryOptions: StatementCategory[] = [
    ...statementCategoryOptions.map((category) => ({ ...category, flow: category.flow as FlowKind | null })),
    ...data.categories
      .filter((category) => !statementCategoryOptions.some((option) => option.id === category.id))
      .map((category) => ({ id: category.id, name: category.name, flow: category.defaultFlow })),
  ]

  const categoryGroups = preview
    ? [
        ...preview.statement.rows
          .reduce((groups, row) => {
            const key = statementGroupKey(row)
            const current = groups.get(key) ?? {
              key,
              merchant: statementGroupLabel(row),
              categoryId: row.categoryId,
              count: 0,
              amount: 0,
            }
            current.count += 1
            current.amount += row.amount
            if (current.categoryId !== row.categoryId) current.categoryId = 'unknown'
            groups.set(key, current)
            return groups
          }, new Map<string, { key: string; merchant: string; categoryId: string; count: number; amount: number }>())
          .values(),
      ].sort((left, right) => Number(left.categoryId !== 'unknown') - Number(right.categoryId !== 'unknown') || right.amount - left.amount)
    : []

  const setMerchantCategory = (groupKey: string, categoryId: string) => {
    setPreview((current) => {
      if (!current) return current
      const selected = categoryOptions.find((category) => category.id === categoryId)
      const rows = current.statement.rows.map((row) =>
        statementGroupKey(row) === groupKey
          ? {
              ...row,
              categoryId,
              flow: selected?.flow && selected.flow !== 'neutral' ? (selected.flow as 'inflow' | 'outflow' | 'transfer') : row.flow,
            }
          : row,
      )
      const existingRows = data.customTableRows.filter((row) => row.tableId === current.table.id)
      const merge =
        current.bank === 'SBI' ? mergeSbiRows(existingRows, rows, current.table.id) : mergeIciciRows(existingRows, rows, current.table.id)
      return { ...current, statement: { ...current.statement, rows }, merge }
    })
  }

  const preparePdf = async (selected: File, bank: BankName, pdfPassword: string) => {
    const account = data.accounts.find((item) => item.id === bank.toLowerCase() || new RegExp(bank, 'i').test(item.name))
    if (!account) throw new Error(`Add the ${bank} account on the Accounts page before importing its statement.`)
    const { readProtectedPdf } = await import('@/features/import/readProtectedPdf')
    const text = await readProtectedPdf(selected, pdfPassword)
    if (bank === 'SBI') {
      const statement = parseSbiStatementText(text, account.id)
      const existingTable = findSbiTable(data.customTables, data.customTableRows)
      const table: CustomTable = existingTable ?? {
        id: 'sbi-statement',
        name: 'SBI bank statement',
        description: 'Incremental imports from SBI PDF statements.',
        columns: SBI_COLUMNS,
        origin: 'user',
        createdAt: new Date().toISOString(),
      }
      const existingRows = data.customTableRows.filter((row) => row.tableId === table.id)
      const merge = mergeSbiRows(existingRows, statement.rows, table.id)
      setPreview({ bank, statement, merge, table, isNewTable: !existingTable })
      return
    }
    const statement = parseIciciStatementText(text, account.id)
    const existingTable = findIciciTable(data.customTables, data.customTableRows)
    const table: CustomTable = existingTable ?? {
      id: 'icici-statement',
      name: 'ICICI bank statement',
      description: 'Incremental imports from password-protected ICICI PDF statements.',
      columns: ICICI_COLUMNS,
      origin: 'user',
      createdAt: new Date().toISOString(),
    }
    const existingRows = data.customTableRows.filter((row) => row.tableId === table.id)
    const merge = mergeIciciRows(existingRows, statement.rows, table.id)
    setPreview({ bank, statement, merge, table, isNewTable: !existingTable })
  }

  const choosePdf = async (selected: File | undefined, bank: BankName) => {
    if (!selected) return
    setFile(selected)
    setPdfBank(bank)
    setPassword('')
    setError('')
    setPreview(null)
    setSaved('')
    setUploadSteps([])
    if (bank === 'ICICI') {
      setDrawerOpen(true)
      return
    }
    setWorking(true)
    try {
      await preparePdf(selected, bank, '')
    } catch (cause) {
      if (cause instanceof Error && /password/i.test(cause.message)) setDrawerOpen(true)
      else setError(cause instanceof Error ? cause.message : 'Unable to read this PDF.')
    } finally {
      setWorking(false)
    }
  }

  const closePassword = () => {
    setDrawerOpen(false)
    setPassword('')
  }

  const inspectPdf = async () => {
    if (!file || !password) return
    setWorking(true)
    setError('')
    try {
      await preparePdf(file, pdfBank, password)
      closePassword()
    } catch (cause) {
      setPassword('')
      setError(
        cause instanceof Error && /password/i.test(cause.message)
          ? 'That password could not open this PDF. Please try again.'
          : cause instanceof Error
            ? cause.message
            : cause instanceof Error
              ? cause.message
              : 'Unable to read this PDF.',
      )
    } finally {
      setWorking(false)
    }
  }

  const savePdf = async () => {
    if (!preview) return
    setWorking(true)
    setError('')
    setSaveStage('Preparing changed records...')
    try {
      const mapping: ColumnMapping = {
        tableId: preview.table.id,
        kind: 'transactions',
        roles: { date: 'date', amount: 'amount', flow: 'flow', account: 'account', category: 'category', memo: 'memo' },
        flowVocabulary: 'in-out-enum',
      }
      const currency = data.accounts.find((account) => account.id === preview.statement.rows[0]?.accountId)?.currency ?? 'INR'
      const existingRows = new Map(data.customTableRows.filter((row) => row.tableId === preview.table.id).map((row) => [row.id, row]))
      const changedRows = preview.merge.rows.filter((row) => JSON.stringify(existingRows.get(row.id)?.cells) !== JSON.stringify(row.cells))
      const deriveStatementData = preview.bank === 'SBI' ? deriveSbiData : deriveIciciData
      const changedTransactions = deriveStatementData(changedRows, preview.table.id, currency).transactions
      const statementRows = tableRowsFromStatement(preview.statement.rows, preview.table.id)
      const statementSnapshots = deriveStatementData(statementRows, preview.table.id, currency).snapshots
      const referencedCategoryIds = new Set(preview.statement.rows.map((row) => row.categoryId))
      const categoriesToSave: Category[] = statementCategoryOptions
        .filter((category) => referencedCategoryIds.has(category.id) && !data.categories.some((existing) => existing.id === category.id))
        .map((category) => ({
          id: category.id,
          name: category.name,
          parentId: null,
          defaultFlow: (category.flow ?? 'neutral') as FlowKind,
          origin: 'user',
        }))

      const steps: UploadStep[] = [
        { id: 'setup', label: 'Table setup', status: 'pending', completed: 0, total: 3 },
        { id: 'rows', label: 'Statement rows', status: 'pending', completed: 0, total: changedRows.length },
        { id: 'transactions', label: 'Transactions', status: 'pending', completed: 0, total: changedTransactions.length },
        { id: 'balances', label: 'Daily balances', status: 'pending', completed: 0, total: statementSnapshots.length },
        { id: 'audit', label: 'Import summary', status: 'pending', completed: 0, total: 1 },
        { id: 'refresh', label: 'Dashboard refresh', status: 'pending', completed: 0, total: 1 },
      ]
      setUploadSteps(steps)
      const updateStep = (id: string, update: Partial<UploadStep>) =>
        setUploadSteps((current) => current.map((step) => (step.id === id ? { ...step, ...update } : step)))
      const runStep = async (id: string, action: (report: (progress: WriteProgress) => void) => Promise<unknown>) => {
        updateStep(id, { status: 'uploading', error: undefined })
        try {
          await action((progress) => updateStep(id, progress))
          setUploadSteps((current) =>
            current.map((step) => (step.id === id ? { ...step, status: 'success', completed: step.total } : step)),
          )
        } catch (cause) {
          const message = cause instanceof Error ? cause.message : 'Firebase operation failed.'
          updateStep(id, { status: 'failed', error: message })
          throw cause
        }
      }

      setSaveStage(`Saving ${changedRows.length} changed transactions...`)
      const results = await Promise.allSettled([
        runStep('setup', async (report) => {
          let completed = 0
          report({ completed, total: 3 })
          await upsertTable(preview.table)
          report({ completed: ++completed, total: 3 })
          await putMany('columnMappings', [mapping])
          report({ completed: ++completed, total: 3 })
          await putMany('categories', categoriesToSave)
          report({ completed: ++completed, total: 3 })
        }),
        runStep('rows', (report) => putMany('customTableRows', changedRows, report)),
        runStep('transactions', (report) => putMany('transactions', changedTransactions, report)),
        runStep('balances', (report) => putMany('snapshots', statementSnapshots, report)),
      ])
      const failed = results.find((result): result is PromiseRejectedResult => result.status === 'rejected')
      if (failed) throw failed.reason

      setSaveStage('Recording import summary...')
      await runStep('audit', (report) =>
        putMany(
          'imports',
          [
            {
              id: crypto.randomUUID(),
              bank: preview.bank,
              fileName: file?.name ?? `${preview.bank} statement PDF`,
              periodFrom: preview.statement.periodFrom,
              periodTo: preview.statement.periodTo,
              transactionCount: preview.statement.rows.length,
              added: preview.merge.added,
              updated: preview.merge.updated,
              unchanged: preview.merge.unchanged,
              importedAt: new Date().toISOString(),
            },
          ],
          report,
        ),
      )
      setSaveStage('Refreshing the dashboard...')
      await runStep('refresh', async (report) => {
        report({ completed: 0, total: 1 })
        await onSaved()
        report({ completed: 1, total: 1 })
      })
      setSaved(
        `${preview.merge.added} added, ${preview.merge.updated} updated, ${preview.merge.unchanged} already present. Older history was preserved.`,
      )
      setPreview(null)
      setFile(null)
      if (inputRef.current) inputRef.current.value = ''
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The import could not be saved.')
    } finally {
      setWorking(false)
      setSaveStage('')
    }
  }

  const progressTotal = uploadSteps.reduce((sum, step) => sum + Math.max(1, step.total), 0)
  const progressComplete = uploadSteps.reduce(
    (sum, step) => sum + (step.status === 'success' ? Math.max(1, step.total) : Math.min(step.completed, Math.max(1, step.total))),
    0,
  )
  const progressPercent = progressTotal ? Math.round((progressComplete / progressTotal) * 100) : 0

  const stepIcon = (status: UploadStatus) => {
    if (status === 'success') return <CheckCircleIcon />
    if (status === 'failed') return <ErrorIcon />
    if (status === 'uploading') return <HourglassEmptyIcon />
    return <PendingIcon />
  }

  const importSpreadsheet = async (selected?: File) => {
    if (!selected) return
    setWorking(true)
    setError('')
    try {
      const parsed = await parseImportFile(selected)
      const id = crypto.randomUUID()
      const table: CustomTable = {
        id,
        name: selected.name.replace(/\.(csv|xlsx)$/i, ''),
        description: 'Imported from CSV/Excel.',
        origin: 'user',
        createdAt: new Date().toISOString(),
        columns: parsed.headers.map((header) => ({
          id: header,
          name: header,
          type: /date/i.test(header) ? 'date' : /amount|debit|credit|value/i.test(header) ? 'number' : 'text',
          required: false,
        })),
      }
      await upsertTable(table)
      await putMany('columnMappings', [{ tableId: id, kind: 'unmapped', roles: {} }])
      await putMany(
        'customTableRows',
        parsed.rows.map((row) => ({ id: crypto.randomUUID(), tableId: id, origin: 'user' as const, cells: row })),
      )
      await onSaved()
      onOpenTables()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to import this spreadsheet.')
    } finally {
      setWorking(false)
    }
  }

  const inspectInvestmentOrders = async (selected: File | undefined, kind: InvestmentPreview['kind']) => {
    if (!selected) return
    setWorking(true)
    setError('')
    setSaved('')
    try {
      if (kind === 'mutual_fund') {
        const parsed = await parseGrowwMutualFundOrders(selected, data.holdings)
        setInvestmentPreview({ ...parsed, kind, file: selected })
      } else {
        const parsed = await parseGrowwStockOrders(selected, data.holdings)
        setInvestmentPreview({ ...parsed, kind, file: selected })
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to inspect this order-history file.')
    } finally {
      setWorking(false)
    }
  }

  const inspectSelectedUpload = async (selected?: File) => {
    if (!selected) return
    if (uploadKind === 'icici' || uploadKind === 'sbi') {
      await choosePdf(selected, uploadKind === 'icici' ? 'ICICI' : 'SBI')
      return
    }
    if (uploadKind === 'mutual_fund' || uploadKind === 'stock') {
      await inspectInvestmentOrders(selected, uploadKind)
      return
    }
    await importSpreadsheet(selected)
  }

  const selectUploadKind = (next: UploadKind) => {
    setUploadKind(next)
    setFile(null)
    setPreview(null)
    setInvestmentPreview(null)
    setError('')
    setSaved('')
    setUploadSteps([])
    if (inputRef.current) inputRef.current.value = ''
  }

  const saveInvestmentOrders = async () => {
    if (!investmentPreview) return
    setWorking(true)
    setError('')
    try {
      await Promise.all(investmentPreview.closedHoldingIds.map((holdingId) => deleteHolding(holdingId)))
      await putMany('holdings', investmentPreview.holdings)
      if (investmentPreview.kind === 'mutual_fund') await putMany('sipEvents', investmentPreview.sipEvents)
      const marketSync = await syncInvestmentPortfolio()
      await putMany('imports', [
        {
          id: crypto.randomUUID(),
          bank: investmentPreview.kind === 'mutual_fund' ? 'Groww mutual funds' : 'Groww stocks',
          fileName: investmentPreview.file.name,
          periodFrom: investmentPreview.periodFrom,
          periodTo: investmentPreview.periodTo,
          transactionCount: investmentPreview.orderCount,
          added: investmentPreview.holdings.length,
          updated: 0,
          unchanged: investmentPreview.ignoredCount,
          importedAt: new Date().toISOString(),
        },
      ])
      await onSaved()
      setSaved(
        `${investmentPreview.orderCount} orders processed into ${investmentPreview.holdings.length} active ${investmentPreview.kind === 'mutual_fund' ? 'funds' : 'stocks'}${investmentPreview.closedHoldingIds.length ? `; ${investmentPreview.closedHoldingIds.length} fully sold or redeemed position${investmentPreview.closedHoldingIds.length === 1 ? '' : 's'} removed` : ''}. ${marketSync.updatedHoldings} current market value${marketSync.updatedHoldings === 1 ? '' : 's'} updated${marketSync.errors.length ? `; ${marketSync.errors.length} kept their last known value` : ''}.`,
      )
      setInvestmentPreview(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The investment import could not be saved.')
    } finally {
      setWorking(false)
    }
  }

  const categoryReview = preview ? (
    <div className={classes.categoryReview}>
      <div className={classes.categoryReviewHead}>
        <strong>Review categories</strong>
        <span className={classes.merchantMeta}>{categoryGroups.filter((group) => group.categoryId === 'unknown').length} unknown</span>
      </div>
      <p className={classes.copy}>
        Confident merchant matches are filled in. Ambiguous people and payments stay Unknown. Changing one entry updates every matching
        recipient in this import.
      </p>
      <div className={classes.categoryList}>
        {categoryGroups.map((group) => (
          <div className={classes.categoryRow} key={group.key}>
            <div>
              <span className={classes.merchantName}>{group.merchant}</span>
              <span className={classes.merchantMeta}>
                {group.count} transaction{group.count === 1 ? '' : 's'} · ₹
                {group.amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </span>
            </div>
            <Select
              aria-label={`Category for ${group.merchant}`}
              value={group.categoryId}
              onChange={(event) => setMerchantCategory(group.key, event.target.value)}
            >
              {categoryOptions.map((category) => (
                <option value={category.id} key={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </div>
        ))}
      </div>
    </div>
  ) : null

  const activeUpload = uploadKinds.find((item) => item.id === uploadKind) ?? uploadKinds[0]

  return (
    <div className={classes.layout}>
      {error || saved ? (
        <Card className={`${classes.card} ${classes.fullWidth}`}>
          <ErrorText>{error}</ErrorText>
          {saved ? <span>{saved}</span> : null}
        </Card>
      ) : null}
      {uploadSteps.length ? (
        <Card className={`${classes.card} ${classes.fullWidth}`}>
          <div className={classes.monitor} aria-live="polite">
            <div className={classes.monitorHead}>
              <strong>Firebase upload</strong>
              <span className={classes.progressValue}>{progressPercent}%</span>
            </div>
            <LinearProgress variant="determinate" value={progressPercent} />
            <ul className={classes.log}>
              {uploadSteps.map((step) => {
                const tone =
                  step.status === 'success'
                    ? classes.logSuccess
                    : step.status === 'failed'
                      ? classes.logFailed
                      : step.status === 'uploading'
                        ? classes.logActive
                        : ''
                const statusLabel =
                  step.status === 'uploading'
                    ? 'Uploading'
                    : step.status === 'success'
                      ? 'Success'
                      : step.status === 'failed'
                        ? 'Failed'
                        : 'Pending'
                return (
                  <li className={`${classes.logItem} ${tone}`} key={step.id} title={step.error}>
                    <span className={classes.logIcon}>{stepIcon(step.status)}</span>
                    <span>
                      {step.label} - {statusLabel}
                      {step.error ? `: ${step.error}` : ''}
                    </span>
                    <span className={classes.logCount}>
                      {step.completed}/{step.total}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        </Card>
      ) : null}
      <Card className={`${classes.card} ${classes.uploadCard}`}>
        <h2 className={classes.cardTitle}>Import data</h2>
        <Field label="What are you uploading?">
          <Select value={uploadKind} disabled={working} onChange={(event) => selectUploadKind(event.target.value as UploadKind)}>
            {uploadKinds.map((item) => (
              <option value={item.id} key={item.id}>
                {item.label}
              </option>
            ))}
          </Select>
        </Field>
        <input
          ref={inputRef}
          className={classes.hidden}
          id="finance-data-upload"
          type="file"
          accept={activeUpload.accept}
          disabled={working}
          onClick={(event) => {
            event.currentTarget.value = ''
          }}
          onChange={(event) => void inspectSelectedUpload(event.target.files?.[0])}
        />
        <label
          className={`${classes.dropZone} ${dragging ? classes.dropZoneActive : ''} ${working ? classes.dropZoneDisabled : ''}`}
          htmlFor="finance-data-upload"
          role="button"
          tabIndex={working ? -1 : 0}
          aria-disabled={working}
          onKeyDown={(event) => {
            if (!working && (event.key === 'Enter' || event.key === ' ')) {
              event.preventDefault()
              inputRef.current?.click()
            }
          }}
          onDragEnter={(event) => {
            event.preventDefault()
            if (!working) setDragging(true)
          }}
          onDragOver={(event) => {
            event.preventDefault()
            if (!working) event.dataTransfer.dropEffect = 'copy'
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false)
          }}
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)
            if (!working) void inspectSelectedUpload(event.dataTransfer.files[0])
          }}
        >
          <CloudUploadIcon />
          <strong className={classes.dropTitle}>{working ? 'Reading file...' : 'Drop your file here'}</strong>
          <span className={classes.dropHint}>or click to browse from your device</span>
          <span className={classes.dropHint}>{activeUpload.help}</span>
        </label>
        {file || investmentPreview?.file ? <p className={classes.copy}>{file?.name ?? investmentPreview?.file.name}</p> : null}

        {preview ? (
          <>
            <div className={classes.summary}>
              {[
                ['Transactions', preview.statement.rows.length],
                ['New', preview.merge.added],
                ['Updated', preview.merge.updated],
                ['Already present', preview.merge.unchanged],
              ].map(([label, value]) => (
                <div className={classes.stat} key={label}>
                  <span className={classes.statLabel}>{label}</span>
                  <span className={classes.statValue}>{value}</span>
                </div>
              ))}
            </div>
            <div className={classes.details}>
              <span>
                Period: {preview.statement.periodFrom || 'Unknown'} to {preview.statement.periodTo || 'Unknown'}
              </span>
              <span>Account ending: {preview.statement.accountNumberLast4 || 'Not shown'}</span>
              <span>Older rows preserved: {preview.merge.preserved}</span>
              {preview.isNewTable ? <span>A new {preview.bank} statement table will be created.</span> : null}
            </div>
            {categoryReview}
            {saveStage ? <p className={classes.copy}>{saveStage}</p> : null}
            <Row>
              <Button variant="primary" disabled={working} onClick={savePdf}>
                {working ? 'Saving...' : 'Confirm import'}
              </Button>
              <Button disabled={working} onClick={() => setPreview(null)}>
                Cancel
              </Button>
            </Row>
          </>
        ) : null}

        {investmentPreview ? (
          <>
            <div className={classes.summary}>
              {[
                [investmentPreview.kind === 'stock' ? 'Executed orders' : 'Orders', investmentPreview.orderCount],
                [investmentPreview.kind === 'stock' ? 'Active stocks' : 'Active funds', investmentPreview.holdings.length],
                ...(investmentPreview.kind === 'mutual_fund'
                  ? [
                      ['Paid SIP months', investmentPreview.sipEvents.length],
                      ['Fully redeemed', investmentPreview.closedHoldingIds.length],
                    ]
                  : []),
                ...(investmentPreview.kind === 'stock' ? [['Fully sold', investmentPreview.closedHoldingIds.length]] : []),
                ...(investmentPreview.kind === 'stock'
                  ? [
                      ['Yahoo matched', investmentPreview.resolvedCount],
                      ['Using Groww name', investmentPreview.unresolvedCount],
                    ]
                  : []),
                [investmentPreview.kind === 'stock' ? 'Ignored orders' : 'Ignored rows', investmentPreview.ignoredCount],
              ].map(([label, value]) => (
                <div className={classes.stat} key={label}>
                  <span className={classes.statLabel}>{label}</span>
                  <span className={classes.statValue}>{value}</span>
                </div>
              ))}
            </div>
            <p className={classes.copy}>
              Period: {investmentPreview.periodFrom} to {investmentPreview.periodTo}
            </p>
            <Row>
              <Button variant="primary" disabled={working} onClick={saveInvestmentOrders}>
                {working ? 'Saving...' : 'Confirm import'}
              </Button>
              <Button disabled={working} onClick={() => setInvestmentPreview(null)}>
                Cancel
              </Button>
            </Row>
          </>
        ) : null}
      </Card>

      {drawerOpen ? (
        <Drawer
          title={`Unlock ${pdfBank} statement`}
          onClose={closePassword}
          footer={
            <Button variant="primary" disabled={!password || working} onClick={inspectPdf}>
              {working ? 'Reading...' : 'Review statement'}
            </Button>
          }
        >
          <div className={classes.passwordBody}>
            <LockIcon color="primary" />
            <p className={classes.copy}>Enter the password for {file?.name}. It is used only to open this file and is never saved.</p>
            <Field label="PDF password">
              <div className={classes.passwordWrap}>
                <Input
                  type={passwordVisible ? 'text' : 'password'}
                  value={password}
                  autoComplete="off"
                  autoFocus
                  onChange={(event) => setPassword(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && password && !working) inspectPdf()
                  }}
                />
                <button
                  className={classes.passwordVisibility}
                  type="button"
                  aria-label={passwordVisible ? 'Hide PDF password' : 'Show PDF password'}
                  aria-pressed={passwordVisible}
                  title={passwordVisible ? 'Hide password' : 'Show password'}
                  onClick={() => {
                    const next = !passwordVisible
                    setPasswordVisible(next)
                    savePasswordVisibility(next)
                  }}
                >
                  {passwordVisible ? <VisibilityOffIcon /> : <VisibilityIcon />}
                </button>
              </div>
            </Field>
            <ErrorText>{error}</ErrorText>
          </div>
        </Drawer>
      ) : null}
    </div>
  )
}
