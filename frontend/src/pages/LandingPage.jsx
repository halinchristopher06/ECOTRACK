import { useNavigate } from 'react-router-dom'
import {
  Bell,
  BarChart3,
  CalendarClock,
  Droplets,
  FileSpreadsheet,
  Gauge,
  Globe,
  Leaf,
  LineChart,
  ScanLine,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  UploadCloud,
  UserPlus,
  Wallet,
  Zap,
} from 'lucide-react'
import { useAppState } from '../hooks/useAppState.js'
import { TariffTable } from '../components/TariffTable.jsx'
import { Reveal } from '../components/ui/Reveal.jsx'

const FEATURES = [
  {
    icon: FileSpreadsheet,
    title: 'Smart bill tracking',
    description: 'Log electricity and water bills and keep a complete, searchable history of every payment.',
  },
  {
    icon: ScanLine,
    title: 'OCR bill upload',
    description: 'Photograph a paper bill and let EcoTrack read the meter reading, units and amount for you.',
    tone: 'water',
  },
  {
    icon: Zap,
    title: 'Electricity tariff slabs',
    description: 'Compare real provider slabs so you always know what you are paying per unit.',
  },
  {
    icon: Droplets,
    title: 'Water tariff slabs',
    description: 'See how municipal water slabs step up, and where your household sits on the ladder.',
    tone: 'water',
  },
  {
    icon: TrendingUp,
    title: 'Bill prediction',
    description: 'Get a forecast of your next bill from your recent consumption trend, before it arrives.',
  },
  {
    icon: Gauge,
    title: 'Appliance cost tracking',
    description: 'Estimate what each appliance adds to your bill from its wattage and daily usage hours.',
  },
  {
    icon: BarChart3,
    title: 'Consumption analytics',
    description: 'Visualise monthly usage and spending for electricity and water with clear charts.',
    tone: 'water',
  },
  {
    icon: Wallet,
    title: 'Budget management',
    description: 'Set monthly budgets and watch a live progress bar against what you have spent.',
  },
  {
    icon: Bell,
    title: 'Smart notifications',
    description: 'Get alerted about due dates, unusual consumption and budget thresholds you set.',
  },
]

const STEPS = [
  { icon: UserPlus, title: 'Create your account', description: 'Sign up free in under a minute with your email and a one-time code.' },
  { icon: UploadCloud, title: 'Add your utility bills', description: 'Enter a bill manually or upload a photo or PDF and let OCR read it.' },
  { icon: LineChart, title: 'Watch your usage trends', description: 'See electricity and water consumption and spend side by side.' },
  { icon: CalendarClock, title: 'Plan ahead with confidence', description: 'Use predictions, budgets and alerts to avoid bill surprises.' },
]

const BENEFITS = [
  {
    icon: ShieldCheck,
    title: 'Your data stays yours',
    description: 'Everything sits behind your own session and is only visible to your account.',
  },
  {
    icon: Sparkles,
    title: 'Reads the bills you already have',
    description: 'No new meter to buy — EcoTrack works from the bills your utility already sends.',
  },
  {
    icon: TrendingDown,
    title: 'Find the avoidable spend',
    description: 'Appliance estimates and trend analysis show where the money actually goes.',
  },
  {
    icon: CalendarClock,
    title: 'Never miss a due date',
    description: 'Due-date reminders keep late-payment charges off your account.',
  },
]

const IMPACT = [
  { icon: Leaf, value: 'Lower', label: 'Cut the energy you waste and see the difference on your next bill.' },
  { icon: Droplets, value: 'Smarter', label: 'Spot the habits and slow leaks that quietly waste water every day.', tone: 'water' },
  { icon: Globe, value: 'Cleaner', label: 'Every unit you avoid is a unit that never had to be generated.' },
  { icon: Wallet, value: 'Budgeted', label: 'Know your spend before the bill lands and plan the month with confidence.' },
]

/** Practical, cost-free actions that show up on a utility bill. Kept qualitative on purpose. */
const ELECTRICITY_SAVINGS = [
  {
    title: 'Move heavy loads off peak',
    text: 'Run the washing machine, dryer and water heater outside the peak evening window wherever your tariff rewards it.',
  },
  {
    title: 'Kill the standby draw',
    text: 'Televisions, consoles and chargers keep drawing power all day. Switch them off at the socket.',
  },
  {
    title: 'Match cooling to the season',
    text: 'Relaxing the thermostat by a degree or two cuts the biggest load in most homes. Clean filters keep it efficient.',
  },
  {
    title: 'Replace the worst bulbs first',
    text: 'LED lamps use a fraction of the power of halogen and incandescent bulbs and last far longer.',
  },
  {
    title: 'Watch your slab position',
    text: 'Use the tariff tables below to see how close you are to the next slab rate, where every extra unit costs more.',
  },
]

const WATER_SAVINGS = [
  {
    title: 'Fix dripping taps early',
    text: 'A slow drip runs day and night. It is the cheapest leak to repair and one of the most expensive to ignore.',
  },
  {
    title: 'Check the toilet cistern',
    text: 'A leaking flush valve can waste more water than every tap in the house combined.',
  },
  {
    title: 'Shorten showers',
    text: 'Trimming a couple of minutes per shower is the single largest indoor saving for most households.',
  },
  {
    title: 'Full loads only',
    text: 'Run the washing machine and dishwasher only when they are full — the same cycle delivers more output.',
  },
  {
    title: 'Reuse kitchen water',
    text: 'Water used to rinse vegetables is perfectly fine for plants and outdoor pots.',
  },
]

/** Axis labels for the six-month charts in the hero and dashboard preview. */
const MONTHS = ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct']

const MOCK_BARS = [
  { height: '46%', water: '28%' },
  { height: '62%', water: '34%' },
  { height: '54%', water: '30%' },
  { height: '78%', water: '42%' },
  { height: '66%', water: '36%' },
  { height: '88%', water: '48%' },
]

export function LandingPage() {
  const navigate = useNavigate()
  const { electricityTariffs, waterTariffs, maxElecTariffRate, maxWaterTariffRate } = useAppState()

  const goTo = (hash) => document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <div className="eco-landing">
      {/* 1 — Hero */}
      <section className="eco-hero">
        <div className="eco-hero-grid">
          <div className="eco-hero-copy">
            <h1 className="eco-hero-title">
              Take control of your <span className="eco-accent">electricity and water</span> costs.
            </h1>
            <p className="eco-hero-lead">
              One calm place to read your utility bills, see what each appliance really costs and plan the month
              ahead — so fewer units and litres go to waste.
            </p>

            <div className="eco-hero-actions">
              <button type="button" className="eco-btn eco-btn-primary eco-btn-lg" onClick={() => navigate('/signup')}>
                Get started free
              </button>
              <button type="button" className="eco-btn eco-btn-secondary eco-btn-lg" onClick={() => navigate('/login')}>
                Sign in
              </button>
            </div>
          </div>

          {/* A compact preview of the signed-in dashboard, built from the same metric
              tiles and chart bars the real product uses. */}
          <div className="eco-hero-panel">
            <div>
              <p className="eco-hero-panel-title">Monthly overview</p>
              <p className="eco-hero-panel-sub">Electricity and water, this month</p>
            </div>

            <div className="eco-hero-panel-metrics">
              <div className="eco-metric is-elec">
                <span className="eco-metric-label">Electricity</span>
                <span className="eco-metric-value">412 kWh</span>
                <span className="eco-metric-sub">8% lower than last month</span>
              </div>
              <div className="eco-metric is-water">
                <span className="eco-metric-label">Water</span>
                <span className="eco-metric-value">14.2 kl</span>
                <span className="eco-metric-sub">5% lower than last month</span>
              </div>
            </div>

            <div className="eco-chart" style={{ '--chart-cols': MOCK_BARS.length }}>
              <div className="eco-chart-head">
                <span className="eco-chart-title">Electricity trend</span>
                <span className="eco-chart-note">Last 6 months · kWh</span>
              </div>
              <div
                className="eco-chart-plot"
                role="img"
                aria-label="Bar chart of monthly electricity use over the last six months"
              >
                {MOCK_BARS.map((bar, index) => (
                  <span key={index} className="eco-chart-col">
                    <span className="eco-chart-bar" style={{ height: bar.height }} />
                  </span>
                ))}
              </div>
              <div className="eco-chart-axis" aria-hidden="true">
                {MONTHS.map((month) => (
                  <span key={month}>{month}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2 — Features */}
      <section id="features" className="eco-section">
        <div className="eco-section-inner">
          <Reveal className="eco-section-head">
            <span className="eco-section-eyebrow">Features</span>
            <h2 className="eco-section-title">Everything you need to manage utility expenses</h2>
            <p className="eco-section-lead">
              Billing, scanning, tariffs, prediction and budgeting — designed to work together rather than as a
              loose pile of tools.
            </p>
          </Reveal>

          <div className="eco-feature-grid">
            {FEATURES.map(({ icon: Icon, title, description, tone }, index) => (
              <Reveal key={title} delay={(index % 3) * 70}>
                <article className={`eco-feature ${tone === 'water' ? 'is-water' : ''}`.trim()}>
                  <span className="eco-feature-icon">
                    <Icon size={22} aria-hidden="true" />
                  </span>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 3 — How it works */}
      <section id="how" className="eco-section eco-section-alt">
        <div className="eco-section-inner">
          <Reveal className="eco-section-head">
            <span className="eco-section-eyebrow">How EcoTrack works</span>
            <h2 className="eco-section-title">Four steps from paper bill to clear plan</h2>
            <p className="eco-section-lead">
              You do not need new hardware or a smart meter. EcoTrack reads the bills you already receive.
            </p>
          </Reveal>

          <div className="eco-steps">
            {STEPS.map(({ icon: Icon, title, description }, index) => (
              <Reveal key={title} delay={index * 70}>
                <article className="eco-step">
                  <span className="eco-step-num">{index + 1}</span>
                  <h3>
                    <Icon size={16} aria-hidden="true" style={{ verticalAlign: '-3px', marginRight: 7 }} />
                    {title}
                  </h3>
                  <p>{description}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 4 — Dashboard preview */}
      <section id="preview" className="eco-section">
        <div className="eco-section-inner">
          <Reveal className="eco-section-head">
            <span className="eco-section-eyebrow">Dashboard preview</span>
            <h2 className="eco-section-title">Your whole month at a glance</h2>
            <p className="eco-section-lead">
              A preview of the analysis you get after signing in — consumption, estimated bill, budget pace and
              upcoming due dates.
            </p>
          </Reveal>

          <Reveal>
            <div className="eco-preview">
              <div className="eco-preview-grid">
                <div className="eco-metric">
                  <span className="eco-metric-label">Electricity this month</span>
                  <span className="eco-metric-value">412 kWh</span>
                  <span className="eco-metric-sub">8% lower than last month</span>
                </div>
                <div className="eco-metric">
                  <span className="eco-metric-label">Water this month</span>
                  <span className="eco-metric-value">14.2 kl</span>
                  <span className="eco-metric-sub">5% lower than last month</span>
                </div>
                <div className="eco-metric">
                  <span className="eco-metric-label">Estimated bill</span>
                  <span className="eco-metric-value">₹1,840</span>
                  <span className="eco-metric-sub">Forecast for this billing cycle</span>
                </div>
                <div className="eco-metric">
                  <span className="eco-metric-label">Budget used</span>
                  <span className="eco-metric-value">72%</span>
                  <span className="eco-metric-sub">₹2,400 of ₹3,300</span>
                </div>
              </div>

              <div className="eco-chart" style={{ '--chart-cols': MOCK_BARS.length }}>
                <div className="eco-chart-head">
                  <span className="eco-chart-title">Monthly water usage</span>
                  <span className="eco-chart-note">Last 6 months · kilolitres</span>
                </div>
                <div
                  className="eco-chart-plot"
                  role="img"
                  aria-label="Bar chart of monthly water use over the last six months"
                >
                  {MOCK_BARS.map((bar, index) => (
                    <span key={index} className="eco-chart-col">
                      <span className="eco-chart-bar is-water" style={{ height: bar.water }} />
                    </span>
                  ))}
                </div>
                <div className="eco-chart-axis" aria-hidden="true">
                  {MONTHS.map((month) => (
                    <span key={month}>{month}</span>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* 5 — Benefits */}
      <section className="eco-section eco-section-alt">
        <div className="eco-section-inner">
          <Reveal className="eco-section-head">
            <span className="eco-section-eyebrow">Benefits</span>
            <h2 className="eco-section-title">Built to make the numbers useful</h2>
            <p className="eco-section-lead">
              Clear data beats guessing. EcoTrack turns your bills into decisions you can actually act on.
            </p>
          </Reveal>

          <div className="eco-benefit-grid">
            {BENEFITS.map(({ icon: Icon, title, description }, index) => (
              <Reveal key={title} delay={(index % 2) * 70}>
                <article className="eco-benefit">
                  <span className="eco-benefit-icon">
                    <Icon size={19} aria-hidden="true" />
                  </span>
                  <div>
                    <h3>{title}</h3>
                    <p>{description}</p>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 6 — Tariffs */}
      <section id="tariffs" className="eco-section">
        <div className="eco-section-inner">
          <Reveal className="eco-section-head">
            <span className="eco-section-eyebrow">Tariffs</span>
            <h2 className="eco-section-title">Real electricity and water slab rates</h2>
            <p className="eco-section-lead">
              Live slab rates from the providers in EcoTrack&apos;s public tariff catalogue — the same rates used by
              the calculators inside the app.
            </p>
          </Reveal>

          <div className="eco-tariff-grid">
            <Reveal>
              <div className="eco-tariff-card" id="tariffs-electricity">
                <div className="eco-tariff-head is-elec">
                  <Zap size={19} aria-hidden="true" />
                  <div>
                    <h3>Electricity</h3>
                    <p>Energy charge slabs per kWh</p>
                  </div>
                </div>
                <div className="eco-tariff-body">
                  <TariffTable
                    electricityTariffs={electricityTariffs}
                    waterTariffs={[]}
                    maxElecTariffRate={maxElecTariffRate}
                    maxWaterTariffRate={maxWaterTariffRate || 1}
                  />
                </div>
              </div>
            </Reveal>

            <Reveal delay={80}>
              <div className="eco-tariff-card" id="tariffs-water">
                <div className="eco-tariff-head is-water">
                  <Droplets size={19} aria-hidden="true" />
                  <div>
                    <h3>Water</h3>
                    <p>Domestic slab rates per kilolitre</p>
                  </div>
                </div>
                <div className="eco-tariff-body">
                  <TariffTable
                    electricityTariffs={[]}
                    waterTariffs={waterTariffs}
                    maxElecTariffRate={maxElecTariffRate || 1}
                    maxWaterTariffRate={maxWaterTariffRate}
                  />
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* 7 — Environmental impact */}
      <section id="impact" className="eco-section eco-section-alt">
        <div className="eco-section-inner">
          <Reveal className="eco-section-head">
            <span className="eco-section-eyebrow">Environmental impact</span>
            <h2 className="eco-section-title">Saving money and saving resources are the same habit</h2>
            <p className="eco-section-lead">
              The units and litres you do not use are the cleanest ones available — no generation, no treatment,
              no waste.
            </p>
          </Reveal>

          <div className="eco-impact">
            {IMPACT.map(({ icon: Icon, value, label }, index) => (
              <Reveal key={value} delay={(index % 4) * 60}>
                <article className="eco-impact-card">
                  <span className="eco-impact-icon">
                    <Icon size={22} aria-hidden="true" />
                  </span>
                  <div className="eco-impact-value">{value}</div>
                  <p className="eco-impact-label">{label}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 8 — Saving playbook */}
      <section id="saving" className="eco-section">
        <div className="eco-section-inner">
          <Reveal className="eco-section-head">
            <span className="eco-section-eyebrow">Saving playbook</span>
            <h2 className="eco-section-title">Practical ways to cut both bills</h2>
            <p className="eco-section-lead">
              Changes that cost nothing and show up on your next statement. Track them in EcoTrack and the effect
              appears in your monthly consumption and spending charts.
            </p>
          </Reveal>

          <div className="eco-playbook">
            <Reveal>
              <article className="eco-playbook-col">
                <header>
                  <span className="eco-playbook-icon">
                    <Zap size={18} aria-hidden="true" />
                  </span>
                  <div>
                    <h3>Electricity</h3>
                    <p>Where most households find savings first</p>
                  </div>
                </header>
                <ul className="eco-playbook-list">
                  {ELECTRICITY_SAVINGS.map((item) => (
                    <li key={item.title}>
                      <span className="eco-playbook-dot" aria-hidden="true" />
                      <div>
                        <strong>{item.title}</strong>
                        <p>{item.text}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </article>
            </Reveal>

            <Reveal delay={90}>
              <article className="eco-playbook-col is-water">
                <header>
                  <span className="eco-playbook-icon">
                    <Droplets size={18} aria-hidden="true" />
                  </span>
                  <div>
                    <h3>Water</h3>
                    <p>Small habits, measurable litres</p>
                  </div>
                </header>
                <ul className="eco-playbook-list">
                  {WATER_SAVINGS.map((item) => (
                    <li key={item.title}>
                      <span className="eco-playbook-dot" aria-hidden="true" />
                      <div>
                        <strong>{item.title}</strong>
                        <p>{item.text}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </article>
            </Reveal>
          </div>

          <Reveal delay={60}>
            <p className="eco-playbook-note">
              Signed in, EcoTrack turns these into measured results — usage deltas, avoided CO₂ and budget pace on
              your dashboard.{' '}
              <button type="button" className="eco-auth-link" onClick={() => navigate('/signup')}>
                Create a free account
              </button>
            </p>
          </Reveal>
        </div>
      </section>

      {/* 9 — About / mission */}
      <section id="about" className="eco-section eco-section-alt">
        <div className="eco-section-inner">
          <Reveal className="eco-section-head">
            <span className="eco-section-eyebrow">About EcoTrack</span>
            <h2 className="eco-section-title">Made for households, not for spreadsheets</h2>
            <p className="eco-section-lead">
              EcoTrack was built for people who hold a bill in their hand and want to know what it means. It reads
              real tariffs, works from real bills and keeps both utilities in one honest dashboard — for renters,
              owners and anyone trying to spend less on the essentials.
            </p>
          </Reveal>

          <Reveal>
            <div className="eco-cta">
              <div className="eco-cta-inner">
                <h2>Start managing your utility expenses smarter.</h2>
                <p>Create a free account, add one bill and see your first month of insights today.</p>
                <div className="eco-cta-actions">
                  <button type="button" className="eco-btn eco-btn-primary eco-btn-lg" onClick={() => navigate('/signup')}>
                    Create your free account
                  </button>
                  <button type="button" className="eco-btn eco-btn-secondary eco-btn-lg" onClick={() => goTo('#saving')}>
                    See the saving playbook
                  </button>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  )
}
