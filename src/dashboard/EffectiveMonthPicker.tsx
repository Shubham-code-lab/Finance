import { useState } from 'react'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { Button, IconButton, Popover } from '@mui/material'
import { createUseStyles } from 'react-jss'
import { formatMonthLabel } from '@/domain/money'
import { tokens } from '@/theme/tokens'

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const useStyles = createUseStyles({
  root: { width: '100%', minWidth: 0 },
  trigger: {
    width: '100%',
    minHeight: 40,
    justifyContent: 'flex-start',
    textTransform: 'none',
    whiteSpace: 'nowrap',
    color: `${tokens.color.text} !important`,
    borderColor: `${tokens.color.borderStrong} !important`,
    backgroundColor: `${tokens.color.bgMuted} !important`,
    '&:hover': {
      borderColor: `${tokens.color.accent} !important`,
      backgroundColor: `${tokens.color.accentSoft} !important`,
    },
  },
  paper: {
    marginTop: tokens.space.xs,
    padding: tokens.space.md,
    width: 288,
    maxWidth: 'calc(100vw - 24px)',
    boxSizing: 'border-box',
    color: `${tokens.color.text} !important`,
    backgroundColor: `${tokens.color.bgCard} !important`,
    backgroundImage: 'none !important',
    border: `1px solid ${tokens.color.borderStrong}`,
    borderRadius: `${tokens.radius.md}px !important`,
    boxShadow: '0 18px 48px rgba(0, 0, 0, 0.4) !important',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: tokens.space.sm,
  },
  year: { fontSize: tokens.font.sizeMd, fontWeight: tokens.font.weightMedium },
  arrow: { color: `${tokens.color.textMuted} !important` },
  months: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: tokens.space.xs },
  month: {
    minWidth: 0,
    minHeight: 40,
    border: 0,
    borderRadius: tokens.radius.sm,
    background: 'transparent',
    color: tokens.color.text,
    font: 'inherit',
    fontSize: tokens.font.sizeSm,
    cursor: 'pointer',
    '&:hover': { background: tokens.color.accentSoft, color: tokens.color.accent },
  },
  selected: {
    color: `${tokens.color.onAccent} !important`,
    background: `${tokens.color.accent} !important`,
    fontWeight: tokens.font.weightMedium,
  },
})

export function EffectiveMonthPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const classes = useStyles()
  const selectedYear = Number(value.slice(0, 4)) || new Date().getFullYear()
  const selectedMonth = Number(value.slice(5, 7)) || 1
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null)
  const [visibleYear, setVisibleYear] = useState(selectedYear)

  const openPicker = (element: HTMLButtonElement) => {
    setVisibleYear(selectedYear)
    setAnchorEl(element)
  }

  return (
    <div className={classes.root}>
      <Button
        className={classes.trigger}
        variant="outlined"
        startIcon={<CalendarMonthIcon fontSize="small" />}
        onClick={(event) => openPicker(event.currentTarget)}
        aria-haspopup="dialog"
        aria-expanded={Boolean(anchorEl)}
      >
        {value ? formatMonthLabel(value) : 'Choose month'}
      </Button>
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{ paper: { className: classes.paper } }}
      >
        <div className={classes.header}>
          <IconButton className={classes.arrow} size="small" onClick={() => setVisibleYear((year) => year - 1)} aria-label="Previous year">
            <ChevronLeftIcon fontSize="small" />
          </IconButton>
          <span className={classes.year}>{visibleYear}</span>
          <IconButton className={classes.arrow} size="small" onClick={() => setVisibleYear((year) => year + 1)} aria-label="Next year">
            <ChevronRightIcon fontSize="small" />
          </IconButton>
        </div>
        <div className={classes.months} role="grid" aria-label={`Choose a month in ${visibleYear}`}>
          {monthNames.map((monthName, index) => {
            const month = index + 1
            const selected = visibleYear === selectedYear && month === selectedMonth
            return (
              <button
                className={`${classes.month} ${selected ? classes.selected : ''}`}
                key={monthName}
                type="button"
                aria-selected={selected}
                onClick={() => {
                  onChange(`${visibleYear}-${String(month).padStart(2, '0')}`)
                  setAnchorEl(null)
                }}
              >
                {monthName}
              </button>
            )
          })}
        </div>
      </Popover>
    </div>
  )
}
