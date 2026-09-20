# Architecture

Three layers. Never mix them in one module.

```
raw (Firestore records, import files, table rows)
  → normalize (canonical Transaction, Account, Snapshot)
    → calculate (pure functions → MetricSeries, KPI values)
      → present (widgets, Recharts, JSS)
```

- **Raw** may be messy, user-typed, or bank-exported. Persist it as-is plus a mapping.
- **Normalized** is the only input to math.
- **Calculated** values are not stored except as optional cache with a schema version; recompute from normalized data on load.
- **Presentation** never owns formulas. Widgets subscribe to calculated series.

## Folder layout (target)

```
src/
  app/                 # routes, shell, providers
  theme/               # tokens, ThemeProvider, global JSS
  storage/             # Firestore repositories and collection definitions
  domain/              # types only
  normalize/           # table rows + mappings → Transaction[]
  calc/                # pure math, combine rules (tested)
  ingest/              # csv, xlsx parsers; pdf stub
  dashboard/           # layout, widget registry, drag
  charts/              # chart spec, builder UI, Recharts adapters
  features/
    tables/            # custom table CRUD
    accounts/
    holdings/          # MF/stock screens; snapshotsFromHoldings
    income/
    backup/
    demo/              # ledger reload; no Groww holding seed
  components/          # shared presentational (Button, Card, Modal)
```

## Runtime

- SPA. `HashRouter` is preferred for GitHub Pages (no server rewrites).
- Google authentication gates all application data.
- Firestore is the sole runtime persistence layer for finance records.
- All money math in `src/calc` using integer **minor units** (cents) internally. Display layer formats.

## Persistence

The UI still works with the same `StoreData` arrays, but Firestore stores them in compact documents beneath `/users/{uid}/dataBundles`. High-volume records are grouped by month; small stores use one document.

| Logical store | Bundle strategy | Notes |
| --- | --- | --- |
| `transactions` | two documents per month | Canonical cash-flow records |
| `snapshots` | two documents per month | Historical account values |
| `customTableRows` | one document per table and month | Raw imported or user-entered rows |
| `priceQuotes` | dedicated quote-cache collections | Compact cached market prices; excluded from general bundle loading |
| `sipEvents`, `imports` | one document per year | Monthly status and import audit records |
| all small stores | one document per store | Accounts, categories, tables, mappings, holdings, income, forecasts, charts, and dashboard settings |

`/users/{uid}/system/bundled-storage-v1` is the migration checkpoint and cache revision. The migration is resumable and never deletes legacy records. Normal reloads use Firebase's persistent browser cache; the explicit refresh command checks the server.

Market quotes do not participate in the general bundle revision. The cache uses two layouts for different access patterns. A full-market scan uses `/marketQuoteCache`: each annual shard stores compact date/close arrays for multiple tickers, so a 500-stock one-year scan touches at most 16 documents. A small comparison uses `/marketTickerQuoteCache`: one compact all-years document per ticker is loaded with a single batched query for up to 30 selected stocks. Both layouts read Firestore's persistent local cache first, and quote data is not retained in a large application-memory cache.

The current comparison stocks and all named watchlists share one compact `/users/{uid}/settings/stock-lists` document. It is read once when the stock workspace loads and written with an 800 ms debounce only after the lists change. Chart filters remain browser preferences and are not included in this cloud document.

Do not store File blobs long-term in v1. Store parsed rows in the table.

Backup remains a JSON dump of the logical stores. Import replaces the signed-in user's bundled dataset after confirmation.

## Dashboard widgets

Layout model (persist this):

```ts
type WidgetInstance = {
  id: string
  type: WidgetTypeId
  title: string
  visible: boolean
  order: number          // simple list reorder is enough for v1
  // optional later: { x, y, w, h } for a real grid
  config: Record<string, unknown>
}

type WidgetTypeId =
  | 'kpi'
  | 'chart'
  | 'tablePreview'
  | 'customBlock'        // registry extension point
```

v1 UX:

- Visible widgets in a dense CSS grid (not giant cards).
- Drag handle to reorder (`order`).
- Hide/show from a widget catalog.
- Register new types in `widgetRegistry` without changing the dashboard shell.

Later: free-form grid (`w`/`h`). Keep `order` working if grid is not done.

A **custom block** later (total food spend, bike savings) is:

1. A `MetricDef` (how to compute)
2. A widget type that renders that metric (KPI or chart)
3. Optional `ChartSpec`

Do not hard-code “food” into the dashboard. Seed examples via demo metrics.

## Normalization pipeline

```
CustomTable + ColumnMapping + rows
        │
        ▼
  normalizeTable(table, mapping, rows) → Transaction[] | MappingError[]
        │
        ▼
  upsertTransactionsForTable(tableId, txs)
        │
        ▼
  calc.select(txs, accounts, snapshots, query) → Series[]
```

If mapping is incomplete, the table still stores rows. Dashboard charts only use canonical transactions + snapshots.

## Demo data

On first visit, seed:

- 3 accounts (checking, savings, brokerage)
- Categories (salary, groceries, rent, bike, index fund)
- One transactions table with ~40 rows over 6 months
- One holdings snapshot table
- Default dashboard + 2 chart specs (spend vs invest as **two series**; savings accounts combined example)

`meta.demoSeeded = true`. Button **Clear demo data** deletes records with `origin: 'demo'` only. User tables stay.

## Testing strategy

- `src/calc/**/*.test.ts` — required
- `src/normalize/**/*.test.ts` — mapping edge cases
- `src/charts/combine.test.ts` — compatibility
- No requirement to test JSS or drag-and-drop in v1
