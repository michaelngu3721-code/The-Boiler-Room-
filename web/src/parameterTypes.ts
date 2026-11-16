export interface ParameterDataPoint {
  study: string
  soot_value: number | null
  soot_unit: string | null
  temperature_value: number | null
  temperature_unit: string | null
  material: string | null
  gravity_g: number | null
  result: string
  source_url: string
  relevance?: string | null
}

export type ComparisonMeasurement = 'soot' | 'temperature' | 'gravity'
