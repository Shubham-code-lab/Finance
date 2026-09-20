import { SkeletonBone } from '@/components/SkeletonBone'
import { useSkeletonStyles } from '@/components/skeletonStyles'

export function PanelSkeleton() {
  const classes = useSkeletonStyles()
  return (
    <div className={classes.panelRoot} aria-label="Loading panel" role="status">
      <SkeletonBone width="40" />
      <SkeletonBone className={classes.panelChart} />
      <SkeletonBone width="70" />
      <SkeletonBone width="55" />
    </div>
  )
}
