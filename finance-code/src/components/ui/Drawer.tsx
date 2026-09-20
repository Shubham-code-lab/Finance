import { ReactNode } from 'react'
import CloseIcon from '@mui/icons-material/Close'
import { Button as MuiButton, Drawer as MuiDrawer } from '@mui/material'
import { useUiStyles } from './styles'

export function Drawer({
  title,
  children,
  footer,
  onClose,
}: {
  title: string
  children: ReactNode
  footer: ReactNode
  onClose: () => void
}) {
  const classes = useUiStyles()
  return (
    <MuiDrawer anchor="right" open onClose={onClose} transitionDuration={{ enter: 260, exit: 180 }}>
      <div className={classes.drawer} role="dialog" aria-modal="true" aria-label={title}>
        <header className={classes.drawerHeader}>
          <h2 className={classes.drawerTitle}>{title}</h2>
          <MuiButton type="button" aria-label="Close" onClick={onClose} size="small" variant="outlined">
            <CloseIcon fontSize="small" />
          </MuiButton>
        </header>
        <div className={classes.drawerBody}>{children}</div>
        <footer className={classes.drawerFooter}>{footer}</footer>
      </div>
    </MuiDrawer>
  )
}
