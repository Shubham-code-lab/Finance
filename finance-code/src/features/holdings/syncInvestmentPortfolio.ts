import { todayIso } from '@/domain/money'
import { Account, Holding, StoreData } from '@/domain/types'
import { snapshotsFromHoldings } from '@/features/holdings/fromDump'
import { getMutualFundNavHistory } from '@/market/mutualFundNav.api'
import { getDailyCloses } from '@/market/stockQuotes'
import { canonicalStockAlias, canonicalStockHolding } from '@/market/stockAliases'
import { deleteHolding, getAllData, putMany, replaceInvestmentSnapshots } from '@/storage/repository'

export type InvestmentMarketSyncResult = {
  updatedHoldings: number
  updatedAccounts: number
  updatedSnapshots: boolean
  removedDuplicateHoldings: number
  errors: string[]
}

type LatestMarketPrice = { price: number; asOf: string }
type LatestPriceReader = (holding: Holding, asOf: string) => Promise<number | LatestMarketPrice>

function dateDaysBefore(value: string, days: number) {
  const date = new Date(`${value}T12:00:00`)
  date.setDate(date.getDate() - days)
  return todayIso(date)
}

async function latestMarketPrice(holding: Holding, asOf: string) {
  if (holding.kind === 'stock') {
    if (!holding.ticker) throw new Error('Missing market ticker')
    const closes = await getDailyCloses(holding.ticker, dateDaysBefore(asOf, 14), asOf)
    const latest = closes.at(-1)
    if (!latest) throw new Error('No recent market price')
    return { price: latest.closeMinor / 100, asOf: latest.date }
  }

  const history = await getMutualFundNavHistory(holding.name, undefined, holding.avgPrice)
  const latest = history.points.filter((point) => point.date <= asOf).at(-1)
  if (!latest) throw new Error('No recent NAV')
  return { price: latest.nav, asOf: latest.date }
}

export function holdingAtMarketPrice(holding: Holding, marketPrice: number, marketPriceAsOf?: string): Holding {
  if (!holding.qty || holding.qty <= 0 || !Number.isFinite(marketPrice) || marketPrice <= 0) return holding
  return {
    ...holding,
    marketPrice,
    marketPriceAsOf: marketPriceAsOf ?? holding.marketPriceAsOf ?? null,
    marketPriceSource: 'market',
    currentMinor: Math.round(holding.qty * marketPrice * 100),
  }
}

function sameHoldingValue(left: Holding, right: Holding) {
  return (
    left.currentMinor === right.currentMinor &&
    left.marketPrice === right.marketPrice &&
    left.marketPriceAsOf === right.marketPriceAsOf &&
    left.marketPriceSource === right.marketPriceSource
  )
}

export function dedupeCanonicalStockHoldings(holdings: Holding[]) {
  const kept: Holding[] = []
  const removedIds: string[] = []

  holdings.forEach((holding) => {
    const alias = canonicalStockAlias(holding)
    if (!alias) {
      kept.push(holding)
      return
    }
    const duplicateIndex = kept.findIndex(
      (candidate) =>
        canonicalStockAlias(candidate)?.ticker === alias.ticker &&
        candidate.qty === holding.qty &&
        candidate.investedMinor === holding.investedMinor &&
        candidate.avgPrice === holding.avgPrice,
    )
    if (duplicateIndex < 0) {
      kept.push(holding)
      return
    }

    const candidate = kept[duplicateIndex]
    const keepIncoming = Boolean(holding.buyDate && (!candidate.buyDate || holding.buyDate < candidate.buyDate))
    if (keepIncoming) {
      removedIds.push(candidate.id)
      kept[duplicateIndex] = holding
    } else {
      removedIds.push(holding.id)
    }
  })

  return { holdings: kept, removedIds }
}

function investmentAccount(id: string, name: string): Account {
  return { id, name, type: 'investment', currency: 'INR', origin: 'user', archived: false }
}

function missingInvestmentAccounts(data: StoreData) {
  const existing = new Set(data.accounts.map((account) => account.id))
  const accounts: Account[] = []
  if (data.holdings.some((holding) => holding.kind === 'mutual_fund') && !existing.has('mutual-funds')) {
    accounts.push(investmentAccount('mutual-funds', 'Mutual funds'))
  }
  if (data.holdings.some((holding) => holding.kind === 'stock') && !existing.has('stocks-portfolio')) {
    accounts.push(investmentAccount('stocks-portfolio', 'Stocks'))
  }
  return accounts
}

function investmentSnapshotsChanged(data: StoreData, expected: ReturnType<typeof snapshotsFromHoldings>) {
  const current = data.snapshots
    .filter((snapshot) => snapshot.accountId === 'mutual-funds' || snapshot.accountId === 'stocks-portfolio')
    .sort((left, right) => left.id.localeCompare(right.id))
  const next = [...expected].sort((left, right) => left.id.localeCompare(right.id))
  return JSON.stringify(current) !== JSON.stringify(next)
}

/**
 * Makes imported positions the single source for investment quantities/cost,
 * then persists current API prices and matching account snapshots to Firebase.
 * A failed quote never blocks the other holdings or replaces its last known value.
 */
export async function syncInvestmentPortfolio(
  source?: StoreData,
  readLatestPrice: LatestPriceReader = latestMarketPrice,
): Promise<InvestmentMarketSyncResult> {
  const data = source ?? (await getAllData())
  const asOf = todayIso()
  const errors: string[] = []
  const canonical = dedupeCanonicalStockHoldings(data.holdings.map(canonicalStockHolding))
  const canonicalHoldings = canonical.holdings
  const refreshed = await Promise.all(
    canonicalHoldings.map(async (holding) => {
      if (!holding.qty || holding.qty <= 0) return holding
      try {
        const latest = await readLatestPrice(holding, asOf)
        return typeof latest === 'number'
          ? holdingAtMarketPrice(holding, latest, asOf)
          : holdingAtMarketPrice(holding, latest.price, latest.asOf)
      } catch (cause) {
        errors.push(`${holding.name}: ${cause instanceof Error ? cause.message : 'Market value unavailable'}`)
        return holding
      }
    }),
  )
  const existingById = new Map(data.holdings.map((holding) => [holding.id, holding]))
  const changedHoldings = refreshed.filter((holding) => {
    const existing = existingById.get(holding.id)
    return !existing || !sameHoldingValue(holding, existing) || holding.ticker !== existing.ticker || holding.name !== existing.name
  })
  const accounts = missingInvestmentAccounts({ ...data, holdings: refreshed })
  const snapshots = snapshotsFromHoldings(refreshed, asOf, data.sipEvents)
  const updatedSnapshots = investmentSnapshotsChanged(data, snapshots)

  for (const holdingId of canonical.removedIds) await deleteHolding(holdingId)
  await Promise.all([
    changedHoldings.length ? putMany('holdings', changedHoldings) : Promise.resolve(),
    accounts.length ? putMany('accounts', accounts) : Promise.resolve(),
    updatedSnapshots ? replaceInvestmentSnapshots(snapshots) : Promise.resolve(),
  ])

  return {
    updatedHoldings: changedHoldings.length,
    updatedAccounts: accounts.length,
    updatedSnapshots,
    removedDuplicateHoldings: canonical.removedIds.length,
    errors,
  }
}
