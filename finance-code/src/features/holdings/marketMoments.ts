export type MarketPoint = { date: string; value: number }
export type MarketSeries = { id: string; points: MarketPoint[] }
export type MarketMoment = { id: string; kind: 'drop' | 'high'; date: string; value: number }

function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
}

export function equalWeightPerformance(series: MarketSeries[]): MarketPoint[] {
  const usable = series
    .map((item) => ({ ...item, points: [...item.points].sort((left, right) => left.date.localeCompare(right.date)) }))
    .filter((item) => item.points.length > 1 && item.points[0].value > 0)
  const dates = [...new Set(usable.flatMap((item) => item.points.map((point) => point.date)))].sort()
  const latest = new Map<string, number>()
  const baselines = new Map(usable.map((item) => [item.id, item.points[0].value]))
  const bySeries = new Map(usable.map((item) => [item.id, new Map(item.points.map((point) => [point.date, point.value]))]))

  return dates.flatMap((date): MarketPoint[] => {
    usable.forEach((item) => {
      const value = bySeries.get(item.id)?.get(date)
      if (value !== undefined) latest.set(item.id, value)
    })
    const changes = usable.flatMap((item) => {
      const value = latest.get(item.id)
      const baseline = baselines.get(item.id)
      return value !== undefined && baseline ? [(value / baseline - 1) * 100] : []
    })
    if (!changes.length) return []
    const average = changes.reduce((sum, value) => sum + value, 0) / changes.length
    return [{ date, value: Math.abs(average) < 1e-10 ? 0 : average }]
  })
}

function separated<T extends { index: number }>(items: T[], count: number, minimumGap: number) {
  const selected: T[] = []
  items.forEach((item) => {
    if (selected.length < count && selected.every((existing) => Math.abs(existing.index - item.index) >= minimumGap)) selected.push(item)
  })
  return selected
}

export function findMarketMoments(points: MarketPoint[], count = 5): MarketMoment[] {
  if (points.length < 45 || daysBetween(points[0].date, points.at(-1)?.date ?? points[0].date) < 90) return []

  let peak = points[0].value
  const drawdowns = points.map((point) => {
    peak = Math.max(peak, point.value)
    const peakIndexValue = 100 + peak
    return peakIndexValue > 0 ? ((100 + point.value) / peakIndexValue - 1) * 100 : 0
  })
  const window = Math.max(2, Math.floor(points.length / 50))
  const minimumGap = Math.max(8, Math.floor(points.length / 14))
  const local = (values: number[], index: number, kind: 'min' | 'max') => {
    const start = Math.max(0, index - window)
    const end = Math.min(values.length, index + window + 1)
    const sample = values.slice(start, end)
    return kind === 'min' ? values[index] === Math.min(...sample) : values[index] === Math.max(...sample)
  }

  const drops = separated(
    drawdowns
      .map((value, index) => ({ index, value }))
      .filter((item) => item.value <= -3 && local(drawdowns, item.index, 'min'))
      .sort((left, right) => left.value - right.value),
    count,
    minimumGap,
  ).map(({ index, value }) => ({ id: `drop:${points[index].date}`, kind: 'drop' as const, date: points[index].date, value }))

  const performance = points.map((point) => point.value)
  const highs = separated(
    performance
      .map((value, index) => ({ index, value }))
      .filter((item) => item.value >= 3 && local(performance, item.index, 'max'))
      .sort((left, right) => right.value - left.value),
    count,
    minimumGap,
  ).map(({ index, value }) => ({ id: `high:${points[index].date}`, kind: 'high' as const, date: points[index].date, value }))

  return [...drops, ...highs]
}
