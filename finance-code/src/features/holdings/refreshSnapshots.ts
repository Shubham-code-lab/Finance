import { todayIso } from '@/domain/money'
import { snapshotsFromHoldings } from '@/features/holdings/fromDump'
import { getAllData, replaceInvestmentSnapshots } from '@/storage/repository'

export async function refreshInvestmentSnapshots() {
  const latest = await getAllData()
  await replaceInvestmentSnapshots(snapshotsFromHoldings(latest.holdings, todayIso(), latest.sipEvents))
}
