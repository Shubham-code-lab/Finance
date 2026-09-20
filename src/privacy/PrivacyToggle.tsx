import { Visibility, VisibilityOff } from '@mui/icons-material'
import { createUseStyles } from 'react-jss'
import { Button } from '@/components/ui'
import { usePrivacy } from '@/privacy/privacy'
import { tokens } from '@/theme/tokens'

const useStyles = createUseStyles({
  button: { minWidth: '36px !important', padding: '4px !important', color: tokens.color.textMuted },
})

export function PrivacyToggle() {
  const classes = useStyles()
  const { masked, toggle } = usePrivacy()
  const label = masked ? 'Show financial values' : 'Hide financial values'
  return (
    <Button className={classes.button} onClick={toggle} title={label} aria-label={label} aria-pressed={!masked}>
      {masked ? <Visibility fontSize="small" /> : <VisibilityOff fontSize="small" />}
    </Button>
  )
}
