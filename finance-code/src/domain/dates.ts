const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30)

export function excelSerialToIso(serial: number): string {
  return new Date(EXCEL_EPOCH_UTC + serial * 86400000).toISOString().slice(0, 10)
}

export function toIsoDate(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }
  if (typeof value === 'number' && value > 20000 && value < 80000) {
    return excelSerialToIso(value)
  }
  const text = String(value ?? '').trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10)
  const asNumber = Number(text.replace(/,/g, ''))
  if (Number.isFinite(asNumber) && asNumber > 20000 && asNumber < 80000) {
    return excelSerialToIso(asNumber)
  }
  return text.slice(0, 10)
}

export function toRupees(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const numeric = Number(
    String(value ?? '')
      .replace(/,/g, '')
      .replace(/₹/g, '')
      .trim(),
  )
  return Number.isFinite(numeric) ? numeric : 0
}
