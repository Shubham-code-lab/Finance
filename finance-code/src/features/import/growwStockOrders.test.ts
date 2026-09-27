import { describe, expect, it } from 'vitest'
import { Holding } from '@/domain/types'
import { growwStockOrdersFromRows, resolveGrowwStockNames } from '@/features/import/growwStockOrders'

const header = [
  'Stock name',
  'Symbol',
  'ISIN',
  'Type',
  'Quantity',
  'Value',
  'Exchange',
  'Exchange Order Id',
  'Execution date and time',
  'Order status',
]

describe('Groww stock order import', () => {
  it('uses only executed orders and calculates remaining average cost', () => {
    const result = growwStockOrdersFromRows([
      ['Name', 'Private person'],
      header,
      ['Example Limited', 'EXAMPLE', 'INE000000001', 'BUY', 10, 1000, 'NSE', '1', '04-10-2023 09:00 AM', 'Executed'],
      ['Example Limited', 'EXAMPLE', 'INE000000001', 'SELL', 4, 600, 'NSE', '2', '18-03-2024 09:00 AM', 'Executed'],
      ['Ignored Limited', 'IGNORE', 'INE000000002', 'BUY', 5, 500, 'NSE', '3', '18-03-2024 09:00 AM', 'Cancelled'],
    ])
    expect(result).toMatchObject({ orderCount: 2, ignoredCount: 1, periodFrom: '2023-10-04', periodTo: '2024-03-18' })
    expect(result.holdings[0]).toMatchObject({
      name: 'Example Limited',
      ticker: 'EXAMPLE.NS',
      qty: 6,
      investedMinor: 60_000,
      buyDate: '2023-10-04',
    })
  })

  it('omits fully exited positions', () => {
    const existing: Holding = {
      id: 'existing-example',
      name: 'Example Limited',
      kind: 'stock',
      purchaseMode: 'lumpsum',
      currentMinor: 25_000,
      investedMinor: 20_000,
      qty: 2,
      ticker: 'EXAMPLE.BO',
      avgPrice: 100,
      marketPrice: 125,
      sipAmountMinor: null,
      sipDayOfMonth: null,
      sipStartMonth: null,
      notes: '',
      origin: 'user',
    }
    const result = growwStockOrdersFromRows(
      [
        header,
        ['Example Limited', 'EXAMPLE', 'INE000000001', 'BUY', 2, 200, 'BSE', '1', '04-10-2023 09:00 AM', 'Executed'],
        ['Example Limited', 'EXAMPLE', 'INE000000001', 'SELL', 2, 250, 'BSE', '2', '05-10-2023 09:00 AM', 'Executed'],
      ],
      [existing],
    )
    expect(result.holdings).toEqual([])
    expect(result.closedHoldingIds).toEqual(['existing-example'])
  })

  it('applies a sell-only export against an existing position', () => {
    const existing: Holding = {
      id: 'existing-example',
      name: 'Example Limited',
      kind: 'stock',
      purchaseMode: 'lumpsum',
      currentMinor: 100_000,
      investedMinor: 80_000,
      qty: 10,
      ticker: 'EXAMPLE.NS',
      buyDate: '2023-01-01',
      avgPrice: 800,
      marketPrice: 1000,
      sipAmountMinor: null,
      sipDayOfMonth: null,
      sipStartMonth: null,
      notes: '',
      origin: 'user',
    }
    const result = growwStockOrdersFromRows(
      [header, ['Example Limited', 'EXAMPLE', 'INE000000001', 'SELL', 4, 4400, 'NSE', '2', '05-10-2023 09:00 AM', 'Executed']],
      [existing],
    )
    expect(result.closedHoldingIds).toEqual([])
    expect(result.holdings[0]).toMatchObject({ id: 'existing-example', qty: 6, investedMinor: 48_000, buyDate: '2023-01-01' })
  })

  it('uses an exact NSE symbol and Yahoo canonical company name', async () => {
    const imported = growwStockOrdersFromRows([
      header,
      ['Mahindra & Mahindra', 'M&M', 'INE101A01026', 'BUY', 2, 6000, 'NSE', '1', '04-10-2023 09:00 AM', 'Executed'],
    ])
    const resolved = await resolveGrowwStockNames(imported, async () => [
      { ticker: 'M&M.NS', name: 'Mahindra & Mahindra Limited', exchange: 'NSI', type: 'EQUITY' },
      { ticker: 'M&M.BO', name: 'Mahindra & Mahindra Limited', exchange: 'BSE', type: 'EQUITY' },
    ])
    expect(resolved).toMatchObject({ resolvedCount: 1, unresolvedCount: 0 })
    expect(resolved.holdings[0]).toMatchObject({ ticker: 'M&M.NS', name: 'Mahindra & Mahindra Limited' })
  })

  it('keeps the Groww symbol when a fuzzy name result is not safe', async () => {
    const imported = growwStockOrdersFromRows([
      header,
      ['Example Industries', 'EXAMPLE', 'INE000000001', 'BUY', 1, 100, 'NSE', '1', '04-10-2023 09:00 AM', 'Executed'],
    ])
    const resolved = await resolveGrowwStockNames(imported, async () => [
      { ticker: 'DIFFERENT.NS', name: 'Unrelated Finance Limited', exchange: 'NSI', type: 'EQUITY' },
    ])
    expect(resolved).toMatchObject({ resolvedCount: 0, unresolvedCount: 1 })
    expect(resolved.holdings[0]).toMatchObject({ ticker: 'EXAMPLE.NS', name: 'Example Industries' })
  })

  it('maps the Yahoo-unsupported Modern Engineering listing to its BSE scrip code', async () => {
    const imported = growwStockOrdersFromRows([
      header,
      ['MODERN ENGINEERING AND PROJECT', 'MEAPL', 'INE250S01015', 'BUY', 10, 250, 'BSE', '1', '04-10-2023 09:00 AM', 'Executed'],
    ])
    const resolved = await resolveGrowwStockNames(imported, async () => [])
    expect(resolved).toMatchObject({ resolvedCount: 1, unresolvedCount: 0 })
    expect(resolved.holdings[0]).toMatchObject({
      ticker: '539762.BO',
      name: 'Modern Engineering and Projects Limited',
    })
  })

  it('reuses an existing Modern Engineering holding stored under its canonical ticker', () => {
    const existing: Holding = {
      id: 'existing-modern',
      name: 'Modern Engineering and Projects Limited',
      kind: 'stock',
      purchaseMode: 'lumpsum',
      currentMinor: 25_000,
      investedMinor: 25_000,
      qty: 10,
      ticker: '539762.BO',
      buyDate: '2023-10-04',
      avgPrice: 25,
      marketPrice: 25,
      sipAmountMinor: null,
      sipDayOfMonth: null,
      sipStartMonth: null,
      notes: '',
      origin: 'user',
    }
    const imported = growwStockOrdersFromRows(
      [header, ['MODERN ENGINEERING AND PROJECT', 'MEAPL', 'INE250S01015', 'BUY', 10, 250, 'BSE', '1', '04-10-2023 09:00 AM', 'Executed']],
      [existing],
    )
    expect(imported.holdings[0].id).toBe('existing-modern')
  })
})
