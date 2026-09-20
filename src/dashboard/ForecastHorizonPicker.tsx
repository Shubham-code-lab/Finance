import { useState } from 'react'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { Button, IconButton, Popover } from '@mui/material'
import { createUseStyles } from 'react-jss'
import { formatMonthLabel } from '@/domain/money'
import { addMonths } from '@/domain/sip'
import { tokens } from '@/theme/tokens'

const presets = [
  { months: 3, label: '3 months' },
  { months: 6, label: '6 months' },
  { months: 12, label: '1 year' },
  { months: 24, label: '2 years' },
  { months: 36, label: '3 years' },
  { months: 48, label: '4 years' },
  { months: 60, label: '5 years' },
  { months: 72, label: '6 years' },
  { months: 84, label: '7 years' },
  { months: 96, label: '8 years' },
  { months: 108, label: '9 years' },
  { months: 120, label: '10 years' },
]

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function monthsBetween(fromMonth: string, toMonth: string) {
  const fromYear = Number(fromMonth.slice(0, 4))
  const from = Number(fromMonth.slice(5, 7))
  const toYear = Number(toMonth.slice(0, 4))
  const to = Number(toMonth.slice(5, 7))
  return (toYear - fromYear) * 12 + to - from
}

const useStyles = createUseStyles({
  root: { width: 190, maxWidth: '100%', minWidth: 0 },
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
    maxWidth: 'calc(100vw - 24px)',
    color: `${tokens.color.text} !important`,
    backgroundColor: `${tokens.color.bgCard} !important`,
    backgroundImage: 'none !important',
    border: `1px solid ${tokens.color.borderStrong}`,
    borderRadius: `${tokens.radius.md}px !important`,
    boxShadow: '0 18px 48px rgba(0, 0, 0, 0.4) !important',
  },
  content: {
    display: 'grid',
    gridTemplateColumns: '128px 288px',
    '@media (max-width: 500px)': { gridTemplateColumns: '1fr', width: 'min(288px, calc(100vw - 24px))' },
  },
  shortcuts: {
    display: 'grid',
    alignContent: 'start',
    gap: tokens.space.xs,
    padding: tokens.space.md,
    maxHeight: 420,
    overflowY: 'auto',
    background: tokens.color.bgMuted,
    borderRight: `1px solid ${tokens.color.border}`,
    '@media (max-width: 500px)': {
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      maxHeight: 240,
      borderRight: 0,
      borderBottom: `1px solid ${tokens.color.border}`,
    },
  },
  shortcut: {
    width: '100%',
    minHeight: 36,
    border: 0,
    borderRadius: tokens.radius.sm,
    padding: [tokens.space.sm, tokens.space.md],
    background: 'transparent',
    color: tokens.color.textMuted,
    textAlign: 'left',
    font: 'inherit',
    fontSize: tokens.font.sizeSm,
    cursor: 'pointer',
    '&:hover': { background: tokens.color.accentSoft, color: tokens.color.text },
  },
  activeShortcut: {
    background: `${tokens.color.accentSoft} !important`,
    color: `${tokens.color.accent} !important`,
    fontWeight: tokens.font.weightMedium,
  },
  calendar: { padding: tokens.space.md },
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
    '&:hover:not(:disabled)': { background: tokens.color.accentSoft, color: tokens.color.accent },
    '&:disabled': { color: tokens.color.borderStrong, cursor: 'not-allowed' },
  },
  selected: {
    color: `${tokens.color.onAccent} !important`,
    background: `${tokens.color.accent} !important`,
    fontWeight: tokens.font.weightMedium,
  },
})

export function ForecastHorizonPicker({
  baseMonth,
  months,
  onChange,
}: {
  baseMonth: string
  months: number
  onChange: (months: number) => void
}) {
  const classes = useStyles()
  const endMonth = addMonths(baseMonth, months)
  const selectedYear = Number(endMonth.slice(0, 4))
  const selectedMonth = Number(endMonth.slice(5, 7))
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null)
  const [visibleYear, setVisibleYear] = useState(selectedYear)

  const choose = (nextMonths: number) => {
    onChange(nextMonths)
    setAnchorEl(null)
  }

  return (
    <div className={classes.root}>
      <Button
        className={classes.trigger}
        variant="outlined"
        startIcon={<CalendarMonthIcon fontSize="small" />}
        onClick={(event) => {
          setVisibleYear(selectedYear)
          setAnchorEl(event.currentTarget)
        }}
        aria-haspopup="dialog"
        aria-expanded={Boolean(anchorEl)}
      >
        Until {formatMonthLabel(endMonth)}
      </Button>
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{ paper: { className: classes.paper } }}
      >
        <div className={classes.content}>
          <aside className={classes.shortcuts} aria-label="Forecast horizon presets">
            {presets.map((preset) => (
              <button
                className={`${classes.shortcut} ${months === preset.months ? classes.activeShortcut : ''}`}
                key={preset.months}
                type="button"
                onClick={() => choose(preset.months)}
              >
                {preset.label}
              </button>
            ))}
          </aside>
          <div className={classes.calendar}>
            <div className={classes.header}>
              <IconButton
                className={classes.arrow}
                size="small"
                onClick={() => setVisibleYear((year) => year - 1)}
                aria-label="Previous year"
              >
                <ChevronLeftIcon fontSize="small" />
              </IconButton>
              <span className={classes.year}>{visibleYear}</span>
              <IconButton className={classes.arrow} size="small" onClick={() => setVisibleYear((year) => year + 1)} aria-label="Next year">
                <ChevronRightIcon fontSize="small" />
              </IconButton>
            </div>
            <div className={classes.months} role="grid" aria-label={`Choose forecast end month in ${visibleYear}`}>
              {monthNames.map((monthName, index) => {
                const month = `${visibleYear}-${String(index + 1).padStart(2, '0')}`
                const nextMonths = monthsBetween(baseMonth, month)
                const selected = visibleYear === selectedYear && index + 1 === selectedMonth
                return (
                  <button
                    className={`${classes.month} ${selected ? classes.selected : ''}`}
                    key={monthName}
                    type="button"
                    disabled={nextMonths < 1}
                    aria-selected={selected}
                    onClick={() => choose(nextMonths)}
                  >
                    {monthName}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </Popover>
    </div>
  )
}
