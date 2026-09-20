import { formatPrivateMoney, usePrivacy } from '@/privacy/privacy'
import { useUiStyles } from './styles'

export function MoneyText({
  amountMinor,
  tone = 'auto',
  currency = 'INR',
  showPaise = false,
}: {
  amountMinor: number
  tone?: 'auto' | 'positive' | 'negative' | 'steady'
  currency?: string
  showPaise?: boolean
}) {
  const classes = useUiStyles()
  const { masked } = usePrivacy()
  const resolved = tone === 'auto' ? (amountMinor > 0 ? 'positive' : amountMinor < 0 ? 'negative' : 'steady') : tone
  const toneClass = resolved === 'positive' ? classes.moneyPositive : resolved === 'negative' ? classes.moneyNegative : classes.moneySteady
  return <span className={`${classes.money} ${toneClass}`}>{formatPrivateMoney(amountMinor, currency, showPaise, masked)}</span>
}
