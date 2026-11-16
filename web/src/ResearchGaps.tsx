import { useEffect, useMemo, useRef, useState } from 'react'
import SourceCitations from './SourceCitations'
import type { SourceCitation } from './citationData'

type EvidenceStatus =
  | 'Coverage observation in this PSI sample'
  | 'Explicit limitation stated by a PSI record'

interface ResearchGap {
  gap: string
  why_it_matters: string
  evidence_basis: string
  research_question: string
  evidence_status: EvidenceStatus
  source_urls: string[]
}

interface ResearchGapSource {
  title: string
  accession: string
  source_url: string
}

interface ResearchGapsResponse {
  sample_size: number
  analyzed_study_count: number
  gaps: ResearchGap[]
  sources: ResearchGapSource[]
}

const EVIDENCE_STATUSES: EvidenceStatus[] = [
  'Coverage observation in this PSI sample',
  'Explicit limitation stated by a PSI record',
]

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

function isResearchGap(value: unknown): value is ResearchGap {
  return (
    isRecord(value) &&
    typeof value.gap === 'string' &&
    value.gap.trim().length > 0 &&
    typeof value.why_it_matters === 'string' &&
    value.why_it_matters.trim().length > 0 &&
    typeof value.evidence_basis === 'string' &&
    value.evidence_basis.trim().length > 0 &&
    typeof value.research_question === 'string' &&
    value.research_question.trim().length > 0 &&
    typeof value.evidence_status === 'string' &&
    EVIDENCE_STATUSES.some((status) => status === value.evidence_status) &&
    Array.isArray(value.source_urls) &&
    value.source_urls.length > 0 &&
    value.source_urls.every(isPSIUrl)
  )
}

function isResearchGapSource(value: unknown): value is ResearchGapSource {
  return (
    isRecord(value) &&
    typeof value.title === 'string' &&
    value.title.trim().length > 0 &&
    typeof value.accession === 'string' &&
    value.accession.trim().length > 0 &&
    isPSIUrl(value.source_url)
  )
}

function isResearchGapsResponse(value: unknown): value is ResearchGapsResponse {
  if (
    !isRecord(value) ||
    typeof value.sample_size !== 'number' ||
    !Number.isInteger(value.sample_size) ||
    value.sample_size < 0 ||
    typeof value.analyzed_study_count !== 'number' ||
    !Number.isInteger(value.analyzed_study_count) ||
    value.analyzed_study_count < 0 ||
    value.analyzed_study_count > value.sample_size ||
    !Array.isArray(value.gaps) ||
    value.gaps.length !== 3 ||
    !value.gaps.every(isResearchGap) ||
    !Array.isArray(value.sources) ||
    value.sources.length === 0 ||
    !value.sources.every(isResearchGapSource)
  ) {
    return false
  }

  const allowedSources = new Set(value.sources.map((source) => source.source_url))
  return value.gaps.every((gap) =>
    gap.source_urls.every((sourceUrl) => allowedSources.has(sourceUrl)),
  )
}

function errorMessage(payload: unknown) {
  return isRecord(payload) && typeof payload.detail === 'string'
    ? payload.detail
    : 'The research-gap service returned an unexpected response.'
}

async function readResponse(response: Response): Promise<unknown> {
  let payload: unknown
  try {
    payload = await response.json()
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('The research-gap service returned unreadable data.')
    }
    throw error
  }
  if (!response.ok) throw new Error(errorMessage(payload))
  return payload
}

function ResearchGaps() {
  const [results, setResults] = useState<ResearchGapsResponse | null>(null)
  const [error, setError] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const requestController = useRef<AbortController | null>(null)

  useEffect(
    () => () => {
      requestController.current?.abort()
      requestController.current = null
    },
    [],
  )

  async function analyzeSample() {
    requestController.current?.abort()
    const controller = new AbortController()
    requestController.current = controller
    setResults(null)
    setError('')
    setIsAnalyzing(true)

    try {
      const response = await fetch('/api/research-gaps/analyze', {
        method: 'POST',
        signal: controller.signal,
      })
      const payload = await readResponse(response)
      if (!isResearchGapsResponse(payload)) {
        throw new Error('The agent returned invalid or unsupported research-gap data.')
      }
      if (!controller.signal.aborted) setResults(payload)
    } catch (requestError) {
      if (controller.signal.aborted) return
      setError(
        requestError instanceof TypeError
          ? 'Could not connect to the PSI analysis service. Check that the local API is running.'
          : requestError instanceof Error
            ? requestError.message
            : 'The PSI research sample could not be analyzed.',
      )
    } finally {
      if (requestController.current === controller) {
        requestController.current = null
        setIsAnalyzing(false)
      }
    }
  }

  const citations = useMemo<SourceCitation[]>(() => {
    if (!results) return []
    return results.sources.map((source) => ({
      title: source.title,
      source_type: 'NASA PSI investigation',
      source_url: source.source_url,
      relevance: `This record was cited in the analysis of potential gaps in the PSI combustion search sample (${source.accession}).`,
    }))
  }, [results])

  const sourcesByUrl = new Map(
    (results?.sources ?? []).map(
      (source): [string, ResearchGapSource] => [source.source_url, source],
    ),
  )

  return (
    <div className="page-content research-gaps-page">
      <section className="page-heading">
        <div>
          <div className="eyebrow">NASA PSI STUDY OVERVIEW <span>06</span></div>
          <h1>Research gaps</h1>
          <p>
            Explore research opportunities that may be underrepresented in the NASA PSI
            combustion records reviewed.
          </p>
        </div>
        <div className="gravity-readout research-gaps-readout">
          <span className="readout-label">STUDIES ANALYZED</span>
          <strong>{results ? results.analyzed_study_count : '—'}</strong>
        </div>
      </section>

      <section className="research-gaps-overview" aria-labelledby="research-gaps-overview-title">
        <div>
          <span className="card-kicker">POTENTIAL RESEARCH OPPORTUNITIES</span>
          <h2 id="research-gaps-overview-title">What might be worth studying next?</h2>
          <p>
            The agent compares goals, methods, conditions, and limitations described in the
            available PSI records, then suggests three questions for further investigation.
          </p>
        </div>
        <button
          className="research-gaps-button"
          disabled={isAnalyzing}
          onClick={() => void analyzeSample()}
          type="button"
        >
          {isAnalyzing ? 'Reviewing PSI records…' : results ? 'Analyze again' : 'Analyze PSI records'}
        </button>
      </section>

      <p className="research-gaps-disclaimer">
        Analysis runs only when requested, requires an OpenAI API key, and may incur API charges.
        These are hypotheses about the records returned by the PSI combustion search—not proof
        that a topic is missing from the wider research literature or a substitute for expert review.
      </p>

      {isAnalyzing && (
        <p className="research-gaps-message" role="status">
          Comparing NASA PSI study records and checking their cited evidence…
        </p>
      )}
      {error && (
        <div className="research-gaps-message research-gaps-error" role="alert">
          <p>{error}</p>
          <button
            className="research-gaps-retry"
            onClick={() => void analyzeSample()}
            type="button"
          >
            Try again
          </button>
        </div>
      )}

      {results && (
        <section className="research-gaps-results" aria-labelledby="research-gaps-results-title">
          <div className="research-gaps-results-heading">
            <div>
              <span className="card-kicker">SAMPLE-BASED ANALYSIS</span>
              <h2 id="research-gaps-results-title">Three directions to explore</h2>
            </div>
            <span className="research-gaps-sample">
              {results.analyzed_study_count} of {results.sample_size} PSI records reviewed
            </span>
          </div>

          <div className="research-gaps-list">
            {results.gaps.map((gap, index) => (
              <article className="research-gap-card" key={`${gap.gap}-${index}`}>
                <div className="research-gap-card-heading">
                  <span className="research-gap-number">OPPORTUNITY {String(index + 1).padStart(2, '0')}</span>
                  <span
                    className={`research-gap-status ${gap.evidence_status === 'Explicit limitation stated by a PSI record' ? 'is-explicit' : ''}`}
                  >
                    {gap.evidence_status}
                  </span>
                </div>
                <h3>{gap.gap}</h3>
                <dl>
                  <div>
                    <dt>Why it may matter</dt>
                    <dd>{gap.why_it_matters}</dd>
                  </div>
                  <div>
                    <dt>What the records show</dt>
                    <dd>{gap.evidence_basis}</dd>
                  </div>
                  <div className="research-gap-question">
                    <dt>Question to investigate</dt>
                    <dd>{gap.research_question}</dd>
                  </div>
                </dl>
                <div className="research-gap-sources">
                  <span>RELATED PSI RECORDS</span>
                  {gap.source_urls.map((sourceUrl) => {
                    const source = sourcesByUrl.get(sourceUrl)
                    return (
                      <a
                        href={sourceUrl}
                        key={sourceUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {source?.title ?? 'Open NASA PSI record'}
                      </a>
                    )
                  })}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <SourceCitations
        note={
          results
            ? 'These NASA PSI records were cited as evidence for the potential research opportunities above.'
            : 'Cited NASA PSI records will appear here after the sample has been analyzed.'
        }
        sources={citations}
      />
    </div>
  )
}

export default ResearchGaps
