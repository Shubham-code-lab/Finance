import {
  defaultWealthView,
  Account,
  AccountSnapshot,
  BackupFile,
  Category,
  ChartSpec,
  ColumnMapping,
  CustomTable,
  CustomTableRow,
  DashboardLayout,
  ForecastSettings,
  Holding,
  IncomeSource,
  MetricDef,
  PlannedExpense,
  SipEvent,
  StoreData,
  Transaction,
} from '@/domain/types'
import { KeyedStoreName, STORE_NAMES } from '@/storage/stores'
import {
  deleteBundledWhere,
  initializeBundleStore,
  putBundledDashboard,
  putBundledValues,
  readBundledStore,
  replaceBundledStore,
  replaceBundledWhere,
  requestBundleServerRefresh,
} from '@/storage/bundleStore'

export type WriteProgress = { completed: number; total: number }

export async function getAllData(): Promise<StoreData> {
  await initializeBundleStore()
  const [
    accounts,
    categories,
    customTables,
    customTableRows,
    columnMappings,
    transactions,
    snapshots,
    metrics,
    chartSpecs,
    dashboardRows,
    holdings,
    sipEvents,
    incomeSources,
    plannedExpenses,
    forecastSettingsRows,
  ] = await Promise.all([
    readBundledStore<Account>('accounts'),
    readBundledStore<Category>('categories'),
    readBundledStore<CustomTable>('customTables'),
    readBundledStore<CustomTableRow>('customTableRows'),
    readBundledStore<ColumnMapping>('columnMappings'),
    readBundledStore<Transaction>('transactions'),
    readBundledStore<AccountSnapshot>('snapshots'),
    readBundledStore<MetricDef>('metrics'),
    readBundledStore<ChartSpec>('chartSpecs'),
    readBundledStore<DashboardLayout>('dashboard'),
    readBundledStore<Holding>('holdings'),
    readBundledStore<SipEvent>('sipEvents'),
    readBundledStore<IncomeSource>('incomeSources'),
    readBundledStore<PlannedExpense>('plannedExpenses'),
    readBundledStore<ForecastSettings>('forecastSettings'),
  ])
  const dashboard = dashboardRows[0]
  return {
    accounts,
    categories,
    customTables,
    customTableRows,
    columnMappings,
    transactions,
    snapshots,
    metrics,
    chartSpecs,
    holdings,
    sipEvents,
    incomeSources,
    plannedExpenses,
    forecastSettings: forecastSettingsRows.find((settings) => settings.id === 'default') ?? null,
    dashboard: dashboard
      ? { widgets: dashboard.widgets ?? [], wealth: dashboard.wealth ?? defaultWealthView, views: dashboard.views }
      : { widgets: [], wealth: defaultWealthView },
  }
}

export function requestServerRefresh() {
  requestBundleServerRefresh()
}

export async function putMany<T>(store: KeyedStoreName, values: T[], onProgress?: (progress: WriteProgress) => void) {
  onProgress?.({ completed: 0, total: values.length })
  await putBundledValues(store, values)
  onProgress?.({ completed: values.length, total: values.length })
}

export async function putDashboard(dashboard: DashboardLayout) {
  await putBundledDashboard(dashboard)
}

export async function putMapping(mapping: ColumnMapping) {
  await putMany('columnMappings', [mapping])
}

export async function replaceRowsForTable(tableId: string, rows: CustomTableRow[]) {
  await replaceBundledWhere<CustomTableRow>('customTableRows', (row) => row.tableId === tableId, rows)
}

export async function replaceDerivedForTable(tableId: string, transactions: Transaction[], snapshots: AccountSnapshot[]) {
  await Promise.all([
    replaceBundledWhere<Transaction>('transactions', (item) => item.sourceTableId === tableId, transactions),
    replaceBundledWhere<AccountSnapshot>('snapshots', (item) => item.sourceTableId === tableId, snapshots),
  ])
}

export async function clearDemoData() {
  for (const store of STORE_NAMES.filter((name) => name !== 'meta' && name !== 'dashboard')) {
    await deleteBundledWhere<Record<string, unknown>>(store as KeyedStoreName, (item) => item.origin === 'demo')
  }
}

export async function exportBackup(): Promise<BackupFile> {
  const stores: Record<string, unknown[]> = {}
  await Promise.all(
    STORE_NAMES.map(async (store) => {
      stores[store] = await readBundledStore(store)
    }),
  )
  return { app: 'finance-local', formatVersion: 1, exportedAt: new Date().toISOString(), stores }
}

export async function importBackup(file: BackupFile) {
  if (file.app !== 'finance-local' || file.formatVersion !== 1) throw new Error('Unsupported backup file.')
  await Promise.all(STORE_NAMES.map((store) => replaceBundledStore(store, file.stores[store] ?? [])))
}

export async function upsertTable(table: CustomTable) {
  await putMany('customTables', [table])
}

export async function deleteTable(table: CustomTable) {
  await Promise.all([
    deleteBundledWhere<CustomTable>('customTables', (item) => item.id === table.id),
    deleteBundledWhere<ColumnMapping>('columnMappings', (item) => item.tableId === table.id),
    deleteBundledWhere<CustomTableRow>('customTableRows', (item) => item.tableId === table.id),
    deleteBundledWhere<Transaction>('transactions', (item) => item.sourceTableId === table.id),
    deleteBundledWhere<AccountSnapshot>('snapshots', (item) => item.sourceTableId === table.id),
  ])
}

export async function upsertAccount(account: Account) {
  await putMany('accounts', [account])
}

export async function upsertAccountSnapshot(snapshot: AccountSnapshot) {
  await putMany('snapshots', [snapshot])
}

export async function deleteAccount(accountId: string) {
  await deleteBundledWhere<Account>('accounts', (item) => item.id === accountId)
}

export async function upsertHolding(holding: Holding) {
  await putMany('holdings', [holding])
}

export async function deleteHolding(holdingId: string) {
  await Promise.all([
    deleteBundledWhere<Holding>('holdings', (item) => item.id === holdingId),
    deleteBundledWhere<SipEvent>('sipEvents', (item) => item.holdingId === holdingId),
  ])
}

export async function upsertSipEvent(event: SipEvent) {
  await putMany('sipEvents', [event])
}

export async function replaceSipEventsForHoldings(holdingIds: string[], events: SipEvent[]) {
  const ids = new Set(holdingIds)
  await replaceBundledWhere<SipEvent>('sipEvents', (item) => ids.has(item.holdingId), events)
}

export async function replaceInvestmentSnapshots(snapshots: AccountSnapshot[]) {
  await replaceBundledWhere<AccountSnapshot>(
    'snapshots',
    (item) => item.accountId === 'mutual-funds' || item.accountId === 'stocks-portfolio',
    snapshots,
  )
}

export async function upsertIncomeSource(source: IncomeSource) {
  await putMany('incomeSources', [source])
}

export async function deleteIncomeSource(id: string) {
  await deleteBundledWhere<IncomeSource>('incomeSources', (item) => item.id === id)
}

export async function upsertPlannedExpense(expense: PlannedExpense) {
  await putMany('plannedExpenses', [expense])
}

export async function deletePlannedExpense(id: string) {
  await deleteBundledWhere<PlannedExpense>('plannedExpenses', (item) => item.id === id)
}

export async function upsertForecastSettings(settings: ForecastSettings) {
  await putMany('forecastSettings', [settings])
}

export type EntityUnion =
  | Account
  | Category
  | CustomTable
  | CustomTableRow
  | ColumnMapping
  | Transaction
  | AccountSnapshot
  | MetricDef
  | ChartSpec
  | Holding
  | SipEvent
  | IncomeSource
  | PlannedExpense
  | ForecastSettings
