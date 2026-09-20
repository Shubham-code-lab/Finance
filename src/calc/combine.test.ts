import { describe, expect, it } from 'vitest'
import { canCombine } from '@/calc/combine'
import { MetricDef } from '@/domain/types'

function metric(partial: Partial<MetricDef>): MetricDef {
  return {
    id: partial.id ?? 'metric',
    label: partial.label ?? 'Metric',
    kind: partial.kind ?? 'outflow',
    includeTransfers: false,
    filter: {},
    aggregate: partial.aggregate ?? 'sum',
    unit: partial.unit ?? 'money',
    currency: partial.currency ?? 'INR',
  }
}

describe('canCombine', () => {
  it('rejects income and spend', () => {
    expect(canCombine([metric({ id: 'income', kind: 'inflow' }), metric({ id: 'spend', kind: 'outflow' })]).ok).toBe(false)
  })

  it('allows two outflow category metrics', () => {
    expect(canCombine([metric({ id: 'food' }), metric({ id: 'bike' })])).toEqual({ ok: true })
  })

  it('rejects spend and investment value', () => {
    expect(
      canCombine([metric({ id: 'spend', kind: 'outflow' }), metric({ id: 'invest_value', kind: 'neutral', aggregate: 'last' })]).ok,
    ).toBe(false)
  })

  it('allows combining same-kind last-value wealth series', () => {
    expect(
      canCombine([
        metric({ id: 'sbi_balance', kind: 'neutral', aggregate: 'last' }),
        metric({ id: 'mf_value', kind: 'neutral', aggregate: 'last' }),
        metric({ id: 'stocks_value', kind: 'neutral', aggregate: 'last' }),
      ]),
    ).toEqual({ ok: true })
  })
})
