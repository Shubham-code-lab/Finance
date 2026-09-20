# Paste this into ChatGPT 5.5

Copy everything under **Prompt** through the end of this file.

---

## Prompt

You are implementing one feature in the existing Finance SPA. Spec: `docs/STOCK-PERFORMANCE.md`. Do not improvise a new page.

### Repo

- `d:\Project\Finance`. Read `AGENTS.md`, `docs/STOCK-PERFORMANCE.md`, then `src/dashboard/Dashboard.tsx` (Investment section), `src/features/holdings/HoldingsView.tsx`, `src/domain/types.ts`, `src/storage/db.ts`.
- No Jira. No git push / config. Commit only if asked. `npm test` and `npm run build` when done.

### UI location — dashboard homepage only

Put this **only** in the dashboard **Investment** section (homepage). Do **not** add a nav tab, investment page, or graph on Stocks / Mutual funds / Saving / money-flow.

Holdings add/edit (SIP vs lump sum) **stays as it is**. Do not rebuild it. If lump-sum stocks have no ticker or buy date, add **only those two fields** on the existing Stocks form.

### Investment section controls

Replace the Investment SIP/MF/Stocks **checkboxes** used for this graph with:

1. Existing **date range** picker (keep it; this graph uses it).
2. A **searchable multi-select dropdown**:
   - Search box inside the dropdown.
   - Option **Select all**.
   - Other options: each **non-SIP** lump-sum stock (`purchaseMode !== 'sip'`).
   - SIP must **not** be in the list. Remove the Investment **SIP** checkbox/line.
   - Each selected name **adds one line** on this section’s graph. Deselect removes it.

Use `react-jss` + tokens. No Tailwind. No MUI `Box`/`sx`. Build a small `SearchMultiSelect` if nothing exists.

### Graph rules

- Fetch public daily closes (Yahoo `.NS` for NSE) from each stock’s **buy date** through the range end.
- **Staggered starts:** if A was bought 1 Jan and B 1 Feb, B’s line **starts in February**. No points for B in January (`null` / omit; do not connect across).
- Each point = position **market value** that day. Tooltip: value, P/L ₹ vs cost, P/L % (“how much it raised”).
- Math (minor units in `src/calc/stockPerformance.ts`, tested): `qty = qty ?? invested/buyClose`; `value = qty * close` for dates >= buyDate.

### Fetch / cache

No Groww integration and no API keys committed to the repo. Cache quotes in the signed-in user's Firestore `priceQuotes` collection. Use a Vite dev proxy only if CORS blocks; never fake prices.

### Optional news (skip if hard)

Optional: on a point, headlines for that stock+day. **Do not scrape Google.** Public news API or skip. Graph must ship without news.

### Done when

1. Homepage → Investment: searchable multi-select + date range.
2. Select two non-SIP stocks → two lines; later buy does not start on the earlier date.
3. SIP not in the dropdown.
4. Tooltip shows value and gain vs cost.
5. Tests + build pass.
