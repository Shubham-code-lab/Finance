# Codex implementation brief — Finance

Paste this whole file into Codex. Do not query Jira. Do not invent a backend.

You are implementing a **client-only** personal finance web app from the docs in this repo. Read every file under `docs/` before writing code. Follow them over any improvisation.

## Environment

- Repo root: this folder (`Finance/`). `git` is already initialized.
- Node: use `fnm` if `npm` is missing from PATH (`fnm env` then use that Node). Do not assume `C:\Program Files\nodejs`.
- Do not push. Do not change git config. Commit only if the user asks.

## Stack

- React + TypeScript + Vite
- Recharts
- `react-jss` with `createUseStyles` — **no** inline `style={{}}`, **no** CSS-in-JS other than JSS, **no** MUI, **no** Tailwind
- IndexedDB (prefer `idb`)
- Vitest for calculation tests
- GitHub Pages static deploy (`base` path configurable)

## Product in one paragraph

User creates **custom tables** (or imports CSV/XLSX into a table), maps columns to a canonical transaction model, stores everything locally, then builds a **movable widget dashboard** and a **chart builder**. Charts understand **inflow / outflow / neutral**. Unlike types can share a chart as **separate series**. Same-type series may **combine** into one line. Inflow and outflow must **never** be summed into one series. PDF import is a **stub for later**.

## Implementation order (do this sequence)

### 1. Scaffold

- Vite React-TS app at repo root (or `app/` if you must; prefer root).
- Path alias `@/` → `src/`.
- Vitest + happy-dom or jsdom.
- `vite.config.ts` with `base` from env (`BASE_PATH` default `/`).

### 2. Design tokens + JSS theme

Implement `docs/UI.md`. Global reset, light gray canvas, compact cards. Every visual style goes through `createUseStyles` and tokens.

### 3. Domain types + IndexedDB

Implement `docs/DATA-MODEL.md` and the storage section of `docs/ARCHITECTURE.md`. Empty DB is valid. Versioned schema with a migrate function.

### 4. Calculation engine + tests first

Implement `docs/CALCULATIONS.md` as **pure functions** with no DOM/IndexedDB. Tests for savings, savings rate, net worth, investment gain/loss, transfer exclusion, combine-compatibility. Do not skip tests.

### 5. Custom tables (primary data path)

Implement `docs/DATA-INGESTION.md` custom tables:

- Create table (name + columns)
- Add / edit / delete rows
- Map columns to semantic roles
- Normalize mapped tables into canonical `Transaction[]`
- Seed demo tables + “Clear demo data” that does not delete user-created tables

### 6. CSV / Excel import into a table

Parse CSV and xlsx, preview, map columns, write into a custom table. Do not auto-guess bank formats beyond header matching.

### 7. PDF stub

UI: import source list includes PDF, disabled or “Coming later”, link to the PDF section in `DATA-INGESTION.md`. No fake parser.

### 8. Dashboard widgets

Grid of widgets: drag to rearrange, hide/show, persist layout. Widget types: KPI, chart, table preview. Leave a registry so new block types can be registered later (food spend, bike savings).

### 9. Chart builder + semantics

Implement `docs/CHART-SEMANTICS.md` exactly. Combine control only when compatible. Otherwise separate series + explanation string. Multi-series compare (spend vs invest) as two lines, never one summed line if kinds differ.

### 10. Backup

JSON export of the full store. Import replace (v1). Confirm before wipe.

### 11. GitHub Pages notes

Document deploy in README: `npm run build` and publish `dist`. Hash router or `404.html` copy of `index.html` for SPA.

## Out of scope for this pass

- Server, auth, cloud sync
- Real PDF extraction
- Native mobile
- Tax lots beyond the cost-basis model in CALCULATIONS.md
- Jira, Linear, or any ticket IDs

## Definition of done

- `npm test` passes for math + combine rules
- Demo data loads; clear demo works
- User can create a table, add rows, see KPIs and a chart
- Chart builder refuses illegal combine and explains why
- Backup export/import round-trips
- UI matches tokens; no inline styles; no Tailwind/MUI
