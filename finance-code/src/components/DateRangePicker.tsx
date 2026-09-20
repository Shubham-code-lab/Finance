import { startTransition, useState } from 'react'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import { Button, Popover } from '@mui/material'
import { DateRangeCalendar } from '@mui/x-date-pickers-pro/DateRangeCalendar'
import dayjs, { Dayjs } from 'dayjs'
import { createUseStyles } from 'react-jss'
import { DateRangeValue, isValidDateRange } from '@/components/dateRange'
import { tokens } from '@/theme/tokens'

type PickerValue = [Dayjs | null, Dayjs | null]

function lastThreeMonthsBounds(): PickerValue {
  return [dayjs().subtract(2, 'month').startOf('month'), dayjs()]
}

const useStyles = createUseStyles({
  root: {
    display: 'inline-flex',
    width: 'fit-content',
    maxWidth: '100%',
    minWidth: 0,
    justifyContent: 'flex-end',
    '@media (max-width: 420px)': {
      width: '100%',
    },
  },
  trigger: {
    width: 'auto',
    minWidth: 250,
    maxWidth: '100%',
    justifyContent: 'flex-start',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    textTransform: 'none',
    color: `${tokens.color.text} !important`,
    borderColor: `${tokens.color.borderStrong} !important`,
    backgroundColor: `${tokens.color.bgMuted} !important`,
    '&:hover': {
      backgroundColor: `${tokens.color.accentSoft} !important`,
      borderColor: `${tokens.color.accent} !important`,
    },
    '@media (max-width: 420px)': {
      width: '100%',
      minWidth: 0,
    },
  },
  paper: {
    maxWidth: 'calc(100vw - 24px) !important',
    maxHeight: 'calc(100vh - 24px) !important',
    backgroundColor: `${tokens.color.bgCard} !important`,
    backgroundImage: 'none !important',
    opacity: '1 !important',
    color: tokens.color.text,
    border: `1px solid ${tokens.color.borderStrong}`,
    boxShadow: '0 24px 60px rgba(0, 0, 0, 0.46)',
    overflow: 'auto',
  },
  popover: {
    display: 'grid',
    gridTemplateColumns: '180px minmax(312px, 1fr)',
    backgroundColor: `${tokens.color.bgCard} !important`,
    backgroundImage: 'none',
    opacity: 1,
    color: tokens.color.text,
    '@media (max-width: 720px)': {
      gridTemplateColumns: '1fr',
      width: 'calc(100vw - 24px)',
      maxWidth: '100%',
    },
  },
  shortcuts: {
    display: 'grid',
    alignContent: 'start',
    gap: 6,
    padding: tokens.space.md,
    maxHeight: 460,
    overflowY: 'auto',
    backgroundColor: `${tokens.color.bgMuted} !important`,
    borderRight: `1px solid ${tokens.color.border}`,
    '@media (max-width: 720px)': {
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      borderRight: 0,
      borderBottom: `1px solid ${tokens.color.border}`,
      maxHeight: 220,
    },
  },
  shortcut: {
    width: '100%',
    border: 0,
    borderRadius: tokens.radius.sm,
    padding: [9, tokens.space.sm],
    background: 'transparent',
    color: tokens.color.textMuted,
    textAlign: 'left',
    font: 'inherit',
    fontSize: tokens.font.sizeSm,
    cursor: 'pointer',
    '&:hover': {
      background: tokens.color.accentSoft,
      color: tokens.color.text,
    },
  },
  selectedShortcut: {
    background: `${tokens.color.accentSoft} !important`,
    color: `${tokens.color.accent} !important`,
    fontWeight: tokens.font.weightMedium,
  },
  calendarWrap: {
    minWidth: 312,
    boxSizing: 'border-box',
    padding: tokens.space.md,
    backgroundColor: `${tokens.color.bgCard} !important`,
    backgroundImage: 'none',
    opacity: 1,
    '& .MuiDateRangeCalendar-root, & .MuiDateRangeCalendar-container, & .MuiDateRangeCalendar-monthContainer, & .MuiDateCalendar-root, & .MuiDayCalendar-root':
      {
        backgroundColor: `${tokens.color.bgCard} !important`,
        backgroundImage: 'none !important',
        opacity: '1 !important',
        color: tokens.color.text,
      },
    '& .MuiPickersCalendarHeader-label, & .MuiDayCalendar-weekDayLabel': {
      color: `${tokens.color.textMuted} !important`,
    },
    '& .MuiPickersArrowSwitcher-button': {
      color: `${tokens.color.text} !important`,
    },
    '& .MuiPickersDay-root': {
      color: `${tokens.color.text} !important`,
    },
    '& .MuiPickersDay-root:hover': {
      backgroundColor: `${tokens.color.accentSoft} !important`,
    },
    '& .MuiDateRangePickerDay-root': {
      backgroundColor: `${tokens.color.bgCard} !important`,
    },
    '& .MuiDateRangePickerDay-rangeIntervalDayHighlight': {
      backgroundColor: `${tokens.color.accentSoft} !important`,
    },
    '& .MuiDateRangePickerDay-rangeIntervalPreview': {
      borderColor: `${tokens.color.borderStrong} !important`,
    },
    '& .Mui-selected': {
      backgroundColor: `${tokens.color.accent} !important`,
      color: `${tokens.color.onAccent} !important`,
    },
    '@media (max-width: 720px)': {
      width: '100%',
      minWidth: 0,
      padding: tokens.space.sm,
      overflowX: 'auto',
    },
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: tokens.space.md,
    paddingTop: tokens.space.sm,
    borderTop: `1px solid ${tokens.color.border}`,
    color: tokens.color.textMuted,
    fontSize: tokens.font.sizeSm,
  },
  error: {
    color: tokens.color.danger,
  },
})

const presets = [
  {
    label: 'Current month',
    getValue: () => {
      const value = dayjs()
      return [value.startOf('month'), value] as PickerValue
    },
  },
  {
    label: 'Last month',
    getValue: () => {
      const value = dayjs().subtract(1, 'month')
      return [value.startOf('month'), value.endOf('month')] as PickerValue
    },
  },
  {
    label: 'Last 3 months',
    getValue: lastThreeMonthsBounds,
  },
  {
    label: 'Last 6 months',
    getValue: () => [dayjs().subtract(5, 'month').startOf('month'), dayjs()] as PickerValue,
  },
  {
    label: 'Current year',
    getValue: () => {
      const value = dayjs()
      return [value.startOf('year'), value] as PickerValue
    },
  },
  {
    label: 'Last year',
    getValue: () => {
      const value = dayjs().subtract(1, 'year')
      return [value.startOf('year'), value.endOf('year')] as PickerValue
    },
  },
  {
    label: 'Last 2 years',
    getValue: () => [dayjs().subtract(2, 'year'), dayjs()] as PickerValue,
  },
  {
    label: 'Last 3 years',
    getValue: () => [dayjs().subtract(3, 'year'), dayjs()] as PickerValue,
  },
  {
    label: 'Last 4 years',
    getValue: () => [dayjs().subtract(4, 'year'), dayjs()] as PickerValue,
  },
  {
    label: 'Last 5 years',
    getValue: () => [dayjs().subtract(5, 'year'), dayjs()] as PickerValue,
  },
]

function asDay(value: string) {
  return value ? dayjs(value) : null
}

function asIso(value: Dayjs | null) {
  return value?.isValid() ? value.format('YYYY-MM-DD') : ''
}

function formatDisplay(value: DateRangeValue) {
  if (!value.from && !value.to) return 'Select date range'
  const from = value.from ? dayjs(value.from).format('DD MMM YYYY') : 'Start'
  const to = value.to ? dayjs(value.to).format('DD MMM YYYY') : 'End'
  return `${from} - ${to}`
}

function sameRange(current: DateRangeValue, next: PickerValue) {
  return current.from === asIso(next[0]) && current.to === asIso(next[1])
}

export function DateRangePicker({ value, onChange }: { value: DateRangeValue; onChange: (next: DateRangeValue) => void }) {
  const classes = useStyles()
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null)
  const [alignment, setAlignment] = useState<'left' | 'right'>('right')
  const [rangePosition, setRangePosition] = useState<'start' | 'end'>('start')
  const open = Boolean(anchorEl)
  const pickerValue: PickerValue = [asDay(value.from), asDay(value.to)]
  const valid = isValidDateRange(value)

  const applyRange = ([from, to]: PickerValue) => {
    const today = dayjs()
    const cappedTo = to?.isAfter(today, 'day') ? today : to
    startTransition(() => onChange({ from: asIso(from), to: asIso(cappedTo) }))
  }

  return (
    <div className={classes.root}>
      <Button
        className={classes.trigger}
        color={valid ? 'primary' : 'error'}
        startIcon={<CalendarMonthIcon fontSize="small" />}
        variant="outlined"
        onClick={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect()
          setAlignment(bounds.left < window.innerWidth / 2 ? 'left' : 'right')
          setAnchorEl(event.currentTarget)
        }}
      >
        {formatDisplay(value)}
      </Button>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: alignment }}
        transformOrigin={{ vertical: 'top', horizontal: alignment }}
        slotProps={{ paper: { className: classes.paper } }}
      >
        <div className={classes.popover}>
          <aside className={classes.shortcuts} aria-label="Date range presets">
            {presets.map((preset) => {
              const presetValue = preset.getValue()
              return (
                <button
                  key={preset.label}
                  type="button"
                  className={`${classes.shortcut} ${sameRange(value, presetValue) ? classes.selectedShortcut : ''}`}
                  onClick={() => {
                    applyRange(presetValue)
                    setRangePosition('start')
                    setAnchorEl(null)
                  }}
                >
                  {preset.label}
                </button>
              )
            })}
            <button
              type="button"
              className={`${classes.shortcut} ${presets.some((preset) => sameRange(value, preset.getValue())) ? '' : classes.selectedShortcut}`}
              onClick={() => setRangePosition('start')}
            >
              Custom range
            </button>
          </aside>
          <div className={classes.calendarWrap}>
            <DateRangeCalendar
              value={pickerValue}
              onChange={applyRange}
              calendars={1}
              rangePosition={rangePosition}
              onRangePositionChange={setRangePosition}
            />
            <div className={classes.footer}>
              <span className={valid ? '' : classes.error}>{valid ? formatDisplay(value) : 'Start date must be before end date'}</span>
              <Button size="small" variant="contained" onClick={() => setAnchorEl(null)}>
                Done
              </Button>
            </div>
          </div>
        </div>
      </Popover>
    </div>
  )
}
