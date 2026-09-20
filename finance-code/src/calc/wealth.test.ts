import { describe, expect, it } from 'vitest'
import { calculateWealthTotal } from '@/calc/wealth'
import { Account, AccountSnapshot, defaultWealthView } from '@/domain/types'

const accounts: Account[] = [
  { id: 'sbi', name: 'SBI', type: 'savings', currency: 'INR', origin: 'user', archived: false },
  { id: 'icici', name: 'ICICI', type: 'checking', currency: 'INR', origin: 'user', archived: false },
  { id: 'cash-held-elsewhere', name: 'Cash held elsewhere', type: 'cash', currency: 'INR', origin: 'user', archived: false },
  { id: 'security-deposit', name: 'Security deposit', type: 'cash', currency: 'INR', origin: 'user', archived: false },
  { id: 'mutual-funds', name: 'Mutual funds', type: 'investment', currency: 'INR', origin: 'user', archived: false },
  { id: 'stocks-portfolio', name: 'Stocks', type: 'investment', currency: 'INR', origin: 'user', archived: false },
]

const snapshots: AccountSnapshot[] = [
  { id: '1', accountId: 'sbi', date: '2026-06-30', valueMinor: 50_000_00, costBasisMinor: null, origin: 'user', sourceTableId: 'sbi' },
  { id: '1b', accountId: 'icici', date: '2026-06-30', valueMinor: 10_000_00, costBasisMinor: null, origin: 'user', sourceTableId: 'icici' },
  {
    id: 'parked1',
    accountId: 'cash-held-elsewhere',
    date: '2026-06-10',
    valueMinor: 30_000_00,
    costBasisMinor: null,
    origin: 'user',
    sourceTableId: null,
  },
  {
    id: 'parked2',
    accountId: 'security-deposit',
    date: '2026-06-10',
    valueMinor: 20_000_00,
    costBasisMinor: null,
    origin: 'user',
    sourceTableId: null,
  },
  {
    id: '2',
    accountId: 'mutual-funds',
    date: '2026-06-30',
    valueMinor: 80_000_00,
    costBasisMinor: 80_000_00,
    origin: 'user',
    sourceTableId: null,
  },
  {
    id: '3',
    accountId: 'stocks-portfolio',
    date: '2026-06-30',
    valueMinor: 20_000_00,
    costBasisMinor: 25_000_00,
    origin: 'user',
    sourceTableId: null,
  },
]

describe('wealth composition', () => {
  it('sums ticked bank accounts plus investments', () => {
    expect(calculateWealthTotal(snapshots, '2026-06-30', defaultWealthView, accounts)).toBe(210_000_00)
    expect(calculateWealthTotal(snapshots, '2026-06-30', { bankSavings: true, mutualFunds: false, stocks: false }, accounts)).toBe(
      110_000_00,
    )
    expect(calculateWealthTotal(snapshots, '2026-06-30', { bankSavings: false, mutualFunds: true, stocks: true }, accounts)).toBe(
      100_000_00,
    )
  })
})
