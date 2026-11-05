import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PiggyBank, Target, Wallet } from 'lucide-react'
import { useAuth } from '../hooks/useAuth.js'
import { getBudget, getBudgetStatus, updateBudget } from '../services/budgetService.js'
import { PageHeader } from '../components/ui/PageHeader.jsx'
import { Card } from '../components/ui/Card.jsx'
import { Alert } from '../components/ui/Alert.jsx'
import { Skeleton } from '../components/ui/EmptyState.jsx'
import { ProgressBar } from '../components/ui/Badge.jsx'
import { TextField } from '../components/ui/Field.jsx'
import { LoadingButton } from '../components/LoadingButton.jsx'

const DEFAULT_THRESHOLDS = [50, 80, 100]
const THRESHOLD_LABELS = ['First alert (%)', 'Second alert (%)', 'Final alert (%)']

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 })

function formatMoney(value) {
  return money.format(Number.isFinite(value) ? value : 0)
}

/** Usage percent decides the bar colour: green while comfortable, amber near the limit, red past it. */
function toneFor(percent, base = 'brand') {
  if (percent >= 100) return 'danger'
  if (percent >= 80) return 'warn'
  return base
}

export function BudgetManagementPage() {
  const navigate = useNavigate()
  const { token } = useAuth()
  const [form, setForm] = useState({ electricityBudget: '', waterBudget: '', thresholds: DEFAULT_THRESHOLDS })
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!token) return undefined
    let cancelled = false
    ;(async () => {
      try {
        const [budget, budgetStatus] = await Promise.all([getBudget(token), getBudgetStatus(token)])
        if (cancelled) return
        setForm({
          electricityBudget: budget.electricityBudget ?? '',
          waterBudget: budget.waterBudget ?? '',
          thresholds: budget.alertThresholds?.length ? budget.alertThresholds : DEFAULT_THRESHOLDS,
        })
        setStatus(budgetStatus)
        setError('')
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load your budget.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, reloadKey])

  const reload = () => {
    setLoading(true)
    setReloadKey((value) => value + 1)
  }

  const handleThresholdChange = (index, value) => {
    setForm((current) => {
      const thresholds = [...current.thresholds]
      thresholds[index] = value
      return { ...current, thresholds }
    })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!token) return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const thresholds = form.thresholds.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0)
      await updateBudget(
        {
          electricityBudget: form.electricityBudget === '' ? 0 : Number(form.electricityBudget),
          waterBudget: form.waterBudget === '' ? 0 : Number(form.waterBudget),
          alertThresholds: thresholds.length ? thresholds : DEFAULT_THRESHOLDS,
        },
        token,
      )
      setMessage('Budget saved. Your alerts and progress bars below are up to date.')
      setLoading(true)
      setReloadKey((value) => value + 1)
    } catch (err) {
      setError(err.message || 'Could not save your budget.')
    } finally {
      setSaving(false)
    }
  }

  if (!token) {
    return (
      <div>
        <PageHeader
          breadcrumbs={[{ label: 'Overview', onClick: () => navigate('/dashboard') }, { label: 'Budget' }]}
          eyebrow="Spending"
          title="Budget management"
          description="Set monthly caps for electricity and water and get warned before you cross them."
          icon={Wallet}
        />
        <Card>
          <Alert variant="info">Log in to set up and track your monthly budgets.</Alert>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Overview', onClick: () => navigate('/dashboard') }, { label: 'Budget' }]}
        eyebrow="Spending"
        title="Budget management"
        description="Set monthly caps for electricity and water and get warned before you cross them. Leave a cap at 0 to stop tracking it."
        icon={Wallet}
      />

      <div className="eco-stack">
        {error ? (
          <Alert variant="error" onClose={() => setError('')}>
            {error}
          </Alert>
        ) : null}
        {message ? (
          <Alert variant="success" onClose={() => setMessage('')}>
            {message}
          </Alert>
        ) : null}

        <div className="eco-grid eco-grid-2">
          <Card title="Monthly budgets" subtitle="Amounts are in ₹ per calendar month." icon={Target}>
            <form onSubmit={handleSubmit}>
              <div className="eco-field-row">
                <TextField
                  label="Electricity budget (₹/month)"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0"
                  value={form.electricityBudget}
                  onChange={(event) => setForm((f) => ({ ...f, electricityBudget: event.target.value }))}
                />
                <TextField
                  label="Water budget (₹/month)"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0"
                  value={form.waterBudget}
                  onChange={(event) => setForm((f) => ({ ...f, waterBudget: event.target.value }))}
                />
              </div>

              <p className="eco-label" style={{ marginBottom: 6 }}>
                Alert thresholds
              </p>
              <div className="eco-field-row">
                {THRESHOLD_LABELS.map((label, index) => (
                  <TextField
                    key={label}
                    label={label}
                    type="number"
                    min="1"
                    max="500"
                    value={form.thresholds[index] ?? ''}
                    onChange={(event) => handleThresholdChange(index, event.target.value)}
                  />
                ))}
              </div>

              <LoadingButton
                type="submit"
                className="eco-btn eco-btn-primary"
                loading={saving}
                loadingText="Saving…"
              >
                Save budget
              </LoadingButton>
            </form>
          </Card>

          <Card
            title={status ? `This month — ${status.currentMonth}` : 'This month'}
            subtitle="Live spend measured against the caps you set."
            icon={PiggyBank}
          >
            {loading ? (
              <div className="eco-stack">
                <Skeleton className="eco-skel-line" />
                <Skeleton className="eco-skel-block" />
                <Skeleton className="eco-skel-line" style={{ width: '70%' }} />
              </div>
            ) : status ? (
              <>
                {status.triggeredAlerts?.length > 0 ? (
                  <div className="eco-stack" style={{ marginBottom: 16 }}>
                    {status.triggeredAlerts.map((alert) => (
                      <Alert key={alert} variant="warn">
                        {alert}
                      </Alert>
                    ))}
                  </div>
                ) : null}

                <div className="eco-stack">
                  <ProgressBar
                    label="Electricity"
                    valueLabel={`${formatMoney(status.currentElectricityExpense)} / ${formatMoney(status.electricityBudget)}`}
                    value={status.electricityPercentUsed}
                    tone={toneFor(status.electricityPercentUsed)}
                  />
                  <ProgressBar
                    label="Water"
                    valueLabel={`${formatMoney(status.currentWaterExpense)} / ${formatMoney(status.waterBudget)}`}
                    value={status.waterPercentUsed}
                    tone={toneFor(status.waterPercentUsed, 'water')}
                  />
                  <ProgressBar
                    label="Combined"
                    valueLabel={`${formatMoney(status.currentCombinedExpense)} / ${formatMoney(status.combinedBudget)}`}
                    value={status.combinedPercentUsed}
                    tone={toneFor(status.combinedPercentUsed)}
                  />
                </div>

                <div style={{ marginTop: 18 }}>
                  <div className="eco-summary-row">
                    <span>Predicted electricity by month end</span>
                    <span className="eco-summary-value">
                      {status.predictedMonthEndElectricity != null
                        ? formatMoney(status.predictedMonthEndElectricity)
                        : '—'}
                    </span>
                  </div>
                  <div className="eco-summary-row">
                    <span>Predicted water by month end</span>
                    <span className="eco-summary-value">
                      {status.predictedMonthEndWater != null ? formatMoney(status.predictedMonthEndWater) : '—'}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <Alert variant="info">No budget status yet. Save a budget to start tracking this month.</Alert>
            )}

            <button type="button" className="eco-btn eco-btn-ghost eco-btn-sm" onClick={reload} style={{ marginTop: 14 }}>
              Refresh status
            </button>
          </Card>
        </div>
      </div>
    </div>
  )
}
