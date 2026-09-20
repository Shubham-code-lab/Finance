import { ComponentType, forwardRef } from 'react'
import { TextField } from '@mui/material'
import { useUiStyles } from './styles'
import { SelectProps } from './types'

const MaterialTextField = TextField as ComponentType<Record<string, unknown>>

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ className = '', children, ...props }, ref) {
  const classes = useUiStyles()
  return (
    <MaterialTextField
      className={`${classes.input} ${className}`}
      size="small"
      fullWidth
      select
      slotProps={{ select: { native: true } }}
      inputRef={ref}
      {...props}
    >
      {children}
    </MaterialTextField>
  )
})
