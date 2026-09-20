import { lazy, startTransition, Suspense, useState } from 'react'
import { ToggleButton, ToggleButtonGroup } from '@mui/material'
import { createUseStyles } from 'react-jss'
import { DataPageSkeleton } from '@/components/DataPageSkeleton'
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
  modeBar: { display: 'flex', justifyContent: 'flex-start', alignItems: 'center' },
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
      <Suspense fallback={<DataPageSkeleton />}>
        {mountedWorkspaces.custom ? (
          <div hidden={workspace !== 'custom'}>
            <StockMarketComparison
              portfolioStatus={portfolioStatus}
              recoverySymbols={data.holdings.flatMap((holding) =>
                holding.kind === 'stock' && holding.ticker ? [{ name: holding.name, ticker: holding.ticker }] : [],
              )}
            />
          </div>
        ) : null}
        {mountedWorkspaces.topIndia ? (
          <div hidden={workspace !== 'top-india'}>
            <TopIndiaReturns />
          </div>
        ) : null}
        {mountedWorkspaces.investments ? (
          <div hidden={workspace !== 'investments'}>
            <StockInvestmentChart data={data} />
          </div>
        ) : null}
        {mountedWorkspaces.funds ? (
          <div hidden={workspace !== 'funds'}>
            <MutualFundInvestmentChart data={data} />
          </div>
        ) : null}
      </Suspense>
    </div>
  )
}
