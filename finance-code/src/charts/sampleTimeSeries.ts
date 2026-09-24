type TimeSeriesRow = Record<string, string | number>

export function sampleTimeSeries<T extends TimeSeriesRow>(rows: T[], maximum = 600, requiredDates: Iterable<string> = []): T[] {
  if (rows.length <= maximum) return rows
  const required = new Set(requiredDates)
  const keep = new Set<number>([0, rows.length - 1])
  const slots = Math.max(2, maximum - required.size)
  const step = (rows.length - 1) / (slots - 1)
  for (let index = 0; index < slots; index += 1) keep.add(Math.round(index * step))
  rows.forEach((row, index) => {
    if (required.has(String(row.date ?? ''))) keep.add(index)
  })
  return [...keep].sort((left, right) => left - right).map((index) => rows[index])
}
