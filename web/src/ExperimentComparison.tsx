import { useEffect, useMemo, useState } from 'react'
import type { ComparisonMeasurement, ParameterDataPoint } from './parameterTypes'

interface ExperimentComparisonProps {
  dataPoints: ParameterDataPoint[]
}

interface ComparisonResult {
  measurement: ComparisonMeasurement
  unit: string
  baseline_value: number
  comparison_value: number
  difference: number
  absolute_difference: number
  direction: 'increase' | 'decrease' | 'no_change'
  percent_change: number | null
  percent_change_note: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isComparisonResult(value: unknown): value is ComparisonResult {
  return (
    isRecord(value) &&
    (value.measurement === 'soot' ||
      value.measurement === 'temperature' ||
      value.measurement === 'gravity') &&
    typeof value.unit === 'string' &&
    typeof value.baseline_value === 'number' &&
    Number.isFinite(value.baseline_value) &&
    typeof value.comparison_value === 'number' &&
    Number.isFinite(value.comparison_value) &&
    typeof value.difference === 'number' &&
    Number.isFinite(value.difference) &&
    typeof value.absolute_difference === 'number' &&
    Number.isFinite(value.absolute_difference) &&
    (value.direction === 'increase' ||
      value.direction === 'decrease' ||
      value.direction === 'no_change') &&
    (value.percent_change === null ||
      (typeof value.percent_change === 'number' && Number.isFinite(value.percent_change))) &&
    (value.percent_change_note === null || typeof value.percent_change_note === 'string')
  )
}

function isComparisonMeasurement(value: string): value is ComparisonMeasurement {
  return value === 'soot' || value === 'temperature' || value === 'gravity'
}

const measurementHelp: Record<ComparisonMeasurement, string> = {
  soot: 'Tiny carbon particles produced during burning. The study may measure soot in different ways.',
  temperature: 'A temperature reported by the study. Check the source to see exactly what it refers to.',
  gravity: 'Gravity level during the test. 1 g is about Earth gravity; lower values mean weaker gravity.',
}

function readMeasurement(point: ParameterDataPoint, measurement: ComparisonMeasurement) {
  if (measurement === 'gravity') {
    return point.gravity_g === null ? null : { value: point.gravity_g, unit: 'g' }
  }

  if (measurement === 'soot') {
    return point.soot_value === null || !point.soot_unit?.trim()
      ? null
      : { value: point.soot_value, unit: point.soot_unit.trim() }
  }

  return point.temperature_value === null || !point.temperature_unit?.trim()
    ? null
    : { value: point.temperature_value, unit: point.temperature_unit.trim() }
}

function formatNumber(value: number, signed = false) {
  return new Intl.NumberFormat(undefined, {
    maximumSignificantDigits: 8,
    signDisplay: signed ? 'exceptZero' : 'auto',
  }).format(value)
}

function getApiError(value: unknown) {
  if (isRecord(value) && typeof value.detail === 'string') return value.detail
  return 'The comparison service returned an invalid response.'
}

function ExperimentComparison({ dataPoints }: ExperimentComparisonProps) {
  const [measurement, setMeasurement] = useState<ComparisonMeasurement>('soot')
  const [unit, setUnit] = useState('')
  const [baselineId, setBaselineId] = useState('')
  const [comparisonId, setComparisonId] = useState('')
  const [result, setResult] = useState<ComparisonResult | null>(null)
  const [explanation, setExplanation] = useState('')
  const [explanationError, setExplanationError] = useState('')
  const [isExplaining, setIsExplaining] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    setUnit('')
    setBaselineId('')
    setComparisonId('')
    setResult(null)
    setExplanation('')
    setExplanationError('')
    setError('')
  }, [dataPoints])

  const measurementOptions = useMemo(
    () =>
      dataPoints.flatMap((point, index) => {
        const reading = readMeasurement(point, measurement)
        return reading ? [{ id: String(index), point, ...reading }] : []
      }),
    [dataPoints, measurement],
  )

  const units = Array.from(new Set(measurementOptions.map((option) => option.unit)))
  const selectedUnit =
    units.find((option) => option.toLowerCase() === unit.toLowerCase()) ?? units[0] ?? ''
  const optionsForUnit = measurementOptions.filter(
    (option) => option.unit.toLowerCase() === selectedUnit.toLowerCase(),
  )
  const baseline =
    optionsForUnit.find((option) => option.id === baselineId) ?? optionsForUnit[0]
  const comparisonOptions = optionsForUnit.filter((option) => option.id !== baseline?.id)
  const comparison =
    comparisonOptions.find((option) => option.id === comparisonId) ?? comparisonOptions[0]

  async function runComparison() {
    if (!baseline || !comparison) return

    setError('')
    setResult(null)
    setExplanation('')
    setExplanationError('')
    setIsLoading(true)
    try {
      const response = await fetch('/api/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          measurement,
          value_a: baseline.value,
          value_b: comparison.value,
          unit_a: baseline.unit,
          unit_b: comparison.unit,
        }),
      })
      const payload: unknown = await response.json()
      if (!response.ok) throw new Error(getApiError(payload))
      if (!isComparisonResult(payload)) {
        throw new Error('The comparison service returned an invalid response.')
      }
      setResult(payload)
    } catch (requestError) {
      setError(
        requestError instanceof TypeError
          ? 'Could not reach the calculation service. Start it with: uv run uvicorn agent.api:app --reload'
          : requestError instanceof Error
            ? requestError.message
            : 'The comparison could not be completed.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  async function explainResult() {
    if (!baseline || !comparison || !result) return

    setExplanation('')
    setExplanationError('')
    setIsExplaining(true)
    try {
      const response = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          measurement,
          value_a: baseline.value,
          value_b: comparison.value,
          unit_a: baseline.unit,
          unit_b: comparison.unit,
          study_a: baseline.point.study,
          study_b: comparison.point.study,
          outcome_a: baseline.point.result,
          outcome_b: comparison.point.result,
        }),
      })
      const payload: unknown = await response.json()
      if (!response.ok) throw new Error(getApiError(payload))
      if (!isRecord(payload) || typeof payload.explanation !== 'string') {
        throw new Error('The agent returned an invalid explanation.')
      }
      setExplanation(payload.explanation)
    } catch (requestError) {
      setExplanationError(
        requestError instanceof TypeError
          ? 'Could not reach the agent service. Start it with: uv run uvicorn agent.api:app --reload'
          : requestError instanceof Error
            ? requestError.message
            : 'The agent could not explain this comparison.',
      )
    } finally {
      setIsExplaining(false)
    }
  }

  function changeMeasurement(value: ComparisonMeasurement) {
    setMeasurement(value)
    setUnit('')
    setBaselineId('')
    setComparisonId('')
    setResult(null)
    setExplanation('')
    setExplanationError('')
    setError('')
  }

  return (
    <section className="comparison-panel" aria-label="Experiment comparison calculator">
      <div className="comparison-heading">
        <div>
          <span className="card-kicker">COMPARE REPORTED VALUES</span>
          <h2>Compare two data points</h2>
          <p>
            Choose the same measurement from two studies. The calculator shows how their reported
            values differ; it does not explain what caused the difference.
          </p>
        </div>
        <span className="comparison-tool-badge">CALCULATION</span>
      </div>

      <div className="comparison-controls">
        <label className="comparison-field">
          <span>What do you want to compare?</span>
          <select
            aria-describedby="comparison-measurement-help"
            aria-label="What do you want to compare?"
            disabled={isLoading || isExplaining}
            onChange={(event) => {
              const value = event.target.value
              if (isComparisonMeasurement(value)) changeMeasurement(value)
            }}
            value={measurement}
          >
            <option value="soot">Soot amount</option>
            <option value="temperature">Temperature</option>
            <option value="gravity">Gravity level</option>
          </select>
          <small id="comparison-measurement-help">{measurementHelp[measurement]}</small>
        </label>
        <label className="comparison-field">
          <span>Unit</span>
          <select
            aria-describedby="comparison-unit-help"
            aria-label="Unit"
            disabled={isLoading || isExplaining || !units.length}
            onChange={(event) => {
              setUnit(event.target.value)
              setBaselineId('')
              setComparisonId('')
              setResult(null)
              setExplanation('')
              setExplanationError('')
            }}
            value={selectedUnit}
          >
            {units.length ? (
              units.map((option) => <option key={option} value={option}>{option}</option>)
            ) : (
              <option value="">No reported values</option>
            )}
          </select>
          <small id="comparison-unit-help">
            Only values reported in the same unit can be compared.
          </small>
        </label>
        <label className="comparison-field">
          <span>Starting study (A)</span>
          <select
            disabled={isLoading || isExplaining || !optionsForUnit.length}
            onChange={(event) => {
              setBaselineId(event.target.value)
              setResult(null)
              setExplanation('')
              setExplanationError('')
            }}
            value={baseline?.id ?? ''}
          >
            {optionsForUnit.length ? (
              optionsForUnit.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.point.study} - {formatNumber(option.value)} {option.unit}
                </option>
              ))
            ) : (
              <option value="">No comparable records</option>
            )}
          </select>
        </label>
        <label className="comparison-field">
          <span>Second study (B)</span>
          <select
            disabled={isLoading || isExplaining || !comparisonOptions.length}
            onChange={(event) => {
              setComparisonId(event.target.value)
              setResult(null)
              setExplanation('')
              setExplanationError('')
            }}
            value={comparison?.id ?? ''}
          >
            {comparisonOptions.length ? (
              comparisonOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.point.study} - {formatNumber(option.value)} {option.unit}
                </option>
              ))
            ) : (
              <option value="">Need two records with this unit</option>
            )}
          </select>
        </label>
      </div>

      <div className="comparison-actions">
        <p>A is the starting value and B is the value compared with it. Units are not converted.</p>
        <button
          className="comparison-run-button"
          disabled={!baseline || !comparison || isLoading || isExplaining}
          onClick={runComparison}
          type="button"
        >
          {isLoading ? 'Calculating...' : isExplaining ? 'Agent explaining...' : 'Calculate difference'}
          {!isLoading && !isExplaining && <span aria-hidden="true">→</span>}
        </button>
      </div>

      {error && <p className="comparison-error" role="alert">{error}</p>}

      {result && baseline && comparison && (
        <div className="comparison-result" aria-live="polite">
          <div className="comparison-result-heading">
            <span className="comparison-result-mark" aria-hidden="true">✓</span>
            <div>
              <span className="card-kicker">COMPUTED RESULT</span>
              <h3>
                {result.direction === 'increase'
                  ? 'Increase'
                  : result.direction === 'decrease'
                    ? 'Decrease'
                    : 'No change'}
              </h3>
            </div>
          </div>
          <div className="comparison-result-grid">
            <div>
              <span>DIFFERENCE (SECOND - FIRST)</span>
              <strong>{formatNumber(result.difference, true)} {result.unit}</strong>
            </div>
            <div>
              <span>ABSOLUTE DIFFERENCE</span>
              <strong>{formatNumber(result.absolute_difference)} {result.unit}</strong>
            </div>
            <div>
              <span>PERCENT CHANGE</span>
              <strong>
                {result.percent_change === null
                  ? 'Not reported'
                  : `${formatNumber(result.percent_change, true)}%`}
              </strong>
            </div>
          </div>
          {result.percent_change_note && (
            <p className="comparison-result-note">{result.percent_change_note}</p>
          )}
          <div className="comparison-source-links">
            <span>Sources for these values</span>
            <a href={baseline.point.source_url} rel="noopener noreferrer" target="_blank">
              A: {baseline.point.study} <span aria-hidden="true">↗</span>
            </a>
            <a href={comparison.point.source_url} rel="noopener noreferrer" target="_blank">
              B: {comparison.point.study} <span aria-hidden="true">↗</span>
            </a>
          </div>
          <div className="comparison-agent-actions">
            <button
              className="comparison-explain-button"
              disabled={isExplaining}
              onClick={explainResult}
              type="button"
            >
              {isExplaining ? 'Agent is explaining...' : explanation ? 'Explain again' : 'Explain with agent'}
            </button>
            <span>The Python tool performs the arithmetic; the agent adds context to the comparison.</span>
          </div>
          {explanationError && (
            <p className="comparison-error" role="alert">{explanationError}</p>
          )}
          {explanation && (
            <div className="comparison-agent-explanation" aria-live="polite">
              <span className="card-kicker">AGENT EXPLANATION</span>
              <p>{explanation}</p>
            </div>
          )}
          <p className="comparison-disclaimer">
            This is a descriptive calculation between two reported values, not a causal conclusion
            or a prediction.
          </p>
        </div>
      )}
    </section>
  )
}

export default ExperimentComparison
