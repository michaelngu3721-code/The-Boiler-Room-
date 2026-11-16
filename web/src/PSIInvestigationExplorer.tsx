import { useEffect, useMemo, useRef, useState } from 'react'
import SourceCitations from './SourceCitations'
import type { SourceCitation } from './citationData'
import type {
  InvestigationDetail,
  InvestigationExplanation,
  InvestigationSummary,
} from './investigationTypes'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
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

function isInvestigationSummary(value: unknown): value is InvestigationSummary {
  return (
    isRecord(value) &&
    typeof value.accession === 'string' &&
    typeof value.title === 'string' &&
    isNullableString(value.acronym) &&
    isNullableString(value.research_area) &&
    isNullableString(value.subresearch_area) &&
    isNullableString(value.project_type) &&
    isNullableString(value.flight_platform) &&
    isNullableString(value.start_date) &&
    isNullableString(value.end_date) &&
    isNullableString(value.keywords) &&
    isPSIUrl(value.detail_url) &&
    (value.image_url === null || isPSIUrl(value.image_url))
  )
}

function isInvestigationDetail(value: unknown): value is InvestigationDetail {
  return (
    isInvestigationSummary(value) &&
    isRecord(value) &&
    isNullableString(value.objective) &&
    isNullableString(value.approach) &&
    isNullableString(value.hypothesis) &&
    isNullableString(value.description) &&
    isNullableString(value.research_impact) &&
    Array.isArray(value.publications) &&
    value.publications.every((publication) => typeof publication === 'string')
  )
}

function isInvestigationExplanation(value: unknown): value is InvestigationExplanation {
  return (
    isRecord(value) &&
    typeof value.summary === 'string' &&
    typeof value.goal === 'string' &&
    typeof value.approach === 'string' &&
    typeof value.hypothesis === 'string'
  )
}

function apiError(payload: unknown) {
  return isRecord(payload) && typeof payload.detail === 'string'
    ? payload.detail
    : 'The investigation service returned an unexpected response.'
}

async function readResponse(response: Response): Promise<unknown> {
  let payload: unknown
  try {
    payload = await response.json()
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('The investigation service returned unreadable data.')
    }
    throw error
  }
  if (!response.ok) throw new Error(apiError(payload))
  return payload
}

function displayOrMissing(value: string | null) {
  return value?.trim() || 'Not provided in the PSI record.'
}

function PSIInvestigationExplorer() {
  const [investigations, setInvestigations] = useState<InvestigationSummary[]>([])
  const [selectedAccession, setSelectedAccession] = useState('')
  const [detail, setDetail] = useState<InvestigationDetail | null>(null)
  const [search, setSearch] = useState('')
  const [listError, setListError] = useState('')
  const [detailError, setDetailError] = useState('')
  const [explanationError, setExplanationError] = useState('')
  const [explanation, setExplanation] = useState<InvestigationExplanation | null>(null)
  const [isLoadingList, setIsLoadingList] = useState(true)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [isExplaining, setIsExplaining] = useState(false)
  const [imageUnavailable, setImageUnavailable] = useState(false)
  const [listRetry, setListRetry] = useState(0)
  const [detailRetry, setDetailRetry] = useState(0)
  const explanationController = useRef<AbortController | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setIsLoadingList(true)
    setListError('')

    async function loadInvestigations() {
      try {
        const response = await fetch('/api/investigations', { signal: controller.signal })
        const payload = await readResponse(response)
        if (!Array.isArray(payload) || !payload.every(isInvestigationSummary)) {
          throw new Error('The investigation service returned invalid PSI records.')
        }
        setInvestigations(payload)
        setSelectedAccession((current) =>
          payload.some((item) => item.accession === current)
            ? current
            : payload[0]?.accession ?? '',
        )
      } catch (error) {
        if (controller.signal.aborted) return
        setListError(
          error instanceof TypeError
            ? 'Could not connect to NASA PSI. Check the connection and try again.'
            : error instanceof Error
              ? error.message
              : 'The investigation list could not be loaded.',
        )
      } finally {
        if (!controller.signal.aborted) setIsLoadingList(false)
      }
    }

    void loadInvestigations()
    return () => controller.abort()
  }, [listRetry])

  useEffect(() => {
    if (!selectedAccession) {
      setDetail(null)
      setIsLoadingDetail(false)
      return
    }

    const controller = new AbortController()
    explanationController.current?.abort()
    explanationController.current = null
    setDetail(null)
    setDetailError('')
    setExplanation(null)
    setExplanationError('')
    setIsExplaining(false)
    setImageUnavailable(false)
    setIsLoadingDetail(true)

    async function loadDetail() {
      try {
        const response = await fetch(
          `/api/investigations/${encodeURIComponent(selectedAccession)}`,
          { signal: controller.signal },
        )
        const payload = await readResponse(response)
        if (!isInvestigationDetail(payload) || payload.accession !== selectedAccession) {
          throw new Error('The selected investigation details are incomplete.')
        }
        setDetail(payload)
      } catch (error) {
        if (controller.signal.aborted) return
        setDetailError(
          error instanceof TypeError
            ? 'Could not connect to NASA PSI. Check the connection and try again.'
            : error instanceof Error
              ? error.message
              : 'The selected investigation could not be loaded.',
        )
      } finally {
        if (!controller.signal.aborted) setIsLoadingDetail(false)
      }
    }

    void loadDetail()
    return () => {
      controller.abort()
      explanationController.current?.abort()
    }
  }, [selectedAccession, detailRetry])

  const visibleInvestigations = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return investigations

    return investigations.filter((item) =>
      [
        item.accession,
        item.title,
        item.acronym,
        item.research_area,
        item.subresearch_area,
        item.project_type,
        item.flight_platform,
        item.keywords,
      ]
        .filter((value): value is string => Boolean(value))
        .join(' ')
        .toLowerCase()
        .includes(query),
    )
  }, [investigations, search])

  const citations = useMemo<SourceCitation[]>(() => {
    if (!detail) return []
    return [
      {
        title: `NASA PSI: ${detail.title}`,
        source_type: 'PSI investigation',
        source_url: detail.detail_url,
        relevance: 'The NASA PSI record provides this investigation’s official goals, methods, hypothesis, and background information.',
      },
    ]
  }, [detail])

  async function explainSelectedInvestigation() {
    if (!detail) return

    setExplanation(null)
    setExplanationError('')
    setIsExplaining(true)
    const controller = new AbortController()
    explanationController.current?.abort()
    explanationController.current = controller
    try {
      const response = await fetch(
        `/api/investigations/${encodeURIComponent(detail.accession)}/explain`,
        { method: 'POST', signal: controller.signal },
      )
      const payload = await readResponse(response)
      if (!isInvestigationExplanation(payload)) {
        throw new Error('The agent returned an incomplete explanation.')
      }
      setExplanation(payload)
    } catch (error) {
      if (controller.signal.aborted) return
      setExplanationError(
        error instanceof TypeError
          ? 'Could not reach the explanation service. Make sure the project API is running.'
          : error instanceof Error
            ? error.message
            : 'The agent could not explain this investigation.',
      )
    } finally {
      if (explanationController.current === controller) {
        explanationController.current = null
        setIsExplaining(false)
      }
    }
  }

  function chooseInvestigation(accession: string) {
    if (accession === selectedAccession) return
    explanationController.current?.abort()
    explanationController.current = null
    setIsExplaining(false)
    setSelectedAccession(accession)
  }

  return (
    <div className="page-content psi-investigation-page">
      <section className="page-heading">
        <div>
          <div className="eyebrow">NASA PHYSICAL SCIENCES INFORMATICS <span>02</span></div>
          <h1>Combustion investigations</h1>
          <p>Choose a study to learn its goal, methods, hypothesis, and what the researchers reported.</p>
        </div>
        <div className="gravity-readout investigation-count">
          <span className="readout-label">INVESTIGATIONS</span>
          <strong>{isLoadingList ? 'Loading…' : investigations.length}</strong>
        </div>
      </section>

      <section className="investigation-explorer-layout" aria-label="NASA PSI investigations">
        <aside className="investigation-list-card">
          <div className="investigation-list-heading">
            <span className="card-kicker">NASA PSI DATABASE</span>
            <h2>Choose an investigation</h2>
            <p>All combustion investigations found in the NASA PSI database are listed here.</p>
          </div>

          <label className="investigation-search">
            <span>Search by name, number, or topic</span>
            <input
              aria-label="Search PSI investigations"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="For example, soot or PSI-22"
              type="search"
              value={search}
            />
          </label>

          <div className="investigation-list-count" aria-live="polite">
            {isLoadingList
              ? 'Loading investigations…'
              : `${visibleInvestigations.length} of ${investigations.length} investigations`}
          </div>

          {isLoadingList ? (
            <div className="investigation-list-message">Connecting to NASA PSI…</div>
          ) : listError ? (
            <div className="investigation-list-message investigation-error" role="alert">
              <p>{listError}</p>
              <button onClick={() => setListRetry((value) => value + 1)} type="button">
                Try again
              </button>
            </div>
          ) : visibleInvestigations.length === 0 ? (
            <div className="investigation-list-message">
              {investigations.length
                ? 'No investigations match that search. Try another word or number.'
                : 'No combustion investigations were returned by NASA PSI.'}
            </div>
          ) : (
            <ul className="investigation-list">
              {visibleInvestigations.map((item) => (
                <li key={item.accession}>
                  <button
                    aria-current={selectedAccession === item.accession ? 'true' : undefined}
                    className={`investigation-list-item ${selectedAccession === item.accession ? 'is-selected' : ''}`}
                    onClick={() => chooseInvestigation(item.accession)}
                    type="button"
                  >
                    <span className="investigation-list-accession">{item.accession}</span>
                    <strong>{item.title}</strong>
                    {item.acronym && <small>{item.acronym}</small>}
                    <span className="investigation-list-area">
                      {item.subresearch_area || item.research_area || 'Combustion research'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <main className="investigation-detail-panel" aria-label="Selected investigation details">
          {isLoadingDetail ? (
            <div className="investigation-detail-message">Loading this investigation…</div>
          ) : detailError ? (
            <div className="investigation-detail-message investigation-error" role="alert">
              <p>{detailError}</p>
              <button onClick={() => setDetailRetry((value) => value + 1)} type="button">
                Try again
              </button>
            </div>
          ) : detail ? (
            <>
              <article className="investigation-record">
                <div className="investigation-hero">
                  {detail.image_url && !imageUnavailable ? (
                    <img
                      alt={`NASA PSI image for ${detail.title}`}
                      onError={() => setImageUnavailable(true)}
                      src={detail.image_url}
                    />
                  ) : (
                    <div className="investigation-hero-placeholder" aria-hidden="true">
                      <span>PSI</span>
                      <strong>Combustion research</strong>
                    </div>
                  )}
                  <div className="investigation-hero-shade" />
                  <div className="investigation-hero-copy">
                    <span>{detail.accession}{detail.acronym ? ` · ${detail.acronym}` : ''}</span>
                    <h2>{detail.title}</h2>
                    <a href={detail.detail_url} rel="noopener noreferrer" target="_blank">
                      View the original NASA PSI record <span aria-hidden="true">↗</span>
                    </a>
                  </div>
                </div>

                <div className="investigation-meta-grid">
                  <div>
                    <span>Research area</span>
                    <strong>{displayOrMissing(detail.research_area)}</strong>
                  </div>
                  <div>
                    <span>Platform</span>
                    <strong>{displayOrMissing(detail.flight_platform)}</strong>
                  </div>
                  <div>
                    <span>Project type</span>
                    <strong>{displayOrMissing(detail.project_type)}</strong>
                  </div>
                  <div>
                    <span>Dates</span>
                    <strong>
                      {detail.start_date || detail.end_date
                        ? [detail.start_date, detail.end_date].filter(Boolean).join(' – ')
                        : 'Not provided in the PSI record.'}
                    </strong>
                  </div>
                </div>

                <p className="investigation-consistency-note">
                  Every investigation uses the same sections below. If NASA PSI does not list a
                  detail, it is marked as not provided.
                </p>

                <div className="investigation-fields">
                  <section>
                    <span>GOAL</span>
                    <h3>What were they trying to learn?</h3>
                    <p>{displayOrMissing(detail.objective)}</p>
                  </section>
                  <section>
                    <span>METHOD</span>
                    <h3>How did they study it?</h3>
                    <p>{displayOrMissing(detail.approach)}</p>
                  </section>
                  <section>
                    <span>HYPOTHESIS</span>
                    <h3>What did they expect?</h3>
                    <p>{displayOrMissing(detail.hypothesis)}</p>
                  </section>
                  <section>
                    <span>BACKGROUND</span>
                    <h3>Additional information</h3>
                    <p>{displayOrMissing(detail.description)}</p>
                  </section>
                  <section>
                    <span>RESEARCH IMPACT</span>
                    <h3>Why might this work matter?</h3>
                    <p>{displayOrMissing(detail.research_impact)}</p>
                  </section>
                </div>

                {detail.publications.length > 0 && (
                  <section className="investigation-publications">
                    <h3>Related publications</h3>
                    <ul>
                      {detail.publications.slice(0, 5).map((publication) => (
                        <li key={publication}>{publication}</li>
                      ))}
                    </ul>
                  </section>
                )}
              </article>

              <section className="investigation-agent-card" aria-label="Agent explanation">
                <div className="investigation-agent-heading">
                  <div>
                    <span className="card-kicker">OPTIONAL AI GUIDE</span>
                    <h2>Explain this investigation simply</h2>
                    <p>
                      The agent will restate the PSI record's goal, method, and hypothesis in
                      everyday language.
                    </p>
                  </div>
                  <button
                    disabled={isExplaining}
                    onClick={explainSelectedInvestigation}
                    type="button"
                  >
                    {isExplaining ? 'Preparing explanation…' : 'Ask the agent'}
                  </button>
                </div>
                <small className="investigation-agent-cost">
                  Only runs when you click. Requires an OpenAI API key and may incur usage charges.
                </small>
                {explanationError && (
                  <p className="investigation-error" role="alert">{explanationError}</p>
                )}
                {explanation && (
                  <div className="investigation-explanation" aria-live="polite">
                    <p>{explanation.summary}</p>
                    <div>
                      <strong>Goal</strong>
                      <p>{explanation.goal}</p>
                    </div>
                    <div>
                      <strong>Method</strong>
                      <p>{explanation.approach}</p>
                    </div>
                    <div>
                      <strong>Hypothesis</strong>
                      <p>{explanation.hypothesis}</p>
                    </div>
                  </div>
                )}
              </section>
            </>
          ) : (
            <div className="investigation-detail-message">
              <h2>Choose an investigation to get started</h2>
              <p>Select any item in the list to see what the researchers planned and what they expected.</p>
            </div>
          )}
        </main>
      </section>

      <SourceCitations
        note="Investigation information is retrieved from the selected NASA PSI record. The original source is linked above."
        sources={citations}
      />
    </div>
  )
}

export default PSIInvestigationExplorer
