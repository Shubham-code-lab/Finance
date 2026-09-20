import { ReactNode } from 'react'
import { Card as MuiCard } from '@mui/material'
import { useUiStyles } from './styles'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  const classes = useUiStyles()
  return (
    <MuiCard component="section" className={`${classes.card} ${className}`} variant="outlined">
      {children}
    </MuiCard>
  )
}
