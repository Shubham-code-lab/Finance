import { useState } from 'react'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import { Button, Popover } from '@mui/material'
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar'
import dayjs from 'dayjs'
import { createUseStyles } from 'react-jss'
import { tokens } from '@/theme/tokens'

const useStyles = createUseStyles({
  root: { width: '100%', minWidth: 0 },
  trigger: {
    width: '100%',
    minHeight: tokens.control.height,
    padding: `${tokens.control.paddingY}px ${tokens.control.paddingX}px !important`,
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
    padding: tokens.space.sm,
    color: `${tokens.color.text} !important`,
    backgroundColor: `${tokens.color.bgCard} !important`,
    backgroundImage: 'none !important',
    border: `1px solid ${tokens.color.borderStrong}`,
    borderRadius: `${tokens.radius.md}px !important`,
    boxShadow: '0 18px 48px rgba(0, 0, 0, 0.4) !important',
    '& .MuiDateCalendar-root': { width: 280, maxHeight: 304, background: tokens.color.bgCard },
    '& .MuiPickersCalendarHeader-root': { minHeight: 34, marginTop: 2, marginBottom: 2, paddingLeft: 4, paddingRight: 4 },
    '& .MuiPickersDay-root': { width: 32, height: 32, margin: '0 2px' },
    '& .MuiDayCalendar-weekDayLabel': { width: 32, height: 28, margin: '0 2px' },
  },
})

export function DatePicker({
  value,
  min,
  onChange,
  onBlur,
}: {
  value: string
  min?: string
  onChange: (value: string) => void
  onBlur?: () => void
}) {
  const classes = useStyles()
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null)

  const close = () => {
    setAnchorEl(null)
    onBlur?.()
  }

  return (
    <div className={classes.root}>
      <Button
        className={classes.trigger}
        type="button"
        variant="outlined"
        startIcon={<CalendarMonthIcon fontSize="small" />}
        onClick={(event) => setAnchorEl(event.currentTarget)}
        aria-haspopup="dialog"
        aria-expanded={Boolean(anchorEl)}
      >
        {value ? dayjs(value).format('DD MMM YYYY') : 'Choose date'}
      </Button>
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{ paper: { className: classes.paper } }}
      >
        <DateCalendar
          value={value ? dayjs(value) : null}
          minDate={min ? dayjs(min) : undefined}
          onChange={(next) => {
            if (!next?.isValid()) return
            onChange(next.format('YYYY-MM-DD'))
            close()
          }}
        />
      </Popover>
    </div>
  )
}
