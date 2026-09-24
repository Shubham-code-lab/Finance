import { ChartSkeleton } from '@/components/ChartSkeleton'
import { SkeletonBone } from '@/components/SkeletonBone'
import { useSkeletonStyles } from '@/components/skeletonStyles'

export function MarketTabSkeleton({ showTable = true }: { showTable?: boolean }) {
  const classes = useSkeletonStyles()
  return (
    <div className={classes.stockPage} aria-label="Loading market tab" role="status">
      <div className={classes.stockPanel}>
        <div className={classes.stockPanelHead}>
          <div className={classes.stockControls}>
            <SkeletonBone width="170" height="38" />
            <SkeletonBone width="220" height="38" />
          </div>
        </div>
        <div className={classes.stockChips}>
          <SkeletonBone width="120" height="26" />
          <SkeletonBone width="170" height="26" />
          <SkeletonBone width="110" height="26" />
        </div>
        <ChartSkeleton compact />
      </div>
      {showTable ? (
        <div className={classes.skeletonTableCard}>
          <div className={classes.skeletonTableToolbar}>
            <SkeletonBone width="120" height="36" />
          </div>
          <SkeletonBone height="38" />
          {[0, 1, 2, 3].map((row) => (
            <SkeletonBone key={row} height="34" />
          ))}
        </div>
      ) : null}
    </div>
  )
}
