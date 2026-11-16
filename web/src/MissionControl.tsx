import { useMemo, useState, type CSSProperties } from 'react'
import SourceCitations from './SourceCitations'
import type { SourceCitation } from './citationData'

type MaterialType = 'wood-paper' | 'fabric' | 'polymer' | 'non-combustible' | 'unknown'
type FuelGeometry = 'sheet' | 'thick-solid' | 'rod-cylinder' | 'other'
type FuelAmount = 'small' | 'medium' | 'large'
type AirflowDirection = 'with' | 'against' | 'cross' | 'unspecified'
type SmokeObservation = 'not-measured' | 'none' | 'visible' | 'dense'

interface MissionInputs {
  gravity: number
  oxygenPercent: number
  temperatureC: number
  pressureKpa: number
  airflowMps: number
  airflowDirection: AirflowDirection
  material: MaterialType
  geometry: FuelGeometry
  fuelAmount: FuelAmount
  ignitionPresent: boolean
  smokeObservation: SmokeObservation
}

interface MissionAssessment {
  shapeLabel: string
  shapeDescription: string
  shapeClass: string
  riskFactors: string[]
  spreadFactors: string[]
  smokeDescription: string
  mitigationActions: string[]
}

const INITIAL_INPUTS: MissionInputs = {
  gravity: 1,
  oxygenPercent: 20.9,
  temperatureC: 22,
  pressureKpa: 101,
  airflowMps: 0.1,
  airflowDirection: 'unspecified',
  material: 'fabric',
  geometry: 'sheet',
  fuelAmount: 'medium',
  ignitionPresent: false,
  smokeObservation: 'not-measured',
}

const missionSources: SourceCitation[] = [
  {
    title: 'Burning and Suppression of Solids - II (NASA PSI-25)',
    source_type: 'NASA PSI investigation',
    source_url: 'https://psi.nasa.gov/physci/repo/data/investigations/PSI-25',
    relevance:
      'NASA describes testing flame growth and spread while varying airflow speed and direction, oxygen concentration, and solid-fuel geometry. It supports the choice of inputs, not a universal prediction from them.',
  },
  {
    title: 'Combustion Science',
    source_type: 'NASA research context',
    source_url:
      'https://www.nasa.gov/glenn/glenn-expertise-space-exploration/physical-sciences-program/combustion-science/',
    relevance:
      'NASA explains how gravity-driven buoyancy shapes flames and why quantitative combustion behavior is complex. It also summarizes NASA spacecraft material flammability research.',
  },
  {
    title: 'A Researcher’s Guide to: Combustion Science',
    source_type: 'NASA research guide',
    source_url:
      'https://www.nasa.gov/missions/station/a-researchers-guide-to-combustion-science/',
    relevance:
      'Provides NASA context for studying combustion and fire safety in reduced gravity; it does not supply a validated prediction formula for this interactive tool.',
  },
]

function assessScenario(inputs: MissionInputs): MissionAssessment {
  const combustible = ['wood-paper', 'fabric', 'polymer'].includes(inputs.material)
  let shapeLabel = 'Not estimated'
  let shapeDescription = 'The selected material category is outside this flame-shape illustration.'
  let shapeClass = 'mission-shape-unavailable'

  if (inputs.material === 'unknown') {
    shapeDescription = 'The material is unknown, so a flame-shape cue cannot be selected.'
  } else if (combustible && inputs.gravity < 0.05) {
    shapeLabel = 'Rounded, low-buoyancy cue'
    shapeDescription =
      'At very low gravity, buoyancy-driven upward motion is reduced. NASA research describes more rounded flames in microgravity.'
    shapeClass = 'mission-shape-rounded'
  } else if (combustible && inputs.airflowMps > 0.15) {
    shapeLabel = 'Flow-influenced cue'
    shapeDescription =
      'The selected airflow can influence flame shape and spread. Its effect depends on direction, fuel geometry, and test conditions.'
    shapeClass = 'mission-shape-flow'
  } else if (combustible) {
    shapeLabel = 'Upward, buoyant cue'
    shapeDescription =
      'In ordinary gravity, hot gases tend to rise and can tilt a flame upward. This drawing is not a geometric prediction.'
    shapeClass = 'mission-shape-buoyant'
  }

  const riskFactors: string[] = []
  if (inputs.material === 'unknown') {
    riskFactors.push('The material is unknown; its flammability cannot be inferred.')
  } else if (combustible) {
    riskFactors.push('A potentially combustible material is selected.')
  } else {
    riskFactors.push('A non-combustible category is selected; coatings and contaminants are not assessed.')
  }
  if (inputs.ignitionPresent) riskFactors.push('An ignition source is selected.')
  if (inputs.oxygenPercent > 20.9) {
    riskFactors.push('Oxygen is above the 20.9% reference value for air.')
  }
  if (inputs.temperatureC > 22) {
    riskFactors.push('The selected temperature is above the 22°C starting reference.')
  }
  if (inputs.fuelAmount === 'large') {
    riskFactors.push('A larger relative amount of fuel is selected.')
  }
  if (inputs.airflowMps > 0.15) {
    riskFactors.push('Forced airflow is selected; its direction can affect flame spread.')
  }
  if (riskFactors.length === 0) {
    riskFactors.push('No additional factors are flagged by this simple display.')
  }

  const spreadFactors = [
    `Airflow: ${inputs.airflowMps.toFixed(2)} m/s, ${formatAirflowDirection(inputs.airflowDirection)}.`,
    `Oxygen: ${inputs.oxygenPercent.toFixed(1)}%.`,
    `Fuel geometry: ${formatGeometry(inputs.geometry)}.`,
    `Gravity: ${inputs.gravity.toFixed(2)} g.`,
    `Temperature and pressure are recorded (${inputs.temperatureC}°C, ${inputs.pressureKpa} kPa), not converted to a spread rate.`,
  ]

  let smokeDescription =
    'Smoke amount and composition cannot be estimated from this generic material selection.'
  if (inputs.material === 'wood-paper' || inputs.material === 'fabric') {
    smokeDescription =
      'NASA notes that many hydrocarbon fuels can produce soot. The amount depends on the exact material and burn conditions; it is not estimated here.'
  } else if (inputs.material === 'polymer') {
    smokeDescription =
      'NASA notes that plastics can produce recondensed polymer fragments as aerosols. The amount and composition depend on the exact polymer and conditions.'
  } else if (inputs.material === 'non-combustible') {
    smokeDescription =
      'No fuel-derived smoke is modeled for this selection. Coatings, dust, or nearby materials are not accounted for.'
  }
  if (inputs.smokeObservation !== 'not-measured') {
    smokeDescription += ` Current user observation: ${formatSmokeObservation(inputs.smokeObservation)}.`
  }

  const mitigationActions = [
    'Use material-specific flammability test results and qualified fire-safety review for real designs.',
    'Keep combustible materials away from ignition sources and follow the facility’s approved fire procedures.',
    'Do not change oxygen levels or ventilation based on this display; use only approved controls.',
  ]
  if (inputs.oxygenPercent > 20.9) {
    mitigationActions.unshift(
      'Treat oxygen above ordinary-air levels as a specialist condition; do not introduce or adjust oxygen outside approved procedures.',
    )
  }
  if (inputs.smokeObservation === 'dense') {
    mitigationActions.unshift(
      'Dense smoke may indicate an active hazard: follow the local alarm and emergency-response procedure.',
    )
  }

  return {
    shapeLabel,
    shapeDescription,
    shapeClass,
    riskFactors,
    spreadFactors,
    smokeDescription,
    mitigationActions,
  }
}

function formatAirflowDirection(direction: AirflowDirection) {
  switch (direction) {
    case 'with':
      return 'with the selected spread direction'
    case 'against':
      return 'against the selected spread direction'
    case 'cross':
      return 'across the selected spread direction'
    default:
      return 'direction not specified'
  }
}

function isAirflowDirection(value: string): value is AirflowDirection {
  return value === 'with' || value === 'against' || value === 'cross' || value === 'unspecified'
}

function isMaterialType(value: string): value is MaterialType {
  return (
    value === 'wood-paper' ||
    value === 'fabric' ||
    value === 'polymer' ||
    value === 'non-combustible' ||
    value === 'unknown'
  )
}

function isFuelGeometry(value: string): value is FuelGeometry {
  return value === 'sheet' || value === 'thick-solid' || value === 'rod-cylinder' || value === 'other'
}

function isFuelAmount(value: string): value is FuelAmount {
  return value === 'small' || value === 'medium' || value === 'large'
}

function isSmokeObservation(value: string): value is SmokeObservation {
  return value === 'not-measured' || value === 'none' || value === 'visible' || value === 'dense'
}

function formatGeometry(geometry: FuelGeometry) {
  switch (geometry) {
    case 'sheet':
      return 'sheet or fabric'
    case 'thick-solid':
      return 'thick solid'
    case 'rod-cylinder':
      return 'rod or cylinder'
    default:
      return 'other or unknown'
  }
}

function formatSmokeObservation(observation: SmokeObservation) {
  switch (observation) {
    case 'none':
      return 'no visible soot/smoke'
    case 'visible':
      return 'visible soot/smoke'
    case 'dense':
      return 'dense soot/smoke'
    default:
      return 'not measured'
  }
}

function RangeControl({
  id,
  label,
  min,
  max,
  step,
  value,
  unit,
  help,
  onChange,
}: {
  id: string
  label: string
  min: number
  max: number
  step: number
  value: number
  unit: string
  help: string
  onChange: (value: number) => void
}) {
  const progress = ((value - min) / (max - min)) * 100

  return (
    <label className="mission-range-control" htmlFor={id}>
      <span className="mission-control-label">
        <span>{label}</span>
        <strong>{value}{unit}</strong>
      </span>
      <input
        id={id}
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.target.value))}
        step={step}
        style={{ '--slider-progress': `${progress}%` } as CSSProperties}
        type="range"
        value={value}
      />
      <small>{help}</small>
    </label>
  )
}

function MissionControl() {
  const [inputs, setInputs] = useState(INITIAL_INPUTS)
  const assessment = useMemo(() => assessScenario(inputs), [inputs])

  function update<K extends keyof MissionInputs>(key: K, value: MissionInputs[K]) {
    setInputs((current) => ({ ...current, [key]: value }))
  }

  return (
    <div className="page-content mission-control-page">
      <section className="page-heading">
        <div>
          <div className="eyebrow">INTERACTIVE WHAT-IF EXPLORER <span>05</span></div>
          <h1>Mission Control</h1>
          <p>Explore how fire-research conditions relate to flame behavior and fire-safety concerns.</p>
        </div>
        <div className="gravity-readout mission-live-readout">
          <span className="readout-label">SCENARIO</span>
          <strong>What-if</strong>
        </div>
      </section>

      <div className="mission-safety-note" role="note">
        <strong>Educational model — not a fire-risk assessment.</strong>
        <span>
          No validated spread rate, flammability probability, or smoke quantity is calculated.
          For a real fire or safety decision, follow approved emergency procedures and qualified
          engineering guidance.
        </span>
      </div>

      <div className="mission-layout">
        <section className="mission-input-card" aria-label="Scenario inputs">
          <div className="mission-card-heading">
            <span className="card-kicker">SET THE SCENARIO</span>
            <h2>What conditions should we explore?</h2>
            <p>Change any input; the guide updates immediately.</p>
          </div>

          <div className="mission-input-group">
            <h3>Air and surroundings</h3>
            <RangeControl
              help="NASA studies compare ordinary gravity with reduced gravity."
              id="mission-gravity"
              label="Gravity"
              max={1}
              min={0}
              onChange={(value) => update('gravity', value)}
              step={0.01}
              unit=" g"
              value={inputs.gravity}
            />
            <RangeControl
              help="20.9% is the reference value for ordinary air; this is not a safe/unsafe threshold."
              id="mission-oxygen"
              label="Oxygen concentration"
              max={30}
              min={10}
              onChange={(value) => update('oxygenPercent', value)}
              step={0.1}
              unit="%"
              value={inputs.oxygenPercent}
            />
            <RangeControl
              help="Ambient temperature can affect ignition and burning; material-specific data is needed."
              id="mission-temperature"
              label="Air temperature"
              max={100}
              min={0}
              onChange={(value) => update('temperatureC', value)}
              step={1}
              unit="°C"
              value={inputs.temperatureC}
            />
            <RangeControl
              help="Pressure is recorded because PSI compares it as a controlled condition."
              id="mission-pressure"
              label="Pressure"
              max={120}
              min={70}
              onChange={(value) => update('pressureKpa', value)}
              step={1}
              unit=" kPa"
              value={inputs.pressureKpa}
            />
            <RangeControl
              help="NASA BASS-II reports controlled tests with airflow up to 0.4 m/s."
              id="mission-airflow"
              label="Airflow velocity"
              max={0.4}
              min={0}
              onChange={(value) => update('airflowMps', value)}
              step={0.01}
              unit=" m/s"
              value={inputs.airflowMps}
            />
            <label className="mission-select-control" htmlFor="mission-airflow-direction">
              <span>Airflow direction</span>
              <select
                id="mission-airflow-direction"
                onChange={(event) =>
                  isAirflowDirection(event.target.value) &&
                  update('airflowDirection', event.target.value)
                }
                value={inputs.airflowDirection}
              >
                <option value="unspecified">Not specified</option>
                <option value="with">With the spread direction</option>
                <option value="against">Against the spread direction</option>
                <option value="cross">Across the spread direction</option>
              </select>
              <small>Direction matters, so PSI tests it separately from speed.</small>
            </label>
          </div>

          <div className="mission-input-group">
            <h3>Fuel and ignition</h3>
            <label className="mission-select-control" htmlFor="mission-material">
              <span>Material type</span>
              <select
                id="mission-material"
                onChange={(event) =>
                  isMaterialType(event.target.value) && update('material', event.target.value)
                }
                value={inputs.material}
              >
                <option value="fabric">Fabric</option>
                <option value="wood-paper">Wood or paper</option>
                <option value="polymer">Plastic or polymer</option>
                <option value="non-combustible">Non-combustible material</option>
                <option value="unknown">Unknown / other</option>
              </select>
              <small>These broad categories do not replace a material flammability test.</small>
            </label>
            <label className="mission-select-control" htmlFor="mission-geometry">
              <span>Fuel shape or thickness</span>
              <select
                id="mission-geometry"
                onChange={(event) =>
                  isFuelGeometry(event.target.value) && update('geometry', event.target.value)
                }
                value={inputs.geometry}
              >
                <option value="sheet">Sheet, film, or fabric</option>
                <option value="thick-solid">Thick solid</option>
                <option value="rod-cylinder">Rod or cylinder</option>
                <option value="other">Other / unknown</option>
              </select>
              <small>PSI investigations use different fuel geometries because shape affects burning.</small>
            </label>
            <label className="mission-select-control" htmlFor="mission-fuel-amount">
              <span>Amount of fuel</span>
              <select
                id="mission-fuel-amount"
                onChange={(event) =>
                  isFuelAmount(event.target.value) && update('fuelAmount', event.target.value)
                }
                value={inputs.fuelAmount}
              >
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
              </select>
              <small>Relative amount for this scenario; no mass or energy is inferred.</small>
            </label>
            <label className="mission-toggle-control">
              <input
                checked={inputs.ignitionPresent}
                onChange={(event) => update('ignitionPresent', event.target.checked)}
                type="checkbox"
              />
              <span>
                <strong>Ignition source is present</strong>
                <small>For example, a heat source or spark in the described scenario.</small>
              </span>
            </label>
          </div>

          <div className="mission-input-group mission-input-group-last">
            <h3>Observed soot or smoke</h3>
            <label className="mission-select-control" htmlFor="mission-soot">
              <span>Current observation</span>
              <select
                id="mission-soot"
                onChange={(event) =>
                  isSmokeObservation(event.target.value) &&
                  update('smokeObservation', event.target.value)
                }
                value={inputs.smokeObservation}
              >
                <option value="not-measured">Not measured</option>
                <option value="none">None visible</option>
                <option value="visible">Visible</option>
                <option value="dense">Dense</option>
              </select>
              <small>This reports what you observe; it does not predict smoke output.</small>
            </label>
          </div>
        </section>

        <section className="mission-results" aria-label="Scenario guide" aria-live="polite">
          <article className="mission-visual-card">
            <div className="mission-result-heading">
              <div>
                <span className="card-kicker">ILLUSTRATIVE FLAME CUE</span>
                <h2>{assessment.shapeLabel}</h2>
              </div>
              <span className="live-tag"><span /> INPUT-DRIVEN</span>
            </div>
            <div className={`flame-stage mission-flame-stage ${inputs.gravity < 0.05 ? 'is-microgravity' : ''}`}>
              <div className="stage-coordinate coordinate-one">MISSION SCENARIO</div>
              <div className="stage-coordinate coordinate-two">{inputs.gravity.toFixed(2)} G</div>
              {assessment.shapeClass === 'mission-shape-unavailable' ? (
                <div className="mission-no-flame">Flame shape<br />not estimated</div>
              ) : (
                <>
                  <div className="stage-glow" />
                  <div
                    className={`flame ${assessment.shapeClass}`}
                    style={{
                      width: `${inputs.gravity < 0.05 ? 118 : 76 + inputs.airflowMps * 60}px`,
                      height: `${inputs.gravity < 0.05 ? 105 : 140 + inputs.gravity * 24}px`,
                      transform: `translateX(-50%) rotate(${inputs.airflowMps > 0.15 ? (inputs.airflowDirection === 'against' ? -12 : 12) : 0}deg)`,
                    }}
                  >
                    <span className="flame-core" />
                  </div>
                  <div className="burner"><span /></div>
                  <div className="stage-floor" />
                </>
              )}
              <div className="stage-caption">
                <span>SHAPE CUE</span>
                <strong>{inputs.airflowMps > 0.15 ? 'Flow-influenced' : inputs.gravity < 0.05 ? 'Low-buoyancy' : 'Buoyant'}</strong>
              </div>
            </div>
            <p className="mission-result-copy">{assessment.shapeDescription}</p>
            <p className="mission-visual-warning">Illustration only; not a fire simulation.</p>
          </article>

          <article className="mission-output-card">
            <div className="mission-output-title">
              <span className="mission-output-icon">↗</span>
              <div>
                <span className="card-kicker">FLAME SPREAD</span>
                <h2>No numerical rate estimated</h2>
              </div>
            </div>
            <p>
              A rate such as cm/s requires material-specific test data. PSI BASS-II studies spread
              under controlled flow, oxygen, and geometry conditions; this guide does not
              extrapolate a speed from sliders.
            </p>
            <ul className="mission-factor-list">
              {assessment.spreadFactors.map((factor) => <li key={factor}>{factor}</li>)}
            </ul>
          </article>

          <article className="mission-output-card">
            <div className="mission-output-title">
              <span className="mission-output-icon">!</span>
              <div>
                <span className="card-kicker">FLAMMABILITY CONCERN</span>
                <h2>Factors to consider, not a risk score</h2>
              </div>
            </div>
            <ul className="mission-factor-list">
              {assessment.riskFactors.map((factor) => <li key={factor}>{factor}</li>)}
            </ul>
            <p className="mission-output-caveat">
              The absence of listed factors does not mean a scenario is safe. No probability,
              pass/fail limit, or material rating is calculated.
            </p>
          </article>

          <article className="mission-output-card">
            <div className="mission-output-title">
              <span className="mission-output-icon">≈</span>
              <div>
                <span className="card-kicker">SMOKE / SOOT</span>
                <h2>Type discussed; amount not predicted</h2>
              </div>
            </div>
            <p>{assessment.smokeDescription}</p>
          </article>

          <article className="mission-mitigation-card">
            <div>
              <span className="card-kicker">GENERAL MITIGATION</span>
              <h2>Practical safety reminders</h2>
            </div>
            <ul>
              {assessment.mitigationActions.map((action) => <li key={action}>{action}</li>)}
            </ul>
            {inputs.smokeObservation === 'dense' && (
              <p className="mission-emergency-note" role="alert">
                Dense smoke selected: treat this as a possible active hazard and follow local
                emergency procedures.
              </p>
            )}
          </article>
        </section>
      </div>

      <SourceCitations
        note="NASA PSI investigations support which variables are important to study. They do not validate the qualitative cues or provide a universal fire prediction model for this page."
        sources={missionSources}
      />
    </div>
  )
}

export default MissionControl
