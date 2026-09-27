import { ReactNode } from 'react'
import CloseIcon from '@mui/icons-material/Close'
import { Drawer as MuiDrawer, IconButton } from '@mui/material'
import { Button } from './Button'
import { useUiStyles } from './styles'

export function Drawer({
  title,
  children,
  footer,
  onClose,
  cancelDisabled = false,
  wide = false,
}: {
  title: string
  children: ReactNode
  footer?: ReactNode
  onClose: () => void
  cancelDisabled?: boolean
  wide?: boolean
}) {
  const classes = useUiStyles()
  return (
    <MuiDrawer anchor="right" open onClose={onClose} transitionDuration={{ enter: 260, exit: 180 }}>
      <div
        className={`${classes.drawer} ${wide ? classes.drawerWide : ''} ${footer ? '' : classes.drawerWithoutFooter}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className={classes.drawerHeader}>
          <h2 className={classes.drawerTitle}>{title}</h2>
          <IconButton className={classes.drawerClose} type="button" aria-label="Close" onClick={onClose} size="small">
            <CloseIcon fontSize="small" />
          </IconButton>
        </header>
        <div className={classes.drawerBody}>{children}</div>
        {footer ? (
          <footer className={classes.drawerFooter}>
            <Button type="button" onClick={onClose} disabled={cancelDisabled}>
              Cancel
            </Button>
            {footer}
          </footer>
        ) : null}
      </div>
    </MuiDrawer>
  )
}
