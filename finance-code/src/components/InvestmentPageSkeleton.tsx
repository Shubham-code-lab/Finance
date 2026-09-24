import { DataPageSkeleton } from '@/components/DataPageSkeleton'
import { SkeletonBone } from '@/components/SkeletonBone'
import { useSkeletonStyles } from '@/components/skeletonStyles'

export function InvestmentPageSkeleton() {
  const classes = useSkeletonStyles()
  return (
    <div className={classes.stockPage} aria-label="Loading investments" role="status">
      <div className={classes.stockPanelHead}>
        <SkeletonBone width="55" height="16" />
        <div className={classes.stockTabs}>
          <SkeletonBone width="110" height="36" />
          <SkeletonBone width="120" height="36" />
        </div>
      </div>
      <div className={classes.investmentSummary}>
        {[0, 1, 2, 3].map((card) => (
          <div className={classes.card} key={card}>
            <SkeletonBone width="55" height="16" />
            <SkeletonBone width="76" height="26" />
          </div>
        ))}
      </div>
      <DataPageSkeleton />
    </div>
  )
}
