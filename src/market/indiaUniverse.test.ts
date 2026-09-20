import { describe, expect, it } from 'vitest'
import { parseNifty500Constituents } from './indiaUniverse'

describe('parseNifty500Constituents', () => {
  it('builds Yahoo tickers from the live NSE constituent format', () => {
    const csv = [
      'Company Name,Industry,Symbol,Series,ISIN Code',
      'ABB India Ltd.,Capital Goods,ABB,EQ,INE117A01022',
      'Example SME Ltd.,Financial Services,EXAMPLE,SM,INE000000001',
      'Reliance Industries Ltd.,Oil Gas & Consumable Fuels,RELIANCE,EQ,INE002A01018',
    ].join('\n')

    expect(parseNifty500Constituents(csv)).toEqual([
      { name: 'ABB India Ltd.', industry: 'Capital Goods', ticker: 'ABB.NS' },
      { name: 'Reliance Industries Ltd.', industry: 'Oil Gas & Consumable Fuels', ticker: 'RELIANCE.NS' },
    ])
  })

  it('handles quoted company names without hard-coded symbols', () => {
    const csv = 'Company Name,Industry,Symbol,Series\n"Example, Holdings Ltd.",Financial Services,EXAMPLE,EQ'
    expect(parseNifty500Constituents(csv)[0]).toEqual({
      name: 'Example, Holdings Ltd.',
      industry: 'Financial Services',
      ticker: 'EXAMPLE.NS',
    })
  })

  it('drops NSE dummy constituents and keeps real securities in the BE series', () => {
    const csv = [
      'Company Name,Industry,Symbol,Series,ISIN Code',
      'Dummy HEG Ltd.,Metals & Mining,DUMMYHEG,EQ,DUM545A01024',
      'HEG Ltd.,Capital Goods,HEG,BE,INE545A01024',
    ].join('\n')

    expect(parseNifty500Constituents(csv)).toEqual([{ name: 'HEG Ltd.', industry: 'Capital Goods', ticker: 'HEG.NS' }])
  })
})
