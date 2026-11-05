import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Droplets, Gauge, Info, TrendingUp, Upload, Zap } from 'lucide-react'
import { useAuth } from '../hooks/useAuth.js'
import { useTheme } from '../hooks/useTheme.js'
import { chartThemeFor } from '../utils/chartTheme.js'
import { fetchUpcomingBillPrediction } from '../services/predictionService.js'
import { PageHeader } from '../components/ui/PageHeader.jsx'
import { Card } from '../components/ui/Card.jsx'
import { Badge } from '../components/ui/Badge.jsx'
import { Alert } from '../components/ui/Alert.jsx'
import { EmptyState, Skeleton } from '../components/ui/EmptyState.jsx'

const CONFIDENCE_LABEL = {
  NONE: 'No data yet',
  LOW: 'Low confidence',
  MEDIUM: 'Medium confidence',
  HIGH: 'High confidence',
}

const CONFIDENCE_TONE = { HIGH: 'primary', MEDIUM: 'water', LOW: 'earth' }

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

const UTILITIES = [
  {
    key: 'ELECTRICITY',
    label: 'Electricity',
    unit: 'kWh',
    icon: Zap,
    tone: 'brand',
    emptyText: 'Upload at least two electricity bills and EcoTrack can forecast your next one.',
  },
  {
    key: 'WATER',
    label: 'Water',
    unit: 'kL',
    icon: Droplets,
    tone: 'water',
    emptyText: 'Upload at least two water bills and EcoTrack can forecast your next one.',
  },
]

/** One utility's forecast: headline amount, expected range, confidence and the last actual bill. */
function ForecastCard({ utility, prediction }) {
  const { label, unit, icon: Icon, tone, emptyText } = utility

  if (!prediction) {
    return (
      <Card title={`${label} forecast`} subtitle="Next billing cycle" icon={Icon}>
        <Skeleton className="eco-skel-block" style={{ height: 148 }} />
      </Card>
    )
  }

  if (!prediction.hasEnoughData) {
    return (
      <Card title={`${label} forecast`} subtitle="Next billing cycle" icon={Icon}>
        <EmptyState icon={Icon} title="Not enough history yet" text={prediction.message || emptyText} />
      </Card>
    )
  }

  const low = prediction.estimatedAmountLow
  const high = prediction.estimatedAmountHigh
  const previous = prediction.previousBillAmount
  const delta =
    Number.isFinite(prediction.predictedAmount) && Number.isFinite(previous) ? prediction.predictedAmount - previous : null

  return (
    <Card
      title={`${label} forecast`}
      subtitle="Next billing cycle"
      icon={Icon}
      actions={
        <Badge tone={CONFIDENCE_TONE[prediction.confidence] || 'default'}>
          {CONFIDENCE_LABEL[prediction.confidence] || 'Estimated'}
        </Badge>
      }
    >
      <div className={`eco-predict ${tone === 'water' ? 'is-water' : ''}`.trim()}>
        <div className="eco-predict-headline">
          <span className="eco-predict-label">Predicted amount</span>
          <span className="eco-predict-value">{formatMoneyRounded(prediction.predictedAmount)}</span>
          {Number.isFinite(prediction.predictedUnits) ? (
            <span className="eco-predict-sub">
              about {formatUnits(prediction.predictedUnits)} {unit}
            </span>
          ) : null}
        </div>

        <div className="eco-predict-facts">
          <div className="eco-predict-fact">
            <span>Expected range</span>
            <strong>
              {Number.isFinite(low) && Number.isFinite(high)
                ? `${formatMoneyRounded(low)} – ${formatMoneyRounded(high)}`
                : 'Not available'}
            </strong>
          </div>
          <div className="eco-predict-fact">
            <span>Last bill</span>
            <strong>{Number.isFinite(previous) ? formatMoney(previous) : 'No earlier bill'}</strong>
          </div>
          <div className="eco-predict-fact">
            <span>Change vs last bill</span>
            {delta == null ? (
              <Badge>No comparison yet</Badge>
            ) : (
              <Badge tone={delta > 0 ? 'danger' : 'primary'}>
                {delta > 0 ? '+' : '−'}
                {formatMoney(Math.abs(delta))}
              </Badge>
            )}
          </div>
        </div>

        {prediction.actualVsPredictedCurrentMonth ? (
          <div className="eco-predict-accuracy">
            <span className="eco-predict-label">
              This month — {prediction.actualVsPredictedCurrentMonth.month}
            </span>
            <div className="eco-predict-facts">
              <div className="eco-predict-fact">
                <span>Actual</span>
                <strong>{formatMoney(prediction.actualVsPredictedCurrentMonth.actualAmount)}</strong>
              </div>
              <div className="eco-predict-fact">
                <span>We predicted</span>
                <strong>{formatMoney(prediction.actualVsPredictedCurrentMonth.predictedAmount)}</strong>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  )
}

export function PredictionPage() {
  const { token } = useAuth()
  const { theme } = useTheme()
  const navigate = useNavigate()
  const { palette, tooltipStyle, axisProps } = chartThemeFor(theme)

  const [predictions, setPredictions] = useState({ ELECTRICITY: null, WATER: null })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  // Each utility is requested on its own so a single failure cannot blank the whole page.
  useEffect(() => {
    if (!token) return undefined
    let cancelled = false

    ;(async () => {
      const [electricity, water] = await Promise.all([
        fetchUpcomingBillPrediction('ELECTRICITY', token).catch(() => null),
        fetchUpcomingBillPrediction('WATER', token).catch(() => null),
      ])
      if (cancelled) return
      setPredictions({ ELECTRICITY: electricity, WATER: water })
      if (!electricity && !water) {
        setError('We could not reach the prediction service. Please try again in a moment.')
      }
      setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [token, reloadKey])

  const reload = () => {
    setError('')
    setLoading(true)
    setReloadKey((value) => value + 1)
  }

  const comparison = useMemo(() => {
    const rows = []
    if (predictions.ELECTRICITY?.actualVsPredictedCurrentMonth) {
      rows.push({ label: 'Electricity', ...predictions.ELECTRICITY.actualVsPredictedCurrentMonth })
    }
    if (predictions.WATER?.actualVsPredictedCurrentMonth) {
      rows.push({ label: 'Water', ...predictions.WATER.actualVsPredictedCurrentMonth })
    }
    return rows
  }, [predictions])

  const hasForecast = UTILITIES.some(({ key }) => predictions[key]?.hasEnoughData)

  if (!token) {
    return (
      <div className="eco-stack">
        <PageHeader eyebrow="Forecast" icon={TrendingUp} title="Bill prediction" />
        <Card>
          <p className="eco-muted">Sign in to see your forecasts.</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="eco-stack">
      <PageHeader
        breadcrumbs={[{ label: 'Overview', onClick: () => navigate('/dashboard') }, { label: 'Bill prediction' }]}
        eyebrow="Forecast"
        icon={TrendingUp}
        title="Bill prediction"
        description="EcoTrack reads your own billing history and estimates what the next electricity and water bill will come to, with a range so you know how firm the number is."
        actions={
          <button type="button" className="eco-btn eco-btn-primary" onClick={() => navigate('/upload-bill')}>
            <Upload size={16} aria-hidden="true" />
            Add a bill
          </button>
        }
      />

      {error ? (
        <Alert variant="error" onClose={() => setError('')}>
          {error}
          <div style={{ marginTop: 10 }}>
            <button type="button" className="eco-btn eco-btn-secondary eco-btn-sm" onClick={reload}>
              Try again
            </button>
          </div>
        </Alert>
      ) : null}

      {loading && !hasForecast ? (
        <div className="eco-grid eco-grid-2" aria-hidden="true">
          <Skeleton className="eco-skel-block" style={{ height: 268 }} />
          <Skeleton className="eco-skel-block" style={{ height: 268 }} />
        </div>
      ) : (
        <div className="eco-grid eco-grid-2">
          {UTILITIES.map((utility) => (
            <ForecastCard key={utility.key} utility={utility} prediction={predictions[utility.key]} />
          ))}
        </div>
      )}

      {comparison.length > 0 ? (
        <Card
          title="Predicted vs actual"
          subtitle="How close this month's estimate was to the real bill"
          icon={Gauge}
        >
          <div className="eco-chart-box">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={comparison}>
                <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} vertical={false} />
                <XAxis dataKey="label" {...axisProps} />
                <YAxis {...axisProps} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: palette.tooltipText }}
                  formatter={(value) => formatMoney(value)}
                />
                <Legend wrapperStyle={{ fontSize: '0.82rem', color: palette.axis }} />
                <Bar dataKey="actual" name="Actual" fill={palette.electricity} radius={[5, 5, 0, 0]} maxBarSize={52} />
                <Bar dataKey="predicted" name="Predicted" fill={palette.earth} radius={[5, 5, 0, 0]} maxBarSize={52} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      ) : null}

      <Card title="How the forecast is built" subtitle="No guesswork — just your own numbers" icon={Info}>
        <ul className="eco-list">
          <li>
            <span>
              <span className="eco-list-title">Your billed history only</span>
              <span className="eco-list-sub">
                The forecast uses the consumption recorded on your uploaded bills. Nothing is typed in by hand and no
                figure is invented when there is not enough history.
              </span>
            </span>
          </li>
          <li>
            <span>
              <span className="eco-list-title">Confidence reflects how much data exists</span>
              <span className="eco-list-sub">
                More billed months means a narrower range and higher confidence. With only one or two months the range
                stays deliberately wide so it is not mistaken for a precise figure.
              </span>
            </span>
          </li>
          <li>
            <span>
              <span className="eco-list-title">Bills settle once they arrive</span>
              <span className="eco-list-sub">
                When the real bill for the month is uploaded, the estimate is replaced by the actual amount.
              </span>
            </span>
          </li>
        </ul>
      </Card>
    </div>
  )
}
