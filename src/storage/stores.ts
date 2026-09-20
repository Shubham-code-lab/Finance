export const STORE_NAMES = [
  'meta',
  'accounts',
  'categories',
  'customTables',
  'customTableRows',
  'columnMappings',
  'transactions',
  'snapshots',
  'metrics',
  'chartSpecs',
  'dashboard',
  'imports',
  'holdings',
  'sipEvents',
  'incomeSources',
  'plannedExpenses',
  'forecastSettings',
] as const

export type StoreName = (typeof STORE_NAMES)[number]
export type KeyedStoreName = Exclude<StoreName, 'meta' | 'dashboard'>
