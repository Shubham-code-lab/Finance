import { ReactNode } from 'react'
import { useUiStyles } from './styles'

export function Field({ label, children }: { label: string; children: ReactNode }) {
  const classes = useUiStyles()
  return (
    <label className={classes.label}>
      {label}
      {children}
    </label>
  )
}
