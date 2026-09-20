import { useSkeletonStyles } from '@/components/skeletonStyles'

type Width = '40' | '42' | '55' | '68' | '70' | '76' | '88' | '92' | '100' | '110' | '120' | '170' | '220'
type Height = '11' | '16' | '26' | '32' | '34' | '36' | '38'

export function SkeletonBone({ className = '', width = '100', height }: { className?: string; width?: Width; height?: Height }) {
  const classes = useSkeletonStyles()
  const widthClass = classes[`width${width}`]
  const heightClass = height ? classes[`height${height}`] : ''
  return <div className={`${classes.pulse} ${widthClass} ${heightClass} ${className}`} />
}
