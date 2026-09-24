# Changelog

## 1.1.0

- Added real historical mutual-fund NAV charts with Price and Change % modes.
- Changed mutual-fund and stock-investment chips to optional emphasis controls; all saved holdings remain visible.
- Added equal-weight Market moments analysis to comparison, investment, mutual-fund, and India top-return charts.
- Added up to five separated drawdowns and highs with a single user-pinned vertical marker to avoid chart clutter.
- Suppressed long-term drop/high signals for date ranges shorter than three months.
- Added tests for mutual-fund scheme matching, NAV parsing, equal-weight performance, and market-moment detection.

## 1.0.0

- Added the React, TypeScript, Vite, Recharts, and Firebase application.
- Added dashboard, account, income, investment, market-comparison, import, and planning views.
- Added user-scoped Firestore persistence and Google authentication.
- Added CSV, spreadsheet, PDF, and JSON import workflows without bundling user source files.
- Added privacy masking, confirmation dialogs, responsive controls, and loading states.
- Added automated calculation, parsing, storage, market-data, and forecast tests.
- Added GitHub pull-request checks and GitHub Pages deployment.

Personal statements, transactions, holdings, SIP history, and account balances are intentionally excluded from the repository. They are loaded from the authenticated user's Firebase records or imported locally through the application.
