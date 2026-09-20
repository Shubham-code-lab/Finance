export type Origin = 'demo' | 'user'
export type CurrencyCode = string
export type FlowKind = 'inflow' | 'outflow' | 'neutral' | 'transfer'
export type AccountType = 'checking' | 'savings' | 'credit' | 'cash' | 'investment' | 'liability' | 'other'
export type ColumnType = 'date' | 'number' | 'text' | 'enum' | 'accountRef' | 'categoryRef'
export type SemanticRole = 'date' | 'amount' | 'flow' | 'account' | 'counterpartyAccount' | 'category' | 'memo' | 'ignore'
export type MetricKind = 'inflow' | 'outflow' | 'neutral'
export type ChartType = 'line' | 'bar' | 'area'

export type Money = { amountMinor: number; currency: CurrencyCode }

export type Account = {
  id: string
  name: string
  type: AccountType
  currency: CurrencyCode
  origin: Origin
  archived: boolean
}

export type Category = {
  id: string
  name: string
  parentId: string | null
  defaultFlow: FlowKind
  origin: Origin
}

export type TableColumn = {
  id: string
  name: string
  type: ColumnType
  required: boolean
  enumValues?: string[]
}

export type CustomTable = {
  id: string
  name: string
  description: string
  columns: TableColumn[]
  origin: Origin
  createdAt: string
}

export type CustomTableRow = {
  id: string
  tableId: string
  cells: Record<string, string | number | null>
  origin: Origin
}

export type ColumnMapping = {
  tableId: string
  kind: 'transactions' | 'snapshots' | 'unmapped'
  roles: Partial<Record<SemanticRole, string>>
  snapshotRoles?: { date: string; account: string; value: string; costBasis?: string }
  flowVocabulary?: 'signed-amount' | 'debit-credit' | 'in-out-enum'
  defaultFlow?: FlowKind
}

export type Transaction = {
  id: string
  sourceTableId: string
  sourceRowId: string
  date: string
  accountId: string
  counterpartyAccountId: string | null
  categoryId: string | null
  amountMinor: number
  flow: FlowKind
  signedAmountMinor: number
  memo: string
  origin: Origin
  currency: CurrencyCode
}

export type AccountSnapshot = {
  id: string
  accountId: string
  date: string
  valueMinor: number
  costBasisMinor: number | null
  origin: Origin
  sourceTableId: string | null
}

export type MetricFilter = {
  accountIds?: string[]
  categoryIds?: string[]
  categoryNameContains?: string
  flows?: FlowKind[]
  tableIds?: string[]
}

export type MetricDef = {
  id: string
  label: string
  kind: MetricKind
  includeTransfers: boolean
  filter: MetricFilter
  aggregate: 'sum' | 'last' | 'avg'
  unit: 'money' | 'ratio' | 'count'
  currency?: CurrencyCode
}

export type ChartSeriesRef = {
  id: string
  metricId: string
  combinedFrom?: string[]
  labelOverride?: string
}

export type ChartSpec = {
  id: string
  title: string
  chartType: ChartType
  groupBy: 'month' | 'week' | 'day' | 'category' | 'account'
  series: ChartSeriesRef[]
  combineMode: 'separate' | 'combine'
  incompatibilityReason?: string | null
}

export type WidgetTypeId = 'kpi' | 'chart' | 'tablePreview' | 'trend' | 'customBlock'

export type IncomeSchedule = 'once' | 'monthly'

export type IncomeSource = {
  id: string
  name: string
  amountMinor: number
  accountId: string
  schedule: IncomeSchedule
  startDate: string
  dayOfMonth: number | null
  origin: Origin
}

export type PlannedExpenseCategory = 'phone' | 'trip' | 'bike' | 'other'

export type PlannedExpense = {
  id: string
  name: string
  amountMinor: number
  date: string
  category: PlannedExpenseCategory
  active: boolean
  origin: Origin
}

export type ForecastSettings = {
  id: 'default'
  months: number
  spendLookback: number | 'all'
  mutualFundAnnualReturnPct: number
  stockAnnualReturnPct: number
  salaryAnnualGrowthPct: number
  salaryGrowthStartMonth: string
  adjustments?: ForecastAdjustment[]
  updatedAt: string
}

export type ForecastAdjustment = {
  effectiveMonth: string
  salaryMinor?: number
  livingCostMinor?: number
  mutualFundSipMinor?: number
  stockSipMinor?: number
}

export type HoldingKind = 'mutual_fund' | 'stock'
export type PurchaseMode = 'sip' | 'lumpsum'
export type SipStatus = 'paid' | 'skipped' | 'cancelled' | 'failed'

export type Holding = {
  id: string
  name: string
  kind: HoldingKind
  purchaseMode: PurchaseMode
  currentMinor: number
  investedMinor: number
  qty: number | null
  ticker?: string | null
  buyDate?: string | null
  avgPrice: number | null
  marketPrice: number | null
  sipAmountMinor: number | null
  sipDayOfMonth: number | null
  sipStartMonth: string | null
  notes: string
  origin: Origin
}

export type PriceQuote = {
  id: string
  ticker: string
  date: string
  closeMinor: number
  fetchedAt: string
}

export type SipEvent = {
  id: string
  holdingId: string
  month: string
  status: SipStatus
  amountMinor: number | null
  notedAt: string
  origin: Origin
}

export type WidgetInstance = {
  id: string
  type: WidgetTypeId
  title: string
  visible: boolean
  order: number
  config: Record<string, unknown>
}

export type WealthFlags = {
  bankSavings: boolean
  mutualFunds: boolean
  stocks: boolean
}

export type WealthView = WealthFlags & { combine: boolean }

export const defaultWealthView: WealthView = {
  bankSavings: true,
  mutualFunds: true,
  stocks: true,
  combine: false,
}

export type DashboardLayout = {
  widgets: WidgetInstance[]
  wealth?: WealthView
  views?: DashboardViewSettings
}

export type DashboardDateRange = { from: string; to: string }

export type DashboardViewSettings = {
  moneyFlow: { range: DashboardDateRange; series: string[] }
  saving: { range: DashboardDateRange; series: string[] }
  investment: { range: DashboardDateRange; stockIds: string[]; view: 'table' | 'line' | 'pie'; metric: 'value' | 'percent' }
  income: { range: DashboardDateRange }
  lifestyle: { range: DashboardDateRange; series: string[] }
}

export type BackupFile = {
  app: 'finance-local'
  formatVersion: 1
  exportedAt: string
  stores: Record<string, unknown[]>
}

export type StoreData = {
  accounts: Account[]
  categories: Category[]
  customTables: CustomTable[]
  customTableRows: CustomTableRow[]
  columnMappings: ColumnMapping[]
  transactions: Transaction[]
  snapshots: AccountSnapshot[]
  metrics: MetricDef[]
  chartSpecs: ChartSpec[]
  dashboard: DashboardLayout
  holdings: Holding[]
  sipEvents: SipEvent[]
  incomeSources: IncomeSource[]
  plannedExpenses: PlannedExpense[]
  forecastSettings: ForecastSettings | null
}
