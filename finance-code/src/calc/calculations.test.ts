import { describe, expect, it } from 'vitest'
import { Account, AccountSnapshot, Category, Transaction } from '@/domain/types'
import {
  accountBalanceAt,
  calculateInvestmentPL,
  calculateNetWorth,
  calculateSavings,
  calculateSavingsRate,
  lifestyleDataMonthCount,
  netWorthSeriesByMonth,
  sumIncome,
  sumInvested,
  sumLifestyleSpend,
} from '@/calc/calculations'

const categories: Category[] = [
  { id: 'salary', name: 'Salary', parentId: null, defaultFlow: 'inflow', origin: 'demo' },
  { id: 'food', name: 'Groceries', parentId: null, defaultFlow: 'outflow', origin: 'demo' },
  { id: 'lifestyle-food', name: 'Food delivery / restaurants', parentId: null, defaultFlow: 'outflow', origin: 'demo' },
  { id: 'rent-home', name: 'Rent - home share', parentId: null, defaultFlow: 'outflow', origin: 'demo' },
  { id: 'roommate-reimbursement', name: 'Roommate / Splitwise reimbursement', parentId: null, defaultFlow: 'transfer', origin: 'demo' },
  { id: 'invest', name: 'Index fund', parentId: null, defaultFlow: 'outflow', origin: 'demo' },
]

function tx(partial: Partial<Transaction>): Transaction {
  return {
    id: partial.id ?? crypto.randomUUID(),
    sourceTableId: 'table',
    sourceRowId: partial.sourceRowId ?? crypto.randomUUID(),
    date: partial.date ?? '2026-01-10',
    accountId: partial.accountId ?? 'checking',
    counterpartyAccountId: partial.counterpartyAccountId ?? null,
    categoryId: partial.categoryId ?? null,
    amountMinor: partial.amountMinor ?? 0,
    flow: partial.flow ?? 'neutral',
    signedAmountMinor: partial.signedAmountMinor ?? (partial.flow === 'outflow' ? -(partial.amountMinor ?? 0) : (partial.amountMinor ?? 0)),
    memo: '',
    origin: 'demo',
    currency: 'INR',
  }
}

describe('calculations', () => {
  it('counts only months containing lifestyle data for averages', () => {
    const transactions = [
      tx({ date: '2026-01-10', flow: 'outflow', amountMinor: 10_000, categoryId: 'food' }),
      tx({ date: '2026-03-10', flow: 'outflow', amountMinor: 20_000, categoryId: 'lifestyle-food' }),
      tx({ date: '2026-02-10', flow: 'transfer', amountMinor: 30_000, signedAmountMinor: 0 }),
    ]
    expect(lifestyleDataMonthCount(transactions, categories, { from: '2024-01-01', to: '2027-12-31' })).toBe(2)
  })

  it('calculates income, lifestyle spend, invested, savings, and rate', () => {
    const transactions = [
      tx({ flow: 'inflow', amountMinor: 100_000, categoryId: 'salary' }),
      tx({ flow: 'outflow', amountMinor: 40_000, categoryId: 'food' }),
      tx({ flow: 'outflow', amountMinor: 20_000, categoryId: 'invest', counterpartyAccountId: 'brokerage' }),
    ]
    expect(sumIncome(transactions)).toBe(100_000)
    expect(sumLifestyleSpend(transactions, categories)).toBe(40_000)
    expect(sumInvested(transactions, categories)).toBe(20_000)
    expect(calculateSavings(transactions, categories)).toBe(60_000)
    expect(calculateSavingsRate(transactions, categories)).toBe(0.6)
  })

  it('excludes transfers from income and spend', () => {
    const transactions = [tx({ flow: 'transfer', amountMinor: 20_000, signedAmountMinor: 0 })]
    expect(sumIncome(transactions)).toBe(0)
    expect(sumLifestyleSpend(transactions, categories)).toBe(0)
    expect(calculateSavingsRate(transactions, categories)).toBeNull()
  })

  it('uses the 15k personal rent share for a 28k owner rent payment', () => {
    const transactions = [
      tx({ flow: 'outflow', amountMinor: 2_800_000, categoryId: 'rent-home' }),
      tx({ flow: 'transfer', amountMinor: 1_300_000, categoryId: 'roommate-reimbursement', signedAmountMinor: 0 }),
      tx({ flow: 'outflow', amountMinor: 50_000, categoryId: 'lifestyle-food' }),
    ]
    expect(sumLifestyleSpend(transactions, categories)).toBe(1_550_000)
  })

  it('returns null savings rate when income is zero', () => {
    expect(calculateSavingsRate([], categories)).toBeNull()
  })

  it('carries snapshots through month gaps for net worth', () => {
    const accounts: Account[] = [{ id: 'checking', name: 'Checking', type: 'checking', currency: 'INR', origin: 'demo', archived: false }]
    const snapshots: AccountSnapshot[] = [
      {
        id: 's1',
        accountId: 'checking',
        date: '2026-01-15',
        valueMinor: 50_000,
        costBasisMinor: null,
        origin: 'demo',
        sourceTableId: null,
      },
    ]
    expect(netWorthSeriesByMonth(accounts, [], snapshots, '2026-01-01', '2026-03-31')).toEqual([
      { period: '2026-01', value: 50_000 },
      { period: '2026-02', value: 50_000 },
      { period: '2026-03', value: 50_000 },
    ])
  })

  it('counts house-owner and other parked balances as assets', () => {
    const accounts: Account[] = [
      { id: 'checking', name: 'Checking', type: 'checking', currency: 'INR', origin: 'user', archived: false },
      { id: 'house-owner', name: 'House owner', type: 'other', currency: 'INR', origin: 'user', archived: false },
    ]
    const snapshots: AccountSnapshot[] = [
      {
        id: 'bank',
        accountId: 'checking',
        date: '2026-09-10',
        valueMinor: 10_000_00,
        costBasisMinor: null,
        origin: 'user',
        sourceTableId: null,
      },
      {
        id: 'house',
        accountId: 'house-owner',
        date: '2026-09-10',
        valueMinor: 50_000_00,
        costBasisMinor: null,
        origin: 'user',
        sourceTableId: null,
      },
    ]
    expect(calculateNetWorth(accounts, [], snapshots, '2026-09-10')).toBe(60_000_00)
  })

  it('subtracts credit and liability snapshots', () => {
    const accounts: Account[] = [
      { id: 'checking', name: 'Checking', type: 'checking', currency: 'INR', origin: 'demo', archived: false },
      { id: 'credit', name: 'Credit', type: 'credit', currency: 'INR', origin: 'demo', archived: false },
    ]
    const snapshots: AccountSnapshot[] = [
      {
        id: 'cash',
        accountId: 'checking',
        date: '2026-01-31',
        valueMinor: 50_000,
        costBasisMinor: null,
        origin: 'demo',
        sourceTableId: null,
      },
      {
        id: 'debt',
        accountId: 'credit',
        date: '2026-01-31',
        valueMinor: 10_000,
        costBasisMinor: null,
        origin: 'demo',
        sourceTableId: null,
      },
    ]
    expect(calculateNetWorth(accounts, [], snapshots, '2026-01-31')).toBe(40_000)
  })

  it('calculates investment gain and loss from snapshot cost basis', () => {
    const account: Account = { id: 'brokerage', name: 'Brokerage', type: 'investment', currency: 'INR', origin: 'demo', archived: false }
    const snapshots: AccountSnapshot[] = [
      { id: 's1', accountId: 'brokerage', date: '2026-01-31', valueMinor: 120, costBasisMinor: 100, origin: 'demo', sourceTableId: null },
    ]
    expect(calculateInvestmentPL(account, [], snapshots, '2026-01-31')).toBe(20)
  })

  it('uses transactions when an account has no balance snapshot', () => {
    const account: Account = { id: 'cash', name: 'Cash', type: 'cash', currency: 'INR', origin: 'demo', archived: false }
    const transactions = [tx({ accountId: 'cash', date: '2026-01-15', signedAmountMinor: 12_345 })]
    expect(accountBalanceAt(account, transactions, [], '2026-01-31')).toBe(12_345)
  })
})
