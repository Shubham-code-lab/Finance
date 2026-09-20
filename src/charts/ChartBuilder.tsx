import { useMemo, useState } from 'react'
import { createUseStyles } from 'react-jss'
import { useForm } from 'react-hook-form'
import { canCombine } from '@/calc/combine'
import { withLiveBankMetrics } from '@/calc/wealth'
import { Button, Card, CheckboxField, ErrorText, Field, Input, Row, Select } from '@/components/ui'
import { ChartPanel } from '@/charts/ChartPanel'
import { ChartSpec, ChartType, StoreData } from '@/domain/types'
import { tokens } from '@/theme/tokens'

const useStyles = createUseStyles({
  layout: {
    display: 'grid',
    gridTemplateColumns: '320px minmax(0, 1fr)',
    gap: tokens.space.md,
    '@media (max-width: 880px)': { gridTemplateColumns: '1fr' },
  },
  form: { display: 'grid', gap: tokens.space.md },
  checks: { display: 'grid', gap: tokens.space.xs },
  helper: { color: tokens.color.textMuted, fontSize: tokens.font.sizeSm },
})

type ChartForm = { title: string; chartType: ChartType }

export function ChartBuilder({ data, onSave }: { data: StoreData; onSave: (spec: ChartSpec) => void }) {
  const classes = useStyles()
  const {
    register,
    handleSubmit,
    watch,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<ChartForm>({ defaultValues: { title: 'Custom chart', chartType: 'line' } })
  const title = watch('title')
  const chartType = watch('chartType')
  const [selectedMetricIds, setSelectedMetricIds] = useState(['bank_icici', 'bank_sbi', 'mf_value', 'stocks_value'])
  const liveMetrics = useMemo(() => withLiveBankMetrics(data.metrics, data.accounts), [data.accounts, data.metrics])
  const metrics = useMemo(
    () => selectedMetricIds.map((id) => liveMetrics.find((metric) => metric.id === id)).filter((metric) => metric !== undefined),
    [liveMetrics, selectedMetricIds],
  )
  const decision = canCombine(metrics)
  const [combine, setCombine] = useState(false)
  const effectiveCombine = combine && decision.ok
  const spec: ChartSpec = {
    id: 'preview',
    title,
    chartType,
    groupBy: 'month',
    combineMode: effectiveCombine ? 'combine' : 'separate',
    incompatibilityReason: decision.ok ? null : decision.reason,
    series: selectedMetricIds.map((metricId) => ({
      id: metricId,
      metricId,
      combinedFrom: effectiveCombine ? selectedMetricIds : undefined,
    })),
  }
  const save = () => {
    if (!selectedMetricIds.length) {
      setError('root', { message: 'Select at least one metric.' })
      return
    }
    onSave({
      ...spec,
      id: crypto.randomUUID(),
      series: selectedMetricIds.map((metricId) => ({
        id: crypto.randomUUID(),
        metricId,
        combinedFrom: effectiveCombine ? selectedMetricIds : undefined,
      })),
    })
  }
  return (
    <div className={classes.layout}>
      <Card>
        <form className={classes.form} onSubmit={handleSubmit(save)}>
          <Field label="Title">
            <Input {...register('title', { validate: (value) => value.trim().length > 0 || 'Chart title is required.' })} />
            <ErrorText>{errors.title?.message}</ErrorText>
          </Field>
          <Field label="Chart type">
            <Select {...register('chartType', { required: 'Chart type is required.' })}>
              <option value="line">Line</option>
              <option value="area">Area</option>
              <option value="bar">Bar</option>
            </Select>
            <ErrorText>{errors.chartType?.message}</ErrorText>
          </Field>
          <div className={classes.checks}>
            {liveMetrics.map((metric) => (
              <CheckboxField
                key={metric.id}
                label={metric.label}
                checked={selectedMetricIds.includes(metric.id)}
                onChange={(checked) => {
                  clearErrors('root')
                  setSelectedMetricIds(checked ? [...selectedMetricIds, metric.id] : selectedMetricIds.filter((id) => id !== metric.id))
                }}
              />
            ))}
          </div>
          <ErrorText>{errors.root?.message}</ErrorText>
          {decision.ok ? (
            <CheckboxField label="Combine compatible series" checked={combine} onChange={setCombine} />
          ) : (
            <div className={classes.helper}>{decision.reason}</div>
          )}
          <Row>
            <Button variant="primary" type="submit">
              Save chart
            </Button>
          </Row>
        </form>
      </Card>
      <Card>
        <ChartPanel spec={spec} data={{ ...data, metrics: liveMetrics }} />
      </Card>
    </div>
  )
}
