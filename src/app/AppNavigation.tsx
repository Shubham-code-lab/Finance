import { useState } from 'react'
import { createUseStyles } from 'react-jss'
import { navItems, View } from '@/app/navigation'
import { Button } from '@/components/ui'
import { tokens } from '@/theme/tokens'

const useStyles = createUseStyles({
  navBackdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 9,
    border: 0,
    padding: 0,
    background: tokens.color.overlay,
    cursor: 'default',
  },
  nav: {
    position: 'fixed',
    left: 0,
    top: 56,
    bottom: 0,
    zIndex: 10,
    boxSizing: 'border-box',
    width: 64,
    padding: tokens.space.sm,
    display: 'grid',
    alignContent: 'start',
    gap: tokens.space.sm,
    borderRight: `1px solid ${tokens.color.border}`,
    background: tokens.color.bgCard,
    boxShadow: tokens.shadow.header,
    overflow: 'hidden',
    transition: 'width 280ms cubic-bezier(0.22, 1, 0.36, 1)',
    '@media (max-width: 720px)': { width: 56 },
  },
  navOpen: {
    width: 196,
    '@media (max-width: 720px)': { width: 184 },
  },
  navButton: {
    boxSizing: 'border-box',
    height: 44,
    width: '100%',
    justifyContent: 'flex-start !important',
    display: 'flex',
    alignItems: 'center',
    gap: tokens.space.sm,
    padding: '7px 4px !important',
    textAlign: 'left',
    minWidth: '0 !important',
    overflow: 'hidden',
  },
  navIcon: {
    flex: '0 0 28px',
    width: 28,
    height: 28,
    display: 'grid',
    placeItems: 'center',
    borderRadius: tokens.radius.sm,
    background: tokens.color.accentSoft,
    color: tokens.color.accent,
    '& svg': { fontSize: 18 },
  },
  navIconGold: { background: tokens.color.goldSoft, color: tokens.color.warning },
  navIconGreen: { background: tokens.color.greenSoft, color: tokens.color.inflow },
  navIconRose: { background: tokens.color.roseSoft, color: tokens.color.rose },
  navIconBlue: { background: tokens.color.accentSoft, color: tokens.color.accent },
  navIconRed: { background: tokens.color.dangerSoft, color: tokens.color.danger },
  navText: {
    display: 'inline-block',
    flex: '1 1 auto',
    textAlign: 'left',
    opacity: 0,
    maxWidth: 0,
    overflow: 'hidden',
    transform: 'translateX(-6px)',
    whiteSpace: 'nowrap',
    textTransform: 'capitalize',
    transition: 'opacity 180ms ease 40ms, max-width 260ms ease, transform 240ms ease',
    '$navOpen &': { opacity: 1, maxWidth: 120, transform: 'translateX(0)' },
  },
})

export function AppNavigation({ view, onNavigate }: { view: View; onNavigate: (view: View) => void }) {
  const classes = useStyles()
  const [open, setOpen] = useState(false)

  return (
    <>
      {open ? <button className={classes.navBackdrop} aria-label="Close navigation" onClick={() => setOpen(false)} /> : null}
      <nav
        className={`${classes.nav} ${open ? classes.navOpen : ''}`}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <Button
              key={item.id}
              className={classes.navButton}
              variant={item.id === view ? 'primary' : undefined}
              title={item.label}
              aria-label={item.label}
              onClick={() => {
                onNavigate(item.id)
                setOpen(false)
              }}
            >
              <span className={`${classes.navIcon} ${classes[item.tone]}`}>
                <Icon />
              </span>
              <span className={classes.navText}>{item.label}</span>
            </Button>
          )
        })}
      </nav>
    </>
  )
}
