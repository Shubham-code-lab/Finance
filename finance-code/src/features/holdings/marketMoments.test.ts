import { describe, expect, it } from 'vitest'
import { equalWeightPerformance, findMarketMoments } from '@/features/holdings/marketMoments'

const isoDay = (offset: number) => new Date(Date.UTC(2025, 0, 1 + offset)).toISOString().slice(0, 10)

describe('market moments', () => {
  it('builds an equal-weight percentage series', () => {
    expect(
      equalWeightPerformance([
        {
          id: 'a',
          points: [
            { date: isoDay(0), value: 100 },
            { date: isoDay(1), value: 110 },
          ],
        },
        {
          id: 'b',
          points: [
            { date: isoDay(0), value: 200 },
            { date: isoDay(1), value: 180 },
          ],
        },
      ]),
    ).toEqual([
      { date: isoDay(0), value: 0 },
      { date: isoDay(1), value: 0 },
    ])
  })

  it('hides long-term moments for short ranges', () => {
    const points = Array.from({ length: 60 }, (_, index) => ({ date: isoDay(index), value: Math.sin(index / 5) * 10 }))
    expect(findMarketMoments(points)).toEqual([])
  })

  it('finds separated drops and highs for a long range', () => {
    const points = Array.from({ length: 220 }, (_, index) => ({
      date: isoDay(index),
      value: index * 0.08 + Math.sin(index / 11) * 12,
    }))
    const moments = findMarketMoments(points)
    expect(moments.some((moment) => moment.kind === 'drop')).toBe(true)
    expect(moments.some((moment) => moment.kind === 'high')).toBe(true)
    expect(moments.filter((moment) => moment.kind === 'drop').length).toBeLessThanOrEqual(5)
    expect(moments.filter((moment) => moment.kind === 'high').length).toBeLessThanOrEqual(5)
  })
})
