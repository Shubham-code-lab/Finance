import { ComponentType, forwardRef } from 'react'
import { TextField } from '@mui/material'
import { useUiStyles } from './styles'
import { InputProps } from './types'

const MaterialTextField = TextField as ComponentType<Record<string, unknown>>

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className = '', ...props }, ref) {
  const classes = useUiStyles()
  return <MaterialTextField className={`${classes.input} ${className}`} size="small" fullWidth inputRef={ref} {...props} />
})
