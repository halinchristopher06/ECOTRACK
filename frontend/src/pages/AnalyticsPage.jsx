import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Area,
  AreaChart,
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
import { AlertTriangle, BarChart3, Droplets, LineChart as LineChartIcon, PieChart as PieChartIcon, Receipt, Upload, Zap } from 'lucide-react'
import { useAuth } from '../hooks/useAuth.js'
import { useTheme } from '../hooks/useTheme.js'
import { chartThemeFor } from '../utils/chartTheme.js'
import { fetchDashboardCharts, fetchDashboardSummary } from '../services/dashboardService.js'
import { checkUnusualConsumption } from '../services/anomalyService.js'
import { PageHeader } from '../components/ui/PageHeader.jsx'
import { Card } from '../components/ui/Card.jsx'
import { StatCard } from '../components/ui/StatCard.jsx'
import { Alert } from '../components/ui/Alert.jsx'
import { EmptyState, Skeleton } from '../components/ui/EmptyState.jsx'

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

/** "2026-08" → "Aug". Short so a full year of ticks still fits on a phone. */
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

function sumAmount(points) {
  return (points || []).reduce((total, point) => total + (Number(point.amount) || 0), 0)
}

/** Percentage change between the two most recent billed months, phrased for a consumption tile. */
function latestTrend(points) {
  const series = (points || []).filter((point) => Number(point.units) > 0)
  if (series.length < 2) return null
  const current = Number(series[series.length - 1].units) || 0
  const previous = Number(series[series.length - 2].units) || 0
  if (previous === 0) return null
  const percent = Math.abs(((current - previous) / previous) * 100)
  if (percent < 0.5) return { direction: 'flat', text: 'Level with last month' }
  return {
    direction: current > previous ? 'up' : 'down',
    text: `${percent.toFixed(0)}% ${current > previous ? 'higher' : 'lower'} than last month`,
  }
}

/** A chart card that never renders an empty plot area — it explains the situation instead. */
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

/** One anomaly verdict per utility, rendered from the backend check rather than recomputed here. */
function AnomalyRow({ utility, result }) {
  const Icon = utility === 'WATER' ? Droplets : Zap

  if (!result) {
    return (
      <div className="eco-insight">
        <span className="eco-insight-icon">
          <Icon size={17} aria-hidden="true" />
        </span>
        <div>
          <p>
            <strong>{utility === 'WATER' ? 'Water' : 'Electricity'} check</strong>
          </p>
          <p>This check could not be completed right now.</p>
        </div>
      </div>
    )
  }

  if (!result.hasEnoughData) {
    return (
      <div className="eco-insight">
        <span className="eco-insight-icon">
          <Icon size={17} aria-hidden="true" />
        </span>
        <div>
          <p>
            <strong>{utility === 'WATER' ? 'Water' : 'Electricity'} — not enough history</strong>
          </p>
          <p>{result.message || 'Add more bills and EcoTrack can tell normal months apart from unusual ones.'}</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`eco-insight ${result.isUnusual ? 'is-warn' : ''} ${utility === 'WATER' ? 'is-water' : ''}`.trim()}
    >
      <span className="eco-insight-icon">
        {result.isUnusual ? <AlertTriangle size={17} aria-hidden="true" /> : <Icon size={17} aria-hidden="true" />}
      </span>
      <div>
        <p>
          <strong>
            {result.isUnusual
              ? `Unusual ${utility === 'WATER' ? 'water' : 'electricity'} usage`
              : `${utility === 'WATER' ? 'Water' : 'Electricity'} looks normal`}
          </strong>
        </p>
        <p>{result.message}</p>
        {result.recommendedActions?.length ? (
          <ul className="eco-analytics-actions">
            {result.recommendedActions.slice(0, 3).map((action) => (
              <li key={action}>{action}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  )
}

export function AnalyticsPage() {
  const { token } = useAuth()
  const { theme } = useTheme()
  const navigate = useNavigate()
  const { palette, tooltipStyle, axisProps } = chartThemeFor(theme)

  const [charts, setCharts] = useState(null)
  const [chartsLoading, setChartsLoading] = useState(true)
  const [chartsError, setChartsError] = useState('')

  const [summary, setSummary] = useState(null)
  const [anomalies, setAnomalies] = useState({ ELECTRICITY: null, WATER: null })
  const [reloadKey, setReloadKey] = useState(0)

  // Charts and the summary load independently so a failure in one never blanks the page.
  useEffect(() => {
    if (!token) return undefined
    let cancelled = false

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

    ;(async () => {
      const [summaryData, electricity, water] = await Promise.all([
        fetchDashboardSummary(token).catch(() => null),
        checkUnusualConsumption('ELECTRICITY', token).catch(() => null),
        checkUnusualConsumption('WATER', token).catch(() => null),
      ])
      if (cancelled) return
      setSummary(summaryData)
      setAnomalies({ ELECTRICITY: electricity, WATER: water })
    })()

    return () => {
      cancelled = true
    }
  }, [token, reloadKey])

  const reload = () => {
    setChartsError('')
    setChartsLoading(true)
    setReloadKey((value) => value + 1)
  }

  const electricityMonths = useMemo(() => withLabels(charts?.electricityByMonth), [charts])
  const waterMonths = useMemo(() => withLabels(charts?.waterByMonth), [charts])
  const expenseMonths = useMemo(() => withLabels(charts?.expensesByMonth), [charts])
  const yearlyTrends = useMemo(() => charts?.yearlyTrends || [], [charts])

  const totals = charts?.electricityVsWaterTotals || { electricity: 0, water: 0 }
  const totalElecUnits = useMemo(() => sumUnits(charts?.electricityByMonth), [charts])
  const totalWaterUnits = useMemo(() => sumUnits(charts?.waterByMonth), [charts])
  const totalSpend = useMemo(() => sumAmount(charts?.expensesByMonth), [charts])
  const monthsTracked = useMemo(
    () => (charts?.expensesByMonth || []).filter((point) => Number(point.amount) > 0).length,
    [charts],
  )

  const pieData = [
    { name: 'Electricity', value: totals.electricity },
    { name: 'Water', value: totals.water },
  ].filter((entry) => entry.value > 0)

  if (!token) {
    return (
      <div className="eco-stack">
        <PageHeader eyebrow="Analytics" icon={BarChart3} title="Analytics" />
        <Card>
          <p className="eco-muted">Sign in to see your analytics.</p>
        </Card>
      </div>
    )
  }

  const hasBills = Boolean(summary?.hasAnyBills)

  return (
    <div className="eco-stack">
      <PageHeader
        breadcrumbs={[{ label: 'Overview', onClick: () => navigate('/dashboard') }, { label: 'Analytics' }]}
        eyebrow="Analytics"
        icon={BarChart3}
        title="Usage and spend analytics"
        description="Every billed month for electricity, water and combined spend, in one place — built only from the bills you have uploaded."
        actions={
          <button type="button" className="eco-btn eco-btn-secondary" onClick={() => navigate('/reports')}>
            <Receipt size={16} aria-hidden="true" />
            Export reports
          </button>
        }
      />

      {chartsError && !charts ? (
        <Alert variant="error" onClose={() => setChartsError('')}>
          {chartsError}
          <div style={{ marginTop: 10 }}>
            <button type="button" className="eco-btn eco-btn-secondary eco-btn-sm" onClick={reload}>
              Try again
            </button>
          </div>
        </Alert>
      ) : null}

      {chartsLoading && !charts ? (
        <div aria-hidden="true" className="eco-stack">
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
      ) : null}

      {charts ? (
        <>
          {!hasBills ? (
            <Card>
              <EmptyState
                icon={BarChart3}
                title="No analytics yet"
                text="Upload your first bill and this page fills in with monthly consumption, spend and year-on-year trends."
                actions={
                  <button type="button" className="eco-btn eco-btn-primary" onClick={() => navigate('/upload-bill')}>
                    <Upload size={16} aria-hidden="true" />
                    Add your first bill
                  </button>
                }
              />
            </Card>
          ) : (
            <>
              <div className="eco-grid eco-grid-4">
                <StatCard
                  label="Electricity tracked"
                  value={`${formatUnits(totalElecUnits)} kWh`}
                  meta={`Across ${(charts.electricityByMonth || []).length} month${
                    (charts.electricityByMonth || []).length === 1 ? '' : 's'
                  }`}
                  icon={Zap}
                  tone="brand"
                  trend={latestTrend(charts.electricityByMonth)}
                />
                <StatCard
                  label="Water tracked"
                  value={`${formatUnits(totalWaterUnits)} kL`}
                  meta={`Across ${(charts.waterByMonth || []).length} month${
                    (charts.waterByMonth || []).length === 1 ? '' : 's'
                  }`}
                  icon={Droplets}
                  tone="water"
                  trend={latestTrend(charts.waterByMonth)}
                />
                <StatCard
                  label="Total billed spend"
                  value={formatMoneyRounded(totalSpend)}
                  meta={`${monthsTracked} month${monthsTracked === 1 ? '' : 's'} with bills`}
                  icon={Receipt}
                  tone="earth"
                />
                <StatCard
                  label="Electricity share"
                  value={`${
                    totals.electricity + totals.water > 0
                      ? Math.round((totals.electricity / (totals.electricity + totals.water)) * 100)
                      : 0
                  }%`}
                  meta="Of combined utility spend"
                  icon={LineChartIcon}
                  tone="brand"
                />
              </div>

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
                      <Bar dataKey="units" name="Units (kWh)" fill={palette.electricity} radius={[5, 5, 0, 0]} maxBarSize={46} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard
                  title="Water consumption"
                  subtitle="Volume (kL) per billing month"
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
                      <Bar dataKey="units" name="Volume (kL)" fill={palette.water} radius={[5, 5, 0, 0]} maxBarSize={46} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard
                  title="Combined spend"
                  subtitle="Electricity and water billed together each month"
                  icon={Receipt}
                  hasData={expenseMonths.length > 0}
                  emptyTitle="No spending history yet"
                  emptyText="Add electricity or water bills and the monthly spend line appears here."
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
                        strokeWidth={2.5}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard
                  title="Utility split"
                  subtitle="Where your utility money goes"
                  icon={PieChartIcon}
                  hasData={pieData.length > 0}
                  emptyTitle="Nothing to split yet"
                  emptyText="Once you have billed amounts for both electricity and water the split appears here."
                >
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={58}
                        outerRadius={94}
                        paddingAngle={2}
                      >
                        {pieData.map((entry) => (
                          <Cell
                            key={entry.name}
                            fill={entry.name === 'Water' ? palette.water : palette.electricity}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={tooltipStyle}
                        labelStyle={{ color: palette.tooltipText }}
                        formatter={(value) => formatMoney(value)}
                      />
                      <Legend wrapperStyle={{ fontSize: '0.82rem', color: palette.axis }} />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>

              <ChartCard
                title="Year-on-year spend"
                subtitle="Total billed amount per calendar year"
                icon={BarChart3}
                hasData={yearlyTrends.length > 0}
                emptyTitle="No yearly data yet"
                emptyText="A full year of bills is needed before year-on-year trends appear."
              >
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={yearlyTrends}>
                    <defs>
                      <linearGradient id="ecoAnalyticsYear" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={palette.electricity} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={palette.electricity} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} vertical={false} />
                    <XAxis dataKey="year" {...axisProps} />
                    <YAxis {...axisProps} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelStyle={{ color: palette.tooltipText }}
                      formatter={(value) => formatMoney(value)}
                    />
                    <Area
                      type="monotone"
                      dataKey="amount"
                      name="Amount"
                      stroke={palette.electricity}
                      strokeWidth={2.5}
                      fill="url(#ecoAnalyticsYear)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>

              <Card title="Unusual consumption checks" subtitle="Compared against your own historical average" icon={AlertTriangle}>
                <div className="eco-stack">
                  <AnomalyRow utility="ELECTRICITY" result={anomalies.ELECTRICITY} />
                  <AnomalyRow utility="WATER" result={anomalies.WATER} />
                </div>
              </Card>
            </>
          )}
        </>
      ) : null}
    </div>
  )
}
