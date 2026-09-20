import { describe, expect, it } from 'vitest'
import { classifyStatementMemo, isRecurringTransferAmount, lifestyleAmountMinor } from '@/calc/classify'

describe('isRecurringTransferAmount', () => {
  it('treats typical SIP sizes as transfers and UPI as spend', () => {
    expect(isRecurringTransferAmount(10000)).toBe(true)
    expect(isRecurringTransferAmount(40000)).toBe(true)
    expect(isRecurringTransferAmount(14000)).toBe(true)
    expect(isRecurringTransferAmount(495.05)).toBe(false)
    expect(isRecurringTransferAmount(1314)).toBe(false)
    expect(isRecurringTransferAmount(28000)).toBe(true)
  })
})

describe('classifyStatementMemo', () => {
  it('labels real merchants from the shared statement text', () => {
    expect(classifyStatementMemo('UPI/ZOMATO LIM/zomatoorder/ZOMATO LIMITED', 'outflow', 495).categoryId).toBe('lifestyle-food')
    expect(classifyStatementMemo('UPI/Blinkit/blinkit.payu/Blinkit', 'outflow', 514).categoryId).toBe('lifestyle-groceries')
    expect(classifyStatementMemo('UPI/MYNTRA DES/myntra.payu/MYNTRA DESIGNS PRIVATE LIMITED', 'outflow', 1099).categoryId).toBe(
      'lifestyle-shopping',
    )
    expect(classifyStatementMemo('UPI/BMTC BUS KA57F3442', 'outflow', 18).categoryId).toBe('lifestyle-travel')
    expect(classifyStatementMemo('UPI/Airtel/airtel-prepaid/Airtel', 'outflow', 361).categoryId).toBe('lifestyle-utilities')
  })

  it('keeps salary, rent, reimbursements, and self transfers out of generic spend', () => {
    expect(classifyStatementMemo('NEFT-HDFCH01090826281-AMAGI MEDIA LABS PRIVATE', 'inflow', 128826)).toMatchObject({
      categoryId: 'salary',
      flow: 'inflow',
    })
    expect(classifyStatementMemo('UPI/S J ARUN K/9739009054@ybl/june rent/S J ARUN KUMAR', 'outflow', 28000)).toMatchObject({
      categoryId: 'rent-home',
      flow: 'outflow',
    })
    expect(classifyStatementMemo('UPI/RANGASWAMY/rsudar24@okhdf/monthly ex/RANGASWAMY J', 'inflow', 30000)).toMatchObject({
      categoryId: 'roommate-reimbursement',
      flow: 'transfer',
    })
    expect(classifyStatementMemo('UPI/investment/stock market transfer', 'outflow', 50000)).toMatchObject({
      categoryId: 'stock-market',
      flow: 'transfer',
    })
  })

  it('counts owner rent as the user share for lifestyle math', () => {
    expect(lifestyleAmountMinor('rent-home', 2_800_000)).toBe(1_500_000)
    expect(lifestyleAmountMinor('lifestyle-food', 49_505)).toBe(49_505)
  })
})
