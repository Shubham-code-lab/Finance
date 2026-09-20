import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import { createUseStyles } from 'react-jss'
import { Button, Card, MoneyText } from '@/components/ui'
import { formatDateLabel, formatMonthLabel, todayIso } from '@/domain/money'
import { StoreData } from '@/domain/types'
import { buildStatementCoverage } from '@/features/accounts/statementCoverage.utils'
import { tokens } from '@/theme/tokens'

const useStyles = createUseStyles({
  root: { display: 'grid', gap: tokens.space.md },
  sectionHead: { display: 'grid', gap: tokens.space.xs },
  title: { margin: 0, fontSize: tokens.font.sizeLg },
  help: { margin: 0, color: tokens.color.textMuted, fontSize: tokens.font.sizeSm, lineHeight: 1.45 },
  card: { display: 'grid', gap: tokens.space.md },
  cardHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.space.md,
    flexWrap: 'wrap',
  },
  account: { display: 'grid', gap: 2 },
  accountMeta: { color: tokens.color.textMuted, fontSize: tokens.font.sizeXs },
  months: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(132px, 1fr))',
    gap: tokens.space.sm,
  },
  month: {
    display: 'grid',
    gap: tokens.space.xs,
    minHeight: 88,
    padding: tokens.space.sm,
    border: `1px solid ${tokens.color.border}`,
    borderRadius: tokens.radius.sm,
    background: tokens.color.bgMuted,
  },
  covered: { borderColor: tokens.color.positive, background: tokens.color.positiveSoft },
  missing: { borderColor: tokens.color.negative, background: tokens.color.negativeSoft },
  monthHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: tokens.space.xs },
  monthName: { fontWeight: tokens.font.weightMedium, fontSize: tokens.font.sizeSm },
  coveredIcon: { color: tokens.color.positive, display: 'grid', '& svg': { fontSize: 17 } },
  missingIcon: { color: tokens.color.negative, display: 'grid', '& svg': { fontSize: 17 } },
  detail: { color: tokens.color.textMuted, fontSize: tokens.font.sizeXs, lineHeight: 1.35 },
  missingText: { color: tokens.color.negative, fontSize: tokens.font.sizeSm, fontWeight: tokens.font.weightMedium },
  empty: {
    padding: tokens.space.md,
    border: `1px dashed ${tokens.color.borderStrong}`,
    borderRadius: tokens.radius.sm,
    color: tokens.color.textMuted,
    fontSize: tokens.font.sizeSm,
  },
})

export function StatementCoverage({ data, onOpenUpload }: { data: StoreData; onOpenUpload: () => void }) {
  const classes = useStyles()
  const coverage = buildStatementCoverage(data, todayIso())

  if (!coverage.length) return null

  return (
    <section className={classes.root}>
      <div className={classes.sectionHead}>
        <h2 className={classes.title}>Statement coverage</h2>
        <p className={classes.help}>
          Months are checked from each account&apos;s first imported record through today. Red months have no stored statement activity.
        </p>
      </div>
      {coverage.map((item) => (
        <Card className={classes.card} key={item.account.id}>
          <div className={classes.cardHead}>
            <div className={classes.account}>
              <strong>{item.account.name}</strong>
              <span className={classes.accountMeta}>
                {item.firstRecordedDate
                  ? `${item.missingCount} missing month${item.missingCount === 1 ? '' : 's'} · Records through ${formatDateLabel(item.lastRecordedDate ?? '')}`
                  : 'No imported statement records found'}
              </span>
            </div>
            <Button variant="primary" onClick={onOpenUpload}>
              <UploadFileIcon fontSize="small" /> Upload statement
            </Button>
          </div>
          {item.months.length ? (
            <div className={classes.months}>
              {item.months.map((month) => (
                <div className={`${classes.month} ${month.covered ? classes.covered : classes.missing}`} key={month.month}>
                  <div className={classes.monthHead}>
                    <span className={classes.monthName}>{formatMonthLabel(month.month)}</span>
                    <span className={month.covered ? classes.coveredIcon : classes.missingIcon}>
                      {month.covered ? <CheckCircleIcon /> : <ErrorIcon />}
                    </span>
                  </div>
                  {month.covered ? (
                    <>
                      <span className={classes.detail}>
                        {month.transactionCount} transaction{month.transactionCount === 1 ? '' : 's'} · Last{' '}
                        {formatDateLabel(month.lastRecordedDate ?? '')}
                      </span>
                      {month.closingBalanceMinor === null ? null : (
                        <span className={classes.detail}>
                          Closing <MoneyText amountMinor={month.closingBalanceMinor} tone="steady" />
                        </span>
                      )}
                    </>
                  ) : (
                    <span className={classes.missingText}>Statement missing</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className={classes.empty}>Upload the first statement to start tracking month-by-month coverage.</div>
          )}
        </Card>
      ))}
    </section>
  )
}
