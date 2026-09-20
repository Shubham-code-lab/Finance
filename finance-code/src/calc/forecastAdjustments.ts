import { ForecastAdjustment } from '@/domain/types'

export type ForecastMonthlyAmounts = {
  livingCostMinor: number
  mutualFundSipMinor: number
  stockSipMinor: number
}

export type ActiveSalaryAdjustment = {
  effectiveMonth: string
  salaryMinor: number
}

const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/

function optionalAmount(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.round(value) : undefined
}

export function normalizeForecastAdjustments(value: unknown): ForecastAdjustment[] {
  if (!Array.isArray(value)) return []
  const byMonth = new Map<string, ForecastAdjustment>()
  value.forEach((item) => {
    if (!item || typeof item !== 'object') return
    const candidate = item as Partial<ForecastAdjustment>
    if (typeof candidate.effectiveMonth !== 'string' || !monthPattern.test(candidate.effectiveMonth)) return
    const salaryMinor = optionalAmount(candidate.salaryMinor)
    const livingCostMinor = optionalAmount(candidate.livingCostMinor)
    const mutualFundSipMinor = optionalAmount(candidate.mutualFundSipMinor)
    const stockSipMinor = optionalAmount(candidate.stockSipMinor)
    if (salaryMinor === undefined && livingCostMinor === undefined && mutualFundSipMinor === undefined && stockSipMinor === undefined)
      return
    byMonth.set(candidate.effectiveMonth, {
      ...byMonth.get(candidate.effectiveMonth),
      effectiveMonth: candidate.effectiveMonth,
      ...(salaryMinor !== undefined ? { salaryMinor } : {}),
      ...(livingCostMinor !== undefined ? { livingCostMinor } : {}),
      ...(mutualFundSipMinor !== undefined ? { mutualFundSipMinor } : {}),
      ...(stockSipMinor !== undefined ? { stockSipMinor } : {}),
    })
  })
  return [...byMonth.values()].sort((left, right) => left.effectiveMonth.localeCompare(right.effectiveMonth))
}

export function salaryAdjustmentForMonth(month: string, adjustments: ForecastAdjustment[] | undefined): ActiveSalaryAdjustment | undefined {
  let active: ActiveSalaryAdjustment | undefined
  for (const adjustment of adjustments ?? []) {
    if (adjustment.effectiveMonth > month) break
    if (adjustment.salaryMinor !== undefined) {
      active = { effectiveMonth: adjustment.effectiveMonth, salaryMinor: adjustment.salaryMinor }
    }
  }
  return active
}

export function forecastAmountsForMonth(
  month: string,
  defaults: ForecastMonthlyAmounts,
  adjustments: ForecastAdjustment[] | undefined,
): ForecastMonthlyAmounts {
  const result = { ...defaults }
  for (const adjustment of adjustments ?? []) {
    if (adjustment.effectiveMonth > month) break
    if (adjustment.livingCostMinor !== undefined) result.livingCostMinor = adjustment.livingCostMinor
    if (adjustment.mutualFundSipMinor !== undefined) result.mutualFundSipMinor = adjustment.mutualFundSipMinor
    if (adjustment.stockSipMinor !== undefined) result.stockSipMinor = adjustment.stockSipMinor
  }
  return result
}
