import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import { IconButton, Tooltip as MuiTooltip } from '@mui/material'

export function ForecastInfoTip({ className, label }: { className: string; label: string }) {
  return (
    <MuiTooltip title={label} arrow>
      <IconButton
        className={className}
        size="small"
        aria-label={label}
        sx={{ width: '1em', minWidth: '1em', height: '1em', padding: 0, marginLeft: '2px', fontSize: 'inherit' }}
      >
        <InfoOutlinedIcon sx={{ fontSize: '1em !important' }} />
      </IconButton>
    </MuiTooltip>
  )
}
