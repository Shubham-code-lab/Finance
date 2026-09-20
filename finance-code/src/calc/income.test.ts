import { describe, expect, it } from 'vitest'
import { dateOnDay } from '@/domain/sip'
import { incomeOccurrences, sumScheduledIncome } from '@/calc/income'
import { IncomeSource } from '@/domain/types'

const salary: IncomeSource = {
  id: 'salary',
  name: 'Salary',
  amountMinor: 100_000_00,
  accountId: 'icici',
  schedule: 'monthly',
  startDate: '2026-07-31',
  dayOfMonth: 31,
  origin: 'user',
}

describe('scheduled income', () => {
  it('pays monthly salary on the last calendar day', () => {
    expect(dateOnDay('2026-09', 31)).toBe('2026-09-30')
    expect(dateOnDay('2026-08', 31)).toBe('2026-08-31')
    const dates = incomeOccurrences(salary, '2026-07-01', '2026-09-30').map((item) => item.date)
    expect(dates).toEqual(['2026-07-31', '2026-08-31', '2026-09-30'])
    expect(sumScheduledIncome([salary], { from: '2026-09-01', to: '2026-09-30' })).toBe(100_000_00)
  })

  it('records a lump sum on the given date only', () => {
    const bonus: IncomeSource = { ...salary, id: 'bonus', schedule: 'once', startDate: '2026-09-06', dayOfMonth: null }
    expect(incomeOccurrences(bonus, '2026-09-01', '2026-09-30')).toHaveLength(1)
    expect(incomeOccurrences(bonus, '2026-10-01', '2026-10-31')).toHaveLength(0)
  })
})
