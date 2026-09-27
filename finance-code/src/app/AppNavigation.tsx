import { useEffect, useState } from 'react'
import CloseIcon from '@mui/icons-material/Close'
import MenuIcon from '@mui/icons-material/Menu'
import { createUseStyles } from 'react-jss'
import { navItems, View } from '@/app/navigation'
import { Button } from '@/components/ui'
import { tokens } from '@/theme/tokens'

const useStyles = createUseStyles({
  navBackdrop: {
    display: 'none',
    position: 'fixed',
    inset: 0,
    zIndex: 9,
    border: 0,
    padding: 0,
    background: tokens.color.overlay,
    cursor: 'default',
    '@media (max-width: 720px)': { display: 'block' },
  },
  mobileToggle: {
    display: 'none',
    position: 'fixed',
    top: 10,
    left: 12,
    zIndex: 13,
    width: 32,
    height: 32,
    padding: 0,
    border: `1px solid ${tokens.color.border}`,
    borderRadius: tokens.radius.sm,
    background: tokens.color.bgCard,
    color: tokens.color.text,
    cursor: 'pointer',
    placeItems: 'center',
    '& svg': { fontSize: 19 },
    '&:focus-visible': { outline: `2px solid ${tokens.color.focus}`, outlineOffset: 2 },
    '@media (max-width: 720px)': { display: 'grid' },
  },
  nav: {
    position: 'fixed',
    left: 0,
    top: 56,
    bottom: 0,
    zIndex: 10,
    boxSizing: 'border-box',
    width: tokens.navigation.collapsedWidth,
    padding: tokens.space.sm,
    display: 'grid',
    alignContent: 'start',
    gap: tokens.space.sm,
    borderRight: `1px solid ${tokens.color.border}`,
    background: tokens.color.bgCard,
    boxShadow: tokens.shadow.header,
    overflow: 'hidden',
    transition: 'width 280ms cubic-bezier(0.22, 1, 0.36, 1)',
    '@media (max-width: 720px)': {
      width: `min(${tokens.navigation.mobileWidth}px, 84vw)`,
      padding: tokens.space.sm,
      transform: 'translateX(-100%)',
      transition: 'transform 220ms ease',
    },
  },
  navOpen: {
    width: tokens.navigation.expandedWidth,
    '@media (max-width: 720px)': { width: `min(${tokens.navigation.mobileWidth}px, 84vw)`, transform: 'translateX(0)' },
  },
  navButton: {
    position: 'relative',
    boxSizing: 'border-box',
    height: `${tokens.navigation.rowHeight}px !important`,
    minHeight: `${tokens.navigation.rowHeight}px !important`,
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center !important',
    gap: 0,
    padding: '6px !important',
    border: '0 !important',
    borderRadius: `${tokens.radius.md}px !important`,
    background: 'transparent !important',
    color: `${tokens.color.textMuted} !important`,
    textAlign: 'left',
    minWidth: '0 !important',
    overflow: 'hidden',
    transition: 'background-color 140ms ease, color 140ms ease',
    '&:hover': { background: `${tokens.color.bgMuted} !important`, color: `${tokens.color.text} !important` },
    '&:focus-visible': { outline: `2px solid ${tokens.color.focus}`, outlineOffset: -2 },
    '$navOpen &': { justifyContent: 'flex-start !important', gap: tokens.space.sm },
  },
  navButtonActive: {
    background: `${tokens.color.accentSoft} !important`,
    color: `${tokens.color.text} !important`,
    fontWeight: `${tokens.font.weightMedium} !important`,
    '&:before': {
      content: '""',
      position: 'absolute',
      left: 0,
      top: 7,
      bottom: 7,
      width: 3,
      borderRadius: [0, 2, 2, 0],
      background: tokens.color.accent,
    },
  },
  navIcon: {
    flex: `0 0 ${tokens.navigation.iconSize}px`,
    width: tokens.navigation.iconSize,
    height: tokens.navigation.iconSize,
    display: 'grid',
    placeItems: 'center',
    borderRadius: tokens.radius.sm,
    background: tokens.color.accentSoft,
    color: tokens.color.accent,
    '& svg': { fontSize: tokens.control.iconSize },
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
    '$navOpen &': { opacity: 1, maxWidth: 148, transform: 'translateX(0)' },
  },
})

export function AppNavigation({ view, onNavigate }: { view: View; onNavigate: (view: View) => void }) {
  const classes = useStyles()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [])

  return (
    <>
      <button
        className={classes.mobileToggle}
        type="button"
        aria-label={open ? 'Close navigation' : 'Open navigation'}
        aria-expanded={open}
        aria-controls="app-navigation"
        onClick={() => setOpen((current) => !current)}
      >
        {open ? <CloseIcon /> : <MenuIcon />}
      </button>
      {open ? <button className={classes.navBackdrop} aria-label="Close navigation" onClick={() => setOpen(false)} /> : null}
      <nav
        id="app-navigation"
        aria-label="Main navigation"
        className={`${classes.nav} ${open ? classes.navOpen : ''}`}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <Button
              key={item.id}
              className={`${classes.navButton} ${item.id === view ? classes.navButtonActive : ''}`}
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
