import { ReactNode } from 'react'
import { useUiStyles } from './styles'

export function ErrorText({ children }: { children?: ReactNode }) {
  const classes = useUiStyles()
  return children ? <span className={classes.error}>{children}</span> : null
}
