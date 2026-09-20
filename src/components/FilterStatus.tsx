import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import { CircularProgress } from '@mui/material'
import { createUseStyles } from 'react-jss'
import { tokens } from '@/theme/tokens'

const useStyles = createUseStyles({
  status: {
    width: 22,
    height: 22,
    flex: '0 0 22px',
    display: 'grid',
    placeItems: 'center',
    color: tokens.color.positive,
  },
  spinner: { color: `${tokens.color.accent} !important` },
})

export function FilterStatus({ fetching, ready }: { fetching: boolean; ready: boolean }) {
  const classes = useStyles()
  return (
    <span className={classes.status} aria-live="polite" aria-label={fetching ? 'Loading' : ready ? 'Up to date' : 'Waiting'}>
      {fetching ? (
        <CircularProgress className={classes.spinner} size={16} thickness={5} />
      ) : ready ? (
        <CheckCircleIcon sx={{ fontSize: 18 }} />
      ) : null}
    </span>
  )
}
