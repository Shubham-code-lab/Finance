import { ChartSkeleton } from '@/components/ChartSkeleton'
import { SkeletonBone } from '@/components/SkeletonBone'
import { useSkeletonStyles } from '@/components/skeletonStyles'

export function ChartBuilderSkeleton() {
  const classes = useSkeletonStyles()
  return (
    <div className={classes.formPage} aria-label="Loading chart builder" role="status">
      <div className={classes.formCard}>
        <SkeletonBone width="55" height="16" />
        <SkeletonBone height="38" />
        <SkeletonBone width="55" height="16" />
        <SkeletonBone height="38" />
        <SkeletonBone width="120" height="36" />
      </div>
      <div className={classes.stockPanel}>
        <SkeletonBone width="55" height="26" />
        <ChartSkeleton compact />
      </div>
    </div>
  )
}
