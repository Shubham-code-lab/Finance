import { lazy, startTransition, Suspense, useEffect, useRef, useState } from 'react'
import RefreshIcon from '@mui/icons-material/Refresh'
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet'
import { ToggleButton, ToggleButtonGroup } from '@mui/material'
import { createUseStyles } from 'react-jss'
import { AppNavigation } from '@/app/AppNavigation'
import { PageHeaderActionContext, type PageHeaderAction } from '@/app/PageHeaderAction'
import { navItems, validViews, View, viewFromHash } from '@/app/navigation'
import { FilterStatus } from '@/components/FilterStatus'
import { PageSkeleton } from '@/components/PageSkeleton'
import { Button } from '@/components/ui'
import { StoreData, CustomTable, CustomTableRow, ChartSpec } from '@/domain/types'
import { CloudControls } from '@/firebase/CloudControls'
import { normalizeSnapshots, normalizeTransactions } from '@/normalize/table'
import { useInvalidateStoreData, useStoreData } from '@/query/useStoreData'
import { deleteTable, putMany, replaceDerivedForTable, replaceRowsForTable, requestServerRefresh, upsertTable } from '@/storage/repository'
import { tokens } from '@/theme/tokens'
import { PrivacyToggle } from '@/privacy/PrivacyToggle'
import { ForecastInfoTip } from '@/dashboard/ForecastInfoTip'
import type { InvestmentKind } from '@/features/holdings/InvestmentsView'
import { syncInvestmentPortfolio } from '@/features/holdings/syncInvestmentPortfolio'

const Dashboard = lazy(() => import('@/dashboard/Dashboard').then((module) => ({ default: module.Dashboard })))
const AccountsView = lazy(() => import('@/features/accounts/AccountsView').then((module) => ({ default: module.AccountsView })))
const IncomeView = lazy(() => import('@/features/income/IncomeView').then((module) => ({ default: module.IncomeView })))
const InvestmentsView = lazy(() => import('@/features/holdings/InvestmentsView').then((module) => ({ default: module.InvestmentsView })))
const MarketExplorer = lazy(() => import('@/features/holdings/MarketExplorer').then((module) => ({ default: module.MarketExplorer })))
const TablesView = lazy(() => import('@/features/tables/TablesView').then((module) => ({ default: module.TablesView })))
const ChartBuilder = lazy(() => import('@/charts/ChartBuilder').then((module) => ({ default: module.ChartBuilder })))
const ImportView = lazy(() => import('@/features/import/ImportView').then((module) => ({ default: module.ImportView })))
const useStyles = createUseStyles({
  shell: { minHeight: '100vh', background: tokens.color.bgPage },
  top: {
    position: 'sticky',
    top: 0,
    zIndex: 11,
    boxSizing: 'border-box',
    height: 56,
    minHeight: 56,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.space.md,
    padding: [tokens.space.sm, tokens.space.lg],
    borderBottom: `1px solid ${tokens.color.border}`,
    background: tokens.color.bgCard,
    boxShadow: tokens.shadow.header,
    '@media (max-width: 720px)': { paddingLeft: 60 },
  },
  brand: { display: 'flex', alignItems: 'center', gap: tokens.space.sm, minWidth: 0 },
  brandIcon: {
    width: 34,
    height: 34,
    display: 'grid',
    placeItems: 'center',
    borderRadius: tokens.radius.md,
    background: tokens.color.accentSoft,
    color: tokens.color.accent,
    '& svg': { fontSize: 20 },
  },
  brandCopy: { display: 'grid', lineHeight: 1.1 },
  brandName: { fontWeight: tokens.font.weightMedium, fontSize: tokens.font.sizeLg, color: tokens.color.text },
  brandSubtitle: {
    color: tokens.color.textMuted,
    fontSize: tokens.font.sizeXs,
    '@media (max-width: 520px)': { display: 'none' },
  },
  headerActions: { display: 'flex', alignItems: 'center', gap: tokens.space.sm },
  body: { position: 'relative', minHeight: 'calc(100vh - 56px)' },
  main: {
    boxSizing: 'border-box',
    width: `calc(100% - ${tokens.navigation.collapsedWidth}px)`,
    minWidth: 0,
    marginLeft: tokens.navigation.collapsedWidth,
    padding: tokens.space.lg,
    '@media (min-width: 1440px)': { paddingRight: tokens.space.xl, paddingBottom: tokens.space.xl },
    '@media (max-width: 720px)': { width: '100%', marginLeft: 0, padding: tokens.space.md },
  },
  heading: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: tokens.space.md, gap: tokens.space.md },
  titleRow: { display: 'flex', alignItems: 'center', gap: tokens.space.sm, minWidth: 0, fontSize: 24 },
  title: { margin: 0, fontSize: 'inherit', lineHeight: 1.25, fontWeight: tokens.font.weightMedium },
  iconButton: {
    minWidth: `${tokens.control.iconButtonSize}px !important`,
    width: tokens.control.iconButtonSize,
    height: tokens.control.iconButtonSize,
    padding: `${tokens.control.paddingY}px !important`,
  },
  titleInfo: { color: `${tokens.color.textMuted} !important` },
  pageActions: { display: 'flex', alignItems: 'center', gap: tokens.space.sm, flexWrap: 'wrap', justifyContent: 'flex-end' },
  investmentSwitch: {
    border: `1px solid ${tokens.color.borderStrong}`,
    borderRadius: `${tokens.radius.sm}px !important`,
    background: tokens.color.bgMuted,
    '& .MuiToggleButton-root': { border: '0 !important', color: tokens.color.textMuted },
    '& .Mui-selected': { color: `${tokens.color.accent} !important`, background: `${tokens.color.accentSoft} !important` },
  },
  loadState: { padding: tokens.space.xl, color: tokens.color.textMuted },
})

const emptyData: StoreData = {
  accounts: [],
  categories: [],
  customTables: [],
  customTableRows: [],
  columnMappings: [],
  transactions: [],
  snapshots: [],
  metrics: [],
  chartSpecs: [],
  holdings: [],
  sipEvents: [],
  incomeSources: [],
  plannedExpenses: [],
  forecastSettings: null,
  dashboard: { widgets: [] },
}

export function App() {
  const classes = useStyles()
  const [view, setView] = useState<View>(viewFromHash)
  const [investmentKind, setInvestmentKind] = useState<InvestmentKind>('stock')
  const [pageHeaderAction, setPageHeaderAction] = useState<PageHeaderAction | null>(null)
  const marketSyncKey = useRef('')
  const storeQuery = useStoreData(true)
  const invalidateStore = useInvalidateStoreData()
  const data = storeQuery.data ?? emptyData
  const loading = storeQuery.isLoading && !storeQuery.data
  const loadError = storeQuery.error instanceof Error ? storeQuery.error.message : storeQuery.error ? 'Unable to load Firebase data.' : ''

  const load = () => invalidateStore()
  const refreshFromCloud = async () => {
    requestServerRefresh()
    await invalidateStore()
    const result = await syncInvestmentPortfolio()
    if (result.updatedHoldings || result.updatedAccounts || result.updatedSnapshots) await invalidateStore()
  }

  useEffect(() => {
    if (!storeQuery.data?.holdings.length) return
    const key = storeQuery.data.holdings
      .map((holding) => `${holding.id}:${holding.kind}:${holding.ticker ?? holding.name}:${holding.qty ?? ''}`)
      .sort()
      .join('|')
    if (marketSyncKey.current === key) return
    marketSyncKey.current = key
    void syncInvestmentPortfolio(storeQuery.data)
      .then((result) => {
        if (result.updatedHoldings || result.updatedAccounts || result.updatedSnapshots) void invalidateStore()
      })
      .catch(() => undefined)
  }, [invalidateStore, storeQuery.data])

  useEffect(() => {
    const syncView = () => startTransition(() => setView(viewFromHash()))
    if (!window.location.hash || !validViews.has(window.location.hash.replace(/^#\/?/, '') as View)) {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/dashboard`)
    }
    syncView()
    window.addEventListener('hashchange', syncView)
    return () => window.removeEventListener('hashchange', syncView)
  }, [])

  const navigate = (next: View) => {
    window.location.hash = `/${next}`
  }

  const selectInvestmentKind = (next: InvestmentKind) => {
    setInvestmentKind(next)
  }

  const rebuildTable = async (table: CustomTable, rows: CustomTableRow[]) => {
    const mapping = data.columnMappings.find((item) => item.tableId === table.id)
    if (!mapping) return
    const normalizedTxs = normalizeTransactions(table, mapping, rows, data.accounts, data.categories)
    const normalizedSnapshots = normalizeSnapshots(table, mapping, rows, data.accounts)
    await replaceDerivedForTable(table.id, normalizedTxs.transactions, normalizedSnapshots.snapshots)
  }

  const onRowsChange = async (table: CustomTable, rows: CustomTableRow[]) => {
    await replaceRowsForTable(table.id, rows)
    await rebuildTable(table, rows)
    await load()
  }

  const onCreateTable = async (table: CustomTable, rows: CustomTableRow[]) => {
    await upsertTable(table)
    const columnIds = new Set(table.columns.map((column) => column.id))
    const canMapTransactions = ['date', 'amount', 'flow', 'account'].every((id) => columnIds.has(id))
    await putMany('columnMappings', [
      canMapTransactions
        ? {
            tableId: table.id,
            kind: 'transactions',
            roles: { date: 'date', amount: 'amount', flow: 'flow', account: 'account', category: 'category', memo: 'memo' },
            flowVocabulary: 'in-out-enum',
          }
        : { tableId: table.id, kind: 'unmapped', roles: {} },
    ])
    if (rows.length) await replaceRowsForTable(table.id, rows)
    await load()
  }

  const saveChart = async (spec: ChartSpec) => {
    await putMany('chartSpecs', [spec])
    await load()
  }

  const title = navItems.find((item) => item.id === view)?.label.replace(/\b\w/g, (letter) => letter.toUpperCase()) ?? 'Dashboard'
  const pageHelp =
    view === 'accounts'
      ? 'Saving balances on the dashboard come from accounts you add here and from imported ledgers. Use an ICICI or SBI workbook exported from your bank. Personal import files stay on your device. Money kept with people, house-owner balances, or deposits count as assets (cash or other). Mutual funds and stocks are edited on their own screens.'
      : view === 'income'
        ? 'Income is only salary or real earning you declare here. Move one-time money held elsewhere to savings so it becomes a cash account balance instead of income.'
        : view === 'investments'
          ? 'Your current portfolio, invested value, gains, SIP amounts, and monthly SIP status.'
          : ''
  return (
    <PageHeaderActionContext.Provider value={setPageHeaderAction}>
      <div className={classes.shell}>
        <header className={classes.top}>
          <div className={classes.brand}>
            <span className={classes.brandIcon}>
              <AccountBalanceWalletIcon />
            </span>
            <span className={classes.brandCopy}>
              <span className={classes.brandName}>Finance</span>
              <span className={classes.brandSubtitle}>Personal dashboard</span>
            </span>
          </div>
          <div className={classes.headerActions}>
            <Button
              className={classes.iconButton}
              title="Refresh from Firebase"
              aria-label="Refresh from Firebase"
              disabled={storeQuery.isFetching}
              onClick={refreshFromCloud}
            >
              <RefreshIcon fontSize="small" />
            </Button>
            <PrivacyToggle />
            <CloudControls />
          </div>
        </header>
        <div className={classes.body}>
          <AppNavigation view={view} onNavigate={navigate} />
          <main className={classes.main}>
            {view !== 'stocks' ? (
              <div className={classes.heading}>
                <div className={classes.titleRow}>
                  <FilterStatus fetching={storeQuery.isFetching} ready={Boolean(storeQuery.data) && !storeQuery.isFetching} />
                  <h1 className={classes.title}>{title}</h1>
                  {pageHelp ? <ForecastInfoTip className={classes.titleInfo} label={pageHelp} /> : null}
                </div>
                <div className={classes.pageActions}>
                  {view === 'investments' ? (
                    <ToggleButtonGroup
                      className={classes.investmentSwitch}
                      exclusive
                      size="small"
                      value={investmentKind}
                      onChange={(_event, next: InvestmentKind | null) => {
                        if (next) selectInvestmentKind(next)
                      }}
                      aria-label="Investment type"
                    >
                      <ToggleButton value="stock">Stocks</ToggleButton>
                      <ToggleButton value="mutual_fund">Mutual funds</ToggleButton>
                    </ToggleButtonGroup>
                  ) : null}
                  {pageHeaderAction ? (
                    <Button variant="primary" onClick={pageHeaderAction.onClick}>
                      {pageHeaderAction.label}
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}
            {loading ? <PageSkeleton view={view} /> : null}
            {loadError && view !== 'stocks' ? <div className={classes.loadState}>{loadError}</div> : null}
            <Suspense fallback={<PageSkeleton view={view} />}>
              {!loading && !loadError && view === 'dashboard' && <Dashboard data={data} onDataChange={load} />}
              {!loading && !loadError && view === 'accounts' && (
                <AccountsView data={data} onSaved={load} onOpenUpload={() => navigate('import')} />
              )}
              {!loading && !loadError && view === 'income' && <IncomeView data={data} onSaved={load} />}
              {!loading && !loadError && view === 'investments' && <InvestmentsView data={data} onSaved={load} kind={investmentKind} />}
              {view === 'stocks' && !loading ? (
                <MarketExplorer
                  data={data}
                  portfolioStatus={
                    loadError
                      ? `Saved portfolio unavailable: ${loadError}`
                      : !storeQuery.data
                        ? 'Market-only mode. Firebase portfolio data is not required.'
                        : undefined
                  }
                />
              ) : null}
              {!loading && !loadError && view === 'tables' && (
                <TablesView
                  data={data}
                  onCreateTable={onCreateTable}
                  onRowsChange={onRowsChange}
                  onDeleteTable={async (table) => {
                    await deleteTable(table)
                    await load()
                  }}
                />
              )}
              {!loading && !loadError && view === 'charts' && <ChartBuilder data={data} onSave={saveChart} />}
              {!loading && !loadError && view === 'import' && (
                <ImportView data={data} onSaved={load} onOpenTables={() => navigate('tables')} />
              )}
            </Suspense>
          </main>
        </div>
      </div>
    </PageHeaderActionContext.Provider>
  )
}
