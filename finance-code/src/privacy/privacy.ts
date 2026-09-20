import { createContext, useContext } from 'react'
import { formatIndianNumber, formatMoney } from '@/domain/money'

export type PrivacyContextValue = {
  masked: boolean
  toggle: () => void
}

export const PrivacyContext = createContext<PrivacyContextValue | null>(null)

export function usePrivacy() {
  const context = useContext(PrivacyContext)
  if (!context) throw new Error('usePrivacy must be used inside PrivacyProvider')
  return context
}

function maskedDigits(value: number) {
  const whole = Math.floor(Math.abs(value))
  return `xxxxx${String(whole).slice(-3).padStart(3, '0')}`
}

export function formatPrivateMoney(amountMinor: number, currency = 'INR', showPaise = false, masked = false) {
  if (!masked) return formatMoney(amountMinor, currency, showPaise)
  const sign = amountMinor < 0 ? '-' : ''
  const currencyPart = new Intl.NumberFormat('en-IN', { style: 'currency', currency })
    .formatToParts(0)
    .find((part) => part.type === 'currency')?.value
  return `${sign}${currencyPart ?? currency}${maskedDigits(amountMinor / 100)}`
}

export function formatPrivateNumber(value: number, masked = false) {
  if (!masked) return formatIndianNumber(value)
  return `${value < 0 ? '-' : ''}${maskedDigits(value)}`
}
