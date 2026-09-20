import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import { IconButton, Tooltip as MuiTooltip } from '@mui/material'

export function ForecastInfoTip({ className, label }: { className: string; label: string }) {
  return (
    <MuiTooltip title={label} arrow>
      <IconButton className={className} size="small" aria-label={label}>
        <InfoOutlinedIcon />
      </IconButton>
    </MuiTooltip>
  )
}
