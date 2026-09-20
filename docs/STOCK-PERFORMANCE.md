# Lump-sum stock performance (market prices)

Status: **specified, not implemented.** Implement from `docs/CHATGPT-STOCK-PERFORMANCE.md`.

## Where (and where not)

**Only** the dashboard homepage **Investment** section (`src/dashboard/Dashboard.tsx`, heading `Investment`).

- Do **not** add a nav item, “investment tab”, or second holdings page.
- Do **not** put this graph on Mutual funds, Stocks, Saving, or the main money-flow chart.
- **Stocks / Mutual funds** add-edit stays as it is (SIP vs lump sum). Do not rebuild that CRUD. If lump-sum stocks still lack ticker and buy date, add **only those two fields** on the existing Stocks form so the graph has something to fetch. No other holdings UX change.

## Dropdown (replaces Investment checkboxes for this graph)

In the Investment section header, next to the existing **date range** picker:

- A **searchable multi-select** dropdown of holdings that are **not SIP** (`purchaseMode !== 'sip'`).
- First option: **Select all**.
- Rest: each lump-sum stock by name (search filters this list).
- Selecting an option **adds that stock as its own line** on **this section’s graph only**.
- Deselecting removes the line.
- SIP holdings **must not appear** in the dropdown. No SIP tick, no SIP line on this graph. Remove the current Investment-panel **SIP** checkbox.

Keep the Investment **date range** on this graph (`DateRangePicker` already on that section).

## How lines must look

Example: buy A on **1 Jan**, buy B on **1 Feb**. User selects both.

- Line A starts on 1 Jan (or next trading day).
- Line B starts on **1 Feb**. It must **not** be drawn from January. Points before that buy date are omitted / `null` (Recharts connectNulls false).
- Shared x-axis is the section date range, but each series is silent until its own `buyDate`.

Each **point** is that position’s **market value** that day, and the tooltip shows how much it **rose or fell vs cost** (₹ and %), not a blank price.

```
buyClose     = close on buy date (or next trading day)
qty          = holding.qty if set, else invested / buyClose
value(date)  = qty * close(date)     // only date >= buyDate
cost         = amount invested
pnl(date)    = value(date) - cost
pnlPct       = cost ? pnl / cost : null
```

Table beside the graph (existing Investment table): for selected names — invested, live value, P/L, P/L %, buy date.

## User data the graph needs

Already on holdings: name, invested, qty (optional), lump vs SIP.

Still required for fetch (add on existing Stocks lump-sum form if missing):

| Field | Notes |
| --- | --- |
| Ticker | Yahoo/NSE, e.g. `TATAPOWER.NS` |
| Invested on | `YYYY-MM-DD` |

No ticker / no buy date → omit from dropdown (or show disabled with “add ticker”). Do not invent symbols. Do not put tickers in `_oncePersonalSipDump.ts`.

## Fetch

No Groww integration. No API keys committed to the repo. NSE quotes use Yahoo `.NS`; daily bars are cached in the signed-in user's Firestore `priceQuotes` collection.

CORS: prefer a source that works on static GitHub Pages; Vite **dev** proxy only if needed; never fake prices. One ticker failing must not crash the page.

## Optional: news for a spike (do not block the graph)

**Optional.** Click or tooltip on a point may show “why it moved” that day.

Do **not** scrape Google HTML (blocked, brittle, against ToS). If you ship this, use a **public news search API** or a documented CORS-friendly RSS, query `{stock name} {date}`, show 1–3 headlines. If CORS/quota fails, hide news and keep the price line. Skip news entirely if it would delay the graph.

## Files

```
src/market/          # fetch + Firestore cache
src/calc/stockPerformance.ts   # pure + tests
src/components/SearchMultiSelect.tsx  # JSS, searchable multi-select + Select all
# extend Dashboard Investment section only
```

Tests: SIP excluded from options; line B has no points before Feb 1; holiday = next bar; empty bars no throw; qty from amount/close.

## Stack / do not break

Same stack as today (React, Vite, Recharts, `react-jss`, tokens, `@/`). No Tailwind, no MUI layout. Icons-only MUI is already in Dashboard.

Do not break SIP events, notifications, SIP snapshot staircase, bank ledgers, income, forecast, chart combine rules. Do not wipe holdings.
