import { FormControl, MenuItem, Pagination, Select } from '@mui/material'
import { createUseStyles } from 'react-jss'
import { tokens } from '@/theme/tokens'

const useStyles = createUseStyles({
  root: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.space.md,
    flexWrap: 'wrap',
    marginTop: tokens.space.md,
  },
  meta: { color: tokens.color.textMuted, fontSize: tokens.font.sizeSm },
  controls: { display: 'flex', alignItems: 'center', gap: tokens.space.md, flexWrap: 'wrap' },
  perPage: { display: 'flex', alignItems: 'center', gap: tokens.space.sm, color: tokens.color.textMuted, fontSize: tokens.font.sizeSm },
})

export function PaginationBar({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  label = 'rows',
}: {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  label?: string
}) {
  const classes = useStyles()
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  return (
    <div className={classes.root}>
      <span className={classes.meta}>
        Page {page} of {totalPages} - {total} {label}
      </span>
      <div className={classes.controls}>
        <label className={classes.perPage}>
          Per page
          <FormControl size="small">
            <Select value={String(pageSize)} onChange={(event) => onPageSizeChange(Number(event.target.value))}>
              {[10, 12, 25, 50, 100].map((value) => (
                <MenuItem key={value} value={String(value)}>
                  {value}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </label>
        <Pagination
          count={totalPages}
          page={page}
          onChange={(_, next) => onPageChange(next)}
          color="primary"
          size="small"
          showFirstButton
          showLastButton
        />
      </div>
    </div>
  )
}
