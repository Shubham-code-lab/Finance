import { formatDateLabel } from '@/domain/money'
import { Holding } from '@/domain/types'

export function marketValueStatus(holding: Holding) {
  const date = holding.marketPriceAsOf ? formatDateLabel(holding.marketPriceAsOf) : ''

  if (holding.marketPriceSource === 'market') {
    const label = holding.kind === 'mutual_fund' ? 'Latest NAV' : 'Latest market close'
    return `${label}${date ? ` · ${date}` : ''}`
  }

  if (holding.marketPriceSource === 'import') {
    return `Last imported price${date ? ` · ${date}` : ''}`
  }

  return 'Last saved value · live price not confirmed'
}

export function hasConfirmedMarketValue(holding: Holding) {
  return holding.marketPriceSource === 'market'
}

export function portfolioMarketValueStatus(holdings: Holding[]) {
  if (!holdings.length) return null
  const unconfirmed = holdings.filter((holding) => !hasConfirmedMarketValue(holding)).length
  if (unconfirmed) {
    return {
      confirmed: false,
      text: `${unconfirmed} ${unconfirmed === 1 ? 'value' : 'values'} not live · imported/saved price used`,
    }
  }

  const oldestDate = holdings
    .map((holding) => holding.marketPriceAsOf)
    .filter((date): date is string => Boolean(date))
    .sort()[0]
  return {
    confirmed: true,
    text: `Market values${oldestDate ? ` · through ${formatDateLabel(oldestDate)}` : ''}`,
  }
}
