import { useRef, useState } from 'react'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty'
import LockIcon from '@mui/icons-material/Lock'
import PendingIcon from '@mui/icons-material/Pending'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import { Button as MuiButton, LinearProgress } from '@mui/material'
import { createUseStyles } from 'react-jss'
import { Button, Card, Drawer, ErrorText, Field, Input, Row } from '@/components/ui'
import { BackupControls } from '@/features/backup/BackupControls'
import { ColumnMapping, CustomTable, StoreData } from '@/domain/types'
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
import { putMany, upsertTable, WriteProgress } from '@/storage/repository'
import { tokens } from '@/theme/tokens'

const useStyles = createUseStyles({
  layout: {
    display: 'grid',
    gap: tokens.space.lg,
    gridTemplateColumns: 'minmax(0, 1.4fr) minmax(260px, 0.8fr)',
    '@media (max-width: 840px)': { gridTemplateColumns: '1fr' },
  },
  card: { display: 'grid', alignContent: 'start', gap: tokens.space.md },
  cardTitle: { margin: 0, fontSize: tokens.font.sizeLg },
  copy: { margin: 0, color: tokens.color.textMuted, lineHeight: 1.5 },
  hidden: { display: 'none' },
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
  passwordBody: { display: 'grid', gap: tokens.space.md },
  passwordWrap: {
    position: 'relative',
    '& .MuiInputBase-input': { paddingRight: '44px !important' },
  },
  passwordVisibility: {
    position: 'absolute',
    top: '50%',
    right: 5,
    zIndex: 1,
    display: 'grid',
    placeItems: 'center',
    width: 32,
    height: 32,
    padding: 0,
    transform: 'translateY(-50%)',
    border: 0,
    borderRadius: '50%',
    background: 'transparent',
    color: tokens.color.textMuted,
    cursor: 'pointer',
    '&:hover': { color: tokens.color.text, background: tokens.color.accentSoft },
    '&:focus-visible': { outline: `2px solid ${tokens.color.focus}`, outlineOffset: 1 },
    '& svg': { fontSize: 20 },
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

type Preview = { statement: IciciStatement; merge: MergeResult; table: CustomTable; isNewTable: boolean }
type UploadStatus = 'pending' | 'uploading' | 'success' | 'failed'
type UploadStep = { id: string; label: string; status: UploadStatus; completed: number; total: number; error?: string }

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
  onBackupExport,
  onBackupImport,
}: {
  data: StoreData
  onSaved: () => Promise<unknown>
  onOpenTables: () => void
  onBackupExport: () => void
  onBackupImport: (file: File) => void
}) {
  const classes = useStyles()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [password, setPassword] = useState('')
  const [passwordVisible, setPasswordVisible] = useState(savedPasswordVisibility)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [saved, setSaved] = useState('')
  const [saveStage, setSaveStage] = useState('')
  const [uploadSteps, setUploadSteps] = useState<UploadStep[]>([])

  const choosePdf = (selected?: File) => {
    if (!selected) return
    setFile(selected)
    setPassword('')
    setError('')
    setPreview(null)
    setSaved('')
    setUploadSteps([])
    setDrawerOpen(true)
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
      const account = data.accounts.find((item) => item.id === 'icici' || /icici/i.test(item.name))
      if (!account) throw new Error('Add the ICICI account on the Accounts page before importing its statement.')
      const { readProtectedPdf } = await import('@/features/import/readProtectedPdf')
      const text = await readProtectedPdf(file, password)
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
      setPreview({ statement, merge, table, isNewTable: !existingTable })
      closePassword()
    } catch (cause) {
      setPassword('')
      setError(
        cause instanceof Error && /password/i.test(cause.message)
          ? 'That password could not open this PDF. Please try again.'
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
      const changedTransactions = deriveIciciData(changedRows, preview.table.id, currency).transactions
      const statementRows = tableRowsFromStatement(preview.statement.rows, preview.table.id)
      const statementSnapshots = deriveIciciData(statementRows, preview.table.id, currency).snapshots

      const steps: UploadStep[] = [
        { id: 'setup', label: 'Table setup', status: 'pending', completed: 0, total: 2 },
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
          report({ completed, total: 2 })
          await upsertTable(preview.table)
          report({ completed: ++completed, total: 2 })
          await putMany('columnMappings', [mapping])
          report({ completed: ++completed, total: 2 })
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
              bank: 'ICICI',
              fileName: file?.name ?? 'ICICI statement PDF',
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

  return (
    <div className={classes.layout}>
      <Card className={classes.card}>
        <h2 className={classes.cardTitle}>ICICI statement</h2>
        <p className={classes.copy}>
          Upload the password-protected monthly PDF. You can upload overlapping periods repeatedly; existing history is preserved and
          duplicate transactions are skipped.
        </p>
        <input
          ref={inputRef}
          className={classes.hidden}
          id="icici-pdf"
          type="file"
          accept=".pdf,application/pdf"
          onClick={(event) => {
            event.currentTarget.value = ''
          }}
          onChange={(event) => choosePdf(event.target.files?.[0])}
        />
        <MuiButton component="label" htmlFor="icici-pdf" variant="contained" size="small" startIcon={<CloudUploadIcon />}>
          Choose ICICI PDF
        </MuiButton>
        {file ? <p className={classes.copy}>{file.name}</p> : null}
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
              {preview.isNewTable ? <span>A new ICICI statement table will be created.</span> : null}
            </div>
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
        {uploadSteps.length ? (
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
        ) : null}
        <ErrorText>{error}</ErrorText>
        {saved ? <span>{saved}</span> : null}
      </Card>

      <Card className={classes.card}>
        <h2 className={classes.cardTitle}>CSV or Excel</h2>
        <p className={classes.copy}>Create a new custom table from a CSV or XLSX export.</p>
        <input type="file" accept=".csv,.xlsx" disabled={working} onChange={(event) => importSpreadsheet(event.target.files?.[0])} />
      </Card>

      <Card className={classes.card}>
        <h2 className={classes.cardTitle}>Backup & restore</h2>
        <p className={classes.copy}>Download a complete copy of your finance data or restore a previous JSON backup.</p>
        <BackupControls onExport={onBackupExport} onImport={onBackupImport} />
      </Card>

      {drawerOpen ? (
        <Drawer
          title="Unlock ICICI statement"
          onClose={closePassword}
          footer={
            <>
              <Button onClick={closePassword}>Cancel</Button>
              <Button variant="primary" disabled={!password || working} onClick={inspectPdf}>
                {working ? 'Reading...' : 'Review statement'}
              </Button>
            </>
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
