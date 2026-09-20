import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import AddIcon from '@mui/icons-material/Add'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import CheckBoxIcon from '@mui/icons-material/CheckBox'
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank'
import CloseIcon from '@mui/icons-material/Close'
import DeleteIcon from '@mui/icons-material/Delete'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import RemoveIcon from '@mui/icons-material/Remove'
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore'
import RefreshIcon from '@mui/icons-material/Refresh'
import ViewColumnIcon from '@mui/icons-material/ViewColumn'
import {
  Autocomplete,
  Chip,
  CircularProgress,
  Dialog,
  IconButton,
  Menu,
  MenuItem,
  Popover,
  TextField,
  Tooltip as MuiTooltip,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material'
import { useQueries, useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { createUseStyles } from 'react-jss'
import {
  Area,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts'
import { DateRangePicker } from '@/components/DateRangePicker'
import { DateRangeValue, isValidDateRange } from '@/components/dateRange'
import { Button, Card, Select } from '@/components/ui'
import { formatDateLabel, formatMoney, todayIso } from '@/domain/money'
import { recoverStockListState, SavedStockList, StockListSymbol } from '@/domain/stockLists'
import {
  getSelectedMarketDailyCloses,
  getMarketFundamentals,
  getMarketSymbolProfile,
  MarketFundamentals,
  MarketSymbolSearchResult,
  searchMarketSymbols,
} from '@/market/stockQuotes'
import { readStockLists, stockListsOwnerKey, writeStockLists } from '@/storage/stockLists.api'
import { tokens } from '@/theme/tokens'

type Exchange = 'NSE' | 'BSE' | 'US'
type ChartMode = 'percent' | 'price'
type TableSort = { key: 'name' | 'changePct'; direction: 'asc' | 'desc' }
type TableColumnId =
  'serial' | 'company' | 'from' | 'startPrice' | 'to' | 'currentPrice' | 'change' | 'rangeReturn' | keyof MarketFundamentals
type MarketSymbol = StockListSymbol
type MarketPreferences = {
  version: 1
  highlighted: string[]
  exchange: Exchange
  range: DateRangeValue
  mode: ChartMode
  sort: TableSort
  columns: TableColumnId[]
}
type LegacyMarketPreferences = Partial<MarketPreferences> & { selected?: MarketSymbol[] }
type MarketWatchlist = SavedStockList
type ConfirmAction = 'delete-watchlist' | 'clear-current-stocks' | 'clear-saved-watchlists' | 'remove-stock'

type ColumnDefinition = {
  id: TableColumnId
  label: string
  group: 'Price & period' | 'Valuation' | 'Growth & quality' | 'Financial position'
}

const tableColumns: ColumnDefinition[] = [
  { id: 'serial', label: 'S.No.', group: 'Price & period' },
  { id: 'company', label: 'Company', group: 'Price & period' },
  { id: 'from', label: 'From', group: 'Price & period' },
  { id: 'startPrice', label: 'Start price', group: 'Price & period' },
  { id: 'to', label: 'To', group: 'Price & period' },
  { id: 'currentPrice', label: 'CMP', group: 'Price & period' },
  { id: 'change', label: 'Change', group: 'Price & period' },
  { id: 'rangeReturn', label: 'Range return %', group: 'Price & period' },
  { id: 'marketCap', label: 'Market cap', group: 'Valuation' },
  { id: 'trailingPE', label: 'P/E', group: 'Valuation' },
  { id: 'priceToBook', label: 'P/B', group: 'Valuation' },
  { id: 'dividendYield', label: 'Dividend yield %', group: 'Valuation' },
  { id: 'enterpriseValue', label: 'Enterprise value', group: 'Valuation' },
  { id: 'enterpriseToEbitda', label: 'EV / EBITDA', group: 'Valuation' },
  { id: 'pegRatio', label: 'PEG ratio', group: 'Valuation' },
  { id: 'trailingEps', label: 'EPS', group: 'Growth & quality' },
  { id: 'revenueGrowth', label: 'Qtr sales growth %', group: 'Growth & quality' },
  { id: 'earningsGrowth', label: 'Qtr profit growth %', group: 'Growth & quality' },
  { id: 'returnOnEquity', label: 'ROE %', group: 'Growth & quality' },
  { id: 'returnOnAssets', label: 'ROA %', group: 'Growth & quality' },
  { id: 'totalRevenue', label: 'Revenue (TTM)', group: 'Growth & quality' },
  { id: 'currentRatio', label: 'Current ratio', group: 'Financial position' },
  { id: 'totalDebt', label: 'Total debt', group: 'Financial position' },
  { id: 'freeCashflow', label: 'Free cash flow', group: 'Financial position' },
]

const defaultTableColumns: TableColumnId[] = [
  'serial',
  'company',
  'currentPrice',
  'rangeReturn',
  'marketCap',
  'trailingPE',
  'revenueGrowth',
  'earningsGrowth',
  'returnOnEquity',
]
const tableColumnIds = new Set<TableColumnId>(tableColumns.map((column) => column.id))

const colors = ['#8db7ff', '#42b883', '#ff9fca', '#e5c463', '#ff7a76', '#72d6dd', '#b89cff', '#b8d97a']
const seriesColorStyles = Object.fromEntries(
  colors.flatMap((color, index) => [
    [`seriesChip${index}`, { '&&': { borderColor: `${color} !important` }, '& .MuiChip-icon': { color: `${color} !important` } }],
    [`seriesFill${index}`, { background: color }],
  ]),
)
const preferencesKey = 'finance:stock-market-filters:v1'
const watchlistsKey = 'finance:stock-market-watchlists:v1'

const defaults: MarketSymbol[] = []

const useStyles = createUseStyles({
  ...seriesColorStyles,
  root: { display: 'grid', gap: tokens.space.md },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: tokens.space.md, flexWrap: 'wrap' },
  title: { margin: 0, fontSize: tokens.font.sizeLg },
  source: { color: tokens.color.textMuted, fontSize: tokens.font.sizeXs },
  filters: {
    display: 'grid',
    gridTemplateColumns: 'minmax(220px, 1fr) 110px auto auto',
    gap: tokens.space.sm,
    alignItems: 'center',
    marginTop: tokens.space.md,
    '@media (max-width: 900px)': {
      gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
      '& > form, & > :last-child': { gridColumn: '1 / -1' },
    },
    '@media (max-width: 560px)': { gridTemplateColumns: '1fr' },
  },
  watchlistBar: {
    display: 'grid',
    gridTemplateColumns: 'minmax(150px, 220px) minmax(160px, 260px) auto',
    gap: tokens.space.sm,
    alignItems: 'center',
    marginTop: tokens.space.md,
    padding: tokens.space.sm,
    border: `1px solid ${tokens.color.border}`,
    borderRadius: tokens.radius.sm,
    background: tokens.color.bgMuted,
    '@media (max-width: 760px)': { gridTemplateColumns: '1fr 1fr', '& > :last-child': { gridColumn: '1 / -1' } },
    '@media (max-width: 520px)': { gridTemplateColumns: '1fr' },
  },
  watchlistLabel: { color: tokens.color.textMuted, fontSize: tokens.font.sizeXs, gridColumn: '1 / -1' },
  watchlistDelete: { minWidth: '36px !important', width: 36, padding: '4px !important', color: `${tokens.color.negative} !important` },
  watchlistControls: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: tokens.space.xs },
  watchlistMenuButton: {
    width: '36px !important',
    height: '36px !important',
    color: `${tokens.color.textMuted} !important`,
  },
  watchlistMenuPaper: {
    minWidth: 210,
    border: `1px solid ${tokens.color.borderStrong}`,
    background: `${tokens.color.bgCard} !important`,
    color: `${tokens.color.text} !important`,
  },
  watchlistMenuDanger: { color: `${tokens.color.negative} !important` },
  confirmPaper: {
    width: 430,
    maxWidth: 'calc(100vw - 24px)',
    border: `1px solid ${tokens.color.borderStrong}`,
    borderRadius: `${tokens.radius.md}px !important`,
    background: `${tokens.color.bgCard} !important`,
    color: `${tokens.color.text} !important`,
    boxShadow: `${tokens.shadow.card} !important`,
  },
  confirmForm: { display: 'grid' },
  confirmHeader: {
    display: 'grid',
    gridTemplateColumns: '40px minmax(0, 1fr)',
    gap: tokens.space.md,
    alignItems: 'center',
    padding: [tokens.space.lg, tokens.space.lg, tokens.space.md],
  },
  confirmIcon: {
    width: 40,
    height: 40,
    display: 'grid',
    placeItems: 'center',
    borderRadius: '50%',
    color: tokens.color.negative,
    background: tokens.color.negativeSoft,
  },
  confirmTitle: { margin: 0, fontSize: tokens.font.sizeLg },
  confirmBody: {
    margin: 0,
    padding: [0, tokens.space.lg, tokens.space.lg, 68],
    color: tokens.color.textMuted,
    fontSize: tokens.font.sizeSm,
    lineHeight: 1.55,
  },
  confirmActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: tokens.space.sm,
    padding: tokens.space.md,
    borderTop: `1px solid ${tokens.color.border}`,
    background: tokens.color.bgMuted,
  },
  confirmDanger: {
    minWidth: '112px !important',
    borderColor: `${tokens.color.negative} !important`,
    background: `${tokens.color.negative} !important`,
    color: '#111318 !important',
    fontWeight: `${tokens.font.weightMedium} !important`,
    '&:hover': { background: '#ff928f !important' },
    '&:focus-visible': { outline: `3px solid ${tokens.color.focus}`, outlineOffset: 2 },
  },
  searchForm: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 36px', gap: tokens.space.sm },
  option: { display: 'grid', minWidth: 0 },
  optionName: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  optionMeta: { color: tokens.color.textMuted, fontSize: tokens.font.sizeXs },
  iconButton: { minWidth: '36px !important', width: 36, padding: '4px !important' },
  chips: { display: 'flex', gap: tokens.space.sm, flexWrap: 'wrap', minHeight: 32, marginTop: tokens.space.md },
  chip: {
    height: '26px !important',
    borderRadius: `${tokens.radius.sm}px !important`,
    background: `${tokens.color.bgMuted} !important`,
    color: `${tokens.color.text} !important`,
    cursor: 'pointer',
    '& .MuiChip-label': { padding: '0 7px', fontSize: tokens.font.sizeXs },
    '& .MuiChip-icon, & .MuiChip-deleteIcon': { fontSize: '16px !important' },
    '& .MuiChip-deleteIcon': { color: `${tokens.color.textMuted} !important` },
  },
  chipFocused: { background: `${tokens.color.accentSoft} !important` },
  error: { color: tokens.color.danger, fontSize: tokens.font.sizeSm, marginTop: tokens.space.sm },
  chart: { height: 360, minHeight: 300, marginTop: tokens.space.md, '@media (max-width: 720px)': { height: 320 } },
  chartEmpty: { height: 320, display: 'grid', placeItems: 'center', color: tokens.color.textMuted, fontSize: tokens.font.sizeSm },
  tableWorkspace: { display: 'grid', gap: tokens.space.sm, marginTop: tokens.space.md, minWidth: 0 },
  tableToolbar: { display: 'flex', justifyContent: 'flex-end' },
  columnButton: { display: 'inline-flex', alignItems: 'center', gap: tokens.space.sm },
  columnPopover: {
    width: 290,
    maxWidth: 'calc(100vw - 24px)',
    border: `1px solid ${tokens.color.border}`,
    borderRadius: `${tokens.radius.sm}px !important`,
    background: `${tokens.color.bgMuted} !important`,
    color: `${tokens.color.text} !important`,
    boxShadow: `${tokens.shadow.card} !important`,
  },
  columnSidebar: { overflow: 'hidden' },
  columnSidebarHeader: {
    padding: tokens.space.md,
    borderBottom: `1px solid ${tokens.color.border}`,
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: tokens.space.sm,
  },
  columnCount: { color: tokens.color.textMuted, fontSize: tokens.font.sizeXs, whiteSpace: 'nowrap' },
  columnList: { display: 'grid', maxHeight: 420, overflowY: 'auto', padding: [tokens.space.sm, 0] },
  columnGroup: {
    padding: [tokens.space.sm, tokens.space.md, tokens.space.xs],
    color: tokens.color.textMuted,
    fontSize: tokens.font.sizeXs,
    fontWeight: tokens.font.weightMedium,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  columnToggle: {
    display: 'grid',
    gridTemplateColumns: '20px minmax(0, 1fr)',
    alignItems: 'center',
    gap: tokens.space.sm,
    width: '100%',
    padding: [6, tokens.space.md],
    border: 0,
    background: 'transparent',
    color: tokens.color.text,
    font: 'inherit',
    textAlign: 'left',
    cursor: 'pointer',
    '&:hover': { background: tokens.color.accentSoft },
    '& svg': { fontSize: 17, color: tokens.color.textMuted },
  },
  columnToggleActive: { color: tokens.color.accent, '& svg': { color: tokens.color.accent } },
  gridWrap: { overflowX: 'auto', border: `1px solid ${tokens.color.border}`, borderRadius: tokens.radius.sm },
  table: { width: 'max-content', minWidth: '100%', borderCollapse: 'collapse', fontSize: tokens.font.sizeSm },
  th: {
    padding: [tokens.space.sm, tokens.space.md],
    textAlign: 'left',
    color: tokens.color.accent,
    background: tokens.color.bgMuted,
    borderBottom: `1px solid ${tokens.color.borderStrong}`,
    whiteSpace: 'nowrap',
  },
  td: {
    padding: [tokens.space.sm, tokens.space.md],
    borderBottom: `1px solid ${tokens.color.border}`,
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  },
  sortableHead: { display: 'flex', alignItems: 'center', gap: tokens.space.xs, whiteSpace: 'nowrap' },
  sortButton: {
    width: 26,
    height: 26,
    padding: '3px !important',
    color: `${tokens.color.textMuted} !important`,
    '&:hover': { color: `${tokens.color.accent} !important` },
  },
  sortActive: { color: `${tokens.color.accent} !important` },
  positive: { color: tokens.color.positive },
  negative: { color: tokens.color.negative },
  pending: { color: tokens.color.textMuted },
  portfolioStatus: {
    padding: tokens.space.md,
    color: tokens.color.textMuted,
    fontSize: tokens.font.sizeSm,
    border: `1px solid ${tokens.color.border}`,
    borderRadius: tokens.radius.sm,
  },
  diversityBody: {
    display: 'grid',
    gridTemplateColumns: 'minmax(380px, 0.85fr) minmax(480px, 1.15fr)',
    gap: tokens.space.xl,
    alignItems: 'start',
    marginTop: tokens.space.md,
    '@media (max-width: 1100px)': { gridTemplateColumns: '1fr' },
  },
  pieChart: { height: 420, minHeight: 360 },
  diversityStats: { display: 'grid', alignContent: 'start', gap: tokens.space.md, minWidth: 0 },
  concentration: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: tokens.space.sm },
  stat: {
    padding: tokens.space.md,
    border: `1px solid ${tokens.color.border}`,
    borderRadius: tokens.radius.sm,
    background: tokens.color.bgMuted,
  },
  statLabel: { display: 'block', color: tokens.color.textMuted, fontSize: tokens.font.sizeXs, marginBottom: tokens.space.xs },
  statValue: { fontSize: tokens.font.sizeLg, fontWeight: tokens.font.weightMedium },
  sectorGrid: { overflowX: 'auto', border: `1px solid ${tokens.color.border}`, borderRadius: tokens.radius.sm },
  sectorTable: { width: '100%', minWidth: 460, tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: tokens.font.sizeSm },
  sectorStocks: { color: tokens.color.textMuted, lineHeight: 1.45, whiteSpace: 'normal', overflowWrap: 'anywhere' },
  swatch: { display: 'inline-block', width: 10, height: 10, marginRight: tokens.space.sm, borderRadius: 2 },
  sectorNameColumn: { width: '25%' },
  sectorStocksColumn: { width: '57%' },
  sectorShareColumn: { width: '18%' },
  stockSectors: { display: 'grid', borderTop: `1px solid ${tokens.color.border}`, paddingTop: tokens.space.sm },
  stockSectorRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(120px, 0.7fr) minmax(140px, 0.7fr) minmax(180px, 1fr)',
    gap: tokens.space.sm,
    padding: [tokens.space.sm, 0],
    borderBottom: `1px solid ${tokens.color.border}`,
    fontSize: tokens.font.sizeSm,
    '@media (max-width: 560px)': { gridTemplateColumns: '1fr', gap: 2 },
  },
  industry: { color: tokens.color.textMuted },
  tooltip: {
    minWidth: 220,
    maxWidth: 340,
    maxHeight: 'min(360px, calc(100vh - 48px))',
    overflowY: 'auto',
    border: `1px solid ${tokens.color.borderStrong}`,
    borderRadius: tokens.radius.sm,
    background: tokens.color.bgCard,
    boxShadow: tokens.shadow.card,
    padding: tokens.space.md,
    display: 'grid',
    gap: tokens.space.sm,
  },
  tooltipDate: { color: tokens.color.textMuted, fontSize: tokens.font.sizeXs },
  tooltipSeries: {
    display: 'grid',
    gridTemplateColumns: '10px minmax(0, 1fr) auto',
    gap: tokens.space.sm,
    alignItems: 'center',
    fontSize: tokens.font.sizeSm,
  },
  tooltipDot: { width: 9, height: 9, borderRadius: '50%' },
  tooltipName: { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  tooltipValue: { fontVariantNumeric: 'tabular-nums', fontWeight: tokens.font.weightMedium },
  tooltipChange: {
    gridColumn: '2 / -1',
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 3,
    fontSize: tokens.font.sizeXs,
    fontVariantNumeric: 'tabular-nums',
  },
  tooltipStocks: { color: tokens.color.textMuted, fontSize: tokens.font.sizeXs, lineHeight: 1.4 },
  modeBar: { display: 'flex', justifyContent: 'flex-start', alignItems: 'center' },
})

function resolveSymbol(value: string, exchange: Exchange): MarketSymbol | null {
  const input = value.trim()
  if (!input) return null
  if (!/^[a-z0-9&.-]{1,20}$/i.test(input)) return null
  const raw = input.toUpperCase().replace(/\s+/g, '')
  const ticker = raw.includes('.') || exchange === 'US' ? raw : `${raw}.${exchange === 'BSE' ? 'BO' : 'NS'}`
  return { name: ticker, ticker }
}

function initialRange(): DateRangeValue {
  return { from: dayjs().subtract(1, 'year').format('YYYY-MM-DD'), to: todayIso() }
}

function readPreferences(): MarketPreferences & { selected: MarketSymbol[] } {
  const fallback: MarketPreferences & { selected: MarketSymbol[] } = {
    version: 1,
    selected: defaults,
    highlighted: [],
    exchange: 'NSE',
    range: initialRange(),
    mode: 'percent',
    sort: { key: 'changePct', direction: 'desc' },
    columns: defaultTableColumns,
  }
  try {
    const value = JSON.parse(window.localStorage.getItem(preferencesKey) ?? '') as LegacyMarketPreferences
    const selected = Array.isArray(value.selected)
      ? value.selected
          .filter((item): item is MarketSymbol => Boolean(item && typeof item.name === 'string' && typeof item.ticker === 'string'))
          .slice(0, 20)
      : fallback.selected
    const selectedTickers = new Set(selected.map((item) => item.ticker))
    const highlighted = Array.isArray(value.highlighted)
      ? value.highlighted.filter((ticker): ticker is string => typeof ticker === 'string' && selectedTickers.has(ticker))
      : fallback.highlighted
    const exchange = value.exchange === 'NSE' || value.exchange === 'BSE' || value.exchange === 'US' ? value.exchange : fallback.exchange
    const mode = value.mode === 'price' || value.mode === 'percent' ? value.mode : fallback.mode
    const sort =
      value.sort &&
      (value.sort.key === 'name' || value.sort.key === 'changePct') &&
      (value.sort.direction === 'asc' || value.sort.direction === 'desc')
        ? value.sort
        : fallback.sort
    const range =
      value.range &&
      typeof value.range.from === 'string' &&
      typeof value.range.to === 'string' &&
      isValidDateRange(value.range) &&
      value.range.from &&
      value.range.to
        ? value.range
        : fallback.range
    const columns = Array.isArray(value.columns)
      ? value.columns.filter((column): column is TableColumnId => typeof column === 'string' && tableColumnIds.has(column as TableColumnId))
      : fallback.columns
    return { version: 1, selected, highlighted, exchange, range, mode, sort, columns }
  } catch {
    return fallback
  }
}

function readWatchlists(): MarketWatchlist[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(watchlistsKey) ?? '') as unknown
    if (!Array.isArray(value)) return []
    return value.flatMap((item): MarketWatchlist[] => {
      if (!item || typeof item !== 'object') return []
      const candidate = item as Partial<MarketWatchlist>
      if (typeof candidate.id !== 'string' || typeof candidate.name !== 'string' || !Array.isArray(candidate.stocks)) return []
      const stocks = candidate.stocks
        .filter((stock): stock is MarketSymbol => Boolean(stock && typeof stock.name === 'string' && typeof stock.ticker === 'string'))
        .slice(0, 20)
      return candidate.name.trim() && stocks.length ? [{ id: candidate.id, name: candidate.name.trim(), stocks }] : []
    })
  } catch {
    return []
  }
}

export function StockMarketComparison({
  portfolioStatus,
  recoverySymbols = [],
}: {
  portfolioStatus?: string
  recoverySymbols?: MarketSymbol[]
}) {
  const classes = useStyles()
  const [initialPreferences] = useState(readPreferences)
  const [selected, setSelected] = useState<MarketSymbol[]>(initialPreferences.selected)
  const [highlighted, setHighlighted] = useState<string[]>(initialPreferences.highlighted)
  const [input, setInput] = useState('')
  const [debouncedInput, setDebouncedInput] = useState('')
  const [chosenResult, setChosenResult] = useState<MarketSymbolSearchResult | null>(null)
  const [exchange, setExchange] = useState<Exchange>(initialPreferences.exchange)
  const [range, setRange] = useState<DateRangeValue>(initialPreferences.range)
  const [mode, setMode] = useState<ChartMode>(initialPreferences.mode)
  const [tableSort, setTableSort] = useState<TableSort>(initialPreferences.sort)
  const [visibleColumns, setVisibleColumns] = useState<TableColumnId[]>(initialPreferences.columns)
  const [columnAnchor, setColumnAnchor] = useState<HTMLElement | null>(null)
  const [watchlistMenuAnchor, setWatchlistMenuAnchor] = useState<HTMLElement | null>(null)
  const [watchlists, setWatchlists] = useState<MarketWatchlist[]>(readWatchlists)
  const [activeWatchlistId, setActiveWatchlistId] = useState('')
  const [watchlistName, setWatchlistName] = useState('')
  const [watchlistError, setWatchlistError] = useState('')
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  const [pendingRemoval, setPendingRemoval] = useState<MarketSymbol | null>(null)
  const [inputError, setInputError] = useState('')
  const [stockListSyncError, setStockListSyncError] = useState('')
  const [stockListsWriteReady, setStockListsWriteReady] = useState(false)
  const stockListsHydrated = useRef(false)
  const lastSyncedStockLists = useRef('')
  const validRange = isValidDateRange(range) && Boolean(range.from && range.to)

  const stockListsQuery = useQuery({
    queryKey: ['stock-lists', stockListsOwnerKey()],
    queryFn: readStockLists,
    staleTime: Infinity,
    retry: 1,
  })
  const stockListsReady = stockListsQuery.isFetched

  useEffect(() => {
    if (!stockListsReady || stockListsHydrated.current) return
    const cloud = stockListsQuery.data ?? null
    const recovered = recoverStockListState(cloud, watchlists, recoverySymbols)
    setSelected(recovered.currentStocks)
    setWatchlists(recovered.watchlists)
    const available = new Set(recovered.currentStocks.map((stock) => stock.ticker))
    setHighlighted((current) => current.filter((ticker) => available.has(ticker)))
    lastSyncedStockLists.current = JSON.stringify(cloud)
    stockListsHydrated.current = true
    setStockListsWriteReady(true)
  }, [recoverySymbols, stockListsQuery.data, stockListsReady, watchlists])

  useEffect(() => {
    if (!stockListsHydrated.current || !stockListsWriteReady || stockListsQuery.isError) return
    const payload = { currentStocks: selected, watchlists }
    const serialized = JSON.stringify(payload)
    if (serialized === lastSyncedStockLists.current) return
    const timer = window.setTimeout(() => {
      void writeStockLists(payload)
        .then((saved) => {
          if (!saved) return
          lastSyncedStockLists.current = serialized
          setStockListSyncError('')
          try {
            window.localStorage.removeItem(watchlistsKey)
          } catch {
            // The cloud copy was saved successfully.
          }
        })
        .catch(() => setStockListSyncError('Could not save stock lists to Firebase.'))
    }, 800)
    return () => window.clearTimeout(timer)
  }, [selected, stockListsQuery.isError, stockListsWriteReady, watchlists])

  useEffect(() => {
    const preferences: MarketPreferences = {
      version: 1,
      highlighted,
      exchange,
      range,
      mode,
      sort: tableSort,
      columns: visibleColumns,
    }
    try {
      window.localStorage.setItem(preferencesKey, JSON.stringify(preferences))
    } catch {
      // Market comparison remains usable when browser storage is unavailable.
    }
  }, [exchange, highlighted, mode, range, tableSort, visibleColumns])

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedInput(input.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [input])

  const symbolSearch = useQuery({
    queryKey: ['yahoo-symbol-search', debouncedInput],
    queryFn: () => searchMarketSymbols(debouncedInput),
    enabled: debouncedInput.length >= 2,
    staleTime: 30 * 60_000,
    retry: 1,
  })

  const searchOptions = useMemo(() => {
    const preferred = exchange === 'NSE' ? '.NS' : exchange === 'BSE' ? '.BO' : ''
    return [...(symbolSearch.data ?? [])].sort((left, right) => {
      const leftPreferred = preferred ? left.ticker.endsWith(preferred) : !left.ticker.includes('.')
      const rightPreferred = preferred ? right.ticker.endsWith(preferred) : !right.ticker.includes('.')
      return Number(rightPreferred) - Number(leftPreferred)
    })
  }, [exchange, symbolSearch.data])

  const quoteHistoryQuery = useQuery({
    queryKey: ['market-only-quotes', selected.map((stock) => stock.ticker), range.from, range.to],
    queryFn: ({ signal }) =>
      getSelectedMarketDailyCloses(
        selected.map((stock) => stock.ticker),
        range.from,
        range.to,
        signal,
      ),
    enabled: stockListsReady && validRange && selected.length > 0,
    staleTime: 15 * 60_000,
    retry: 1,
  })

  const profileQueries = useQueries({
    queries: selected.map((stock) => ({
      queryKey: ['yahoo-symbol-profile', stock.ticker],
      queryFn: () => getMarketSymbolProfile(stock.ticker),
      enabled: stockListsReady && !stock.sector,
      staleTime: Infinity,
      retry: 1,
    })),
  })

  const fundamentalQueries = useQueries({
    queries: selected.map((stock) => ({
      queryKey: ['yahoo-fundamentals', stock.ticker],
      queryFn: () => getMarketFundamentals(stock.ticker),
      enabled: stockListsReady,
      staleTime: 6 * 60 * 60_000,
      retry: 1,
    })),
  })

  const series = useMemo(
    () =>
      selected.map((stock) => ({
        stock,
        query: quoteHistoryQuery,
        closes: quoteHistoryQuery.data?.[stock.ticker] ?? [],
      })),
    [quoteHistoryQuery, selected],
  )
  const stockTableRows = useMemo(
    () =>
      series.map(({ stock, closes, query }) => {
        const first = closes[0]
        const last = closes.at(-1)
        const change = first && last ? last.closeMinor - first.closeMinor : null
        const percent = change !== null && first ? change / first.closeMinor : null
        return {
          stock,
          query,
          first,
          last,
          change,
          percent,
          fundamentals: fundamentalQueries[selected.findIndex((item) => item.ticker === stock.ticker)]?.data ?? {},
        }
      }),
    [fundamentalQueries, selected, series],
  )
  const sortedStockTableRows = useMemo(
    () =>
      [...stockTableRows].sort((left, right) => {
        if (tableSort.key === 'name') {
          const compared = left.stock.name.localeCompare(right.stock.name)
          return tableSort.direction === 'asc' ? compared : -compared
        }
        if (left.percent === null && right.percent === null) return left.stock.name.localeCompare(right.stock.name)
        if (left.percent === null) return 1
        if (right.percent === null) return -1
        const compared = left.percent - right.percent
        return tableSort.direction === 'asc' ? compared : -compared
      }),
    [stockTableRows, tableSort],
  )
  const chartData = useMemo(() => {
    const rows = new Map<string, Record<string, string | number>>()
    series.forEach(({ stock, closes }) => {
      const first = closes[0]?.closeMinor
      closes.forEach((close) => {
        const row = rows.get(close.date) ?? { date: close.date }
        row[stock.ticker] = mode === 'percent' && first ? (close.closeMinor / first - 1) * 100 : close.closeMinor / 100
        rows.set(close.date, row)
      })
    })
    return [...rows.values()].sort((left, right) => String(left.date).localeCompare(String(right.date)))
  }, [mode, series])

  const sectorData = useMemo(() => {
    const grouped = new Map<string, MarketSymbol[]>()
    selected.forEach((stock, index) => {
      const profile = profileQueries[index]?.data
      const sector = stock.sector || profile?.sector || (profile?.type === 'ETF' ? 'ETF' : 'Unknown')
      grouped.set(sector, [...(grouped.get(sector) ?? []), stock])
    })
    return [...grouped.entries()]
      .map(([name, stocks]) => ({ name, stocks, value: stocks.length, percent: selected.length ? stocks.length / selected.length : 0 }))
      .sort((left, right) => right.value - left.value || left.name.localeCompare(right.name))
  }, [profileQueries, selected])

  const knownSectorCount = sectorData.filter((item) => item.name !== 'Unknown').length
  const largestSectorShare = sectorData[0]?.percent ?? 0
  const diversification =
    knownSectorCount >= 5 && largestSectorShare <= 0.35
      ? 'Broad'
      : knownSectorCount >= 3 && largestSectorShare <= 0.5
        ? 'Moderate'
        : 'Concentrated'

  const addStock = (event: FormEvent) => {
    event.preventDefault()
    if (!chosenResult && searchOptions.length) {
      const first = searchOptions[0]
      setChosenResult(first)
      setInput(first.name)
      setInputError('Press Enter again to add this stock.')
      return
    }
    const stock = chosenResult
      ? { name: chosenResult.name, ticker: chosenResult.ticker, sector: chosenResult.sector, industry: chosenResult.industry }
      : resolveSymbol(input, exchange)
    if (!stock) {
      setInputError('Enter a company name or ticker.')
      return
    }
    if (selected.some((item) => item.ticker === stock.ticker)) {
      setInputError(`${stock.ticker} is already selected.`)
      return
    }
    setSelected((current) => [...current, stock])
    setInput('')
    setChosenResult(null)
    setInputError('')
  }

  const chooseWatchlist = (id: string) => {
    setActiveWatchlistId(id)
    const watchlist = watchlists.find((item) => item.id === id)
    if (!watchlist) {
      setWatchlistName('')
      return
    }
    setSelected(watchlist.stocks.map((stock) => ({ ...stock })))
    setHighlighted([])
    setWatchlistName(watchlist.name)
    setWatchlistError('')
  }

  const saveWatchlist = (event: FormEvent) => {
    event.preventDefault()
    const name = watchlistName.trim()
    if (!name) {
      setWatchlistError('Give this watchlist a name.')
      return
    }
    if (!selected.length) {
      setWatchlistError('Add at least one stock before saving.')
      return
    }
    const existing =
      watchlists.find((item) => item.id === activeWatchlistId) ??
      watchlists.find((item) => item.name.toLocaleLowerCase() === name.toLocaleLowerCase())
    const id = existing?.id ?? window.crypto.randomUUID?.() ?? `watchlist-${Date.now()}`
    const saved: MarketWatchlist = { id, name, stocks: selected.map((stock) => ({ ...stock })) }
    setWatchlists((current) => (existing ? current.map((item) => (item.id === existing.id ? saved : item)) : [...current, saved]))
    setActiveWatchlistId(id)
    setWatchlistName(name)
    setWatchlistError('')
  }

  const deleteWatchlist = () => {
    if (!activeWatchlistId) return
    setConfirmAction('delete-watchlist')
  }

  const clearCurrentStocks = () => {
    if (!selected.length) return
    setConfirmAction('clear-current-stocks')
  }

  const clearStoredWatchlists = () => {
    if (!watchlists.length) return
    setConfirmAction('clear-saved-watchlists')
  }

  const confirmDestructiveAction = () => {
    if (confirmAction === 'delete-watchlist') {
      setWatchlists((current) => current.filter((item) => item.id !== activeWatchlistId))
      setActiveWatchlistId('')
      setWatchlistName('')
      setWatchlistError('')
    } else if (confirmAction === 'clear-current-stocks') {
      setSelected([])
      setHighlighted([])
      setActiveWatchlistId('')
      setWatchlistName('')
      setInputError('')
    } else if (confirmAction === 'clear-saved-watchlists') {
      setWatchlists([])
      setActiveWatchlistId('')
      setWatchlistName('')
      setWatchlistError('')
    } else if (confirmAction === 'remove-stock' && pendingRemoval) {
      setSelected((current) => current.filter((item) => item.ticker !== pendingRemoval.ticker))
      setHighlighted((current) => current.filter((item) => item !== pendingRemoval.ticker))
    }
    setPendingRemoval(null)
    setConfirmAction(null)
  }

  const refreshing = quoteHistoryQuery.isFetching
  const errors = quoteHistoryQuery.error
    ? [quoteHistoryQuery.error instanceof Error ? quoteHistoryQuery.error.message : 'Price request failed.']
    : []
  const firstPrices = Object.fromEntries(series.map(({ stock, closes }) => [stock.ticker, (closes[0]?.closeMinor ?? 0) / 100]))
  const hasFocusedStocks = highlighted.length > 0

  const toggleHighlight = (ticker: string) => {
    setHighlighted((current) => (current.includes(ticker) ? current.filter((item) => item !== ticker) : [...current, ticker]))
  }

  const removeStock = (ticker: string) => {
    const stock = selected.find((item) => item.ticker === ticker)
    if (!stock) return
    setPendingRemoval(stock)
    setConfirmAction('remove-stock')
  }

  const toggleTableSort = (key: TableSort['key']) => {
    setTableSort((current) =>
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: key === 'changePct' ? 'desc' : 'asc' },
    )
  }

  const sortIcon = (key: TableSort['key']) =>
    tableSort.key !== key ? (
      <UnfoldMoreIcon fontSize="small" />
    ) : tableSort.direction === 'asc' ? (
      <ArrowUpwardIcon fontSize="small" />
    ) : (
      <ArrowDownwardIcon fontSize="small" />
    )

  const toggleColumn = (column: TableColumnId) => {
    setVisibleColumns((current) =>
      current.includes(column)
        ? current.filter((item) => item !== column)
        : tableColumns.filter((item) => current.includes(item.id) || item.id === column).map((item) => item.id),
    )
  }

  const formatPercent = (value?: number) => (value === undefined ? '-' : `${value >= 0 ? '+' : ''}${(value * 100).toFixed(2)}%`)
  const formatNumber = (value?: number) =>
    value === undefined ? '-' : new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value)
  const formatCrore = (value?: number) =>
    value === undefined ? '-' : `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value / 10_000_000)} Cr`

  const renderColumnHeader = (column: ColumnDefinition) => {
    if (column.id === 'company')
      return (
        <span className={classes.sortableHead}>
          Company
          <MuiTooltip title={`Sort name ${tableSort.key === 'name' && tableSort.direction === 'asc' ? 'descending' : 'ascending'}`}>
            <IconButton
              className={`${classes.sortButton} ${tableSort.key === 'name' ? classes.sortActive : ''}`}
              size="small"
              onClick={() => toggleTableSort('name')}
              aria-label="Sort stocks by name"
            >
              {sortIcon('name')}
            </IconButton>
          </MuiTooltip>
        </span>
      )
    if (column.id === 'rangeReturn')
      return (
        <span className={classes.sortableHead}>
          Range return %
          <MuiTooltip title={`Sort return ${tableSort.key === 'changePct' && tableSort.direction === 'desc' ? 'ascending' : 'descending'}`}>
            <IconButton
              className={`${classes.sortButton} ${tableSort.key === 'changePct' ? classes.sortActive : ''}`}
              size="small"
              onClick={() => toggleTableSort('changePct')}
              aria-label="Sort stocks by percentage return"
            >
              {sortIcon('changePct')}
            </IconButton>
          </MuiTooltip>
        </span>
      )
    return column.label
  }

  const renderColumnValue = (column: TableColumnId, row: (typeof stockTableRows)[number], index: number) => {
    const { stock, query, first, last, change, percent, fundamentals } = row
    switch (column) {
      case 'serial':
        return index + 1
      case 'company':
        return (
          <>
            <strong>{stock.name}</strong>
            <br />
            <span className={classes.source}>{stock.ticker}</span>
          </>
        )
      case 'from':
        return first ? formatDateLabel(first.date) : '-'
      case 'startPrice':
        return first ? formatMoney(first.closeMinor, 'INR', true) : '-'
      case 'to':
        return last ? formatDateLabel(last.date) : '-'
      case 'currentPrice':
        return last ? formatMoney(last.closeMinor, 'INR', true) : '-'
      case 'change':
        return change === null ? (query.isFetching ? 'Loading' : '-') : `${change >= 0 ? '+' : ''}${formatMoney(change, 'INR', true)}`
      case 'rangeReturn':
        return percent === null ? '-' : `${percent >= 0 ? '+' : ''}${(percent * 100).toFixed(2)}%`
      case 'marketCap':
        return formatCrore(fundamentals.marketCap)
      case 'dividendYield':
        return formatPercent(fundamentals.dividendYield)
      case 'revenueGrowth':
        return formatPercent(fundamentals.revenueGrowth)
      case 'earningsGrowth':
        return formatPercent(fundamentals.earningsGrowth)
      case 'returnOnEquity':
        return formatPercent(fundamentals.returnOnEquity)
      case 'returnOnAssets':
        return formatPercent(fundamentals.returnOnAssets)
      case 'totalRevenue':
        return formatCrore(fundamentals.totalRevenue)
      case 'totalDebt':
        return formatCrore(fundamentals.totalDebt)
      case 'freeCashflow':
        return formatCrore(fundamentals.freeCashflow)
      case 'enterpriseValue':
        return formatCrore(fundamentals.enterpriseValue)
      case 'trailingEps':
        return fundamentals.trailingEps === undefined ? '-' : `₹${formatNumber(fundamentals.trailingEps)}`
      default:
        return formatNumber(fundamentals[column])
    }
  }

  const columnValueClass = (column: TableColumnId, row: (typeof stockTableRows)[number]) => {
    const value = column === 'change' ? row.change : column === 'rangeReturn' ? row.percent : null
    return value === null ? classes.pending : value >= 0 ? classes.positive : classes.negative
  }

  const renderLineTooltip = ({ active, label, payload }: TooltipContentProps) => {
    if (!active || !payload?.length) return null
    const orderedPayload = [...payload].sort((left, right) => {
      const leftTicker = String(left.dataKey ?? '')
      const rightTicker = String(right.dataKey ?? '')
      const leftValue = Number(left.value)
      const rightValue = Number(right.value)
      const leftBaseline = firstPrices[leftTicker]
      const rightBaseline = firstPrices[rightTicker]
      const leftChange = mode === 'percent' ? leftValue : leftBaseline ? (leftValue / leftBaseline - 1) * 100 : 0
      const rightChange = mode === 'percent' ? rightValue : rightBaseline ? (rightValue / rightBaseline - 1) * 100 : 0
      return rightChange - leftChange
    })
    return (
      <div className={classes.tooltip}>
        <div className={classes.tooltipDate}>{formatDateLabel(String(label))}</div>
        {orderedPayload.map((entry) => {
          const ticker = String(entry.dataKey ?? '')
          const stock = selected.find((item) => item.ticker === ticker)
          const value = Number(entry.value)
          const baseline = firstPrices[ticker]
          const changePct = mode === 'percent' ? value : baseline ? (value / baseline - 1) * 100 : 0
          const direction = changePct > 0 ? 'up' : changePct < 0 ? 'down' : 'flat'
          const seriesIndex =
            Math.max(
              0,
              selected.findIndex((item) => item.ticker === ticker),
            ) % colors.length
          return (
            <div className={classes.tooltipSeries} key={ticker}>
              <span className={`${classes.tooltipDot} ${classes[`seriesFill${seriesIndex}`]}`} />
              <span className={classes.tooltipName}>{stock?.name ?? entry.name ?? ticker}</span>
              <span
                className={`${classes.tooltipValue} ${
                  direction === 'up' ? classes.positive : direction === 'down' ? classes.negative : classes.pending
                }`}
              >
                {mode === 'percent' ? `${value >= 0 ? '+' : ''}${value.toFixed(2)}%` : formatMoney(Math.round(value * 100), 'INR', true)}
              </span>
              <span
                className={`${classes.tooltipChange} ${direction === 'up' ? classes.positive : direction === 'down' ? classes.negative : classes.pending}`}
              >
                {direction === 'up' ? (
                  <ArrowUpwardIcon fontSize="inherit" />
                ) : direction === 'down' ? (
                  <ArrowDownwardIcon fontSize="inherit" />
                ) : (
                  <RemoveIcon fontSize="inherit" />
                )}
                {direction === 'up' ? 'Growth' : direction === 'down' ? 'Loss' : 'No change'} {changePct >= 0 ? '+' : ''}
                {changePct.toFixed(2)}%
              </span>
            </div>
          )
        })}
      </div>
    )
  }

  const renderSectorTooltip = ({ active, payload }: TooltipContentProps) => {
    if (!active || !payload?.length) return null
    const sector = payload[0].payload as (typeof sectorData)[number]
    return (
      <div className={classes.tooltip}>
        <strong>{sector.name}</strong>
        <span className={classes.tooltipValue}>
          {sector.value} stock{sector.value === 1 ? '' : 's'} · {(sector.percent * 100).toFixed(0)}%
        </span>
        <span className={classes.tooltipStocks}>{sector.stocks.map((stock) => `${stock.name} (${stock.ticker})`).join(', ')}</span>
      </div>
    )
  }

  const activeWatchlist = watchlists.find((item) => item.id === activeWatchlistId)
  const confirmation =
    confirmAction === 'delete-watchlist'
      ? {
          title: 'Delete this watchlist?',
          message: `“${activeWatchlist?.name ?? 'Selected watchlist'}” will be removed from Firebase. The stocks currently on screen will remain.`,
          confirmLabel: 'Delete watchlist',
        }
      : confirmAction === 'remove-stock'
        ? {
            title: 'Remove from comparison?',
            message: `“${pendingRemoval?.name ?? 'This stock'}” will be removed from this comparison only. Your investment holding is unchanged.`,
            confirmLabel: 'Remove stock',
          }
        : confirmAction === 'clear-current-stocks'
          ? {
              title: 'Clear current stocks?',
              message:
                'All stocks will be removed from the current screen. Saved watchlists will stay unchanged, and this empty screen will be preserved after reload.',
              confirmLabel: 'Clear stocks',
            }
          : {
              title: 'Clear all saved watchlists?',
              message: `This permanently removes ${watchlists.length} saved watchlist${watchlists.length === 1 ? '' : 's'} from Firebase. The stocks currently on screen will remain.`,
              confirmLabel: 'Clear all lists',
            }

  return (
    <div className={classes.root}>
      <Card>
        <div className={classes.header}>
          <h2 className={classes.title}>Market comparison</h2>
          <span className={classes.source}>{refreshing ? 'Updating market prices...' : 'Yahoo Finance daily close'}</span>
        </div>
        <div className={classes.filters}>
          <form className={classes.searchForm} onSubmit={addStock}>
            <Autocomplete
              freeSolo
              autoHighlight
              filterOptions={(options) => options}
              options={searchOptions}
              inputValue={input}
              value={chosenResult}
              loading={symbolSearch.isFetching}
              getOptionLabel={(option) => (typeof option === 'string' ? option : option.name)}
              isOptionEqualToValue={(option, value) => typeof value !== 'string' && option.ticker === value.ticker}
              onInputChange={(_event, value, reason) => {
                setInput(value)
                setInputError('')
                if (reason === 'input' || reason === 'clear') setChosenResult(null)
              }}
              onChange={(_event, value) => {
                if (typeof value === 'string') {
                  setInput(value)
                  setChosenResult(null)
                } else {
                  setChosenResult(value)
                  if (value) setInput(value.name)
                }
              }}
              renderOption={(props, option) => (
                <li {...props} key={option.ticker}>
                  <span className={classes.option}>
                    <strong className={classes.optionName}>{option.name}</strong>
                    <span className={classes.optionMeta}>
                      {option.ticker} · {option.exchange} · {option.type}
                    </span>
                  </span>
                </li>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  size="small"
                  placeholder="Search company or ticker"
                  slotProps={{
                    ...params.slotProps,
                    input: {
                      ...params.slotProps.input,
                      endAdornment: (
                        <>
                          {symbolSearch.isFetching ? <CircularProgress color="inherit" size={16} /> : null}
                          {params.slotProps.input.endAdornment}
                        </>
                      ),
                    },
                  }}
                />
              )}
            />
            <Button className={classes.iconButton} type="submit" aria-label="Add stock" title="Add stock">
              <AddIcon fontSize="small" />
            </Button>
          </form>
          <Select aria-label="Exchange" value={exchange} onChange={(event) => setExchange(event.target.value as Exchange)}>
            <option value="NSE">NSE</option>
            <option value="BSE">BSE</option>
            <option value="US">US</option>
          </Select>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={mode}
            onChange={(_event, next: ChartMode | null) => {
              if (next) setMode(next)
            }}
            aria-label="Chart scale"
          >
            <ToggleButton value="percent">Change %</ToggleButton>
            <ToggleButton value="price">Price</ToggleButton>
          </ToggleButtonGroup>
          <DateRangePicker value={range} onChange={setRange} />
        </div>
        <form className={classes.watchlistBar} onSubmit={saveWatchlist}>
          <span className={classes.watchlistLabel}>
            Watchlists replace only the selected stocks. Your range, chart, sort, and columns stay as they are.
          </span>
          <Select aria-label="Choose watchlist" value={activeWatchlistId} onChange={(event) => chooseWatchlist(event.target.value)}>
            <option value="">New / choose watchlist</option>
            {watchlists.map((watchlist) => (
              <option key={watchlist.id} value={watchlist.id}>
                {watchlist.name} ({watchlist.stocks.length})
              </option>
            ))}
          </Select>
          <TextField
            size="small"
            value={watchlistName}
            onChange={(event) => {
              setWatchlistName(event.target.value)
              setWatchlistError('')
            }}
            placeholder="Watchlist name"
            slotProps={{ htmlInput: { 'aria-label': 'Watchlist name' } }}
          />
          <div className={classes.watchlistControls}>
            <Button type="submit">{activeWatchlistId ? 'Update list' : 'Save current'}</Button>
            <Button
              type="button"
              className={classes.watchlistDelete}
              onClick={deleteWatchlist}
              disabled={!activeWatchlistId}
              aria-label="Delete selected watchlist"
              title="Delete selected watchlist"
            >
              <DeleteIcon fontSize="small" />
            </Button>
            <IconButton
              type="button"
              className={classes.watchlistMenuButton}
              onClick={(event) => setWatchlistMenuAnchor(event.currentTarget)}
              aria-label="More watchlist actions"
              aria-haspopup="menu"
              aria-expanded={Boolean(watchlistMenuAnchor)}
            >
              <MoreVertIcon fontSize="small" />
            </IconButton>
            <Menu
              anchorEl={watchlistMenuAnchor}
              open={Boolean(watchlistMenuAnchor)}
              onClose={() => setWatchlistMenuAnchor(null)}
              slotProps={{ paper: { className: classes.watchlistMenuPaper } }}
            >
              <MenuItem
                disabled={!selected.length}
                onClick={() => {
                  setWatchlistMenuAnchor(null)
                  clearCurrentStocks()
                }}
              >
                Clear current stocks
              </MenuItem>
              <MenuItem
                className={classes.watchlistMenuDanger}
                disabled={!watchlists.length}
                onClick={() => {
                  setWatchlistMenuAnchor(null)
                  clearStoredWatchlists()
                }}
              >
                Clear saved watchlists
              </MenuItem>
            </Menu>
          </div>
        </form>
        {watchlistError ? <div className={classes.error}>{watchlistError}</div> : null}
        {stockListSyncError || stockListsQuery.error ? (
          <div className={classes.error}>
            {stockListSyncError ||
              (stockListsQuery.error instanceof Error ? stockListsQuery.error.message : 'Could not load stock lists from Firebase.')}
          </div>
        ) : null}
        <div className={classes.chips}>
          {selected.map((stock, index) => (
            <Chip
              className={`${classes.chip} ${classes[`seriesChip${index % colors.length}`]} ${highlighted.includes(stock.ticker) ? classes.chipFocused : ''}`}
              key={stock.ticker}
              size="small"
              label={`${stock.name}  ${stock.ticker}`}
              icon={highlighted.includes(stock.ticker) ? <CheckBoxIcon /> : <CheckBoxOutlineBlankIcon />}
              variant="outlined"
              onClick={() => toggleHighlight(stock.ticker)}
              deleteIcon={<CloseIcon />}
              onDelete={(event) => {
                event.stopPropagation()
                removeStock(stock.ticker)
              }}
              title={highlighted.includes(stock.ticker) ? `Stop highlighting ${stock.name}` : `Highlight ${stock.name}`}
            />
          ))}
        </div>
        {inputError ? <div className={classes.error}>{inputError}</div> : null}
        {!validRange ? <div className={classes.error}>Select a valid start and end date.</div> : null}
        {errors.length ? <div className={classes.error}>{errors.join(' | ')}</div> : null}
        {chartData.length ? (
          <div className={classes.chart}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData}>
                <CartesianGrid stroke={tokens.color.border} vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  minTickGap={30}
                  tickFormatter={(value) => formatDateLabel(String(value))}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={76}
                  domain={mode === 'percent' ? [(min: number) => Math.min(0, min), (max: number) => Math.max(0, max)] : ['auto', 'auto']}
                  tickFormatter={(value) =>
                    mode === 'percent'
                      ? `${Number(value).toFixed(0)}%`
                      : `₹${new Intl.NumberFormat('en-IN', { notation: 'compact' }).format(Number(value))}`
                  }
                />
                {mode === 'percent' ? (
                  <ReferenceLine
                    y={0}
                    stroke={tokens.color.textMuted}
                    strokeWidth={2}
                    ifOverflow="extendDomain"
                    label={{ value: '0', position: 'insideLeft', fill: tokens.color.textMuted, fontSize: 11 }}
                  />
                ) : null}
                <Tooltip content={renderLineTooltip} />
                <Legend />
                {selected.map((stock, index) => {
                  const focused = highlighted.includes(stock.ticker)
                  return (
                    <Area
                      key={stock.ticker}
                      type="monotone"
                      dataKey={stock.ticker}
                      name={stock.name}
                      stroke={colors[index % colors.length]}
                      fill={colors[index % colors.length]}
                      fillOpacity={focused ? 0.14 : 0}
                      strokeOpacity={hasFocusedStocks && !focused ? 0.2 : 1}
                      strokeWidth={focused ? 4 : 2.25}
                      activeDot={{ r: focused ? 6 : 4 }}
                      dot={false}
                      connectNulls
                    />
                  )
                })}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className={classes.chartEmpty}>
            {refreshing ? 'Loading market prices...' : selected.length ? 'No prices available for this range.' : 'Add stocks to compare.'}
          </div>
        )}
        {selected.length ? (
          <div className={classes.tableWorkspace}>
            <div className={classes.tableToolbar}>
              <Button
                type="button"
                className={classes.columnButton}
                onClick={(event) => setColumnAnchor(event.currentTarget)}
                aria-haspopup="dialog"
                aria-expanded={Boolean(columnAnchor)}
              >
                <ViewColumnIcon fontSize="small" /> Columns ({visibleColumns.length})
              </Button>
              <Popover
                open={Boolean(columnAnchor)}
                anchorEl={columnAnchor}
                onClose={() => setColumnAnchor(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                slotProps={{ paper: { className: classes.columnPopover } }}
              >
                <aside className={classes.columnSidebar} aria-label="Table columns">
                  <div className={classes.columnSidebarHeader}>
                    <strong>Choose columns</strong>
                    <span className={classes.columnCount}>{visibleColumns.length} shown</span>
                  </div>
                  <div className={classes.columnList}>
                    {(['Price & period', 'Valuation', 'Growth & quality', 'Financial position'] as const).map((group) => (
                      <div key={group}>
                        <div className={classes.columnGroup}>{group}</div>
                        {tableColumns
                          .filter((column) => column.group === group)
                          .map((column) => {
                            const active = visibleColumns.includes(column.id)
                            return (
                              <button
                                key={column.id}
                                type="button"
                                className={`${classes.columnToggle} ${active ? classes.columnToggleActive : ''}`}
                                onClick={() => toggleColumn(column.id)}
                                aria-pressed={active}
                              >
                                {active ? <CheckBoxIcon /> : <CheckBoxOutlineBlankIcon />}
                                <span>{column.label}</span>
                              </button>
                            )
                          })}
                      </div>
                    ))}
                  </div>
                </aside>
              </Popover>
            </div>
            <div className={classes.gridWrap}>
              {visibleColumns.length ? (
                <table className={classes.table}>
                  <thead>
                    <tr>
                      {tableColumns
                        .filter((column) => visibleColumns.includes(column.id))
                        .map((column) => (
                          <th className={classes.th} key={column.id}>
                            {renderColumnHeader(column)}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedStockTableRows.map((row, index) => (
                      <tr key={row.stock.ticker}>
                        {tableColumns
                          .filter((column) => visibleColumns.includes(column.id))
                          .map((column) => (
                            <td className={`${classes.td} ${columnValueClass(column.id, row)}`} key={column.id}>
                              {renderColumnValue(column.id, row, index)}
                            </td>
                          ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className={classes.chartEmpty}>Choose at least one column from the Columns menu.</div>
              )}
            </div>
          </div>
        ) : null}
      </Card>
      <Card>
        <div className={classes.header}>
          <h2 className={classes.title}>Sector diversification</h2>
          <span className={classes.source}>Equal weight by selected stock</span>
        </div>
        {selected.length ? (
          <div className={classes.diversityBody}>
            <div className={classes.pieChart}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sectorData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="48%"
                    innerRadius="38%"
                    outerRadius="82%"
                    paddingAngle={2}
                  >
                    {sectorData.map((sector, index) => (
                      <Cell key={sector.name} fill={colors[index % colors.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={renderSectorTooltip} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className={classes.diversityStats}>
              <div className={classes.concentration}>
                <div className={classes.stat}>
                  <span className={classes.statLabel}>Diversification</span>
                  <span className={classes.statValue}>
                    {profileQueries.some((query) => query.isFetching) ? 'Checking' : diversification}
                  </span>
                </div>
                <div className={classes.stat}>
                  <span className={classes.statLabel}>Sectors</span>
                  <span className={classes.statValue}>{knownSectorCount}</span>
                </div>
                <div className={classes.stat}>
                  <span className={classes.statLabel}>Largest sector</span>
                  <span className={classes.statValue}>{(largestSectorShare * 100).toFixed(0)}%</span>
                </div>
              </div>
              <div className={classes.sectorGrid}>
                <table className={classes.sectorTable}>
                  <colgroup>
                    <col className={classes.sectorNameColumn} />
                    <col className={classes.sectorStocksColumn} />
                    <col className={classes.sectorShareColumn} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className={classes.th}>Sector</th>
                      <th className={classes.th}>Stocks</th>
                      <th className={classes.th}>Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sectorData.map((sector, index) => (
                      <tr key={sector.name}>
                        <td className={classes.td}>
                          <span className={`${classes.swatch} ${classes[`seriesFill${index % colors.length}`]}`} />
                          {sector.name}
                        </td>
                        <td className={`${classes.td} ${classes.sectorStocks}`}>{sector.stocks.map((stock) => stock.name).join(', ')}</td>
                        <td className={classes.td}>
                          <strong>
                            {sector.value} · {(sector.percent * 100).toFixed(0)}%
                          </strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className={classes.stockSectors}>
                {selected.map((stock, index) => {
                  const profile = profileQueries[index]?.data
                  const sector = stock.sector || profile?.sector || (profile?.type === 'ETF' ? 'ETF' : 'Unknown')
                  const industry =
                    stock.industry || profile?.industry || (profileQueries[index]?.isFetching ? 'Checking Yahoo...' : 'Not available')
                  return (
                    <div className={classes.stockSectorRow} key={stock.ticker}>
                      <strong>{stock.name}</strong>
                      <span>{sector}</span>
                      <span className={classes.industry}>{industry}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className={classes.chartEmpty}>Add stocks to see sector diversification.</div>
        )}
      </Card>
      {portfolioStatus ? (
        <div className={classes.portfolioStatus}>
          <RefreshIcon fontSize="inherit" /> {portfolioStatus}
        </div>
      ) : null}
      <Dialog
        open={Boolean(confirmAction)}
        onClose={() => setConfirmAction(null)}
        aria-labelledby="watchlist-confirm-title"
        aria-describedby="watchlist-confirm-description"
        slotProps={{ paper: { className: classes.confirmPaper } }}
      >
        <form
          className={classes.confirmForm}
          onSubmit={(event) => {
            event.preventDefault()
            confirmDestructiveAction()
          }}
        >
          <div className={classes.confirmHeader}>
            <span className={classes.confirmIcon}>
              <WarningAmberIcon />
            </span>
            <h2 className={classes.confirmTitle} id="watchlist-confirm-title">
              {confirmation.title}
            </h2>
          </div>
          <p className={classes.confirmBody} id="watchlist-confirm-description">
            {confirmation.message}
          </p>
          <div className={classes.confirmActions}>
            <Button type="button" onClick={() => setConfirmAction(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" className={classes.confirmDanger} autoFocus>
              {confirmation.confirmLabel}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  )
}
