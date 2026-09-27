import { ReactNode } from 'react'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import { Tooltip } from '@mui/material'
import { useUiStyles } from './styles'

export function Field({
  label,
  children,
  className = '',
  hint,
}: {
  label: string
  children: ReactNode
  className?: string
  hint?: string
}) {
  const classes = useUiStyles()
  return (
    <label className={`${classes.label} ${className}`}>
      <span className={classes.labelText}>
        {label}
        {hint ? (
          <Tooltip title={hint} arrow>
            <InfoOutlinedIcon className={classes.labelInfo} tabIndex={0} aria-label={`About ${label}`} />
          </Tooltip>
        ) : null}
      </span>
      <span className={classes.fieldControl}>{children}</span>
    </label>
  )
}
