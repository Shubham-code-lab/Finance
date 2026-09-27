import { SkeletonBone } from '@/components/SkeletonBone'
import { useSkeletonStyles } from '@/components/skeletonStyles'

export function ImportPageSkeleton() {
  const classes = useSkeletonStyles()
  return (
    <div className={classes.formPage} aria-label="Loading upload options" role="status">
      {[0, 1].map((card) => (
        <div className={classes.formCard} key={card}>
          <SkeletonBone width="55" height="26" />
          <SkeletonBone width="92" height="16" />
          {card === 0 ? <SkeletonBone width="100" height="38" /> : <SkeletonBone width="76" height="16" />}
          <SkeletonBone width="120" height="36" />
        </div>
      ))}
    </div>
  )
}
