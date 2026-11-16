import type { SourceCitation } from './citationData'

interface SourceCitationsProps {
  note: string
  sources: SourceCitation[]
}

function SourceCitations({ note, sources }: SourceCitationsProps) {
  return (
    <details className="source-citations" aria-label="Sources and citations">
      <summary className="source-citations-summary">
        <span className="source-citations-heading">
          <span className="eyebrow">PROVENANCE</span>
          <strong>Sources &amp; citations</strong>
        </span>
        {sources.length > 0 && (
          <span className="source-citations-summary-meta">
            {sources.length === 1 ? '1 SOURCE' : `${sources.length} SOURCES`}
          </span>
        )}
        <span className="source-citations-chevron" aria-hidden="true">⌄</span>
      </summary>

      <div className="source-citations-content">
        {sources.length > 0 ? (
          <ul className="source-citation-list">
            {sources.map((source) => (
              <li className="source-citation-item" key={source.source_url}>
                <span className="source-citation-type">{source.source_type}</span>
                <div className="source-citation-main">
                  <strong>{source.title}</strong>
                  <p>{source.relevance}</p>
                  <a href={source.source_url} rel="noopener noreferrer" target="_blank">
                    Open original source
                    <span aria-hidden="true">↗</span>
                  </a>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="source-citations-empty">No citations are available for this section.</p>
        )}

        <p className="source-citations-note">{note}</p>
      </div>
    </details>
  )
}

export default SourceCitations
