export interface InvestigationSummary {
  accession: string
  title: string
  acronym: string | null
  research_area: string | null
  subresearch_area: string | null
  project_type: string | null
  flight_platform: string | null
  start_date: string | null
  end_date: string | null
  keywords: string | null
  detail_url: string
  image_url: string | null
}

export interface InvestigationDetail extends InvestigationSummary {
  objective: string | null
  approach: string | null
  hypothesis: string | null
  description: string | null
  research_impact: string | null
  publications: string[]
}

export interface InvestigationExplanation {
  summary: string
  goal: string
  approach: string
  hypothesis: string
}
