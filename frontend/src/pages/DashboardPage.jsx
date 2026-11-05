import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarClock,
  Droplets,
  FileText,
  Gauge,
  Leaf,
  Lightbulb,
  PlugZap,
  Receipt,
  Upload,
  Wallet,
  Zap,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth.js'
import { useTheme } from '../hooks/useTheme.js'
import { chartThemeFor } from '../utils/chartTheme.js'
import { fetchDashboardCharts, fetchDashboardSummary } from '../services/dashboardService.js'
import { fetchUpcomingBillPrediction } from '../services/predictionService.js'
import { createBill } from '../services/billsService.js'
import { checkUnusualConsumption } from '../services/anomalyService.js'
import { getBudgetStatus } from '../services/budgetService.js'
import { getApplianceBreakdown } from '../services/applianceService.js'
import { QuickEstimateSection } from './AppliancesPage.jsx'
import { Card } from '../components/ui/Card.jsx'
import { StatCard } from '../components/ui/StatCard.jsx'
import { EmptyState, Skeleton } from '../components/ui/EmptyState.jsx'
import { Badge, ProgressBar } from '../components/ui/Badge.jsx'
import { Alert } from '../components/ui/Alert.jsx'

const CONFIDENCE_LABEL = {
  NONE: 'no data yet',
  LOW: 'low confidence',
  MEDIUM: 'medium confidence',
  HIGH: 'high confidence',
}

// Demo bills are clearly marked with a "(Demo) " provider prefix (checked for everywhere they are
// displayed) so they are never mistaken for a bill the user actually entered.
const DEMO_PREFIX = '(Demo) '

const money = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
})

const moneyRounded = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

const number = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 })

function formatMoney(value) {
  return money.format(Number.isFinite(value) ? value : 0)
}

function formatMoneyRounded(value) {
  return moneyRounded.format(Number.isFinite(value) ? value : 0)
}

function formatUnits(value) {
  return number.format(Number.isFinite(value) ? value : 0)
}

/** "2026-08" → "Aug". Kept short so a full year of labels still fits on a phone. */
function monthLabel(month) {
  const [year, monthIndex] = String(month || '').split('-')
  const parsed = new Date(Number(year), Number(monthIndex) - 1, 1)
  if (Number.isNaN(parsed.getTime())) return String(month || '')
  return parsed.toLocaleString('en-US', { month: 'short' })
}

function withLabels(points) {
  return (points || []).map((point) => ({ ...point, label: monthLabel(point.month) }))
}

function sumUnits(points) {
  return (points || []).reduce((total, point) => total + (Number(point.units) || 0), 0)
}

/** Percentage change between two months, phrased for a cost tile (up = worse). */
function monthTrend(current, previous) {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null
  const delta = current - previous
  if (Math.abs(delta) < 0.01) return { direction: 'flat', text: 'Same as last month' }
  const percent = Math.abs((delta / previous) * 100)
  return {
    direction: delta > 0 ? 'up' : 'down',
    text: `${percent.toFixed(0)}% ${delta > 0 ? 'higher' : 'lower'} than last month`,
  }
}

/** kg CO₂ released per kWh on the Indian grid, used to turn avoided units into avoided emissions. */
const CO2_PER_KWH = 0.71
/** kg CO₂ a mature tree absorbs in a year — the yardstick the card translates the saving into. */
const CO2_PER_TREE_YEAR = 21

/** Latest billed month against the one before it, for a single utility series. */
function latestComparison(series) {
  const points = (series || []).filter((point) => Number(point.units) > 0)
  if (points.length === 0) return null
  const latest = points[points.length - 1]
  const previous = points.length > 1 ? points[points.length - 2] : null
  const latestUnits = Number(latest.units) || 0
  const previousUnits = previous ? Number(previous.units) || 0 : null
  return {
    month: latest.month,
    latestUnits,
    previousUnits,
    delta: previousUnits == null ? null : latestUnits - previousUnits,
  }
}

function percentChange(current, previous) {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null
  return ((current - previous) / previous) * 100
}

/** One "what your data is telling you" row — shared by the insights and recommendations cards. */
function InsightRow({ tone, title, text }) {
  const Icon = tone === 'warn' ? AlertTriangle : tone === 'water' ? Droplets : Lightbulb
  return (
    <div className={`eco-insight ${tone === 'warn' ? 'is-warn' : ''} ${tone === 'water' ? 'is-water' : ''}`.trim()}>
      <span className="eco-insight-icon">
        <Icon size={17} aria-hidden="true" />
      </span>
      <div>
        <p>
          <strong>{title}</strong>
        </p>
        <p>{text}</p>
      </div>
    </div>
  )
}

/** Month-on-month movement badge for one utility (down is good for both). */
function MovementBadge({ row, unit }) {
  if (!row) return null
  if (row.delta == null) return <Badge>First month billed</Badge>
  if (row.delta === 0) return <Badge>Unchanged</Badge>
  return (
    <Badge tone={row.delta < 0 ? 'primary' : 'danger'}>
      {row.delta < 0 ? '−' : '+'}
      {formatUnits(Math.abs(row.delta))} {unit}
    </Badge>
  )
}

/**
 * Turns the user's own consumption history into avoided energy, avoided water and avoided CO₂. The
 * assumptions are printed inside the card so the figure is never presented as an unexplained number.
 */
function EnvironmentalImpactCard({ electricity, water }) {
  const elec = latestComparison(electricity)
  const waterUse = latestComparison(water)

  if (!elec && !waterUse) {
    return (
      <Card title="Environmental impact" subtitle="Avoided consumption against last month" icon={Leaf}>
        <EmptyState
          icon={Leaf}
          title="No comparison yet"
          text="Once you have two months of bills, EcoTrack shows the energy and water you avoided and the CO₂ that stayed out of the air."
        />
      </Card>
    )
  }

  const elecSaved = elec?.delta != null && elec.delta < 0 ? Math.abs(elec.delta) : 0
  const waterSaved = waterUse?.delta != null && waterUse.delta < 0 ? Math.abs(waterUse.delta) : 0
  const co2Avoided = elecSaved * CO2_PER_KWH
  const treeYears = co2Avoided / CO2_PER_TREE_YEAR
  const nothingAvoided = co2Avoided === 0 && waterSaved === 0

  return (
    <Card title="Environmental impact" subtitle="Against your previous billed month" icon={Leaf}>
      <div className="eco-stack">
        {elec ? (
          <div className="eco-summary-row">
            <span>Electricity</span>
            <span className="eco-impact-figure">
              {formatUnits(elec.latestUnits)} kWh
              <MovementBadge row={elec} unit="kWh" />
            </span>
          </div>
        ) : null}

        {waterUse ? (
          <div className="eco-summary-row">
            <span>Water</span>
            <span className="eco-impact-figure">
              {formatUnits(waterUse.latestUnits)} kL
              <MovementBadge row={waterUse} unit="kL" />
            </span>
          </div>
        ) : null}

        <div className="eco-summary-row">
          <span>Electricity avoided</span>
          <span className="eco-bill-amount">{formatUnits(elecSaved)} kWh</span>
        </div>
        <div className="eco-summary-row">
          <span>Water avoided</span>
          <span className="eco-bill-amount">{formatUnits(waterSaved * 1000)} L</span>
        </div>
        <div className="eco-summary-row is-total">
          <span>CO₂ avoided</span>
          <span className="eco-bill-amount">{formatUnits(co2Avoided)} kg</span>
        </div>

        {co2Avoided > 0 ? (
          <p className="eco-help">
            About what {formatUnits(treeYears)} mature tree{treeYears === 1 ? '' : 's'} absorb in a year.
          </p>
        ) : (
          <p className="eco-help">
            {nothingAvoided
              ? 'Usage is level with or above the previous month, so there is nothing avoided to report yet. The recommendations below are the quickest way to change that.'
              : 'No reduction in CO₂ to report for this month.'}
          </p>
        )}

        <p className="eco-help">
          Estimated with {CO2_PER_KWH} kg CO₂ per kWh (India grid average) and {CO2_PER_TREE_YEAR} kg absorbed per
          mature tree per year.
        </p>
      </div>
    </Card>
  )
}

/** Turns the user's own numbers into concrete next actions rather than generic advice. */
function buildSavingTips({ budget, applianceList, topAppliance, electricity, water }) {
  const tips = []
  const elec = latestComparison(electricity)
  const waterUse = latestComparison(water)

  if (topAppliance) {
    tips.push({
      key: 'appliance-top',
      tone: 'default',
      title: `${topAppliance.name} is your costliest appliance`,
      text: `About ${formatMoney(topAppliance.monthlyCost)} a month for ${topAppliance.quantity} unit${
        topAppliance.quantity === 1 ? '' : 's'
      } at ${topAppliance.wattage} W. Trimming its daily hours moves the bill the most.`,
    })
  } else if (applianceList.length === 0) {
    tips.push({
      key: 'appliance-none',
      tone: 'default',
      title: 'Cost each appliance',
      text: 'Add your appliances and EcoTrack shows which one takes the largest share of your electricity bill.',
    })
  }

  if (elec?.delta != null && elec.delta > 0) {
    const pct = percentChange(elec.latestUnits, elec.previousUnits)
    tips.push({
      key: 'elec-up',
      tone: 'warn',
      title: 'Electricity rose this month',
      text: `You used ${formatUnits(elec.delta)} kWh more than last month${
        pct == null ? '' : ` (${Math.round(pct)}% higher)`
      }. Check cooling settings and standby load first.`,
    })
  }

  if (waterUse?.delta != null && waterUse.delta > 0) {
    tips.push({
      key: 'water-up',
      tone: 'water',
      title: 'Water rose this month',
      text: `You used ${formatUnits(waterUse.delta)} kL more than last month. A leaking cistern or a dripping tap is the usual cause.`,
    })
  }

  if (budget && budget.combinedBudget > 0 && budget.combinedPercentUsed >= 80) {
    tips.push({
      key: 'budget',
      tone: 'warn',
      title: 'You are close to your monthly budget',
      text: `${Math.round(budget.combinedPercentUsed)}% of your budget is used with time still left in the month.`,
    })
  }

  if (elec?.delta != null && elec.delta < 0) {
    tips.push({
      key: 'elec-down',
      tone: 'default',
      title: 'Electricity is down',
      text: `You used ${formatUnits(Math.abs(elec.delta))} kWh less than last month. Whatever you changed is working — keep it.`,
    })
  }

  if (waterUse?.delta != null && waterUse.delta < 0) {
    tips.push({
      key: 'water-down',
      tone: 'water',
      title: 'Water is down',
      text: `You used ${formatUnits(Math.abs(waterUse.delta))} kL less than last month.`,
    })
  }

  return tips
}

function SavingRecommendationsCard({ budget, applianceList, topAppliance, electricity, water }) {
  const tips = buildSavingTips({ budget, applianceList, topAppliance, electricity, water })

  return (
    <Card title="Saving recommendations" subtitle="Built from your own usage" icon={Lightbulb}>
      {tips.length > 0 ? (
        <div className="eco-stack">
          {tips.map((tip) => (
            <InsightRow key={tip.key} tone={tip.tone} title={tip.title} text={tip.text} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Lightbulb}
          title="Nothing to flag yet"
          text="Add bills and appliances and EcoTrack will point out where you can save next."
        />
      )}
    </Card>
  )
}

function buildDemoBills() {
  const now = new Date()
  const months = []
  for (let i = 3; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const bills = []
  months.forEach((month, idx) => {
    const elecUnits = 180 + idx * 12 + (idx % 2 === 0 ? 10 : -5)
    const waterUnits = 14 + idx * 1.2

    bills.push({
      provider: `${DEMO_PREFIX}Sample Electricity Co.`,
      utilityType: 'ELECTRICITY',
      billingMonth: month,
      unitsConsumed: elecUnits,
      billAmount: Math.round(elecUnits * 7.2 + 120),
      previousReading: 1000 + idx * 180,
      currentReading: 1000 + idx * 180 + elecUnits,
      dueDate: `${month}-20`,
      paymentStatus: idx === months.length - 1 ? 'PENDING' : 'PAID',
      entrySource: 'MANUAL',
    })
    bills.push({
      provider: `${DEMO_PREFIX}Sample Water Board`,
      utilityType: 'WATER',
      billingMonth: month,
      unitsConsumed: waterUnits,
      billAmount: Math.round(waterUnits * 18 + 60),
      previousReading: 200 + idx * 15,
      currentReading: 200 + idx * 15 + waterUnits,
      dueDate: `${month}-22`,
      paymentStatus: idx === months.length - 1 ? 'PENDING' : 'PAID',
      entrySource: 'MANUAL',
    })
  })
  return bills
}

/**
 * A chart container that never renders an empty or broken plot area: when there is no data the
 * card shows an explanation and a next step instead of a blank axis.
 */
function ChartCard({ title, subtitle, icon, hasData, emptyTitle, emptyText, children }) {
  return (
    <Card title={title} subtitle={subtitle} icon={icon}>
      {hasData ? (
        <div className="eco-chart-box">{children}</div>
      ) : (
        <EmptyState icon={BarChart3} title={emptyTitle} text={emptyText} />
      )}
    </Card>
  )
}

function QuickActions() {
  const navigate = useNavigate()
  const links = [
    { label: 'Upload a bill', detail: 'Scan or enter a statement', icon: Upload, path: '/upload-bill' },
    { label: 'Bill history', detail: 'Review every past bill', icon: FileText, path: '/bills' },
    { label: 'My appliances', detail: 'Cost each device', icon: PlugZap, path: '/appliances' },
    { label: 'Budget', detail: 'Plan monthly spending', icon: Wallet, path: '/budget' },
    { label: 'Bill calculator', detail: 'Estimate before it arrives', icon: Gauge, path: '/manual' },
    { label: 'Reports', detail: 'Analytics and exports', icon: BarChart3, path: '/reports' },
  ]

  return (
    <div className="eco-quick-grid">
      {links.map(({ label, detail, icon: Icon, path }) => (
        <button key={path} type="button" className="eco-quick" onClick={() => navigate(path)}>
          <span className="eco-quick-icon">
            <Icon size={18} aria-hidden="true" />
          </span>
          <span>
            <strong>{label}</strong>
            <small>{detail}</small>
          </span>
        </button>
      ))}
    </div>
  )
}

function OverviewSkeleton() {
  return (
    <div className="eco-stack" aria-hidden="true">
      <div className="eco-grid eco-grid-4">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="eco-skel-block" style={{ height: 116 }} />
        ))}
      </div>
      <div className="eco-grid eco-grid-2">
        <Skeleton className="eco-skel-block" style={{ height: 320 }} />
        <Skeleton className="eco-skel-block" style={{ height: 320 }} />
      </div>
    </div>
  )
}

export function DashboardPage() {
  const { token, displayName, setAuthMessage, setAuthError } = useAuth()
  const { theme } = useTheme()
  const navigate = useNavigate()
  const { palette, tooltipStyle, axisProps } = chartThemeFor(theme)

  const [summary, setSummary] = useState(null)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [summaryError, setSummaryError] = useState('')

  const [charts, setCharts] = useState(null)
  const [chartsLoading, setChartsLoading] = useState(true)
  const [chartsError, setChartsError] = useState('')

  const [predictions, setPredictions] = useState({ ELECTRICITY: null, WATER: null })
  const [anomalies, setAnomalies] = useState({ ELECTRICITY: null, WATER: null })
  const [budget, setBudget] = useState(null)
  const [applianceData, setApplianceData] = useState(null)

  const [loadingDemo, setLoadingDemo] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  // Each request is fired on its own and updates only its own state, so one slow or failing endpoint
  // can never blank the whole overview. Every state update happens after an await, which keeps this
  // effect free of synchronous renders.
  useEffect(() => {
    if (!token) return undefined
    let cancelled = false

    ;(async () => {
      try {
        const data = await fetchDashboardSummary(token)
        if (!cancelled) setSummary(data)
      } catch (err) {
        if (!cancelled) setSummaryError(err.message)
      } finally {
        if (!cancelled) setSummaryLoading(false)
      }
    })()

    ;(async () => {
      try {
        const data = await fetchDashboardCharts(token)
        if (!cancelled) setCharts(data)
      } catch (err) {
        if (!cancelled) setChartsError(err.message)
      } finally {
        if (!cancelled) setChartsLoading(false)
      }
    })()

    // Predictions, anomalies, the budget and the appliance summary are supplementary: if any of them
    // fails the dashboard simply omits that card rather than reporting an error.
    ;(async () => {
      const [elecPrediction, waterPrediction, elecAnomaly, waterAnomaly, budgetStatus, appliances] =
        await Promise.all([
          fetchUpcomingBillPrediction('ELECTRICITY', token).catch(() => null),
          fetchUpcomingBillPrediction('WATER', token).catch(() => null),
          checkUnusualConsumption('ELECTRICITY', token).catch(() => null),
          checkUnusualConsumption('WATER', token).catch(() => null),
          getBudgetStatus(token).catch(() => null),
          getApplianceBreakdown(token).catch(() => null),
        ])
      if (cancelled) return
      setPredictions({ ELECTRICITY: elecPrediction, WATER: waterPrediction })
      setAnomalies({ ELECTRICITY: elecAnomaly, WATER: waterAnomaly })
      setBudget(budgetStatus)
      setApplianceData(appliances)
    })()

    return () => {
      cancelled = true
    }
  }, [token, reloadKey])

  const reload = () => {
    setSummaryError('')
    setChartsError('')
    setSummaryLoading(true)
    setChartsLoading(true)
    setReloadKey((value) => value + 1)
  }

  const handleLoadDemoData = async () => {
    if (!token) return
    setLoadingDemo(true)
    try {
      // Sequential (not Promise.all) so the demo bills hit the API one at a time rather than in a burst.
      for (const bill of buildDemoBills()) {
        await createBill(bill, token)
      }
      setAuthMessage('Demo bills added — clearly marked "(Demo)" so you can tell them apart from real bills.')
      setAuthError(false)
      reload()
    } catch (err) {
      setSummaryError(err.message)
    } finally {
      setLoadingDemo(false)
    }
  }

  const electricityMonths = useMemo(() => withLabels(charts?.electricityByMonth), [charts])
  const waterMonths = useMemo(() => withLabels(charts?.waterByMonth), [charts])
  const expenseMonths = useMemo(() => withLabels(charts?.expensesByMonth), [charts])
  const yearlyTrends = useMemo(() => charts?.yearlyTrends || [], [charts])

  const totals = charts?.electricityVsWaterTotals || { electricity: 0, water: 0 }
  const totalElecUnits = useMemo(() => sumUnits(charts?.electricityByMonth), [charts])
  const totalWaterUnits = useMemo(() => sumUnits(charts?.waterByMonth), [charts])

  const lastExpense = expenseMonths[expenseMonths.length - 1]
  const previousExpense = expenseMonths[expenseMonths.length - 2]

  const predictedTotal =
    (predictions.ELECTRICITY?.hasEnoughData ? predictions.ELECTRICITY.predictedAmount || 0 : 0) +
    (predictions.WATER?.hasEnoughData ? predictions.WATER.predictedAmount || 0 : 0)
  const estimatedBill = predictedTotal > 0 ? predictedTotal : lastExpense?.amount || 0

  const insights = useMemo(() => {
    const list = []
    if (anomalies.ELECTRICITY?.isUnusual) {
      list.push({ tone: 'warn', title: 'Unusual electricity usage', text: anomalies.ELECTRICITY.message })
    }
    if (anomalies.WATER?.isUnusual) {
      list.push({ tone: 'warn', title: 'Unusual water usage', text: anomalies.WATER.message })
    }
    if (predictions.ELECTRICITY?.hasEnoughData) {
      list.push({
        tone: 'default',
        title: 'Electricity forecast',
        text: `Next electricity bill is predicted at ${formatMoney(predictions.ELECTRICITY.predictedAmount)} (${
          CONFIDENCE_LABEL[predictions.ELECTRICITY.confidence] || 'estimated'
        }).`,
      })
    }
    if (predictions.WATER?.hasEnoughData) {
      list.push({
        tone: 'water',
        title: 'Water forecast',
        text: `Next water bill is predicted at ${formatMoney(predictions.WATER.predictedAmount)} (${
          CONFIDENCE_LABEL[predictions.WATER.confidence] || 'estimated'
        }).`,
      })
    }
    ;(budget?.triggeredAlerts || []).forEach((alert, index) => {
      list.push({ tone: 'warn', title: 'Budget alert', text: alert, key: `budget-${index}` })
    })
    return list
  }, [anomalies, predictions, budget])

  const pieData = [
    { name: 'Electricity', value: totals.electricity },
    { name: 'Water', value: totals.water },
  ].filter((entry) => entry.value > 0)

  const predictionComparison = useMemo(() => {
    const rows = []
    if (predictions.ELECTRICITY?.actualVsPredictedCurrentMonth) {
      rows.push({ label: 'Electricity', ...predictions.ELECTRICITY.actualVsPredictedCurrentMonth })
    }
    if (predictions.WATER?.actualVsPredictedCurrentMonth) {
      rows.push({ label: 'Water', ...predictions.WATER.actualVsPredictedCurrentMonth })
    }
    return rows
  }, [predictions])

  const applianceList = applianceData?.appliances || []
  const topAppliance = applianceList.find((item) => item.isHighestCost) || applianceList[0]

  // The token is guaranteed by the /dashboard route guard, but the guard is cheap to restate so the
  // page degrades to a message rather than a crash if it is ever rendered outside the guard.
  if (!token) {
    return (
      <Card title="Dashboard">
        <p className="eco-muted">Log in to see your real bill history and predictions.</p>
      </Card>
    )
  }

  const hasBills = Boolean(summary?.hasAnyBills)
  const showEmptyState = Boolean(summary) && !summary.hasAnyBills

  return (
    <div className="eco-stack">
      <section className="eco-dash-hero">
        <div className="eco-dash-hero-inner">
          <div>
            <span className="eco-dash-eyebrow">
              <Zap size={13} aria-hidden="true" />
              Your energy, in focus
            </span>
            <h1 className="eco-dash-hello">
              Good to see you, {displayName?.split(' ')[0] || 'there'}.
            </h1>
            <p className="eco-dash-tagline">
              {showEmptyState
                ? 'Add your first bill to unlock consumption charts, payment tracking and forecasts — or explore with demo data.'
                : 'A clear view of your household electricity and water, this month and over time.'}
            </p>
            {hasBills ? (
              <div className="eco-dash-badges">
                <Badge tone="primary" icon={Zap}>
                  {formatUnits(totalElecUnits)} kWh tracked
                </Badge>
                <Badge tone="water" icon={Droplets}>
                  {formatUnits(totalWaterUnits)} kL tracked
                </Badge>
                {summary?.pendingPaymentsCount > 0 ? (
                  <Badge tone="earth" icon={Wallet}>
                    {summary.pendingPaymentsCount} payment{summary.pendingPaymentsCount === 1 ? '' : 's'} pending
                  </Badge>
                ) : (
                  <Badge icon={Receipt}>All bills settled</Badge>
                )}
              </div>
            ) : null}
          </div>

          <div className="eco-dash-hero-actions">
            <button type="button" className="eco-btn eco-btn-primary" onClick={() => navigate('/upload-bill')}>
              <Upload size={16} aria-hidden="true" />
              Add a bill
            </button>
            <button type="button" className="eco-btn eco-btn-secondary" onClick={() => navigate('/bills')}>
              Bill history
            </button>
          </div>
        </div>
      </section>

      {summaryError && !summary ? (
        <Card>
          <Alert variant="error" onClose={() => setSummaryError('')}>
            {summaryError}
            <div style={{ marginTop: 10 }}>
              <button type="button" className="eco-btn eco-btn-secondary eco-btn-sm" onClick={reload}>
                Try again
              </button>
            </div>
          </Alert>
        </Card>
      ) : null}

      {showEmptyState ? (
        <Card>
          <EmptyState
            icon={Receipt}
            title="Your overview will appear here"
            text="Add a bill to unlock consumption charts, payment tracking and history-based forecasts."
            actions={
              <>
                <button type="button" className="eco-btn eco-btn-primary" onClick={() => navigate('/upload-bill')}>
                  Add your first bill
                </button>
                <button
                  type="button"
                  className="eco-btn eco-btn-secondary"
                  onClick={handleLoadDemoData}
                  disabled={loadingDemo}
                >
                  {loadingDemo ? 'Loading demo data…' : 'Explore demo dashboard'}
                </button>
              </>
            }
          />
        </Card>
      ) : null}

      <section className="eco-section-block">
        <div className="eco-section-label">
          <h2>
            <Gauge size={16} aria-hidden="true" />
            Quick actions
          </h2>
        </div>
        <QuickActions />
      </section>

      {summaryLoading && !summary ? <OverviewSkeleton /> : null}

      {hasBills ? (
        <>
          <section className="eco-section-block">
            <div className="eco-section-label">
              <h2>
                <BarChart3 size={16} aria-hidden="true" />
                This month at a glance
              </h2>
            </div>
            <div className="eco-grid eco-grid-4">
              <StatCard
                label="Electricity consumed"
                value={`${formatUnits(totalElecUnits)} kWh`}
                meta={`Across ${electricityMonths.length} month${electricityMonths.length === 1 ? '' : 's'}`}
                icon={Zap}
                tone="brand"
              />
              <StatCard
                label="Water consumed"
                value={`${formatUnits(totalWaterUnits)} kL`}
                meta={`Across ${waterMonths.length} month${waterMonths.length === 1 ? '' : 's'}`}
                icon={Droplets}
                tone="water"
              />
              <StatCard
                label="Current estimated bill"
                value={formatMoneyRounded(estimatedBill)}
                trend={monthTrend(lastExpense?.amount, previousExpense?.amount)}
                icon={Receipt}
                tone="earth"
              />
              <StatCard
                label="Pending payments"
                value={summary.pendingPaymentsCount}
                meta={`${formatMoney(summary.pendingPaymentsTotal)} outstanding`}
                icon={Wallet}
                tone="brand"
              />
            </div>
          </section>

          <section className="eco-section-block">
            <div className="eco-section-label">
              <h2>
                <BarChart3 size={16} aria-hidden="true" />
                Consumption and spending
              </h2>
              {chartsError ? (
                <button type="button" className="eco-btn eco-btn-ghost eco-btn-sm" onClick={reload}>
                  Refresh charts
                </button>
              ) : null}
            </div>

            {chartsError && !charts ? (
              <Card>
                <Alert variant="error" onClose={() => setChartsError('')}>
                  Charts could not be loaded. {chartsError}
                </Alert>
              </Card>
            ) : null}

            {chartsLoading && !charts ? (
              <div className="eco-grid eco-grid-2" aria-hidden="true">
                <Skeleton className="eco-skel-block" style={{ height: 320 }} />
                <Skeleton className="eco-skel-block" style={{ height: 320 }} />
              </div>
            ) : null}

            {charts ? (
              <div className="eco-grid eco-grid-2">
                <ChartCard
                  title="Electricity consumption"
                  subtitle="Units (kWh) per billing month"
                  icon={Zap}
                  hasData={electricityMonths.length > 0}
                  emptyTitle="No electricity history yet"
                  emptyText="Upload an electricity bill to start building your monthly usage chart."
                >
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={electricityMonths}>
                      <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} vertical={false} />
                      <XAxis dataKey="label" {...axisProps} />
                      <YAxis {...axisProps} />
                      <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: palette.tooltipText }} />
                      <Bar
                        dataKey="units"
                        name="Units (kWh)"
                        fill={palette.electricity}
                        radius={[5, 5, 0, 0]}
                        maxBarSize={46}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard
                  title="Water consumption"
                  subtitle="Units (kL) per billing month"
                  icon={Droplets}
                  hasData={waterMonths.length > 0}
                  emptyTitle="No water history yet"
                  emptyText="Upload a water bill to start building your monthly usage chart."
                >
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={waterMonths}>
                      <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} vertical={false} />
                      <XAxis dataKey="label" {...axisProps} />
                      <YAxis {...axisProps} />
                      <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: palette.tooltipText }} />
                      <Bar
                        dataKey="units"
                        name="Units (kL)"
                        fill={palette.water}
                        radius={[5, 5, 0, 0]}
                        maxBarSize={46}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard
                  title="Monthly spend"
                  subtitle="Combined electricity and water"
                  icon={Receipt}
                  hasData={expenseMonths.length > 0}
                  emptyTitle="No spending history yet"
                  emptyText="Your combined monthly spend appears once you have at least one bill."
                >
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={expenseMonths}>
                      <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} vertical={false} />
                      <XAxis dataKey="label" {...axisProps} />
                      <YAxis {...axisProps} />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        labelStyle={{ color: palette.tooltipText }}
                        formatter={(value) => formatMoney(value)}
                      />
                      <Line
                        type="monotone"
                        dataKey="amount"
                        name="Amount"
                        stroke={palette.electricity}
                        strokeWidth={3}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard
                  title="Electricity vs water"
                  subtitle="All-time spend split"
                  icon={BarChart3}
                  hasData={pieData.length > 0}
                  emptyTitle="Nothing to compare yet"
                  emptyText="Add bills for both utilities to see how your spending is split."
                >
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={52}
                        outerRadius={92}
                        paddingAngle={3}
                      >
                        <Cell fill={palette.electricity} />
                        <Cell fill={palette.water} />
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatMoney(value)} />
                      <Legend wrapperStyle={{ fontSize: '0.82rem', color: palette.axis }} />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard
                  title="Yearly trends"
                  subtitle="Total spend per year"
                  icon={BarChart3}
                  hasData={yearlyTrends.length > 0}
                  emptyTitle="Not enough history yet"
                  emptyText="Yearly trends appear once you have at least a year of bill history."
                >
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={yearlyTrends}>
                      <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} vertical={false} />
                      <XAxis dataKey="year" {...axisProps} />
                      <YAxis {...axisProps} />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        labelStyle={{ color: palette.tooltipText }}
                        formatter={(value) => formatMoney(value)}
                      />
                      <Bar dataKey="amount" name="Amount" fill={palette.electricity} radius={[5, 5, 0, 0]} maxBarSize={52} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                {predictionComparison.length > 0 ? (
                  <ChartCard
                    title="Predicted vs actual"
                    subtitle="How close this month's estimate was"
                    icon={Gauge}
                    hasData
                  >
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={predictionComparison}>
                        <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} vertical={false} />
                        <XAxis dataKey="label" {...axisProps} />
                        <YAxis {...axisProps} />
                        <Tooltip
                          contentStyle={tooltipStyle}
                          labelStyle={{ color: palette.tooltipText }}
                          formatter={(value) => formatMoney(value)}
                        />
                        <Legend wrapperStyle={{ fontSize: '0.82rem', color: palette.axis }} />
                        <Bar dataKey="actual" name="Actual" fill={palette.electricity} radius={[5, 5, 0, 0]} maxBarSize={46} />
                        <Bar dataKey="predicted" name="Predicted" fill={palette.earth} radius={[5, 5, 0, 0]} maxBarSize={46} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>
                ) : null}
              </div>
            ) : null}
          </section>

          <div className="eco-split">
            <div className="eco-stack">
              <Card
                title="Upcoming due dates"
                subtitle="Stay ahead of the next payment"
                icon={CalendarClock}
                actions={
                  <button type="button" className="eco-btn eco-btn-ghost eco-btn-sm" onClick={() => navigate('/bills')}>
                    View bills
                    <ArrowRight size={14} aria-hidden="true" />
                  </button>
                }
              >
                {summary.upcomingDueDates?.length ? (
                  <ul className="eco-list">
                    {summary.upcomingDueDates.map((due) => (
                      <li key={due.id}>
                        <span>
                          <span className="eco-list-title">{due.provider || 'Utility bill'}</span>
                          <span className="eco-list-sub">
                            <Badge tone={due.utilityType === 'WATER' ? 'water' : 'primary'}>
                              {due.utilityType === 'WATER' ? 'Water' : 'Electricity'}
                            </Badge>{' '}
                            Due {due.dueDate}
                          </span>
                        </span>
                        <span className="eco-bill-amount">{formatMoney(due.amount)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState
                    icon={CalendarClock}
                    title="Nothing due right now"
                    text="When a bill is unpaid and has a due date, it will be listed here."
                  />
                )}
              </Card>

              <Card title="Spending comparison" subtitle="This month against last month" icon={Receipt}>
                {lastExpense ? (
                  <>
                    <div className="eco-summary-row">
                      <span>This month (combined)</span>
                      <span className="eco-bill-amount">{formatMoney(lastExpense.amount)}</span>
                    </div>
                    <div className="eco-summary-row">
                      <span>Last month (combined)</span>
                      <span className="eco-bill-amount">
                        {previousExpense ? formatMoney(previousExpense.amount) : 'No earlier data'}
                      </span>
                    </div>
                    <div className="eco-summary-row">
                      <span>Difference</span>
                      {monthTrend(lastExpense.amount, previousExpense?.amount) ? (
                        <Badge
                          tone={monthTrend(lastExpense.amount, previousExpense?.amount).direction === 'up' ? 'danger' : 'primary'}
                        >
                          {monthTrend(lastExpense.amount, previousExpense?.amount).text}
                        </Badge>
                      ) : (
                        <Badge>No comparison yet</Badge>
                      )}
                    </div>
                  </>
                ) : (
                  <EmptyState
                    icon={BarChart3}
                    title="No spending data yet"
                    text="Once you have a bill for this month, the comparison appears here."
                  />
                )}
              </Card>

              <Card title="Usage insights" subtitle="What your data is telling you" icon={Lightbulb}>
                {insights.length > 0 ? (
                  <div className="eco-stack">
                    {insights.map((insight, index) => (
                      <InsightRow
                        key={insight.key || `${insight.title}-${index}`}
                        tone={insight.tone}
                        title={insight.title}
                        text={insight.text}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={Lightbulb}
                    title="No unusual usage detected"
                    text="We'll flag spikes in electricity or water use here as soon as we spot them."
                  />
                )}
              </Card>

              <Card
                title="Recent bills"
                subtitle="Most recently added statements"
                icon={FileText}
                actions={
                  <button type="button" className="eco-btn eco-btn-ghost eco-btn-sm" onClick={() => navigate('/bills')}>
                    All bills
                    <ArrowRight size={14} aria-hidden="true" />
                  </button>
                }
              >
                {summary.recentBills?.length ? (
                  <div>
                    {summary.recentBills.map((billRow) => (
                      <div className="eco-bill-row" key={billRow.id}>
                        <div>
                          <div className="eco-list-title">{billRow.provider || 'Utility bill'}</div>
                          <div className="eco-list-sub">
                            {billRow.billingMonth} ·{' '}
                            <Badge tone={billRow.utilityType === 'WATER' ? 'water' : 'primary'}>
                              {billRow.utilityType === 'WATER' ? 'Water' : 'Electricity'}
                            </Badge>{' '}
                            <Badge tone={billRow.paymentStatus === 'PAID' ? 'primary' : 'earth'}>
                              {billRow.paymentStatus === 'PAID' ? 'Paid' : 'Pending'}
                            </Badge>
                          </div>
                        </div>
                        <span className="eco-bill-amount">{formatMoney(billRow.amount)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState icon={Receipt} title="No bills yet" text="Your uploaded bills will be listed here." />
                )}
              </Card>
            </div>

            <div className="eco-stack">
              <EnvironmentalImpactCard
                electricity={charts?.electricityByMonth}
                water={charts?.waterByMonth}
              />

              <SavingRecommendationsCard
                budget={budget}
                applianceList={applianceList}
                topAppliance={topAppliance}
                electricity={charts?.electricityByMonth}
                water={charts?.waterByMonth}
              />

              <Card title="Budget progress" subtitle={budget?.currentMonth || 'This month'} icon={Wallet}>
                {budget && budget.combinedBudget > 0 ? (
                  <div className="eco-stack">
                    <ProgressBar
                      value={budget.combinedPercentUsed}
                      tone={
                        budget.combinedPercentUsed >= 100 ? 'danger' : budget.combinedPercentUsed >= 80 ? 'warn' : 'brand'
                      }
                      label="Combined budget used"
                      valueLabel={`${Math.round(budget.combinedPercentUsed || 0)}%`}
                    />
                    <div className="eco-summary-row">
                      <span>Spent this month</span>
                      <span className="eco-bill-amount">{formatMoney(budget.currentCombinedExpense)}</span>
                    </div>
                    <div className="eco-summary-row">
                      <span>Monthly budget</span>
                      <span className="eco-bill-amount">{formatMoney(budget.combinedBudget)}</span>
                    </div>
                    {budget.predictedMonthEndElectricity != null || budget.predictedMonthEndWater != null ? (
                      <div className="eco-summary-row">
                        <span>Projected month end</span>
                        <span className="eco-bill-amount">
                          {formatMoney(
                            (budget.predictedMonthEndElectricity || 0) + (budget.predictedMonthEndWater || 0),
                          )}
                        </span>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <EmptyState
                    icon={Wallet}
                    title="No budget set"
                    text="Set a monthly budget to track how much of it you have used."
                    actions={
                      <button type="button" className="eco-btn eco-btn-secondary eco-btn-sm" onClick={() => navigate('/budget')}>
                        Set a budget
                      </button>
                    }
                  />
                )}
              </Card>

              <Card
                title="Appliance costs"
                subtitle="Estimated from your tracked appliances"
                icon={PlugZap}
                actions={
                  <button type="button" className="eco-btn eco-btn-ghost eco-btn-sm" onClick={() => navigate('/appliances')}>
                    Manage
                  </button>
                }
              >
                {applianceList.length > 0 ? (
                  <div className="eco-stack">
                    <div className="eco-summary-row">
                      <span>Monthly total</span>
                      <span className="eco-bill-amount">{formatMoney(applianceData.totalMonthlyCost)}</span>
                    </div>
                    <div className="eco-summary-row">
                      <span>Annual total</span>
                      <span className="eco-bill-amount">{formatMoney(applianceData.totalAnnualCost)}</span>
                    </div>
                    {topAppliance ? (
                      <div className="eco-insight">
                        <span className="eco-insight-icon">
                          <Zap size={17} aria-hidden="true" />
                        </span>
                        <div>
                          <p>
                            <strong>{topAppliance.name}</strong> costs the most
                          </p>
                          <p>
                            About {formatMoney(topAppliance.monthlyCost)} a month for {topAppliance.quantity} unit
                            {topAppliance.quantity === 1 ? '' : 's'} at {topAppliance.wattage} W.
                          </p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <EmptyState
                    icon={PlugZap}
                    title="No appliances tracked"
                    text="Add your appliances to see which ones cost you the most."
                    actions={
                      <button type="button" className="eco-btn eco-btn-secondary eco-btn-sm" onClick={() => navigate('/appliances')}>
                        Add an appliance
                      </button>
                    }
                  />
                )}
              </Card>

              <QuickEstimateSection compact />
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
