import { Fragment, useEffect, useRef, useState, type CSSProperties } from 'react'
import SourceCitations from './SourceCitations'
import FactorChart from './FactorChart'
import { gravityLabSources } from './citationData'
import EnvironmentComparison from './EnvironmentComparison'
import MissionControl from './MissionControl'
import PSIInvestigationExplorer from './PSIInvestigationExplorer'
import ResearchGaps from './ResearchGaps'

const modules = [
  { id: 'gravity', label: 'Gravity lab', mark: 'G' },
  { id: 'parameters', label: 'PSI investigations', mark: 'D' },
  { id: 'factors', label: 'Factor chart', mark: 'F' },
  { id: 'comparison', label: 'Environment comparison', mark: 'C' },
  { id: 'mission', label: 'Mission control', mark: 'M' },
  { id: 'gaps', label: 'Research gaps', mark: 'R' },
] as const

type ModuleId = (typeof modules)[number]['id']

const bridgeTitleByModule: Record<ModuleId, string | null> = {
  gravity: 'From Illustration to Investigation',
  parameters: 'From Individual Studies to Shared Factors',
  factors: 'From Research Factors to Space Environments',
  comparison: 'From Environment to Scenario',
  mission: 'From Scenarios to Open Questions',
  gaps: null,
}

const bridgeTextByModule: Record<ModuleId, string | null> = {
  gravity: `The Gravity Lab you just experimented with is relatively simple and does not account for all the potential variables in an unpredictable environment. However, NASA's Physical Sciences Informatics (PSI) database gives us access to numerous studies about combustion in space. Here you can browse investigations performed by scientists, summarized for easier reading. Each record can introduce you to study goals, hypotheses, methods, and more, offering a glimpse of the work researchers do to improve fire safety in space.`,
  parameters: `Didn't have time to sift through every study? Still wondering which factors appear most often? Don't worry; the Factor Chart summarizes the most-mentioned subjects in the PSI records returned by the combustion search, along with their relevance to fire and combustion. Take a look!`,
  factors: `Now that you've explored the key factors, let's get a little more hands-on. In the next module, you'll see how the environment can affect fire safety. Choose from four environments of interest to NASA: Earth, a pressurized habitat such as the ISS, the Moon, or Mars. The analysis discusses how each may affect fire safety and suppression, offering insights into reducing risks during space exploration.`,
  comparison: `Now I'm going to give you more room to explore. Mission Control lets you modify variables such as gravity, oxygen concentration, temperature, pressure, and airflow velocity. You'll see qualitative cues about the flame and general flammability and safety context to help consider mitigation options. These outputs are educational; they do not calculate validated flame-spread or flammability statistics.`,
  mission: `Once that's all said and done, what's next? Combustion is complex, and no set of studies can cover every condition. There is still much to learn, especially in pressurized cabins and future interplanetary habitats. Based on the NASA PSI combustion records reviewed for this dashboard, Research Gaps suggests areas that may deserve further study. These are sample-based opportunities, not proof that a topic is missing from the wider literature.`,
  gaps: null,
}

const presets = [
  { label: 'Microgravity', gravity: 0 },
  { label: 'Moon', gravity: 0.16 },
  { label: 'Mars', gravity: 0.38 },
  { label: 'Earth', gravity: 1 },
]

function formatGravity(value: number) {
  return `${value.toFixed(2)} g`
}

function App() {
  const [gravity, setGravity] = useState(1)
  const [activeModule, setActiveModule] = useState<ModuleId>('gravity')
  const [isDarkTheme, setIsDarkTheme] = useState(true)
  const moduleRefs = useRef<Partial<Record<ModuleId, HTMLElement | null>>>({})
  const selectedModule = modules.find((item) => item.id === activeModule)
  const flameHeight = 118 + gravity * 88
  const flameWidth = 142 - gravity * 58

  useEffect(() => {
    const updateActiveModule = () => {
      const anchor = window.innerHeight * 0.3
      let currentModule: (typeof modules)[number] = modules[0]
      for (const item of modules) {
        const element = moduleRefs.current[item.id]
        if (!element || element.getBoundingClientRect().top > anchor) break
        currentModule = item
      }
      setActiveModule((current) =>
        current === currentModule.id ? current : currentModule.id,
      )
    }

    window.addEventListener('scroll', updateActiveModule, { passive: true })
    window.addEventListener('resize', updateActiveModule)
    updateActiveModule()
    return () => {
      window.removeEventListener('scroll', updateActiveModule)
      window.removeEventListener('resize', updateActiveModule)
    }
  }, [])

  return (
    <div className={`app-shell ${isDarkTheme ? 'theme-dark' : 'theme-light'}`}>
      <aside className="sidebar">
        <a className="brand" href="#" aria-label="The Boiler Room home">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 32 32" fill="none">
              <path
                d="M17.4 3.5c1.2 5.2-3.9 6.7-2.1 11.1 1-1.6 2.8-2.3 4.1-4.9 3.2 2.4 5.1 5.7 5.1 9.3A8.5 8.5 0 1 1 7.6 19c0-3.3 2-6.1 4.7-8.5-.1 3.2.6 4.8 1.7 5.7-.5-5.7 4.3-7.7 3.4-12.7Z"
                fill="currentColor"
              />
            </svg>
          </span>
          <span className="brand-copy">
            <strong>The Boiler Room</strong>
            <small>RESEARCH DASHBOARD</small>
          </span>
        </a>

        <div className="nav-label">WORKSPACE</div>
        <nav className="module-nav" aria-label="Dashboard modules">
          {modules.map((item) => (
            <button
              className={`nav-item ${activeModule === item.id ? 'is-active' : ''}`}
              key={item.id}
              onClick={() => {
                setActiveModule(item.id)
                moduleRefs.current[item.id]?.scrollIntoView({
                  block: 'start',
                })
              }}
              type="button"
              aria-current={activeModule === item.id ? 'location' : undefined}
            >
              <span className="nav-mark" aria-hidden="true">
                {item.mark}
              </span>
              <span>{item.label}</span>
              {activeModule === item.id && <span className="active-dot" aria-hidden="true" />}
            </button>
          ))}
        </nav>

      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span>
            <span className="breadcrumb-slash">/</span>
            <strong>{selectedModule?.label}</strong>
          </div>
          <div className="topbar-meta">
            <button
              aria-label={`Switch to ${isDarkTheme ? 'light' : 'dark'} theme`}
              aria-pressed={isDarkTheme}
              className="theme-toggle"
              onClick={() => setIsDarkTheme((value) => !value)}
              type="button"
            >
              <span aria-hidden="true">{isDarkTheme ? '☼' : '◐'}</span>
              {isDarkTheme ? 'Light mode' : 'Dark mode'}
            </button>
            <span className="user-avatar" aria-label="Research workspace">
              R
            </span>
          </div>
        </header>

        <section
          aria-labelledby="learning-intro-title"
          className="learning-bookend learning-intro learning-bookend-text-left"
        >
          <div className="learning-bookend-bubble">
            <span className="learning-bookend-kicker">START HERE</span>
            <h2 id="learning-intro-title">Welcome to The Boiler Room</h2>
            <p>
              Fire has been integral to humanity since our beginnings. Even now,
              it remains a massive part of life around the globe, but throughout
              history it has also demonstrated great destructive power. As we
              explore new horizons, fire remains a serious hazard. The Apollo 1
              tragedy demonstrated how quickly a fire in a pressurized,
              oxygen-rich spacecraft cabin can become deadly. In this interactive
              dashboard, you&apos;ll explore fire behavior in space-related
              environments and learn key safety considerations as we work to
              prevent future disasters while exploring what&apos;s out there.
            </p>
          </div>
          <img
            alt="The Boiler Room mascot"
            className="learning-bookend-mascot"
            decoding="async"
            src="/images/mascot-left.png"
          />
        </section>

        {modules.map((item, index) => (
          <Fragment key={item.id}>
            <section
              aria-label={`${item.label} module`}
              className="dashboard-module"
              data-module-id={item.id}
              id={`module-${item.id}`}
              ref={(element) => {
                moduleRefs.current[item.id] = element
              }}
            >
        {item.id === 'gravity' ? (
          <div className="page-content">
            <section className="page-heading">
              <div>
                <div className="eyebrow">INTERACTIVE EXPLORER <span>01</span></div>
                <h1>Gravity lab</h1>
                <p>Adjust gravity and explore an illustrative change in flame shape.</p>
              </div>
              <div className="gravity-readout">
                <span className="readout-label">GRAVITY SETTING</span>
                <strong>{formatGravity(gravity)}</strong>
              </div>
            </section>

            <section className="lab-grid" aria-label="Gravity flame explorer">
              <div className="visual-card">
                <div className="visual-card-top">
                  <div>
                    <span className="card-kicker">FLAME VISUALIZER</span>
                    <h2>{gravity < 0.05 ? 'Microgravity' : gravity < 0.25 ? 'Lunar gravity' : gravity < 0.7 ? 'Reduced gravity' : 'Earth gravity'}</h2>
                  </div>
                </div>

                <div
                  className={`flame-stage ${gravity < 0.05 ? 'is-microgravity' : ''}`}
                  aria-label={`Illustrative flame at ${formatGravity(gravity)}`}
                >
                  <div className="stage-glow" />
                  <div
                    className="flame"
                    style={{
                      width: `${flameWidth}px`,
                      height: `${flameHeight}px`,
                      transform: `translateX(-50%) scaleY(${0.84 + gravity * 0.16})`,
                    }}
                  >
                    <span className="flame-core" />
                  </div>
                  <div className="burner">
                    <span />
                  </div>
                  <div className="stage-floor" />
                  <div className="stage-caption">
                    <span>FLAME PROFILE</span>
                    <strong>{gravity < 0.05 ? 'Rounded' : gravity > 0.7 ? 'Elongated' : 'Transitional'}</strong>
                  </div>
                </div>

                <div className="visual-disclaimer">
                  <span className="info-icon">i</span>
                  <span>Illustrative visualization only — not a validated combustion simulation.</span>
                </div>
              </div>

              <div className="control-card">
                <div className="card-kicker">SIMULATION CONTROL</div>
                <h2>Set gravity</h2>
                <p className="control-description">
                  Move the slider to change the flame illustration. This control runs locally in your browser.
                </p>

                <div className="slider-value-row">
                  <span>GRAVITY</span>
                  <strong>{formatGravity(gravity)}</strong>
                </div>
                <input
                  aria-label="Gravity from zero to one g"
                  className="gravity-slider"
                  max="1"
                  min="0"
                  onChange={(event) => setGravity(Number(event.target.value))}
                  step="0.01"
                  style={{ '--slider-progress': `${gravity * 100}%` } as CSSProperties}
                  type="range"
                  value={gravity}
                />
                <div className="slider-endpoints">
                  <span>0 g <small>MICROGRAVITY</small></span>
                  <span>1 g <small>EARTH</small></span>
                </div>

                <div className="preset-divider" />
                <div className="preset-heading">QUICK SETTINGS</div>
                <div className="preset-list">
                  {presets.map((preset) => (
                    <button
                      className={`preset-button ${gravity === preset.gravity ? 'is-selected' : ''}`}
                      key={preset.label}
                      onClick={() => setGravity(preset.gravity)}
                      type="button"
                    >
                      <span>{preset.label}</span>
                      <strong>{formatGravity(preset.gravity)}</strong>
                    </button>
                  ))}
                </div>

                <div className="control-note">
                  <span className="note-mark">↗</span>
                  <span>
                    <strong>For exploration, not prediction</strong>
                  </span>
                </div>
              </div>
            </section>

            <SourceCitations
              note="These pages provide background context only. The flame shape is manually styled and is not calculated from the cited research."
              sources={gravityLabSources}
            />
          </div>
        ) : item.id === 'parameters' ? (
          <PSIInvestigationExplorer />
        ) : item.id === 'mission' ? (
          <MissionControl />
        ) : item.id === 'factors' ? (
          <FactorChart />
        ) : item.id === 'comparison' ? (
          <EnvironmentComparison />
        ) : item.id === 'gaps' ? (
          <ResearchGaps />
        ) : (
          <div className="page-content placeholder-page">
            <div className="eyebrow">MODULE UNAVAILABLE</div>
            <h1>{selectedModule?.label}</h1>
            <p>This section is unavailable right now. Please choose another module.</p>
            <button className="back-button" onClick={() => setActiveModule('gravity')} type="button">
              Return to Gravity lab <span aria-hidden="true">→</span>
            </button>
            <SourceCitations
              note="Citations will appear here when this module's generated data is connected."
              sources={[]}
            />
          </div>
        )}
            </section>
            {index < modules.length - 1 && bridgeTextByModule[item.id] && (
              <aside
                aria-label={`Transition from ${item.label} to ${
                  modules[index + 1]?.label
                }`}
                className={`section-bridge ${
                  index % 2 === 0
                    ? 'section-bridge-text-left'
                    : 'section-bridge-text-right'
                }`}
              >
                <div className="section-bridge-bubble">
                  <h2 className="section-bridge-title">
                    {bridgeTitleByModule[item.id]}
                  </h2>
                  <p>{bridgeTextByModule[item.id]}</p>
                </div>
                <img
                  alt="The Boiler Room mascot"
                  className="section-bridge-mascot"
                  decoding="async"
                  loading="lazy"
                  src={
                    index % 2 === 0
                      ? '/images/mascot-left.png'
                      : '/images/mascot-right.png'
                  }
                />
              </aside>
            )}
          </Fragment>
        ))}

        <section
          aria-labelledby="learning-outro-title"
          className="learning-bookend learning-outro learning-bookend-text-right"
        >
          <div className="learning-bookend-bubble">
            <span className="learning-bookend-kicker">OUTRO</span>
            <h2 id="learning-outro-title">Bring the ideas together</h2>
            <p>
              Congratulations! You&apos;ve made it through this exploration of
              combustion. I hope you&apos;ve learned something from experimenting
              and reviewing the research, and that you can carry these insights
              forward as humanity continues to explore. Best of luck, and thank
              you for visiting The Boiler Room!
            </p>
          </div>
          <img
            alt="The Boiler Room mascot"
            className="learning-bookend-mascot"
            decoding="async"
            src="/images/mascot-right.png"
          />
        </section>
      </main>
    </div>
  )
}

export default App
