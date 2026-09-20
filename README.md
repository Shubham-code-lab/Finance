# Finance

**Live site:** https://shubham-code-lab.github.io/Finance/

Local-first personal finance dashboard. Import or enter transactions, run correct savings and net-worth math, and build charts that respect inflow vs outflow.

The app is a React SPA backed by Google Sign-In and Cloud Firestore. It implements custom tables, dashboard widgets, chart semantics, CSV/Excel and PDF import, and JSON backup/restore.

## Constraints (non-negotiable)

- React, TypeScript, Vite
- Charts: Recharts
- Styles: `react-jss` + `createUseStyles` only — no inline styles, no Material UI, no Tailwind
- Compact professional UI: light gray page, white cards, subtle borders, dense but readable
- Design tokens for color, spacing, type
- Finance records are isolated under the signed-in user's Firestore document
- Browser persistence is disabled for finance data; Firestore uses an in-memory client cache
- Host the built frontend on GitHub Pages (static only)
- Core math must be unit-tested

## Docs (start here)

| Doc | Purpose |
| --- | --- |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | What was built, in order |
| [docs/STOCK-PERFORMANCE.md](docs/STOCK-PERFORMANCE.md) | Lump-sum stock market history (specified, not built) |
| [docs/CHATGPT-STOCK-PERFORMANCE.md](docs/CHATGPT-STOCK-PERFORMANCE.md) | Paste-ready ChatGPT 5.5 prompt for that feature |
| [docs/CODEX-BRIEF.md](docs/CODEX-BRIEF.md) | Ordered implementation brief. Paste this into Codex. |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Layers, folders, storage, dashboard widgets |
| [docs/DATA-MODEL.md](docs/DATA-MODEL.md) | Types, tables, transactions, metrics |
| [docs/CHART-SEMANTICS.md](docs/CHART-SEMANTICS.md) | Inflow/outflow rules, combine vs separate series |
| [docs/DATA-INGESTION.md](docs/DATA-INGESTION.md) | Custom tables (v1), CSV/Excel, PDF later |
| [docs/CALCULATIONS.md](docs/CALCULATIONS.md) | Savings, rate, net worth, investment P/L |
| [docs/UI.md](docs/UI.md) | Tokens, layout, widget chrome |

## Status

- [x] Design: model, architecture, chart semantics, ingestion strategy
- [x] Scaffold app (Vite + React + TS)
- [x] Implement store, math, tables, dashboard, chart builder
- [x] CSV/Excel import, PDF stub, backup export/import
- [x] User holdings + SIP month records (paid / skipped / failed / cancelled)
- [x] Declared income + future cash trend widget
- [x] Groww snapshot constants removed from product seed

See [docs/CHANGELOG.md](docs/CHANGELOG.md) for the personal SIP dump (one reload, then UI only).

## Development

```bash
npm install
npm run dev
npm test
npm run build
```

If `npm` is not on PATH on Windows, initialize Node through `fnm` first:

```powershell
$env:PATH = "$env:LOCALAPPDATA\Microsoft\WinGet\Links;$env:PATH"
fnm env --use-on-cd --shell powershell | Out-String | Invoke-Expression
```

## GitHub Pages

The site is deployed from `main` by [the publish workflow](.github/workflows/publish.yml) when `release.json` has `"publish": true`. The production build uses `/Finance/` as its base path.

Repository changes should be made on a ticket branch and merged through a pull request. CI runs linting, formatting checks, tests, and a production build before merge. Personal statements and spreadsheet exports must never be committed.

After the first deployment, add `shubham-code-lab.github.io` to Firebase Authentication's authorized domains so Google sign-in works on the hosted dashboard.
