import { StoreData } from '@/domain/types'
import { HoldingsView } from '@/features/holdings/HoldingsView'

export type InvestmentKind = 'stock' | 'mutual_fund'

export function InvestmentsView({ data, onSaved, kind }: { data: StoreData; onSaved: () => Promise<void>; kind: InvestmentKind }) {
  return <HoldingsView data={data} kind={kind} onSaved={onSaved} />
}
