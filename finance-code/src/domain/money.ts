export function toMinor(value: string | number): number {
  const numeric = typeof value === 'number' ? value : Number(String(value).replace(/,/g, '').trim())
  if (!Number.isFinite(numeric)) return 0
  return Math.round(numeric * 100)
}

export function formatIndianNumber(value: number): string {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0, minimumFractionDigits: 0 }).format(value)
}

export function formatMoney(amountMinor: number, currency = 'INR', showPaise = false): string {
  const fractionDigits = showPaise ? 2 : 0
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(amountMinor / 100)
}

const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function formatMonthLabel(value: string): string {
  const match = /^(\d{4})-(\d{2})/.exec(value)
  if (!match) return value
  const month = shortMonths[Number(match[2]) - 1]
  return month ? `${month} ${match[1]}` : value
}

export function formatDateLabel(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return formatMonthLabel(value)
  const month = shortMonths[Number(match[2]) - 1]
  return month ? `${Number(match[3])} ${month} ${match[1]}` : value
}

export function formatDisplayValue(value: string | number | null | undefined, columnType?: string): string {
  if (value === null || value === undefined || value === '') return ''
  if (typeof value === 'number') return formatIndianNumber(value)
  const text = String(value)
  if (columnType === 'date') return formatDateLabel(text)
  const numeric = Number(text.replace(/,/g, '').trim())
  if (columnType === 'number' || (Number.isFinite(numeric) && /^-?\d+(?:\.\d+)?$/.test(text.replace(/,/g, '').trim()))) {
    return formatIndianNumber(numeric)
  }
  return text
}

export function todayIso(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
