import { ChartBuilderSkeleton } from '@/components/ChartBuilderSkeleton'
import { DashboardSkeleton } from '@/components/DashboardSkeleton'
import { DataPageSkeleton } from '@/components/DataPageSkeleton'
import { FormPageSkeleton } from '@/components/FormPageSkeleton'
import { InvestmentPageSkeleton } from '@/components/InvestmentPageSkeleton'
import { StocksPageSkeleton } from '@/components/StocksPageSkeleton'

type PageKind = 'dashboard' | 'accounts' | 'income' | 'investments' | 'stocks' | 'tables' | 'charts' | 'import'

export function PageSkeleton({ view }: { view: PageKind }) {
  if (view === 'dashboard') return <DashboardSkeleton />
  if (view === 'stocks') return <StocksPageSkeleton />
  if (view === 'investments') return <InvestmentPageSkeleton />
  if (view === 'charts') return <ChartBuilderSkeleton />
  if (view === 'tables' || view === 'import') return <FormPageSkeleton />
  return <DataPageSkeleton />
}
