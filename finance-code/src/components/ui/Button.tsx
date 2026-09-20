import { Button as MuiButton } from '@mui/material'
import { useUiStyles } from './styles'
import { ButtonProps } from './types'

export function Button({ variant, className = '', ...props }: ButtonProps) {
  const classes = useUiStyles()
  return (
    <MuiButton
      className={`${classes.button} ${className}`}
      variant={variant === 'primary' ? 'contained' : 'outlined'}
      color={variant === 'danger' ? 'error' : 'primary'}
      size="small"
      {...props}
    />
  )
}
