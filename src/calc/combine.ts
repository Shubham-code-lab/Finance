import { MetricDef } from '@/domain/types'

export type CombineDecision = { ok: true } | { ok: false; reason: string }

export const DERIVED_NET_IDS = new Set(['net_cashflow', 'savings', 'savings_rate', 'net_worth', 'invest_pl'])

export function canCombine(metrics: MetricDef[]): CombineDecision {
  if (metrics.length < 2) return { ok: false, reason: 'Need at least two series to combine.' }
  if (metrics.some((metric) => DERIVED_NET_IDS.has(metric.id) || metric.unit === 'ratio')) {
    return { ok: false, reason: 'Derived or ratio metrics cannot be merged into another series. Add them as their own line.' }
  }
  const kinds = new Set(metrics.map((metric) => metric.kind))
  if (kinds.size !== 1) {
    return {
      ok: false,
      reason:
        'These series are different types (inflow vs outflow vs balance). They can share a chart as separate lines, but they cannot be added together.',
    }
  }
  const units = new Set(metrics.map((metric) => metric.unit))
  if (units.size !== 1) return { ok: false, reason: 'Units differ (for example money vs rate). Showing separate series.' }
  const aggregates = new Set(metrics.map((metric) => metric.aggregate))
  if (aggregates.size !== 1) return { ok: false, reason: 'Aggregation differs (sum vs last value). Showing separate series.' }
  const currencies = new Set(metrics.map((metric) => metric.currency ?? 'INR'))
  if (currencies.size !== 1) return { ok: false, reason: 'Currencies differ. v1 charts use one currency per chart.' }
  return { ok: true }
}
