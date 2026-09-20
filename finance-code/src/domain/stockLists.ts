export type StockListSymbol = { name: string; ticker: string; sector?: string; industry?: string }
export type SavedStockList = { id: string; name: string; stocks: StockListSymbol[] }
export type StockListState = { currentStocks: StockListSymbol[]; watchlists: SavedStockList[] }

const MAX_CURRENT_STOCKS = 20
const MAX_WATCHLISTS = 100
const MAX_WATCHLIST_STOCKS = 20

function normalizeSymbol(value: unknown): StockListSymbol | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<StockListSymbol>
  const name = typeof candidate.name === 'string' ? candidate.name.trim() : ''
  const ticker = typeof candidate.ticker === 'string' ? candidate.ticker.trim().toUpperCase() : ''
  if (!name || !ticker) return null
  return {
    name,
    ticker,
    ...(typeof candidate.sector === 'string' && candidate.sector.trim() ? { sector: candidate.sector.trim() } : {}),
    ...(typeof candidate.industry === 'string' && candidate.industry.trim() ? { industry: candidate.industry.trim() } : {}),
  }
}

function normalizeSymbols(value: unknown, limit: number) {
  if (!Array.isArray(value)) return []
  const unique = new Map<string, StockListSymbol>()
  value.forEach((item) => {
    const symbol = normalizeSymbol(item)
    if (symbol && !unique.has(symbol.ticker) && unique.size < limit) unique.set(symbol.ticker, symbol)
  })
  return [...unique.values()]
}

export function normalizeStockListState(value: unknown): StockListState {
  if (!value || typeof value !== 'object') return { currentStocks: [], watchlists: [] }
  const candidate = value as Partial<StockListState>
  const watchlists = Array.isArray(candidate.watchlists)
    ? candidate.watchlists.flatMap((item): SavedStockList[] => {
        if (!item || typeof item !== 'object') return []
        const list = item as Partial<SavedStockList>
        const id = typeof list.id === 'string' ? list.id.trim() : ''
        const name = typeof list.name === 'string' ? list.name.trim() : ''
        const stocks = normalizeSymbols(list.stocks, MAX_WATCHLIST_STOCKS)
        return id && name && stocks.length ? [{ id, name, stocks }] : []
      })
    : []
  return {
    currentStocks: normalizeSymbols(candidate.currentStocks, MAX_CURRENT_STOCKS),
    watchlists: watchlists.slice(0, MAX_WATCHLISTS),
  }
}

export function recoverStockListState(
  cloud: StockListState | null,
  legacyWatchlists: SavedStockList[],
  portfolioStocks: StockListSymbol[],
): StockListState {
  const recovery = normalizeStockListState({ currentStocks: portfolioStocks, watchlists: legacyWatchlists })
  const currentStocks = cloud?.currentStocks.length ? cloud.currentStocks : recovery.currentStocks
  const watchlists = cloud?.watchlists.length
    ? cloud.watchlists
    : recovery.watchlists.length
      ? recovery.watchlists
      : currentStocks.length
        ? [{ id: 'recovered-investments', name: 'Recovered investments', stocks: currentStocks }]
        : []
  return { currentStocks, watchlists }
}
