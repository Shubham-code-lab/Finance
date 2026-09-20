# Data model

IDs: `crypto.randomUUID()`. Dates: ISO `YYYY-MM-DD` in the user’s local calendar, stored as strings. Money in calc: integer minor units. UI may collect decimals; convert at the boundary.

## Money

```ts
type CurrencyCode = string // 'INR' | 'USD' | ...

type Money = {
  amountMinor: number // integer, signed only on Transaction.signedAmountMinor
  currency: CurrencyCode
}
```

Canonical transactions use **unsigned amount + flow**, plus a derived signed value for math:

- `inflow` → `+amountMinor`
- `outflow` → `-amountMinor`
- `neutral` → `+amountMinor` (must not be treated as income or spend)
- `transfer` → zero effect on income/spend; moves value between accounts

## Account

```ts
type AccountType =
  | 'checking'
  | 'savings'
  | 'credit'
  | 'cash'
  | 'investment'
  | 'liability'
  | 'other'

type Account = {
  id: string
  name: string
  type: AccountType
  currency: CurrencyCode
  origin: 'demo' | 'user'
  archived: boolean
}
```

Credit cards: balances in snapshots are liabilities (positive liability = amount owed).

## Category

```ts
type Category = {
  id: string
  name: string
  parentId: string | null
  defaultFlow: FlowKind // used when a row has no flow column
  origin: 'demo' | 'user'
}

type FlowKind = 'inflow' | 'outflow' | 'neutral' | 'transfer'
```

## Custom tables (user-defined)

Primary way to enter data in v1. A table is **not** required to be transactions. It becomes transactions only when a mapping exists.

```ts
type ColumnType = 'date' | 'number' | 'text' | 'enum' | 'accountRef' | 'categoryRef'

type TableColumn = {
  id: string
  name: string
  type: ColumnType
  required: boolean
  enumValues?: string[]
}

type CustomTable = {
  id: string
  name: string
  description: string
  columns: TableColumn[]
  origin: 'demo' | 'user'
  createdAt: string
}

type CustomTableRow = {
  id: string
  tableId: string
  cells: Record<string, string | number | null> // keyed by column id
  origin: 'demo' | 'user'
}
```

### Semantic mapping

```ts
type SemanticRole =
  | 'date'
  | 'amount'
  | 'flow'          // inflow/outflow/neutral/transfer or debit/credit
  | 'account'
  | 'counterpartyAccount'
  | 'category'
  | 'memo'
  | 'ignore'

type ColumnMapping = {
  tableId: string
  roles: Partial<Record<SemanticRole, string>> // role → columnId
  flowVocabulary?: 'signed-amount' | 'debit-credit' | 'in-out-enum'
  /** If no flow column: treat all rows as this, or infer from category */
  defaultFlow?: FlowKind
}
```

Minimum mapping to produce transactions: `date` + `amount` + (`flow` or `defaultFlow` or `category` with `defaultFlow`).

A second table type for net worth / investments:

```ts
type SnapshotMapping = {
  tableId: string
  roles: {
    date: string
    account: string
    value: string      // market value
    costBasis?: string
  }
}
```

UI: table settings has a toggle **This table is** → `transactions` | `snapshots` | `unmapped (notes only)`.

## Canonical transaction

```ts
type Transaction = {
  id: string
  sourceTableId: string
  sourceRowId: string
  date: string
  accountId: string
  counterpartyAccountId: string | null
  categoryId: string | null
  amountMinor: number          // always >= 0
  flow: FlowKind
  signedAmountMinor: number    // derived, stored for convenience
  memo: string
  origin: 'demo' | 'user'
  currency: CurrencyCode
}
```

Rebuild transactions for a table whenever rows or mapping change. Do not let users edit canonical txs independently in v1 (edit the table row).

## Snapshots

```ts
type AccountSnapshot = {
  id: string
  accountId: string
  date: string
  valueMinor: number     // market or statement balance
  costBasisMinor: number | null
  origin: 'demo' | 'user'
  sourceTableId: string | null
}
```

## Metric definition

Metrics are first-class so the chart builder and KPI widgets share one definition.

```ts
type MetricKind = 'inflow' | 'outflow' | 'neutral'

type MetricDef = {
  id: string
  label: string
  kind: MetricKind
  /** transfer is excluded from income/spend metrics unless includeTransfers */
  includeTransfers: boolean
  filter: MetricFilter
  aggregate: 'sum' | 'last' | 'avg'
  unit: 'money' | 'ratio' | 'count'
}

type MetricFilter = {
  accountIds?: string[]
  categoryIds?: string[]
  categoryNameContains?: string
  flows?: FlowKind[]
  tableIds?: string[]
}
```

System metrics (seed, not deletable):

| id | label | kind | meaning |
| --- | --- | --- | --- |
| `income` | Income | inflow | flow=inflow, not transfer |
| `spend` | Spending | outflow | flow=outflow, not transfer |
| `invest_out` | Invested (contributions) | outflow | category or account filter on investment funding |
| `invest_value` | Investment value | neutral | last snapshot of investment accounts |
| `net_cashflow` | Net cashflow | **neutral** | income − spend; **derived**, not a combine of two chart series |
| `savings` | Savings | **neutral** | see CALCULATIONS.md |
| `savings_rate` | Savings rate | **neutral** | ratio |
| `net_worth` | Net worth | **neutral** | assets − liabilities |
| `invest_pl` | Investment gain/loss | **neutral** | see CALCULATIONS.md |

Users can clone a metric and tighten filters (“Food spend”, “Bike savings”).

**Net cashflow is a derived metric.** The chart builder must not create it by “combining” income + spend series. Combining those is illegal (see CHART-SEMANTICS.md). Users add `net_cashflow` as its own series if they want the net line.

## Chart spec

```ts
type ChartType = 'line' | 'bar' | 'area'

type ChartSeriesRef = {
  id: string
  metricId: string
  /** If set, this series is a legal combine of several metric ids */
  combinedFrom?: string[]
  labelOverride?: string
}

type ChartSpec = {
  id: string
  title: string
  chartType: ChartType
  groupBy: 'month' | 'week' | 'day' | 'category' | 'account'
  series: ChartSeriesRef[]
  combineMode: 'separate' | 'combine' // UI may only set combine when legal
  incompatibilityReason?: string | null
}
```

## Income sources

Declared income (not inferred UPI credits) lives in `incomeSources`:

```ts
type IncomeSchedule = 'once' | 'monthly'

type IncomeSource = {
  id: string
  name: string
  amountMinor: number
  accountId: string
  schedule: IncomeSchedule
  startDate: string // YYYY-MM-DD, defaults to today
  dayOfMonth: number | null // monthly; 31 = last calendar day
}
```

KPI `income` uses these rows when any exist. Lump sum fires on `startDate` only. Monthly fires on `dateOnDay(month, dayOfMonth)` from `startDate` onward.

## Holdings and SIP months

Holdings are first-class records (`holdings` store), not dashboard widgets. Kind is `mutual_fund` | `stock`. Purchase mode is `sip` | `lumpsum`.

```ts
type SipEvent = {
  id: string
  holdingId: string
  month: string // YYYY-MM
  status: 'paid' | 'skipped' | 'cancelled' | 'failed'
  amountMinor: number | null
}
```

| Status | Meaning |
| --- | --- |
| `paid` | Instalment went through. `amountMinor` is the debit for that month. |
| `skipped` | Intentionally skipped. |
| `failed` | Attempted and failed (mandate / order fail). Counts as answered. SIP stays active. |
| `cancelled` | SIP stopped from that month onward. No further reminders. Forecast drops that holding’s SIP. |

One event per holding per `YYYY-MM`. The UI only reads/writes those rows. The top bar asks for a month with no event yet, and only on or after that holding’s `sipDayOfMonth` (31 = last calendar day).

Product seed does **not** create holdings. A personal one-shot dump may write your history once (`meta.oncePersonalSipDump`); that is not the empty-user path.


```ts
type BackupFile = {
  app: 'finance-local'
  formatVersion: 1
  exportedAt: string
  stores: Record<string, unknown[]>
}
```
