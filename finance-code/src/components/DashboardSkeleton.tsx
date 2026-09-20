import { SectionSkeleton } from '@/components/SectionSkeleton'
import { SkeletonBone } from '@/components/SkeletonBone'
import { useSkeletonStyles } from '@/components/skeletonStyles'

export function DashboardSkeleton() {
  const classes = useSkeletonStyles()
  return (
    <div className={classes.dashboard} aria-label="Loading dashboard" role="status">
      <div className={classes.cards}>
        {[0, 1, 2, 3].map((card) => (
          <div className={classes.card} key={card}>
            <div className={classes.cardTop}>
              <SkeletonBone width="42" />
              <SkeletonBone className={classes.icon} height="32" />
            </div>
            <SkeletonBone width="68" height="26" />
            <SkeletonBone width="88" height="11" />
            <SkeletonBone width="76" height="11" />
          </div>
        ))}
      </div>
      {[0, 1, 2, 3, 4].map((section) => (
        <SectionSkeleton key={section} />
      ))}
    </div>
  )
}
