import { useEffect, useMemo, useRef, useState } from 'react'
import SourceCitations from './SourceCitations'
import type { SourceCitation } from './citationData'

interface FactorChartItem {
  factor: string
  study_count: number
  source_urls: string[]
}

interface FactorChartData {
  sample_size: number
  factors: FactorChartItem[]
}

interface FactorExplanationPoint {
  study_title: string
  source_url: string
  evidence_point: string
  combustion_relevance: string
  fire_safety_impact: string
  suppression_tactics: string
}

interface FactorExplanation {
  factor: string
  points: FactorExplanationPoint[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isPSIUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname === 'psi.nasa.gov'
  } catch {
    return false
  }
}

function isFactorChartData(value: unknown): value is FactorChartData {
  if (
    !isRecord(value) ||
    typeof value.sample_size !== 'number' ||
    !Number.isInteger(value.sample_size) ||
    value.sample_size < 0 ||
    !Array.isArray(value.factors)
  ) {
    return false
  }

  const sampleSize = value.sample_size
  return value.factors.every(
    (factor) =>
      isRecord(factor) &&
      typeof factor.factor === 'string' &&
      typeof factor.study_count === 'number' &&
      Number.isInteger(factor.study_count) &&
      factor.study_count > 0 &&
      factor.study_count <= sampleSize &&
      Array.isArray(factor.source_urls) &&
      factor.source_urls.length === factor.study_count &&
      factor.source_urls.every(isPSIUrl),
  )
}

function isFactorExplanationPoint(value: unknown): value is FactorExplanationPoint {
  return (
    isRecord(value) &&
    typeof value.study_title === 'string' &&
    value.study_title.trim().length > 0 &&
    isPSIUrl(value.source_url) &&
    typeof value.evidence_point === 'string' &&
    value.evidence_point.trim().length > 0 &&
    typeof value.combustion_relevance === 'string' &&
    value.combustion_relevance.trim().length > 0 &&
    typeof value.fire_safety_impact === 'string' &&
    value.fire_safety_impact.trim().length > 0 &&
    typeof value.suppression_tactics === 'string' &&
    value.suppression_tactics.trim().length > 0
  )
}

function isFactorExplanation(value: unknown, factor: string): value is FactorExplanation {
  if (
    !isRecord(value) ||
    value.factor !== factor ||
    !Array.isArray(value.points) ||
    value.points.length !== 3 ||
    !value.points.every(isFactorExplanationPoint)
  ) {
    return false
  }
  return (
    new Set(
      value.points.map((point) =>
        isFactorExplanationPoint(point) ? point.source_url : '',
      ),
    ).size === 3
  )
}

function errorMessage(payload: unknown) {
  return isRecord(payload) && typeof payload.detail === 'string'
    ? payload.detail
    : 'The factor chart service returned an unexpected response.'
}

async function readResponse(response: Response): Promise<unknown> {
  let payload: unknown
  try {
    payload = await response.json()
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('The factor chart service returned unreadable data.')
    }
    throw error
  }
  if (!response.ok) throw new Error(errorMessage(payload))
  return payload
}

function PSIRecordLink(url: string) {
  const accession = new URL(url).pathname.split('/').pop()
  return accession?.startsWith('PSI-') ? accession : 'NASA PSI record'
}

function FactorChart() {
  const [chart, setChart] = useState<FactorChartData | null>(null)
  const [selectedFactor, setSelectedFactor] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [retry, setRetry] = useState(0)
  const [factorExplanation, setFactorExplanation] = useState<FactorExplanation | null>(null)
  const [explanationError, setExplanationError] = useState('')
  const [isExplaining, setIsExplaining] = useState(false)
  const explanationController = useRef<AbortController | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    explanationController.current?.abort()
    explanationController.current = null
    setFactorExplanation(null)
    setExplanationError('')
    setIsExplaining(false)
    setIsLoading(true)
    setError('')

    async function loadChart() {
      try {
        const response = await fetch('/api/factor-chart', { signal: controller.signal })
        const payload = await readResponse(response)
        if (!isFactorChartData(payload)) {
          throw new Error('The factor chart service returned invalid keyword counts.')
        }
        setChart(payload)
        setSelectedFactor(payload.factors[0]?.factor ?? '')
      } catch (requestError) {
        if (controller.signal.aborted) return
        setError(
          requestError instanceof TypeError
            ? 'Could not connect to the PSI data service. Check that the local API is running.'
            : requestError instanceof Error
              ? requestError.message
              : 'The factor chart could not be loaded.',
        )
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }

    void loadChart()
    return () => {
      controller.abort()
      explanationController.current?.abort()
      explanationController.current = null
    }
  }, [retry])

  const selected = chart?.factors.find((item) => item.factor === selectedFactor)
  function selectFactor(factor: string) {
    explanationController.current?.abort()
    explanationController.current = null
    setFactorExplanation(null)
    setExplanationError('')
    setIsExplaining(false)
    setSelectedFactor((current) => (current === factor ? '' : factor))
  }

  async function explainSelectedFactor() {
    if (!selected) return

    const factor = selected.factor
    const controller = new AbortController()
    explanationController.current?.abort()
    explanationController.current = controller
    setFactorExplanation(null)
    setExplanationError('')
    setIsExplaining(true)

    try {
      const response = await fetch('/api/factor-chart/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ factor }),
        signal: controller.signal,
      })
      const payload = await readResponse(response)
      if (!isFactorExplanation(payload, factor)) {
        throw new Error('The agent returned an invalid factor explanation.')
      }
      if (!controller.signal.aborted) setFactorExplanation(payload)
    } catch (requestError) {
      if (controller.signal.aborted) return
      setExplanationError(
        requestError instanceof TypeError
          ? 'Could not connect to the explanation service. Check that the local API is running.'
          : requestError instanceof Error
            ? requestError.message
            : 'The factor explanation could not be loaded.',
      )
    } finally {
      if (explanationController.current === controller) {
        explanationController.current = null
        setIsExplaining(false)
      }
    }
  }

  const citations = useMemo<SourceCitation[]>(() => {
    if (!selected) return []
    return selected.source_urls.map((sourceUrl) => ({
      title: PSIRecordLink(sourceUrl),
      source_type: 'NASA PSI study',
      source_url: sourceUrl,
      relevance: `This study’s PSI keywords or summary text mention a term grouped under "${selected.factor}". It is counted once for this factor.`,
    }))
  }, [selected])

  const maxStudyCount = Math.max(...(chart?.factors.map((item) => item.study_count) ?? [0]))

  return (
    <div className="page-content factor-chart-page">
      <section className="page-heading">
        <div>
          <div className="eyebrow">NASA PSI STUDY OVERVIEW <span>03</span></div>
          <h1>Factor chart</h1>
          <p>See which research factors appear across NASA PSI combustion investigations.</p>
        </div>
        <div className="gravity-readout factor-chart-readout">
          <span className="readout-label">STUDIES COUNTED</span>
          <strong>{isLoading ? 'Loading…' : chart?.sample_size ?? '—'}</strong>
        </div>
      </section>

      <section className="factor-chart-card" aria-label="Frequently mentioned combustion factors">
        <div className="factor-chart-heading">
          <div>
            <span className="card-kicker">MOST-MENTIONED FACTORS</span>
            <h2>Factors mentioned across studies</h2>
            <p>
              Each bar counts how many investigations mention a factor in their PSI keywords or
              research summary.
            </p>
          </div>
          {chart && (
            <span className="factor-chart-sample">
              {chart.sample_size} PSI {chart.sample_size === 1 ? 'study' : 'studies'}
            </span>
          )}
        </div>

        {isLoading ? (
          <p className="factor-chart-message" role="status">Counting PSI research factors…</p>
        ) : error ? (
          <div className="factor-chart-message factor-chart-error" role="alert">
            <p>{error}</p>
            <button onClick={() => setRetry((value) => value + 1)} type="button">
              Try again
            </button>
          </div>
        ) : chart?.factors.length ? (
          <>
            <ol className="factor-chart-list">
              {chart.factors.map((item) => {
                const width = maxStudyCount
                  ? Math.max(4, (item.study_count / maxStudyCount) * 100)
                  : 0
                const isSelected = selectedFactor === item.factor

                return (
                  <li key={item.factor}>
                    <button
                      aria-label={`${item.factor}, mentioned in ${item.study_count} of ${chart.sample_size} studies`}
                      aria-pressed={isSelected}
                      className={`factor-chart-row ${isSelected ? 'is-selected' : ''}`}
                      onClick={() => selectFactor(item.factor)}
                      type="button"
                    >
                      <span className="factor-chart-label">{item.factor}</span>
                      <span aria-hidden="true" className="factor-chart-track">
                        <span style={{ width: `${width}%` }} />
                      </span>
                      <span className="factor-chart-count">
                        <strong>{item.study_count}</strong>
                        <small>{item.study_count === 1 ? 'study' : 'studies'}</small>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ol>
            <p className="factor-chart-method">
              Counts use the {chart.sample_size} studies returned by the NASA PSI combustion
              search. Each study is counted once per factor using a fixed set of related terms in
              its keywords and summary fields. The chart is a sample, not a full-text count of
              every NASA investigation.
            </p>
          </>
        ) : (
          <p className="factor-chart-message">No PSI keyword data was available for this search.</p>
        )}
      </section>

      {selected && !isLoading && !error && (
        <section className="factor-agent-card" aria-labelledby="factor-agent-title">
          <div className="factor-agent-heading">
            <div>
              <span className="card-kicker">PSI-BACKED EXPLANATION</span>
              <h2 id="factor-agent-title">Explore {selected.factor}</h2>
              <p>
                Ask the agent for three study-based points about combustion, fire safety, and
                suppression.
              </p>
            </div>
            <button
              className="factor-agent-button"
              disabled={isExplaining}
              onClick={() => void explainSelectedFactor()}
              type="button"
            >
              {isExplaining ? 'Analyzing studies…' : 'Ask the agent'}
            </button>
          </div>
          <p className="factor-agent-disclaimer">
            Suppression details are reported only when a PSI source discusses them; this is not
            emergency or operational fire-response guidance.
          </p>

          {isExplaining && (
            <p className="factor-agent-message" role="status">
              Reviewing three relevant NASA PSI records…
            </p>
          )}
          {explanationError && (
            <p className="factor-agent-message factor-agent-error" role="alert">
              {explanationError}
            </p>
          )}
          {factorExplanation && (
            <div className="factor-agent-points">
              {factorExplanation.points.map((point, index) => (
                <article className="factor-agent-point" key={point.source_url}>
                  <span className="factor-agent-point-number">POINT {index + 1}</span>
                  <h3>{point.study_title}</h3>
                  <p className="factor-agent-evidence">{point.evidence_point}</p>
                  <dl>
                    <div>
                      <dt>Combustion relevance</dt>
                      <dd>{point.combustion_relevance}</dd>
                    </div>
                    <div>
                      <dt>Fire-safety connection</dt>
                      <dd>{point.fire_safety_impact}</dd>
                    </div>
                    <div>
                      <dt>Suppression connection</dt>
                      <dd>{point.suppression_tactics}</dd>
                    </div>
                  </dl>
                  <a href={point.source_url} rel="noreferrer" target="_blank">
                    Open NASA PSI source
                  </a>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      <SourceCitations
        note={
          selected
            ? `These are the NASA PSI records counted for "${selected.factor}".`
            : 'Select a bar to see the NASA PSI records counted for that factor.'
        }
        sources={citations}
      />
    </div>
  )
}

export default FactorChart
