import { SkeletonBone } from '@/components/SkeletonBone'
import { useSkeletonStyles } from '@/components/skeletonStyles'

export function ChartSkeleton({ compact = false }: { compact?: boolean }) {
  const classes = useSkeletonStyles()
  return (
    <div className={`${classes.chartSkeleton} ${compact ? classes.chartSkeletonCompact : ''}`} aria-label="Loading chart" role="status">
      <div className={classes.chartPlot}>
        <SkeletonBone className={classes.chartWave} />
        <SkeletonBone className={classes.chartWaveSecond} />
      </div>
      <div className={classes.chartTicks}>
        <SkeletonBone width="110" height="11" />
        <SkeletonBone width="110" height="11" />
        <SkeletonBone width="110" height="11" />
      </div>
    </div>
  )
}
