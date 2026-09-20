import { useEffect, useMemo, useRef, useState } from 'react'
import { createUseStyles } from 'react-jss'
import { SearchMultiSelectOption } from '@/components/SearchMultiSelect.types'
import { tokens } from '@/theme/tokens'

const useStyles = createUseStyles({
  root: { position: 'relative', minWidth: 'min(230px, 100%)', maxWidth: '100%', '@media (max-width: 720px)': { width: '100%' } },
  trigger: {
    boxSizing: 'border-box',
    width: '100%',
    minHeight: 38,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: tokens.space.sm,
    padding: [tokens.space.sm, tokens.space.md],
    border: `1px solid ${tokens.color.borderStrong}`,
    borderRadius: tokens.radius.sm,
    background: tokens.color.bgMuted,
    color: tokens.color.text,
    font: 'inherit',
    fontSize: tokens.font.sizeSm,
    cursor: 'pointer',
    textAlign: 'left',
    '&:hover': { borderColor: tokens.color.accent, background: tokens.color.accentSoft },
  },
  triggerText: { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  chevron: { color: tokens.color.textMuted, fontSize: 14 },
  menu: {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    right: 0,
    width: 'min(380px, calc(100vw - 24px))',
    maxHeight: 'min(340px, calc(100vh - 24px))',
    zIndex: tokens.z.modal,
    display: 'grid',
    gridTemplateRows: 'auto minmax(0, 1fr)',
    border: `1px solid ${tokens.color.borderStrong}`,
    borderRadius: tokens.radius.sm,
    background: tokens.color.bgCard,
    boxShadow: '0 18px 44px rgba(0, 0, 0, 0.42)',
    overflow: 'hidden',
    boxSizing: 'border-box',
  },
  menuLeft: { left: 0, right: 'auto' },
  menuHeader: { position: 'sticky', top: 0, zIndex: 1, background: tokens.color.bgCard },
  search: {
    width: '100%',
    boxSizing: 'border-box',
    border: 0,
    borderBottom: `1px solid ${tokens.color.border}`,
    padding: tokens.space.md,
    background: tokens.color.bgMuted,
    color: tokens.color.text,
    font: 'inherit',
    fontSize: tokens.font.sizeSm,
    outline: 0,
    '&:focus': { boxShadow: `inset 0 -2px ${tokens.color.accent}` },
  },
  options: { minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', padding: tokens.space.xs },
  option: {
    display: 'grid',
    gridTemplateColumns: '18px minmax(0, 1fr) auto',
    gap: tokens.space.sm,
    alignItems: 'center',
    padding: [tokens.space.sm, tokens.space.md],
    borderRadius: tokens.radius.sm,
    color: tokens.color.text,
    fontSize: tokens.font.sizeSm,
    cursor: 'pointer',
    '&:hover': { background: tokens.color.accentSoft },
  },
  selectAll: {
    borderBottom: `1px solid ${tokens.color.border}`,
    fontWeight: tokens.font.weightMedium,
    gridTemplateColumns: '18px minmax(0, 1fr)',
  },
  optionText: { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  detail: { color: tokens.color.textMuted, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', fontSize: tokens.font.sizeXs },
  positive: { color: tokens.color.positive },
  negative: { color: tokens.color.negative },
  steady: { color: tokens.color.steady },
  empty: { padding: tokens.space.md, color: tokens.color.textMuted, fontSize: tokens.font.sizeSm },
})

function sameIds(left: string[], right: string[]) {
  if (left.length !== right.length) return false
  const set = new Set(left)
  return right.every((id) => set.has(id))
}

export function SearchMultiSelect({
  options,
  value,
  onChange,
  label = 'Select stocks',
  selectionNoun = 'stocks',
}: {
  options: SearchMultiSelectOption[]
  value: string[]
  onChange: (value: string[]) => void
  label?: string
  selectionNoun?: string
}) {
  const classes = useStyles()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState(value)
  const [alignLeft, setAlignLeft] = useState(false)
  const draftRef = useRef(draft)
  const valueRef = useRef(value)
  const onChangeRef = useRef(onChange)
  draftRef.current = draft
  valueRef.current = value
  onChangeRef.current = onChange
  const selected = useMemo(() => new Set(draft), [draft])
  const visible = options.filter((option) => `${option.label} ${option.detail ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()))
  const allSelected = options.length > 0 && options.every((option) => selected.has(option.id))
  const showStats = draft.length > 0

  const closeMenu = () => {
    setOpen(false)
    setQuery('')
    const next = draftRef.current
    if (!sameIds(next, valueRef.current)) onChangeRef.current(next)
  }

  useEffect(() => {
    if (!open) setDraft(value)
  }, [open, value])

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) closeMenu()
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const triggerText =
    draft.length === 0
      ? label
      : draft.length === 1
        ? (options.find((option) => option.id === draft[0])?.label ?? label)
        : `${draft.length} ${selectionNoun} selected`

  return (
    <div className={classes.root} ref={rootRef}>
      <button
        type="button"
        className={classes.trigger}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          if (open) closeMenu()
          else {
            setDraft(value)
            const bounds = rootRef.current?.getBoundingClientRect()
            setAlignLeft(Boolean(bounds && bounds.left + 380 <= window.innerWidth - 12))
            setOpen(true)
          }
        }}
      >
        <span className={classes.triggerText}>{triggerText}</span>
        <span className={classes.chevron} aria-hidden="true">
          {open ? '\u25b2' : '\u25bc'}
        </span>
      </button>
      {open ? (
        <div className={`${classes.menu} ${alignLeft ? classes.menuLeft : ''}`}>
          <div className={classes.menuHeader}>
            <input
              className={classes.search}
              type="search"
              placeholder={`Search ${selectionNoun}`}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              autoFocus
            />
            <label className={`${classes.option} ${classes.selectAll}`}>
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() => setDraft(allSelected ? [] : options.map((option) => option.id))}
              />
              <span>Select all</span>
            </label>
          </div>
          <div className={classes.options} role="listbox" aria-multiselectable="true">
            {visible.map((option) => (
              <label className={classes.option} key={option.id}>
                <input
                  type="checkbox"
                  checked={selected.has(option.id)}
                  onChange={() =>
                    setDraft((current) =>
                      current.includes(option.id) ? current.filter((id) => id !== option.id) : [...current, option.id],
                    )
                  }
                />
                <span className={classes.optionText}>{option.label}</span>
                {showStats && selected.has(option.id) && option.detail ? (
                  <span
                    className={`${classes.detail} ${option.tone === 'positive' ? classes.positive : option.tone === 'negative' ? classes.negative : classes.steady}`}
                  >
                    {option.detail}
                  </span>
                ) : null}
              </label>
            ))}
            {!visible.length ? <div className={classes.empty}>No matching {selectionNoun}.</div> : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
