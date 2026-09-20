import { SkeletonBone } from '@/components/SkeletonBone'
import { useSkeletonStyles } from '@/components/skeletonStyles'

export function DataPageSkeleton() {
  const classes = useSkeletonStyles()
  return (
    <div className={classes.page} aria-label="Loading page" role="status">
      <div className={classes.toolbar}>
        <SkeletonBone width="55" />
        <SkeletonBone width="110" height="36" />
      </div>
      <div className={classes.table}>
        <SkeletonBone height="38" />
        {[0, 1, 2, 3, 4, 5, 6].map((row) => (
          <SkeletonBone key={row} width={row % 2 ? '92' : '100'} height="34" />
        ))}
      </div>
    </div>
  )
}
