import { describe, expect, it } from 'vitest'
import { sampleTimeSeries } from '@/charts/sampleTimeSeries'

describe('sampleTimeSeries', () => {
  it('keeps short series unchanged', () => {
    const rows = [{ date: 'a' }, { date: 'b' }]
    expect(sampleTimeSeries(rows, 3)).toBe(rows)
  })

  it('keeps endpoints and required marker dates', () => {
    const rows = Array.from({ length: 1_000 }, (_, index) => ({ date: String(index), value: index }))
    const sampled = sampleTimeSeries(rows, 100, ['511'])
    expect(sampled[0]).toBe(rows[0])
    expect(sampled.at(-1)).toBe(rows.at(-1))
    expect(sampled).toContain(rows[511])
    expect(sampled.length).toBeLessThanOrEqual(101)
  })
})
