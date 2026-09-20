# Data ingestion

## Decision: tables plus bank-specific importers

PDF layouts differ by institution, so each supported bank has its own parser. ICICI password-protected text PDFs are supported. The password stays in browser memory only and is cleared after extraction.

The importer previews additions, updates, unchanged rows, and preserved history before writing. Stable references and transaction fingerprints make overlapping uploads idempotent.

```
User creates table ──► types rows
                 ├──► imports CSV/XLSX into columns
                 └──► imports password-protected ICICI PDF statements
                        └──► maps roles
                              └──► canonical transactions / snapshots
```

## Custom tables (required for v1)

### Create table

Wizard:

1. Name, optional description  
2. Start from template or blank  
3. Edit columns  

Templates (seed):

| Template | Columns | Maps to |
| --- | --- | --- |
| Transactions | Date, Amount, Flow, Account, Category, Memo | `Transaction` |
| Simple spend log | Date, Amount, Category, Memo | transactions, `defaultFlow: outflow` |
| Account snapshots | Date, Account, Value, Cost basis | `AccountSnapshot` |
| Blank | one text column “Notes” | unmapped until user adds columns |

### Column editor

- Add / rename / delete column  
- Type: date, number, text, enum, accountRef, categoryRef  
- Cannot delete a column that is mapped until mapping is cleared  

### Rows

- Spreadsheet-like dense grid (not huge padded cards)  
- Add row, duplicate, delete  
- accountRef / categoryRef as dropdowns from domain lists  
- Paste from clipboard (TSV) is a plus; not required for first cut  

### Mapping

Settings panel on the table:

- Table kind: transactions | snapshots | unmapped  
- Role → column  
- Flow vocabulary:  
  - `in-out-enum` (values inflow/outflow/…)  
  - `debit-credit`  
  - `signed-amount` (negative = outflow)  
- Validation messages: missing date, non-numeric amount, unknown account  

Unmapped tables are allowed (scratch pads). They never affect KPIs.

### Multiple tables

User can have many tables (HDFC CSV dump, cash notebook, brokerage snapshots). Normalization unions all mapped transaction tables.

## CSV / Excel

- Accept `.csv`, `.xlsx`  
- Parse in the browser (`Papa Parse` or similar for CSV; `xlsx` / `exceljs` for Excel — pick one and keep the bundle reasonable)  
- Flow: upload → preview first 20 rows → create new table **or** append to existing if columns match by name  
- Do not write a parser per bank. User maps headers to roles once; save mapping on that table  

Header matching (optional helper): case-insensitive equals for `date`, `amount`, `description`, `debit`, `credit`. Never silently swap debit/credit.

## PDF

- ICICI text statements are supported through `features/import/iciciStatement.ts`.
- Every upload asks for the password; passwords and PDF blobs are never persisted.
- Scanned PDFs still require a future OCR importer.
- Other banks require separate parsers and fixtures.

## Manual correctness

Prefer a correct row the user typed over a guessed PDF line. Tables make that the default path.
