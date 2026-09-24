import { lazy, startTransition, Suspense, useMemo, useState } from 'react'
import { ToggleButton, ToggleButtonGroup } from '@mui/material'
import { createUseStyles } from 'react-jss'
import { MarketTabSkeleton } from '@/components/MarketTabSkeleton'
import { tokens } from '@/theme/tokens'
import { StoreData } from '@/domain/types'

const StockMarketComparison = lazy(() =>
  import('@/features/holdings/StockMarketExplorer').then((module) => ({ default: module.StockMarketComparison })),
)
const TopIndiaReturns = lazy(() => import('@/features/holdings/TopIndiaReturns').then((module) => ({ default: module.TopIndiaReturns })))
const StockInvestmentChart = lazy(() =>
  import('@/features/holdings/StockInvestmentChart').then((module) => ({ default: module.StockInvestmentChart })),
)
const MutualFundInvestmentChart = lazy(() =>
  import('@/features/holdings/MutualFundInvestmentChart').then((module) => ({ default: module.MutualFundInvestmentChart })),
)

const workspaceKey = 'finance:stock-market-workspace:v1'

const useStyles = createUseStyles({
  root: { display: 'grid', gap: tokens.space.md },
  modeBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: tokens.space.md,
    flexWrap: 'wrap',
  },
  title: { margin: 0, fontSize: 24, lineHeight: 1.25, fontWeight: tokens.font.weightMedium },
})

type Workspace = 'custom' | 'top-india' | 'investments' | 'funds'

export function MarketExplorer({ portfolioStatus, data }: { portfolioStatus?: string; data: StoreData }) {
  const classes = useStyles()
  const [workspace, setWorkspace] = useState<Workspace>(() => {
    try {
      const saved = window.localStorage.getItem(workspaceKey)
      return saved === 'top-india' || saved === 'investments' || saved === 'funds' ? saved : 'custom'
    } catch {
      return 'custom'
    }
  })
  const [mountedWorkspaces, setMountedWorkspaces] = useState(() => ({
    custom: workspace === 'custom',
    topIndia: workspace === 'top-india',
    investments: workspace === 'investments',
    funds: workspace === 'funds',
  }))
  const recoverySymbols = useMemo(
    () =>
      data.holdings.flatMap((holding) =>
        holding.kind === 'stock' && holding.ticker ? [{ name: holding.name, ticker: holding.ticker }] : [],
      ),
    [data.holdings],
  )
  const customWorkspace = useMemo(
    () => <StockMarketComparison portfolioStatus={portfolioStatus} recoverySymbols={recoverySymbols} />,
    [portfolioStatus, recoverySymbols],
  )
  const topIndiaWorkspace = useMemo(() => <TopIndiaReturns />, [])
  const investmentsWorkspace = useMemo(() => <StockInvestmentChart data={data} />, [data])
  const fundsWorkspace = useMemo(() => <MutualFundInvestmentChart data={data} />, [data])

  const switchWorkspace = (next: Workspace) => {
    startTransition(() => {
      setWorkspace(next)
      setMountedWorkspaces((current) => ({
        ...current,
        custom: current.custom || next === 'custom',
        topIndia: current.topIndia || next === 'top-india',
        investments: current.investments || next === 'investments',
        funds: current.funds || next === 'funds',
      }))
    })
    try {
      window.localStorage.setItem(workspaceKey, next)
    } catch {
      /* Mode still switches without storage. */
    }
  }

  return (
    <div className={classes.root}>
      <div className={classes.modeBar}>
        <h1 className={classes.title}>Stocks</h1>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={workspace}
          onChange={(_event, next: Workspace | null) => {
            if (next) switchWorkspace(next)
          }}
          aria-label="Market comparison mode"
        >
          <ToggleButton value="custom">My comparison</ToggleButton>
          <ToggleButton value="top-india">India top returns</ToggleButton>
          <ToggleButton value="investments">My investments</ToggleButton>
          <ToggleButton value="funds">Mutual funds</ToggleButton>
        </ToggleButtonGroup>
      </div>
      <Suspense fallback={<MarketTabSkeleton showTable={workspace !== 'top-india'} />}>
        {mountedWorkspaces.custom ? <div hidden={workspace !== 'custom'}>{customWorkspace}</div> : null}
        {mountedWorkspaces.topIndia ? <div hidden={workspace !== 'top-india'}>{topIndiaWorkspace}</div> : null}
        {mountedWorkspaces.investments ? <div hidden={workspace !== 'investments'}>{investmentsWorkspace}</div> : null}
        {mountedWorkspaces.funds ? <div hidden={workspace !== 'funds'}>{fundsWorkspace}</div> : null}
      </Suspense>
    </div>
  )
}
