# UI

## Look

Compact, professional, financial-tool — not a marketing landing page.

- Page background: light gray  
- Surfaces: white cards, 1px subtle border, small radius  
- Dense padding (8–12px), not giant empty cards  
- Readable 13–14px body, 12px meta, 16–18px section titles  
- No Material Design, no Tailwind, no inline styles  

## Tokens

`src/theme/tokens.ts` — the only color/spacing/type source.

```ts
export const tokens = {
  color: {
    bgPage: '#eceff1',
    bgCard: '#ffffff',
    bgMuted: '#f5f7f8',
    border: '#d5dce0',
    borderStrong: '#b7c2c8',
    text: '#1c2428',
    textMuted: '#5c6b73',
    accent: '#2f5d50',
    inflow: '#2f6f4e',
    outflow: '#a33b3b',
    neutral: '#3d5a73',
    danger: '#8b2e2e',
    focus: '#2f5d50',
  },
  space: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
  },
  radius: {
    sm: 4,
    md: 6,
  },
  font: {
    family: 'ui-sans-serif, system-ui, "Segoe UI", sans-serif',
    sizeXs: 11,
    sizeSm: 12,
    sizeMd: 13,
    sizeLg: 16,
    weightRegular: 400,
    weightMedium: 600,
  },
  shadow: {
    card: 'none', // border only; optional 0 1px 2px rgba(0,0,0,0.04)
  },
  z: { modal: 20, drag: 30 },
} as const
```

## JSS

```ts
import { createUseStyles } from 'react-jss'
import { tokens } from '@/theme/tokens'

const useStyles = createUseStyles({
  card: {
    background: tokens.color.bgCard,
    border: `1px solid ${tokens.color.border}`,
    borderRadius: tokens.radius.md,
    padding: tokens.space.md,
  },
})
```

Forbidden: `style={{}}`, `sx=`, Tailwind classes, MUI `Box`.

Exception: Recharts needs `width/height` on `ResponsiveContainer`; keep that as Recharts API, not as ad-hoc DOM styling. Tooltip CSS via JSS wrapper class.

## Shell

- Top bar: app name, range picker, Backup, Clear demo  
- Left nav (narrow): Dashboard, Accounts, Income, Mutual funds, Stocks, Tables, Charts, Import  
- Top bar: SIP paid / skipped / failed / cancelled notifications, only on or after that SIP’s day  

- Main: max width ~1280px, grid gap `tokens.space.md`  

## Widgets

- Title row + drag handle + hide  
- KPI: one number, one label, muted period subtitle. Inflow/outflow/neutral color on the number only  
- Chart widget: legend, no decorative gradients  

## Tables grid

Spreadsheet density: row height ~28–32px, header sticky, horizontal scroll if needed.

## Accessibility

- Buttons are `<button>`  
- Drag: keyboard reorder (up/down) in v1 is enough if pointer drag is flaky  
- Contrast: muted text still ≥ 4.5:1 against white/gray  

## Copy for PDF stub

See `project-docs/DATA-INGESTION.md`.
