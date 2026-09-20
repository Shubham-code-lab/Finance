import { createUseStyles } from 'react-jss'
import { MoneyText } from '@/components/ui'
import { formatDisplayValue, toMinor } from '@/domain/money'
import { StoreData, TableColumn } from '@/domain/types'
import { tokens } from '@/theme/tokens'

const useStyles = createUseStyles({
  wrap: { overflowX: 'auto', border: `1px solid ${tokens.color.border}`, borderRadius: tokens.radius.sm, background: tokens.color.bgPage },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: tokens.font.sizeSm },
  cell: {
    borderBottom: `1px solid ${tokens.color.border}`,
    padding: [tokens.space.xs, tokens.space.sm],
    textAlign: 'left',
    whiteSpace: 'nowrap',
  },
  headCell: { background: tokens.color.bgMuted, color: tokens.color.text },
  muted: { color: tokens.color.textMuted },
})

function isMoneyColumn(column: TableColumn) {
  const key = `${column.id} ${column.name}`.toLowerCase()
  return ['amount', 'value', 'invested', 'profit', 'loss', 'target', 'saved', 'contribution', 'sip'].some((item) => key.includes(item))
}

function moneyTone(column: TableColumn) {
  const key = `${column.id} ${column.name}`.toLowerCase()
  if (['profit', 'loss', 'gain'].some((item) => key.includes(item))) return 'auto'
  if (['spend', 'debit', 'expense'].some((item) => key.includes(item))) return 'negative'
  if (['income', 'credit'].some((item) => key.includes(item))) return 'positive'
  return 'steady'
}

export function TablePreview({ tableId, data }: { tableId: string; data: StoreData }) {
  const classes = useStyles()
  const table = data.customTables.find((item) => item.id === tableId)
  const rows = data.customTableRows.filter((row) => row.tableId === tableId).slice(0, 24)
  if (!table) return <span className={classes.muted}>Missing table.</span>
  return (
    <div className={classes.wrap}>
      <table className={classes.table}>
        <thead>
          <tr>
            {table.columns.map((column) => (
              <th className={`${classes.cell} ${classes.headCell}`} key={column.id}>
                {column.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {table.columns.map((column) => (
                <td className={classes.cell} key={column.id}>
                  {column.type === 'number' && isMoneyColumn(column) ? (
                    <MoneyText amountMinor={toMinor(row.cells[column.id] ?? 0)} tone={moneyTone(column)} />
                  ) : (
                    formatDisplayValue(row.cells[column.id], column.type)
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
