import { toMinor } from '@/domain/money'
import { Holding } from '@/domain/types'
import { MarketSymbolSearchResult, searchMarketSymbols } from '@/market/stockQuotes'
import { canonicalStockAlias } from '@/market/stockAliases'

export type GrowwStockImport = {
  holdings: Holding[]
  closedHoldingIds: string[]
  resolvedCount: number
  unresolvedCount: number
  orderCount: number
  ignoredCount: number
  periodFrom: string
  periodTo: string
}

type Order = {
  name: string
  symbol: string
  isin: string
  type: 'BUY' | 'SELL'
  quantity: number
  value: number
  exchange: string
  date: string
}

function numberValue(value: unknown) {
  const parsed = Number(
    String(value ?? '')
      .replace(/,/g, '')
      .trim(),
  )
  return Number.isFinite(parsed) ? parsed : 0
}

function isoDate(value: unknown) {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  const match = String(value ?? '').match(/^(\d{1,2})-(\d{1,2})-(\d{4})/)
  return match ? `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}` : ''
}

function tickerFor(symbol: string, exchange: string) {
  const clean = symbol.trim().toUpperCase()
  return exchange.toUpperCase() === 'BSE' ? `${clean}.BO` : exchange.toUpperCase() === 'NSE' ? `${clean}.NS` : clean
}

function baseTicker(value: string | null | undefined) {
  return String(value ?? '')
    .toUpperCase()
    .replace(/\.(NS|BO)$/, '')
}

function normalized(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function stableSuffix(value: string) {
  let hash = 2166136261
  for (const character of value) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

function nameWords(value: string) {
  const ignored = new Set(['limited', 'ltd', 'india', 'private', 'pvt', 'company', 'co'])
  return new Set(
    normalized(value)
      .split(' ')
      .filter((word) => word.length > 2 && !ignored.has(word)),
  )
}

function nameSimilarity(left: string, right: string) {
  const leftWords = nameWords(left)
  const rightWords = nameWords(right)
  if (!leftWords.size || !rightWords.size) return 0
  const shared = [...leftWords].filter((word) => rightWords.has(word)).length
  return shared / Math.min(leftWords.size, rightWords.size)
}

function bestYahooMatch(holding: Holding, matches: MarketSymbolSearchResult[]) {
  const expected = String(holding.ticker ?? '').toUpperCase()
  const base = baseTicker(expected)
  return matches
    .filter((match) => match.ticker.endsWith('.NS') || match.ticker.endsWith('.BO'))
    .map((match) => {
      const similarity = nameSimilarity(holding.name, match.name)
      const exactTicker = match.ticker === expected
      const exactBase = baseTicker(match.ticker) === base
      if (!exactTicker && !exactBase && similarity < 0.6) return null
      return {
        match,
        score: (exactTicker ? 100 : 0) + (exactBase ? 70 : 0) + similarity * 30 + (match.ticker.endsWith('.NS') ? 2 : 0),
      }
    })
    .filter((item): item is { match: MarketSymbolSearchResult; score: number } => Boolean(item))
    .sort((left, right) => right.score - left.score)[0]?.match
}

export async function resolveGrowwStockNames(
  imported: GrowwStockImport,
  search: (query: string) => Promise<MarketSymbolSearchResult[]> = searchMarketSymbols,
): Promise<GrowwStockImport> {
  let resolvedCount = 0
  const holdings = await Promise.all(
    imported.holdings.map(async (holding) => {
      const alias = canonicalStockAlias(holding)
      if (alias) {
        resolvedCount += 1
        return { ...holding, ...alias }
      }
      try {
        const tickerMatches = await search(String(holding.ticker ?? ''))
        let match = bestYahooMatch(holding, tickerMatches)
        if (!match) match = bestYahooMatch(holding, await search(holding.name))
        if (!match) return holding
        resolvedCount += 1
        return { ...holding, ticker: match.ticker, name: match.name }
      } catch {
        return holding
      }
    }),
  )
  return { ...imported, holdings, resolvedCount, unresolvedCount: holdings.length - resolvedCount }
}

export function growwStockOrdersFromRows(rows: unknown[][], existing: Holding[] = []): GrowwStockImport {
  const headerIndex = rows.findIndex((row) => row.map(String).includes('Stock name') && row.map(String).includes('Exchange Order Id'))
  if (headerIndex < 0) throw new Error('This is not a supported Groww stock order-history file.')
  const headers = rows[headerIndex].map((value) => String(value ?? '').trim())
  const index = (name: string) => headers.indexOf(name)
  let ignoredCount = 0
  const parsed = rows.slice(headerIndex + 1).flatMap((row): Order[] => {
    const status = String(row[index('Order status')] ?? '')
      .trim()
      .toUpperCase()
    const type = String(row[index('Type')] ?? '')
      .trim()
      .toUpperCase()
    const order = {
      name: String(row[index('Stock name')] ?? '').trim(),
      symbol: String(row[index('Symbol')] ?? '')
        .trim()
        .toUpperCase(),
      isin: String(row[index('ISIN')] ?? '')
        .trim()
        .toUpperCase(),
      type: type as Order['type'],
      quantity: numberValue(row[index('Quantity')]),
      value: numberValue(row[index('Value')]),
      exchange: String(row[index('Exchange')] ?? '')
        .trim()
        .toUpperCase(),
      date: isoDate(row[index('Execution date and time')]),
    }
    if (status !== 'EXECUTED' || !['BUY', 'SELL'].includes(type) || !order.name || !order.symbol || !order.date || !order.quantity) {
      if (row.some((value) => value !== null)) ignoredCount += 1
      return []
    }
    return [order]
  })
  if (!parsed.length) throw new Error('No executed stock orders were found in this file.')

  const existingStocks = existing.filter((item) => item.kind === 'stock')
  const grouped = new Map<string, Order[]>()
  parsed.forEach((order) => grouped.set(order.isin || order.symbol, [...(grouped.get(order.isin || order.symbol) ?? []), order]))
  const closedHoldingIds: string[] = []
  const holdings = [...grouped.entries()].flatMap(([identity, unordered]): Holding[] => {
    const orders = [...unordered].sort((left, right) => left.date.localeCompare(right.date))
    const latest = orders.at(-1) as Order
    const importedTicker = tickerFor(latest.symbol, latest.exchange)
    const importedAlias = canonicalStockAlias({ kind: 'stock', name: latest.name, ticker: importedTicker })
    const previous = existingStocks.find(
      (item) =>
        (importedAlias && canonicalStockAlias(item)?.ticker === importedAlias.ticker) ||
        baseTicker(item.ticker) === latest.symbol ||
        normalized(item.name) === normalized(latest.name),
    )
    const beginsWithImportedPosition = orders.some((order) => order.type === 'BUY')
    let quantity = beginsWithImportedPosition ? 0 : (previous?.qty ?? 0)
    let cost = beginsWithImportedPosition ? 0 : (previous?.investedMinor ?? 0) / 100
    let positionStart = beginsWithImportedPosition ? '' : (previous?.buyDate ?? '')
    orders.forEach((order) => {
      if (order.type === 'BUY') {
        if (!quantity) positionStart = order.date
        quantity += order.quantity
        cost += order.value
      } else {
        const removed = Math.min(quantity, order.quantity)
        const averageCost = quantity > 0 ? cost / quantity : 0
        quantity -= removed
        cost = Math.max(0, cost - removed * averageCost)
        if (quantity < 0.000001) {
          quantity = 0
          cost = 0
          positionStart = ''
        }
      }
    })
    if (!quantity) {
      if (previous) closedHoldingIds.push(previous.id)
      return []
    }
    const latestPrice = latest.value / latest.quantity
    return [
      {
        ...(previous ?? {}),
        id: previous?.id ?? `groww-stock-${stableSuffix(identity)}`,
        name: latest.name,
        kind: 'stock',
        purchaseMode: 'lumpsum',
        currentMinor: toMinor(quantity * latestPrice),
        investedMinor: toMinor(cost),
        qty: quantity,
        ticker: importedTicker,
        buyDate: positionStart || null,
        avgPrice: quantity ? cost / quantity : null,
        marketPrice: latestPrice,
        marketPriceAsOf: latest.date,
        marketPriceSource: 'import',
        sipAmountMinor: null,
        sipDayOfMonth: null,
        sipStartMonth: null,
        notes: previous?.notes ?? 'Imported from Groww stock order history.',
        origin: 'user',
      },
    ]
  })
  const dates = parsed.map((order) => order.date).sort()
  return {
    holdings,
    closedHoldingIds,
    resolvedCount: 0,
    unresolvedCount: holdings.length,
    orderCount: parsed.length,
    ignoredCount,
    periodFrom: dates[0],
    periodTo: dates.at(-1) ?? dates[0],
  }
}

export async function parseGrowwStockOrders(file: Blob, existing: Holding[] = []) {
  const { default: readXlsxFile } = await import('read-excel-file')
  return resolveGrowwStockNames(growwStockOrdersFromRows(await readXlsxFile(file), existing))
}
