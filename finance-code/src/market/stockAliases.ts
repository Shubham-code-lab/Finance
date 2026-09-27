import { Holding } from '@/domain/types'

type StockAlias = { ticker: string; name: string }
type StockIdentity = Pick<Holding, 'kind' | 'name' | 'ticker'>

const aliases: Array<{ matches: (holding: StockIdentity) => boolean; value: StockAlias }> = [
  {
    matches: (holding) =>
      /modern engineering (and|&) projects?/i.test(holding.name) || /^(MEAPL|539762)(\.(BO|NS))?$/i.test(holding.ticker ?? ''),
    value: { ticker: '539762.BO', name: 'Modern Engineering and Projects Limited' },
  },
]

export function canonicalStockAlias(holding: StockIdentity): StockAlias | null {
  if (holding.kind !== 'stock') return null
  return aliases.find((alias) => alias.matches(holding))?.value ?? null
}

export function canonicalStockHolding(holding: Holding): Holding {
  const alias = canonicalStockAlias(holding)
  return alias ? { ...holding, ...alias } : holding
}
