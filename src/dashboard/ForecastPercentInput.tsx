export function ForecastPercentInput({
  classNames,
  value,
  onChange,
}: {
  classNames: { wrap: string; input: string; suffix: string }
  value: number
  onChange: (value: number) => void
}) {
  return (
    <span className={classNames.wrap}>
      <input
        className={classNames.input}
        type="number"
        min="-50"
        max="50"
        step="0.5"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className={classNames.suffix}>%</span>
    </span>
  )
}
