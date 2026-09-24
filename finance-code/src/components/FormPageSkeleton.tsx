import { SkeletonBone } from '@/components/SkeletonBone'
import { useSkeletonStyles } from '@/components/skeletonStyles'

export function FormPageSkeleton() {
  const classes = useSkeletonStyles()
  return (
    <div className={classes.formPage} aria-label="Loading form" role="status">
      {[0, 1].map((card) => (
        <div className={classes.formCard} key={card}>
          <SkeletonBone width="55" height="26" />
          <SkeletonBone height="38" />
          <SkeletonBone height="38" />
          <SkeletonBone width="70" height="38" />
        </div>
      ))}
    </div>
  )
}
