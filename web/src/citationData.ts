export interface SourceCitation {
  title: string
  source_type: string
  source_url: string
  relevance: string
}

export const gravityLabSources: SourceCitation[] = [
  {
    title: 'Combustion Science',
    source_type: 'NASA context',
    source_url:
      'https://www.nasa.gov/glenn/glenn-expertise-space-exploration/physical-sciences-program/combustion-science/',
    relevance:
      'Explains how gravity-driven buoyancy can dominate flames and how removing gravity suppresses it. This is background context, not a source for the slider’s exact shapes.',
  },
  {
    title: 'A Researcher’s Guide to: Combustion Science',
    source_type: 'NASA context',
    source_url:
      'https://www.nasa.gov/missions/station/a-researchers-guide-to-combustion-science/',
    relevance:
      'Describes reduced-gravity combustion research and buoyancy suppression. It does not provide calibrated flame geometry for this illustration.',
  },
]
