import { ReactNode } from 'react'
import { ThemeProvider as MuiThemeProvider, createTheme } from '@mui/material/styles'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { JssProvider, ThemeProvider, createUseStyles } from 'react-jss'
import { tokens } from '@/theme/tokens'

const muiTheme = createTheme({
  palette: {
    mode: 'dark',
    background: { default: tokens.color.bgPage, paper: tokens.color.bgCard },
    primary: { main: tokens.color.accent, contrastText: tokens.color.onAccent },
    error: { main: tokens.color.danger },
    text: { primary: tokens.color.text, secondary: tokens.color.textMuted },
    divider: tokens.color.border,
  },
  shape: { borderRadius: tokens.radius.md },
  typography: { fontFamily: tokens.font.family, fontSize: tokens.font.sizeMd },
  components: {
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none', border: `1px solid ${tokens.color.border}` } } },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: tokens.color.bgCard,
          color: tokens.color.text,
          borderColor: tokens.color.border,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none', borderRadius: tokens.radius.sm, fontWeight: tokens.font.weightMedium },
        outlined: { borderColor: tokens.color.borderStrong, backgroundColor: tokens.color.bgMuted },
        contained: { boxShadow: 'none' },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundImage: 'none',
          backgroundColor: tokens.color.bgCard,
          color: tokens.color.text,
          borderLeft: `1px solid ${tokens.color.borderStrong}`,
          boxShadow: tokens.shadow.card,
        },
      },
    },
    MuiBackdrop: {
      styleOverrides: {
        root: {
          backgroundColor: tokens.color.drawerOverlay,
          backdropFilter: 'blur(2px)',
          transitionTimingFunction: 'cubic-bezier(0.2, 0, 0, 1)',
        },
      },
    },
    MuiCheckbox: {
      styleOverrides: {
        root: { color: tokens.color.textMuted, '&.Mui-checked': { color: tokens.color.accent } },
      },
    },
    MuiFormControlLabel: {
      styleOverrides: { label: { fontSize: tokens.font.sizeMd, color: tokens.color.text } },
    },
    MuiTextField: {
      defaultProps: { variant: 'outlined' },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontSize: tokens.font.sizeMd,
          '&.Mui-selected': { backgroundColor: tokens.color.accentSoft },
          '&.Mui-selected:hover': { backgroundColor: tokens.color.accentSoft },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        notchedOutline: { borderColor: tokens.color.border },
        root: {
          backgroundColor: tokens.color.bgPage,
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: tokens.color.borderStrong },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: tokens.color.focus },
        },
      },
    },
    MuiPaginationItem: {
      styleOverrides: {
        root: {
          color: tokens.color.textMuted,
          borderColor: tokens.color.borderStrong,
          '&.Mui-selected': {
            backgroundColor: tokens.color.accent,
            color: tokens.color.onAccent,
          },
        },
      },
    },
  },
})

const useGlobalStyles = createUseStyles({
  '@global': {
    '*': { boxSizing: 'border-box' },
    html: {
      fontFamily: tokens.font.family,
      color: tokens.color.text,
      background: tokens.color.bgPage,
      colorScheme: 'dark',
    },
    body: {
      margin: 0,
      minWidth: 320,
      fontSize: tokens.font.sizeMd,
      background: tokens.color.bgPage,
    },
    button: { font: 'inherit' },
    input: { font: 'inherit' },
    select: { font: 'inherit' },
    textarea: { font: 'inherit' },
    '#root': { minHeight: '100vh' },
    '::selection': { background: tokens.color.accentSoft, color: tokens.color.text },
    ':focus-visible': {
      outline: `2px solid ${tokens.color.focus}`,
      outlineOffset: 2,
    },
    '*::-webkit-scrollbar': { width: 10, height: 10 },
    '*::-webkit-scrollbar-track': { background: tokens.color.bgPage },
    '*::-webkit-scrollbar-thumb': {
      background: tokens.color.borderStrong,
      borderRadius: 8,
      border: `2px solid ${tokens.color.bgPage}`,
    },
    '.recharts-cartesian-axis-tick-value, .recharts-text': { fill: tokens.color.textMuted },
    '.recharts-legend-item-text': { color: `${tokens.color.textMuted} !important` },
    '.recharts-default-tooltip': {
      background: `${tokens.color.bgCard} !important`,
      border: `1px solid ${tokens.color.borderStrong} !important`,
      borderRadius: `${tokens.radius.sm}px !important`,
      color: `${tokens.color.text} !important`,
      boxShadow: tokens.shadow.card,
    },
    '.recharts-tooltip-label': { color: `${tokens.color.text} !important` },
    '.recharts-tooltip-item': { color: `${tokens.color.textMuted} !important` },
  },
})

export function AppThemeProvider({ children }: { children: ReactNode }) {
  useGlobalStyles()
  return (
    <JssProvider>
      <MuiThemeProvider theme={muiTheme}>
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <ThemeProvider theme={tokens}>{children}</ThemeProvider>
        </LocalizationProvider>
      </MuiThemeProvider>
    </JssProvider>
  )
}
