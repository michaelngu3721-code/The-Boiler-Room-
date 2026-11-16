import { useEffect, useMemo, useRef, useState } from 'react'
import SourceCitations from './SourceCitations'
import type { SourceCitation } from './citationData'

type EnvironmentId = 'earth' | 'iss' | 'moon' | 'mars'
type EvidenceStatus =
  | 'Directly stated by NASA'
  | 'NASA background context'
  | 'Cautious habitat extrapolation'
  | 'Not addressed by NASA sources'

interface EnvironmentOption {
  id: EnvironmentId
  label: string
  subtitle: string
  gravity: string
  setting: string
  atmosphere: string
}

interface EnvironmentSafetyPoint {
  category: string
  fire_safety_effect: string
  evidence_status: EvidenceStatus
  source_urls: string[]
}

interface EnvironmentSource {
  title: string
  source_type: string
  source_url: string
  relevance: string
}

interface EnvironmentExplanation {
  environment: EnvironmentId
  label: string
  summary: string
  points: EnvironmentSafetyPoint[]
  sources: EnvironmentSource[]
}

const ENVIRONMENTS: EnvironmentOption[] = [
  {
    id: 'earth',
    label: 'Earth',
    subtitle: 'Open-air baseline',
    gravity: '1 g',
    setting: 'Open surface',
    atmosphere: 'Oxygen-containing atmosphere',
  },
  {
    id: 'iss',
    label: 'Pressurized habitat (ISS)',
    subtitle: 'Inside the station cabin',
    gravity: '~0 g',
    setting: 'Pressurized, ventilated cabin',
    atmosphere: 'Controlled cabin atmosphere',
  },
  {
    id: 'moon',
    label: 'Moon',
    subtitle: 'Surface or future habitat',
    gravity: '1/6 g',
    setting: 'Near-vacuum exterior',
    atmosphere: 'Extremely thin exosphere; habitat is sealed',
  },
  {
    id: 'mars',
    label: 'Mars',
    subtitle: 'Surface or future habitat',
    gravity: '0.38 g',
    setting: 'Thin-atmosphere exterior',
    atmosphere: 'Mostly carbon dioxide; habitat is sealed',
  },
]

const CATEGORIES = [
  'Atmosphere and fire potential',
  'Flame, heat, and smoke behavior',
  'Fire-safety implications and evidence limits',
]

const EVIDENCE_STATUSES: EvidenceStatus[] = [
  'Directly stated by NASA',
  'NASA background context',
  'Cautious habitat extrapolation',
  'Not addressed by NASA sources',
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNasaUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && (url.hostname === 'nasa.gov' || url.hostname.endsWith('.nasa.gov'))
  } catch {
    return false
  }
}

function isEnvironmentSource(value: unknown): value is EnvironmentSource {
  return (
    isRecord(value) &&
    typeof value.title === 'string' &&
    value.title.trim().length > 0 &&
    typeof value.source_type === 'string' &&
    value.source_type.trim().length > 0 &&
    isNasaUrl(value.source_url) &&
    typeof value.relevance === 'string' &&
    value.relevance.trim().length > 0
  )
}

function isEnvironmentPoint(value: unknown): value is EnvironmentSafetyPoint {
  return (
    isRecord(value) &&
    typeof value.category === 'string' &&
    CATEGORIES.includes(value.category) &&
    typeof value.fire_safety_effect === 'string' &&
    value.fire_safety_effect.trim().length > 0 &&
    typeof value.evidence_status === 'string' &&
    EVIDENCE_STATUSES.some((status) => status === value.evidence_status) &&
    Array.isArray(value.source_urls) &&
    value.source_urls.every(isNasaUrl)
  )
}

function isEnvironmentExplanation(
  value: unknown,
  environment: EnvironmentOption,
): value is EnvironmentExplanation {
  if (
    !isRecord(value) ||
    value.environment !== environment.id ||
    value.label !== environment.label ||
    typeof value.summary !== 'string' ||
    value.summary.trim().length === 0 ||
    !Array.isArray(value.points) ||
    value.points.length !== CATEGORIES.length ||
    !value.points.every(isEnvironmentPoint) ||
    !Array.isArray(value.sources) ||
    value.sources.length === 0 ||
    !value.sources.every(isEnvironmentSource)
  ) {
    return false
  }

  const categories = value.points.map((point) => point.category)
  const allowedSources = new Set(value.sources.map((source) => source.source_url))
  return (
    new Set(categories).size === CATEGORIES.length &&
    CATEGORIES.every((category) => categories.includes(category)) &&
    value.points.every((point) =>
      point.source_urls.every((sourceUrl) => allowedSources.has(sourceUrl)),
    )
  )
}

function errorMessage(payload: unknown) {
  return isRecord(payload) && typeof payload.detail === 'string'
    ? payload.detail
    : 'The environment comparison service returned an unexpected response.'
}

async function readResponse(response: Response): Promise<unknown> {
  let payload: unknown
  try {
    payload = await response.json()
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('The environment comparison service returned unreadable data.')
    }
    throw error
  }
  if (!response.ok) throw new Error(errorMessage(payload))
  return payload
}

function EnvironmentComparison() {
  const [selectedId, setSelectedId] = useState<EnvironmentId | null>(null)
  const [explanation, setExplanation] = useState<EnvironmentExplanation | null>(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const requestController = useRef<AbortController | null>(null)
  const selected = ENVIRONMENTS.find((environment) => environment.id === selectedId)

  useEffect(
    () => () => {
      requestController.current?.abort()
      requestController.current = null
    },
    [],
  )

  async function selectEnvironment(environment: EnvironmentOption) {
    if (
      selectedId === environment.id &&
      (isLoading || explanation !== null)
    ) {
      return
    }

    requestController.current?.abort()
    const controller = new AbortController()
    requestController.current = controller
    setSelectedId(environment.id)
    setExplanation(null)
    setError('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/environment-comparison/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ environment: environment.id }),
        signal: controller.signal,
      })
      const payload = await readResponse(response)
      if (!isEnvironmentExplanation(payload, environment)) {
        throw new Error("I couldn't provide a valid environment safety analysis.")
      }
      if (!controller.signal.aborted) setExplanation(payload)
    } catch (requestError) {
      if (controller.signal.aborted) return
      setError(
        requestError instanceof TypeError
          ? "I couldn't connect to the safety analysis service. Make sure the project API is running."
          : requestError instanceof Error
            ? requestError.message
            : 'The environment safety analysis could not be loaded.',
      )
    } finally {
      if (requestController.current === controller) {
        requestController.current = null
        setIsLoading(false)
      }
    }
  }

  const citations = useMemo<SourceCitation[]>(() => {
    if (!explanation) return []
    return explanation.sources.map((source) => ({
      title: source.title,
      source_type: source.source_type,
      source_url: source.source_url,
      relevance: source.relevance,
    }))
  }, [explanation])

  return (
    <div className="page-content environment-page">
      <section className="page-heading">
        <div>
          <div className="eyebrow">SPACE ENVIRONMENTS <span>04</span></div>
          <h1>Environment comparison</h1>
          <p>
            Choose an environment to see how its gravity and atmosphere can change fire-safety
            concerns.
          </p>
        </div>
        <div className="gravity-readout environment-readout">
          <span className="readout-label">ENVIRONMENTS</span>
          <strong>04</strong>
        </div>
      </section>

      <section className="environment-picker" aria-label="Choose an environment">
        {ENVIRONMENTS.map((environment) => {
          const isSelected = selectedId === environment.id
          return (
            <button
              aria-pressed={isSelected}
              className={`environment-option environment-${environment.id} ${isSelected ? 'is-expanded' : ''}`}
              key={environment.id}
              onClick={() => void selectEnvironment(environment)}
              type="button"
            >
              <span className={`environment-visual environment-visual-${environment.id}`} aria-hidden="true">
                <span />
              </span>
              <span className="environment-option-copy">
                <span className="environment-option-subtitle">{environment.subtitle}</span>
                <strong>{environment.label}</strong>
                <span className="environment-option-gravity">GRAVITY <b>{environment.gravity}</b></span>
                {isSelected && (
                  <span className="environment-expanded-details">
                    <span><b>Setting</b> {environment.setting}</span>
                    <span><b>Atmosphere</b> {environment.atmosphere}</span>
                    <span className="environment-expanded-prompt">
                      Selected — loading NASA-backed fire-safety analysis below.
                    </span>
                  </span>
                )}
              </span>
              <span className="environment-option-arrow" aria-hidden="true">↗</span>
            </button>
          )
        })}
      </section>

      <p className="environment-disclaimer">
        The ISS option means the pressurized cabin. Moon and Mars surface conditions are not the
        same as conditions inside a future habitat. This is educational context, not emergency
        response guidance.
      </p>

      {selected && (
        <section className="environment-analysis" aria-labelledby="environment-analysis-title">
          <div className="environment-analysis-heading">
            <div>
              <span className="card-kicker">MY SAFETY ANALYSIS</span>
              <h2 id="environment-analysis-title">Fire safety in {selected.label}</h2>
            </div>
            {isLoading && <span className="environment-loading-dot" aria-hidden="true" />}
          </div>

          {isLoading ? (
            <p className="environment-message" role="status">
              Reviewing NASA evidence for {selected.label}…
            </p>
          ) : error ? (
            <div className="environment-message environment-error" role="alert">
              <p>{error}</p>
              <button
                className="environment-retry-button"
                onClick={() => void selectEnvironment(selected)}
                type="button"
              >
                Try again
              </button>
            </div>
          ) : explanation ? (
            <>
              <p className="environment-analysis-summary">{explanation.summary}</p>
              <div className="environment-safety-points">
                {explanation.points.map((point) => {
                  const sources = explanation.sources.filter((source) =>
                    point.source_urls.includes(source.source_url),
                  )
                  return (
                    <article className="environment-safety-point" key={point.category}>
                      <span className="environment-point-category">{point.category}</span>
                      <p>{point.fire_safety_effect}</p>
                      <span className={`environment-evidence-status status-${point.evidence_status.toLowerCase().replaceAll(' ', '-')}`}>
                        {point.evidence_status}
                      </span>
                      {sources.length > 0 && (
                        <div className="environment-point-sources">
                          {sources.map((source) => (
                            <a
                              href={source.source_url}
                              key={source.source_url}
                              rel="noreferrer"
                              target="_blank"
                            >
                              {source.title}
                            </a>
                          ))}
                        </div>
                      )}
                    </article>
                  )
                })}
              </div>
              <p className="environment-analysis-note">
                NASA source summaries are separated from cautious habitat extrapolations. No
                operational fire-response procedures are generated.
              </p>
            </>
          ) : null}
        </section>
      )}

      <SourceCitations
        note={
          explanation
            ? `NASA sources used for the ${explanation.label} analysis.`
            : 'Select an environment to view its NASA-backed fire-safety analysis and citations.'
        }
        sources={citations}
      />
    </div>
  )
}

export default EnvironmentComparison
