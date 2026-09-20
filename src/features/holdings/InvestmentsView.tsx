import { useState } from 'react'
import { ToggleButton, ToggleButtonGroup } from '@mui/material'
import { createUseStyles } from 'react-jss'
import { StoreData } from '@/domain/types'
import { HoldingsView } from '@/features/holdings/HoldingsView'
import { tokens } from '@/theme/tokens'

const investmentTabKey = 'finance:investment-tab:v1'

const useStyles = createUseStyles({
  root: { display: 'grid', gap: tokens.space.md },
  intro: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.space.md,
    flexWrap: 'wrap',
  },
  copy: { margin: 0, color: tokens.color.textMuted, fontSize: tokens.font.sizeSm, lineHeight: 1.45 },
})

export function InvestmentsView({ data, onSaved }: { data: StoreData; onSaved: () => Promise<void> }) {
  const classes = useStyles()
  const [kind, setKind] = useState<'stock' | 'mutual_fund'>(() => {
    try {
      return window.localStorage.getItem(investmentTabKey) === 'mutual_fund' ? 'mutual_fund' : 'stock'
    } catch {
      return 'stock'
    }
  })

  const selectKind = (next: 'stock' | 'mutual_fund') => {
    setKind(next)
    try {
      window.localStorage.setItem(investmentTabKey, next)
    } catch {
      // The selected tab can remain session-only when browser storage is unavailable.
    }
  }

  return (
    <div className={classes.root}>
      <div className={classes.intro}>
        <p className={classes.copy}>Your current portfolio, invested value, gains, SIP amounts, and monthly SIP status.</p>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={kind}
          onChange={(_event, next: 'stock' | 'mutual_fund' | null) => {
            if (next) selectKind(next)
          }}
          aria-label="Investment type"
        >
          <ToggleButton value="stock">Stocks</ToggleButton>
          <ToggleButton value="mutual_fund">Mutual funds</ToggleButton>
        </ToggleButtonGroup>
      </div>
      <HoldingsView data={data} kind={kind} onSaved={onSaved} />
    </div>
  )
}
