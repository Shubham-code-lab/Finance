# Calculations

All functions are pure: `(normalized data, range) => result`. Use integer minor units. Round display only at the edge.

Time range: inclusive `from` / `to` dates. KPIs on the dashboard default to current calendar month and YTD; charts use the spec’s groupBy.

Exclude `flow === 'transfer'` from income, spend, savings, and savings rate unless a metric sets `includeTransfers`.

When `incomeSources` exist, **Income** is the sum of those scheduled occurrences in range (lump sum on its date; salary on its day each month). Ledger credits are still stored as transactions for the bank balance chart, but they do not inflate the Income KPI.

## Forecast

Future months (dashboard trend widget):

```
projected_income = scheduled income in that month
projected_spend  = average lifestyle spend of the previous 3 complete months
projected_sip    = sum of SIP amounts on holdings that have no cancelled sipEvent
# skipped and failed months do not drop the holding from the projection
projected_net    = income - spend - sip
projected_bank   = last known bank snapshots + cumulative projected_net
```

Forecast settings may include dated monthly adjustments for salary, living cost, mutual-fund SIP, and stock SIP. Each adjustment becomes effective in its selected month and carries forward independently until a later adjustment changes that field. Adjustments are applied in chronological order before calculating that month's bank, investment, and net-worth balances. A dated salary becomes the new monthly salary baseline; configured annual salary growth continues on its yearly schedule after that change unless its rate is set to zero.

Income, spend, and SIP are plotted as separate series. Do not combine inflow with outflow.

## Income and spend

```
income = sum of amountMinor where flow === 'inflow'
spend  = sum of amountMinor where flow === 'outflow'
```

## Net cashflow (neutral, derived)

```
net_cashflow = income - spend
```

Not a chart combine of two series. Own metric.

## Savings

v1 definition (document in the UI tooltip):

```
savings = income - spend - invest_out
```

`invest_out` = outflows whose category (or account) is tagged investment contribution. If the user has not tagged any investment category, `invest_out = 0` and savings = income − spend.

Rationale: money moved into investments is still “saved”, but we also expose `invest_out` separately so charts can compare lifestyle spend vs investing. **KPI “Savings”** should equal income − spend (cash saved, including amounts that later became investments) **or** we split two KPIs:

| KPI | Formula |
| --- | --- |
| Cash surplus | `income - spend` including investment contributions as spend if they were recorded as outflow from checking |
| Savings (economic) | `income - non_invest_spend` |

**Pick this and test it:**

- Treat investment contributions as **outflow** on the checking account (they are).  
- **Savings** = `income - spend` where `spend` includes groceries, rent, **and** investment contributions. That understates “saved”.  
- Better: **Savings** = `income - spend_ex_invest` and **Invested** = `invest_out`. Then `savings + invested = income - lifestyle_spend`.

Implement:

```
lifestyle_spend = outflows whose category is not investment
invest_out      = outflows whose category is investment
savings         = income - lifestyle_spend
  // equals lifestyle leftover, including cash that stayed in checking
```

Cash that stays in checking is included in savings. Contributions to brokerage are also savings economically; they appear in `invest_out` and in investment value, not in lifestyle spend.

**Savings rate**

```
savings_rate = income === 0 ? null : savings / income
```

`null` means “undefined”, UI shows “—”. Never divide by zero. Do not clamp silently without a test.

## Net worth

As of date `D` (default: today):

```
assets = sum of latest snapshot valueMinor for accounts type in checking, savings, cash, investment
         If no snapshot, fall back to: opening 0 + sum of signed txs on that account up to D
liabilities = sum of latest snapshot for credit + liability
net_worth = assets - liabilities
```

Credit card: snapshot value is amount owed (positive liability).

The dashboard labels the positive balance sum as **Total assets** and shows **Net worth** separately. The Accounts table repeats assets, liabilities, and net worth using exact paise so its totals reconcile with the dashboard even when individual whole-rupee values would round in different directions.

The dashboard **Investments** value is the current mutual-fund balance plus the current stock balance. Do not add the current month's SIP again: purchased SIP units are already represented in those current investment balances.

If both txs and snapshots exist for an investment account, **snapshot wins** for value (market). Txs still drive `invest_out` and cost basis if no cost-basis column.

**Banks vs investments** uses snapshots. Bank balances come from the Excel ledgers (one point per statement date). Mutual funds and stocks are rebuilt from `sipEvents`: each **paid** month adds that amount on the SIP day, so the line steps up on the dates you invested. Skipped and failed months add nothing. The latest point (today) is live **current** value from holdings, not cost. Lump-sum holdings with no paid months appear only on the latest point.

## Investment gain/loss

As of `D`:

```
cost_basis = last snapshot.costBasisMinor if present
           else sum of invest_out to that account - withdrawals (inflows from that investment account tagged withdrawal)
market     = last snapshot.valueMinor
invest_pl  = market - cost_basis
```

If cost basis missing and no contribution txs: `invest_pl` is `null`, UI “Needs cost basis”.

Do not use income/spend flows as a proxy for market gain.

## Grouping for charts

`groupBy: 'month'` → bucket `date` to `YYYY-MM`. Sum flows in bucket. For `last` aggregate (balances), take the last snapshot in the bucket, or carry-forward previous last.

Carry-forward must be tested (empty month does not drop net worth to 0).

## Combine

See `project-docs/CHART-SEMANTICS.md`. Combined series = sum of bucket values for member metrics, **only** after `canCombine` is ok.

## Test cases (required)

1. Income 100_000, lifestyle 40_000, invest_out 20_000 → savings 60_000, savings_rate 0.6, spend lifestyle 40_000.  
2. Only transfers between checking and savings → income 0, spend 0, net worth unchanged except account split.  
3. Income 0 → savings_rate `null`.  
4. Snapshot month gap → net worth carries forward.  
5. `canCombine(income, spend)` false.  
6. `canCombine(two outflow category metrics)` true.  
7. `canCombine(spend, invest_value)` false.  
8. Credit snapshot 10_000, checking 50_000 → net worth 40_000.  
9. Market 120, cost 100 → invest_pl 20.

Use minor units in tests (e.g. rupees × 100 if you choose 2 decimal currencies). Document decimal places per currency; v1 may assume 2.
