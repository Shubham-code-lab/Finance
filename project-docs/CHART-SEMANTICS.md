# Chart semantics

The visualization layer must know whether a series is money **coming in**, money **going out**, or a **neutral** stock/derived value. That tag is `MetricDef.kind`: `inflow` | `outflow` | `neutral`.

## Hard rules

1. **Never merge inflow and outflow into one summed series.**  
   Example: Spending + Investments (contributions) if both are `outflow` *may* combine (same kind). Spending (`outflow`) + Income (`inflow`) must stay **two series**. Spending + Investment *value* (`neutral`) must stay two series.

2. **Unlike kinds on the same chart are allowed** as separate series (multi-axis or shared axis with a legend). That is how the user compares spending vs investments over time.

3. **Same kind + same unit + same time grain** may combine into one series when the user opts in.

4. **Derived nets** (`net_cashflow`, `savings`, `invest_pl`) are `neutral`. They are not produced by combining chart series. They are metrics the user can add as an extra series.

5. **Transfers** are excluded from income and spend series. Do not plot transfers as spend.

## Compatibility (combine)

A set of series is **combinable** iff all of:

- Every `MetricDef.kind` is identical (`inflow` XOR `outflow` XOR `neutral`)
- Every `unit` is `'money'` (do not combine money with ratio)
- Same `aggregate` (`sum` with `sum`; do not mix `sum` and `last`)
- Same currency after conversion (v1: one currency per chart; mismatch → incompatible)
- None of the metrics is a derived net that already subtracts the others (avoid double-count). If a series is `net_cashflow` / `savings` / `invest_pl`, it is **not combinable** with anything else.

```ts
type CombineDecision =
  | { ok: true }
  | {
      ok: false
      reason: string // shown in the chart builder
    }

function canCombine(metrics: MetricDef[]): CombineDecision {
  if (metrics.length < 2) return { ok: false, reason: 'Need at least two series to combine.' }
  if (metrics.some((m) => DERIVED_NET_IDS.has(m.id) || m.unit === 'ratio')) {
    return { ok: false, reason: 'Derived or ratio metrics cannot be merged into another series. Add them as their own line.' }
  }
  const kinds = new Set(metrics.map((m) => m.kind))
  if (kinds.size !== 1) {
    return {
      ok: false,
      reason:
        'These series are different types (inflow vs outflow vs balance). They can share a chart as separate lines, but they cannot be added together.',
    }
  }
  const units = new Set(metrics.map((m) => m.unit))
  if (units.size !== 1) {
    return { ok: false, reason: 'Units differ (for example money vs rate). Showing separate series.' }
  }
  const aggs = new Set(metrics.map((m) => m.aggregate))
  if (aggs.size !== 1) {
    return { ok: false, reason: 'Aggregation differs (sum vs last value). Showing separate series.' }
  }
  return { ok: true }
}
```

Put this in `src/calc/combine.ts` and unit-test it.

## UI behavior (chart builder)

- Default: **separate series**.
- Show a **Combine** control only when `canCombine` is `ok: true`.
- If the user selected incompatible metrics, keep them separate and show `reason` as helper text under the series list. Do not hide the chart.
- When combined, the series label must list parts: `Savings accounts (HDFC + SBI)` or `Outflows (Groceries + Rent)`. Never a vague “Total”.
- Combining creates a **derived combined dataset** (`ChartSeriesRef.combinedFrom`) used only for that chart. It does not rewrite source tables.

## Sign convention on the plot

- Inflow series: plot **positive** magnitudes.
- Outflow series: plot **positive** magnitudes as well (spend is “how much went out”), unless the user picks the derived `net_cashflow` series.
- Neutral stocks (net worth, investment value): plot signed as stored (balances).
- Do **not** flip outflows negative on the same axis as inflows just to “make a total line”. That is the illegal merge.

If a chart has both inflow and outflow, use a shared y-axis of magnitudes plus a clear legend, or dual axis if a `neutral` stock dwarfs flows. Dual axis is optional in v1; separate magnitude + legend is enough.

## Examples

| User intent | Series | Combine? |
| --- | --- | --- |
| Spend vs investments funded | `spend` (outflow), `invest_out` (outflow) | Yes, optional. Default separate so they can compare. |
| Spend vs investment **value** | `spend` (outflow), `invest_value` (neutral) | No. Separate. Explain kinds differ. |
| Income vs spend | `income`, `spend` | No. Offer adding `net_cashflow` as a third series. |
| Two savings accounts | two inflow or two snapshot-neutral metrics | Yes if same kind/unit/agg. |
| Food + bike (both spend categories) | two outflow metrics | Yes. |
| Savings rate vs spend | ratio + money | No. |

## Chart types

- Line / area / bar for time groupBy.
- Bar for category/account groupBy.
- No stacked bar that stacks mixed kinds. Stacked (later) only if every stack member is combinable.

## Market moments

Market-comparison charts may show compact historical **Drops** and **Highs** for the series currently listed on the graph.

- Normalize every listed stock or fund to percentage change from its first value in the selected range.
- Average those normalized values with equal weight. Do not let a high-priced security dominate the aggregate.
- A drop is the aggregate percentage decline from its previous running peak.
- A high is a separated local maximum in aggregate return from the selected range start.
- Ignore moves smaller than 3%.
- Suppress the feature when the selected calendar range is shorter than 90 days or has fewer than 45 observations.
- De-cluster nearby extrema and show no more than five drops and five highs.
- Keep the graph clean: render a vertical reference line only for the one moment the user pins.
- Describe these as historical signals, never as buy recommendations or predictions.

Mutual-fund Price and Change % charts use historical NAV data. SIP contributions and current portfolio value must not be presented as NAV history or used to infer market drawdowns.

## Builder fields

1. Chart type  
2. Group by  
3. Add series → pick metric or “new metric from filter” (account, category, table)  
4. Combine (iff compatible)  
5. Title  

“New metric from filter” writes a `MetricDef` with `kind` copied from the filter’s flow (category `defaultFlow` or explicit flow). If the filter mixes flows, refuse and ask the user to split.
