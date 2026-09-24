import { MarketTabSkeleton } from '@/components/MarketTabSkeleton'
import { SkeletonBone } from '@/components/SkeletonBone'
import { useSkeletonStyles } from '@/components/skeletonStyles'

export function StocksPageSkeleton() {
  const classes = useSkeletonStyles()
  return (
    <div className={classes.stockPage} aria-label="Loading stocks page" role="status">
      <div className={classes.stockPanelHead}>
        <SkeletonBone width="120" height="26" />
        <div className={classes.stockTabs}>
          {[0, 1, 2, 3].map((tab) => (
            <SkeletonBone key={tab} width="120" height="36" />
          ))}
        </div>
      </div>
      <MarketTabSkeleton />
    </div>
  )
}
