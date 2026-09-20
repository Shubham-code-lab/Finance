import { SkeletonBone } from '@/components/SkeletonBone'
import { useSkeletonStyles } from '@/components/skeletonStyles'

export function SectionSkeleton() {
  const classes = useSkeletonStyles()
  return (
    <section className={classes.section}>
      <div className={classes.sectionHead}>
        <SkeletonBone width="120" height="16" />
        <div className={classes.controlRow}>
          <SkeletonBone width="170" height="38" />
          <SkeletonBone width="220" height="38" />
        </div>
      </div>
      <div className={classes.sectionBody}>
        <SkeletonBone className={classes.graph} />
        <div className={classes.tableRows}>
          {[0, 1, 2, 3, 4, 5].map((row) => (
            <SkeletonBone key={row} height="34" />
          ))}
        </div>
      </div>
    </section>
  )
}
