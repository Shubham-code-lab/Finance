import { describe, expect, it } from 'vitest'
import { buildWealthProjection, typicalMonthlySpend } from '@/calc/forecast'
import { StoreData } from '@/domain/types'

describe('forecast spend average', () => {
  it('averages lifestyle spend over prior months', () => {
    const data = {
      transactions: [
        {
          id: '1',
          sourceTableId: 't',
          sourceRowId: '1',
          date: '2026-07-10',
          accountId: 'icici',
          counterpartyAccountId: null,
          categoryId: 'google-spend',
          amountMinor: 30_000_00,
          flow: 'outflow',
          signedAmountMinor: -30_000_00,
          memo: '',
          origin: 'user',
          currency: 'INR',
        },
        {
          id: '2',
          sourceTableId: 't',
          sourceRowId: '2',
          date: '2026-08-10',
          accountId: 'icici',
          counterpartyAccountId: null,
          categoryId: 'google-spend',
          amountMinor: 50_000_00,
          flow: 'outflow',
          signedAmountMinor: -50_000_00,
          memo: '',
          origin: 'user',
          currency: 'INR',
        },
      ],
      categories: [{ id: 'google-spend', name: 'Google / UPI spend', parentId: null, defaultFlow: 'outflow', origin: 'user' }],
    } as Pick<StoreData, 'transactions' | 'categories'>
    expect(typicalMonthlySpend(data as StoreData, '2026-09', 2)).toBe(40_000_00)
  })

  it('moves SIP from bank to investments without reducing net worth', () => {
    const data = {
      accounts: [
        { id: 'bank', name: 'Bank', type: 'checking', currency: 'INR', origin: 'user', archived: false },
        { id: 'mutual-funds', name: 'Mutual funds', type: 'investment', currency: 'INR', origin: 'user', archived: false },
        { id: 'stocks-portfolio', name: 'Stocks', type: 'investment', currency: 'INR', origin: 'user', archived: false },
      ],
      snapshots: [
        {
          id: 'bank-now',
          accountId: 'bank',
          date: '2026-09-15',
          valueMinor: 100_000_00,
          costBasisMinor: null,
          origin: 'user',
          sourceTableId: null,
        },
        {
          id: 'mf-now',
          accountId: 'mutual-funds',
          date: '2026-09-15',
          valueMinor: 100_000_00,
          costBasisMinor: 100_000_00,
          origin: 'user',
          sourceTableId: null,
        },
        {
          id: 'stock-now',
          accountId: 'stocks-portfolio',
          date: '2026-09-15',
          valueMinor: 100_000_00,
          costBasisMinor: 100_000_00,
          origin: 'user',
          sourceTableId: null,
        },
      ],
      transactions: ['2026-06-10', '2026-07-10', '2026-08-10'].map((date, index) => ({
        id: String(index),
        sourceTableId: 't',
        sourceRowId: String(index),
        date,
        accountId: 'bank',
        counterpartyAccountId: null,
        categoryId: 'lifestyle-food',
        amountMinor: 20_000_00,
        flow: 'outflow',
        signedAmountMinor: -20_000_00,
        memo: '',
        origin: 'user',
        currency: 'INR',
      })),
      categories: [{ id: 'lifestyle-food', name: 'Food', parentId: null, defaultFlow: 'outflow', origin: 'user' }],
      holdings: [
        {
          id: 'mf',
          name: 'Fund',
          kind: 'mutual_fund',
          purchaseMode: 'sip',
          currentMinor: 100_000_00,
          investedMinor: 100_000_00,
          qty: null,
          avgPrice: null,
          marketPrice: null,
          sipAmountMinor: 10_000_00,
          sipDayOfMonth: 6,
          sipStartMonth: '2026-01',
          notes: '',
          origin: 'user',
        },
      ],
      incomeSources: [
        {
          id: 'salary',
          name: 'Salary',
          amountMinor: 50_000_00,
          accountId: 'bank',
          schedule: 'monthly',
          startDate: '2026-01-01',
          dayOfMonth: 30,
          origin: 'user',
        },
      ],
      sipEvents: [],
    } as unknown as StoreData
    const result = buildWealthProjection(data, '2026-09-15', {
      months: 1,
      spendLookback: 3,
      mutualFundAnnualReturnPct: 0,
      stockAnnualReturnPct: 0,
    })
    expect(result.currentNetWorthMinor).toBe(300_000_00)
    expect(result.points[0]).toMatchObject({
      month: '2026-09',
      incomeMinor: 50_000_00,
      livingSpendMinor: 10_666_67,
      mutualFundSipMinor: 0,
      bankMinor: 139_333_33,
      mutualFundsMinor: 100_000_00,
      stocksMinor: 100_000_00,
      cumulativeSipMinor: 0,
      netWorthMinor: 339_333_33,
    })
    expect(result.points[1]).toMatchObject({
      month: '2026-10',
      mutualFundSipMinor: 10_000_00,
      bankMinor: 159_333_33,
      mutualFundsMinor: 110_000_00,
      cumulativeSipMinor: 10_000_00,
      netWorthMinor: 369_333_33,
    })
    const raisedSalary = buildWealthProjection(data, '2026-09-15', {
      months: 1,
      spendLookback: 3,
      mutualFundAnnualReturnPct: 0,
      stockAnnualReturnPct: 0,
      salaryAnnualGrowthPct: 10,
      salaryGrowthStartMonth: '2026-10',
    })
    expect(raisedSalary.points[0].incomeMinor).toBe(50_000_00)
    expect(raisedSalary.points[1].incomeMinor).toBe(55_000_00)
    expect(raisedSalary.points[1].netWorthMinor).toBe(374_333_33)
  })

  it('compounds each asset class and supports a five-year horizon', () => {
    const data = {
      accounts: [
        { id: 'mutual-funds', name: 'Mutual funds', type: 'investment', currency: 'INR', origin: 'user', archived: false },
        { id: 'stocks-portfolio', name: 'Stocks', type: 'investment', currency: 'INR', origin: 'user', archived: false },
      ],
      snapshots: [
        {
          id: 'mf-now',
          accountId: 'mutual-funds',
          date: '2026-09-15',
          valueMinor: 100_000_00,
          costBasisMinor: null,
          origin: 'user',
          sourceTableId: null,
        },
        {
          id: 'stocks-now',
          accountId: 'stocks-portfolio',
          date: '2026-09-15',
          valueMinor: 100_000_00,
          costBasisMinor: null,
          origin: 'user',
          sourceTableId: null,
        },
      ],
      transactions: [],
      categories: [],
      holdings: [],
      incomeSources: [],
      sipEvents: [],
    } as unknown as StoreData
    const result = buildWealthProjection(data, '2026-09-15', {
      months: 60,
      spendLookback: 6,
      mutualFundAnnualReturnPct: 10,
      stockAnnualReturnPct: 8,
    })
    expect(result.points).toHaveLength(61)
    expect(result.points.at(-1)?.mutualFundsMinor).toBeGreaterThan(result.points.at(-1)?.stocksMinor ?? 0)
    expect(result.points.at(-1)?.netWorthMinor).toBeGreaterThan(result.currentNetWorthMinor)
  })

  it('applies active planned expenses only in their scheduled month', () => {
    const data = {
      accounts: [{ id: 'bank', name: 'Bank', type: 'checking', currency: 'INR', origin: 'user', archived: false }],
      snapshots: [
        {
          id: 'bank-now',
          accountId: 'bank',
          date: '2026-09-15',
          valueMinor: 100_000_00,
          costBasisMinor: null,
          origin: 'user',
          sourceTableId: null,
        },
      ],
      transactions: [],
      categories: [],
      holdings: [],
      incomeSources: [],
      sipEvents: [],
      plannedExpenses: [
        { id: 'old-plan', name: 'Past plan', amountMinor: 5_000_00, date: '2026-09-01', category: 'other', active: true, origin: 'user' },
        {
          id: 'current-trip',
          name: 'Current month trip',
          amountMinor: 10_000_00,
          date: '2026-09-25',
          category: 'trip',
          active: true,
          origin: 'user',
        },
        { id: 'phone', name: 'Phone', amountMinor: 50_000_00, date: '2026-10-20', category: 'phone', active: true, origin: 'user' },
        { id: 'trip', name: 'Trip', amountMinor: 20_000_00, date: '2026-10-25', category: 'trip', active: false, origin: 'user' },
      ],
    } as unknown as StoreData
    const result = buildWealthProjection(data, '2026-09-15', {
      months: 2,
      spendLookback: 6,
      mutualFundAnnualReturnPct: 0,
      stockAnnualReturnPct: 0,
    })
    expect(result.points[0]).toMatchObject({
      month: '2026-09',
      plannedExpenseMinor: 10_000_00,
      bankMinor: 90_000_00,
      netWorthMinor: 90_000_00,
    })
    expect(result.points[1]).toMatchObject({
      month: '2026-10',
      plannedExpenseMinor: 50_000_00,
      bankMinor: 40_000_00,
      cumulativePlannedExpenseMinor: 60_000_00,
    })
    expect(result.points[2]).toMatchObject({ month: '2026-11', plannedExpenseMinor: 0, cumulativePlannedExpenseMinor: 60_000_00 })
  })

  it('keeps reserved assets in net worth but outside spendable bank cash', () => {
    const data = {
      accounts: [
        { id: 'icici', name: 'ICICI', type: 'checking', currency: 'INR', origin: 'user', archived: false },
        { id: 'sbi', name: 'SBI', type: 'savings', currency: 'INR', origin: 'user', archived: false },
        { id: 'emergency', name: 'Emergency fund', type: 'savings', currency: 'INR', origin: 'user', archived: false },
        { id: 'house-owner', name: 'House owner', type: 'other', currency: 'INR', origin: 'user', archived: false },
      ],
      snapshots: [
        {
          id: 'icici-now',
          accountId: 'icici',
          date: '2026-09-13',
          valueMinor: 427_970_49,
          costBasisMinor: null,
          origin: 'user',
          sourceTableId: 'icici-ledger',
        },
        {
          id: 'sbi-now',
          accountId: 'sbi',
          date: '2026-09-13',
          valueMinor: 5_458_02,
          costBasisMinor: null,
          origin: 'user',
          sourceTableId: 'sbi-ledger',
        },
        {
          id: 'emergency-now',
          accountId: 'emergency',
          date: '2026-09-13',
          valueMinor: 150_000_00,
          costBasisMinor: null,
          origin: 'user',
          sourceTableId: null,
        },
        {
          id: 'house-now',
          accountId: 'house-owner',
          date: '2026-09-13',
          valueMinor: 75_000_00,
          costBasisMinor: null,
          origin: 'user',
          sourceTableId: null,
        },
      ],
      transactions: [],
      categories: [],
      holdings: [],
      sipEvents: [],
      plannedExpenses: [],
      incomeSources: [
        {
          id: 'salary',
          name: 'Salary',
          amountMinor: 128_826_00,
          accountId: 'icici',
          schedule: 'monthly',
          startDate: '2026-09-01',
          dayOfMonth: 31,
          origin: 'user',
        },
      ],
    } as unknown as StoreData
    const result = buildWealthProjection(data, '2026-09-13', {
      months: 1,
      spendLookback: 6,
      mutualFundAnnualReturnPct: 0,
      stockAnnualReturnPct: 0,
    })
    expect(result.currentBankMinor).toBe(433_428_51)
    expect(result.reservedSavingsMinor).toBe(225_000_00)
    expect(result.currentNetWorthMinor).toBe(658_428_51)
    expect(result.points[0]).toMatchObject({ month: '2026-09', incomeMinor: 128_826_00, bankMinor: 562_254_51, netWorthMinor: 787_254_51 })
  })

  it('applies dated living-cost and SIP changes to projection points in chronological order', () => {
    const data = {
      accounts: [{ id: 'bank', name: 'Bank', type: 'checking', currency: 'INR', origin: 'user', archived: false }],
      snapshots: [
        {
          id: 'bank-now',
          accountId: 'bank',
          date: '2026-09-15',
          valueMinor: 1_000_000_00,
          costBasisMinor: null,
          origin: 'user',
          sourceTableId: null,
        },
      ],
      transactions: [],
      categories: [],
      holdings: [],
      incomeSources: [],
      sipEvents: [],
      plannedExpenses: [],
    } as unknown as StoreData

    const result = buildWealthProjection(data, '2026-09-15', {
      months: 2,
      spendLookback: 6,
      mutualFundAnnualReturnPct: 0,
      stockAnnualReturnPct: 0,
      adjustments: [
        {
          effectiveMonth: '2026-10',
          livingCostMinor: 10_000_00,
          mutualFundSipMinor: 20_000_00,
          stockSipMinor: 30_000_00,
        },
        { effectiveMonth: '2026-11', stockSipMinor: 5_000_00 },
      ],
    })

    expect(result.points[1]).toMatchObject({
      month: '2026-10',
      livingSpendMinor: 10_000_00,
      mutualFundSipMinor: 20_000_00,
      stockSipMinor: 30_000_00,
      bankMinor: 940_000_00,
      mutualFundsMinor: 20_000_00,
      stocksMinor: 30_000_00,
      netWorthMinor: 990_000_00,
    })
    expect(result.points[2]).toMatchObject({
      month: '2026-11',
      livingSpendMinor: 10_000_00,
      mutualFundSipMinor: 20_000_00,
      stockSipMinor: 5_000_00,
      bankMinor: 905_000_00,
      mutualFundsMinor: 40_000_00,
      stocksMinor: 35_000_00,
      netWorthMinor: 980_000_00,
    })
  })

  it('uses a dated salary as the new baseline and keeps later annual increases active', () => {
    const data = {
      accounts: [{ id: 'bank', name: 'Bank', type: 'checking', currency: 'INR', origin: 'user', archived: false }],
      snapshots: [
        {
          id: 'bank-now',
          accountId: 'bank',
          date: '2026-09-15',
          valueMinor: 0,
          costBasisMinor: null,
          origin: 'user',
          sourceTableId: null,
        },
      ],
      transactions: [],
      categories: [],
      holdings: [],
      incomeSources: [],
      sipEvents: [],
      plannedExpenses: [],
    } as unknown as StoreData

    const result = buildWealthProjection(data, '2026-09-15', {
      months: 4,
      spendLookback: 6,
      mutualFundAnnualReturnPct: 0,
      stockAnnualReturnPct: 0,
      salaryAnnualGrowthPct: 10,
      salaryGrowthStartMonth: '2027-01',
      adjustments: [{ effectiveMonth: '2026-10', salaryMinor: 100_000_00 }],
    })

    expect(result.points[1]).toMatchObject({ month: '2026-10', incomeMinor: 100_000_00 })
    expect(result.points[3]).toMatchObject({ month: '2026-12', incomeMinor: 100_000_00 })
    expect(result.points[4]).toMatchObject({ month: '2027-01', incomeMinor: 110_000_00 })
  })
})
