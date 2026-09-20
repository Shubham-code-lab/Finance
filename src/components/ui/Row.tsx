import { ReactNode } from 'react'
import { useUiStyles } from './styles'

export function Row({ children, className = '' }: { children: ReactNode; className?: string }) {
  const classes = useUiStyles()
  return <div className={`${classes.row} ${className}`}>{children}</div>
}
