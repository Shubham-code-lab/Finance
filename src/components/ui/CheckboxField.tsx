import { Checkbox, FormControlLabel } from '@mui/material'

export function CheckboxField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <FormControlLabel
      control={<Checkbox checked={checked} onChange={(event) => onChange(event.target.checked)} size="small" />}
      label={label}
    />
  )
}
