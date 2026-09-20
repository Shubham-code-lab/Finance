import Papa from 'papaparse'
import { fetchNifty500Csv } from '@/market/indiaUniverse.api'

export type IndiaStock = { name: string; industry: string; ticker: string }

type NiftyConstituentRow = {
  'Company Name'?: string
  Industry?: string
  Symbol?: string
  Series?: string
  'ISIN Code'?: string
}

export function parseNifty500Constituents(csv: string): IndiaStock[] {
  const parsed = Papa.parse<NiftyConstituentRow>(csv, { header: true, skipEmptyLines: true, transformHeader: (header) => header.trim() })
  if (parsed.errors.length && !parsed.data.length) throw new Error('NSE returned an unreadable Nifty 500 list.')
  const seen = new Set<string>()
  return parsed.data
    .flatMap((row): IndiaStock[] => {
      const symbol = row.Symbol?.trim().toUpperCase()
      if (!symbol) return []
      const name = row['Company Name']?.trim() || symbol
      const series = row.Series?.trim().toUpperCase()
      const isin = row['ISIN Code']?.trim().toUpperCase()
      // NSE can temporarily add synthetic DUMMY constituents during corporate
      // actions. Yahoo does not quote these; the real security may be in BE.
      const isDummy = symbol?.startsWith('DUMMY') || name?.toUpperCase().startsWith('DUMMY ') || isin?.startsWith('DUM')
      if (!['EQ', 'BE'].includes(series ?? '') || isDummy || seen.has(symbol)) return []
      seen.add(symbol)
      return [
        {
          name,
          industry: row.Industry?.trim() || 'Not available',
          ticker: `${symbol}.NS`,
        },
      ]
    })
    .slice(0, 500)
}

export async function getNifty500Constituents(signal?: AbortSignal): Promise<IndiaStock[]> {
  const stocks = parseNifty500Constituents(await fetchNifty500Csv(signal))
  if (stocks.length < 400) throw new Error(`NSE returned only ${stocks.length} Nifty 500 constituents.`)
  return stocks
}
