import { Logout } from '@mui/icons-material'
import { signOut } from 'firebase/auth'
import { createUseStyles } from 'react-jss'
import { Button, Row } from '@/components/ui'
import { auth } from '@/firebase/client'
import { tokens } from '@/theme/tokens'

const useStyles = createUseStyles({
  identity: { display: 'flex', alignItems: 'center', gap: tokens.space.sm, minWidth: 0 },
  avatar: {
    width: 30,
    height: 30,
    display: 'grid',
    placeItems: 'center',
    flex: '0 0 auto',
    borderRadius: '50%',
    background: tokens.color.accentSoft,
    color: tokens.color.accent,
    fontSize: tokens.font.sizeSm,
    fontWeight: tokens.font.weightMedium,
  },
  account: {
    maxWidth: 160,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: tokens.color.textMuted,
    fontSize: tokens.font.sizeSm,
  },
  iconButton: { minWidth: '36px !important', padding: '4px !important' },
})

export function CloudControls() {
  const classes = useStyles()
  const user = auth?.currentUser
  if (!auth || !user) return null
  const activeAuth = auth
  const name = user.displayName?.trim() || user.email?.split('@')[0] || 'Google user'
  return (
    <Row>
      <span className={classes.identity} title={name}>
        <span className={classes.avatar}>{name.slice(0, 1).toUpperCase()}</span>
        <span className={classes.account}>{name}</span>
      </span>
      <Button className={classes.iconButton} onClick={() => signOut(activeAuth)} title="Sign out" aria-label="Sign out">
        <Logout fontSize="small" />
      </Button>
    </Row>
  )
}
