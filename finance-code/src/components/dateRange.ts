import dayjs from 'dayjs'

export type DateRangeValue = { from: string; to: string }

export function lastThreeMonthsRange(): DateRangeValue {
  return { from: dayjs().subtract(2, 'month').startOf('month').format('YYYY-MM-DD'), to: dayjs().format('YYYY-MM-DD') }
}

export function isValidDateRange(range: DateRangeValue) {
  return !range.from || !range.to || range.from <= range.to
}
