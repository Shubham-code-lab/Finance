import { describe, expect, it } from 'vitest'
import { forecastAmountsForMonth, normalizeForecastAdjustments, salaryAdjustmentForMonth } from '@/calc/forecastAdjustments'

const defaults = { livingCostMinor: 30_000_00, mutualFundSipMinor: 20_000_00, stockSipMinor: 10_000_00 }

describe('dated forecast adjustments', () => {
  it('carries each changed value forward until that field changes again', () => {
    const adjustments = [
      { effectiveMonth: '2027-01', livingCostMinor: 35_000_00, stockSipMinor: 15_000_00 },
      { effectiveMonth: '2027-06', stockSipMinor: 5_000_00 },
    ]
    expect(forecastAmountsForMonth('2026-12', defaults, adjustments)).toEqual(defaults)
    expect(forecastAmountsForMonth('2027-03', defaults, adjustments)).toEqual({
      livingCostMinor: 35_000_00,
      mutualFundSipMinor: 20_000_00,
      stockSipMinor: 15_000_00,
    })
    expect(forecastAmountsForMonth('2027-06', defaults, adjustments)).toEqual({
      livingCostMinor: 35_000_00,
      mutualFundSipMinor: 20_000_00,
      stockSipMinor: 5_000_00,
    })
  })

  it('sorts changes and keeps only the final entry for a month', () => {
    expect(
      normalizeForecastAdjustments([
        { effectiveMonth: '2028-01', stockSipMinor: 10_000_00 },
        { effectiveMonth: '2027-01', livingCostMinor: 40_000_00 },
        { effectiveMonth: '2028-01', salaryMinor: 150_000_00, stockSipMinor: 0 },
        { effectiveMonth: '2027-01', mutualFundSipMinor: 20_000_00 },
      ]),
    ).toEqual([
      { effectiveMonth: '2027-01', livingCostMinor: 40_000_00, mutualFundSipMinor: 20_000_00 },
      { effectiveMonth: '2028-01', salaryMinor: 150_000_00, stockSipMinor: 0 },
    ])
  })

  it('carries the latest salary change forward with its effective month', () => {
    const adjustments = normalizeForecastAdjustments([
      { effectiveMonth: '2027-01', salaryMinor: 150_000_00 },
      { effectiveMonth: '2028-04', salaryMinor: 180_000_00 },
    ])
    expect(salaryAdjustmentForMonth('2026-12', adjustments)).toBeUndefined()
    expect(salaryAdjustmentForMonth('2027-08', adjustments)).toEqual({
      effectiveMonth: '2027-01',
      salaryMinor: 150_000_00,
    })
    expect(salaryAdjustmentForMonth('2028-04', adjustments)).toEqual({
      effectiveMonth: '2028-04',
      salaryMinor: 180_000_00,
    })
  })
})
