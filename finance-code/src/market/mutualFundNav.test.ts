import { describe, expect, it } from 'vitest'
import { closestNavHistory, parseMutualFundHistory, selectMutualFundScheme } from '@/market/mutualFundNav.api'

describe('mutual fund NAV adapter', () => {
  it('selects the matching direct growth scheme', () => {
    const selected = selectMutualFundScheme('Parag Parikh Flexi Cap Fund Direct Growth', [
      { schemeCode: 1, schemeName: 'Parag Parikh Flexi Cap Fund - Regular Plan - Growth' },
      { schemeCode: 2, schemeName: 'Parag Parikh Flexi Cap Fund - Direct Plan - Growth' },
    ])
    expect(selected?.schemeCode).toBe(2)
  })

  it('does not accept an unrelated scheme', () => {
    expect(
      selectMutualFundScheme('Parag Parikh Flexi Cap Fund Direct Growth', [
        { schemeCode: 3, schemeName: 'Unrelated Liquid Fund - Direct Plan - Growth' },
      ]),
    ).toBeNull()
  })

  it('parses valid NAV rows and returns ascending ISO dates', () => {
    const scheme = { schemeCode: 2, schemeName: 'Example Direct Growth' }
    expect(
      parseMutualFundHistory(scheme, {
        data: [
          { date: '03-02-2026', nav: '12.25' },
          { date: '01-02-2026', nav: '11.50' },
          { date: 'invalid', nav: '10' },
        ],
      }).points,
    ).toEqual([
      { date: '2026-02-01', nav: 11.5 },
      { date: '2026-02-03', nav: 12.25 },
    ])
  })

  it('uses imported NAV context to distinguish schemes with the same name', () => {
    const histories = [
      { scheme: { schemeCode: 127044, schemeName: 'Motilal Oswal Midcap Fund' }, points: [{ date: '2026-09-25', nav: 47.5978 }] },
      { scheme: { schemeCode: 127042, schemeName: 'Motilal Oswal Midcap Fund' }, points: [{ date: '2026-09-25', nav: 116.6964 }] },
    ]
    expect(closestNavHistory(110.7, histories)?.scheme.schemeCode).toBe(127042)
  })
})
