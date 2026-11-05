import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Calculator,
  CalendarClock,
  Lightbulb,
  Pencil,
  PlugZap,
  Plus,
  Trash2,
  Wallet,
} from 'lucide-react'
import { APPLIANCE_CATALOG, catalogById } from '../appliancesCatalog.js'
import { useAppState } from '../hooks/useAppState.js'
import { useAuth } from '../hooks/useAuth.js'
import {
  createAppliance,
  deleteAppliance,
  getApplianceBreakdown,
  updateAppliance,
} from '../services/applianceService.js'
import { getRecommendations, setRecommendationCompleted } from '../services/recommendationService.js'
import { PageHeader } from '../components/ui/PageHeader.jsx'
import { Card } from '../components/ui/Card.jsx'
import { StatCard } from '../components/ui/StatCard.jsx'
import { Badge } from '../components/ui/Badge.jsx'
import { Alert } from '../components/ui/Alert.jsx'
import { EmptyState, Skeleton } from '../components/ui/EmptyState.jsx'
import { SelectField, TextField } from '../components/ui/Field.jsx'
import { LoadingButton } from '../components/LoadingButton.jsx'

const EMPTY_FORM = {
  name: '',
  catalogId: APPLIANCE_CATALOG[0].id,
  quantity: 1,
  wattage: '',
  hoursPerDay: '',
  daysPerMonth: 30,
}

const CATALOG_OPTIONS = APPLIANCE_CATALOG.map((appliance) => ({ value: appliance.id, label: appliance.name }))

function MyAppliancesSection() {
  const { token, setAuthMessage } = useAuth()
  const [breakdown, setBreakdown] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!token) return undefined
    let cancelled = false
    ;(async () => {
      try {
        const data = await getApplianceBreakdown(token)
        if (cancelled) return
        setBreakdown(data)
        setError('')
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load appliances')
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

  const resetForm = () => {
    setForm(EMPTY_FORM)
    setEditingId(null)
  }

  const startEdit = (item) => {
    setForm({
      name: item.name,
      catalogId: item.catalogId || APPLIANCE_CATALOG[0].id,
      quantity: item.quantity,
      wattage: item.wattage,
      hoursPerDay: item.hoursPerDay,
      daysPerMonth: item.daysPerMonth,
    })
    setEditingId(item.id)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!token) return
    setSaving(true)
    setError('')
    const payload = {
      name: form.name,
      catalogId: form.catalogId,
      quantity: Number(form.quantity) || 1,
      wattage: Number(form.wattage),
      hoursPerDay: Number(form.hoursPerDay),
      daysPerMonth: Number(form.daysPerMonth) || 30,
    }
    try {
      if (editingId) {
        await updateAppliance(editingId, payload, token)
        setAuthMessage?.('Appliance updated.')
      } else {
        await createAppliance(payload, token)
        setAuthMessage?.('Appliance added.')
      }
      resetForm()
      reload()
    } catch (err) {
      setError(err.message || 'Could not save appliance')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!token || deletingId) return
    if (!window.confirm('Delete this appliance?')) return
    setDeletingId(id)
    try {
      await deleteAppliance(id, token)
      reload()
    } catch (err) {
      setError(err.message || 'Could not delete appliance')
    } finally {
      setDeletingId(null)
    }
  }

  const appliances = breakdown?.appliances || []
  const hasAppliances = appliances.length > 0

  return (
    <div className="eco-stack">
      {error ? (
        <Alert variant="error" onClose={() => setError('')}>
          {error}
        </Alert>
      ) : null}

      <Card
        title="Add an appliance"
        subtitle={
          editingId
            ? 'Editing an appliance — save your changes or cancel to add a new one.'
            : 'Enter the real wattage and usage so your running-cost estimates are exact.'
        }
        icon={editingId ? Pencil : Plus}
      >
        <form onSubmit={handleSubmit}>
          <div className="eco-field-row">
            <TextField
              label="Name"
              value={form.name}
              placeholder="e.g. Living room AC"
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
            <SelectField
              label="Category"
              value={form.catalogId}
              onChange={(e) => setForm((f) => ({ ...f, catalogId: e.target.value }))}
              options={CATALOG_OPTIONS}
            />
          </div>

          <div className="eco-field-row eco-card-gap">
            <TextField
              label="Quantity"
              type="number"
              min="1"
              value={form.quantity}
              onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
              required
            />
            <TextField
              label="Wattage (W)"
              type="number"
              min="1"
              step="1"
              placeholder="e.g. 1500"
              value={form.wattage}
              onChange={(e) => setForm((f) => ({ ...f, wattage: e.target.value }))}
              help="Your appliance's actual or nameplate wattage."
              required
            />
            <TextField
              label="Hours / day"
              type="number"
              min="0"
              max="24"
              step="0.5"
              value={form.hoursPerDay}
              onChange={(e) => setForm((f) => ({ ...f, hoursPerDay: e.target.value }))}
              required
            />
            <TextField
              label="Days / month"
              type="number"
              min="1"
              max="31"
              value={form.daysPerMonth}
              onChange={(e) => setForm((f) => ({ ...f, daysPerMonth: e.target.value }))}
            />
          </div>

          <div className="eco-row eco-card-gap" style={{ gap: 10 }}>
            <LoadingButton
              type="submit"
              className="eco-btn eco-btn-primary"
              loading={saving}
              loadingText={editingId ? 'Saving…' : 'Adding…'}
            >
              {editingId ? <Pencil size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
              {editingId ? 'Save changes' : 'Add appliance'}
            </LoadingButton>
            {editingId ? (
              <button type="button" className="eco-btn eco-btn-secondary" onClick={resetForm}>
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      </Card>

      <Card
        padded={false}
        title="Your appliances"
        subtitle={
          loading
            ? 'Loading your appliances…'
            : `${appliances.length} ${appliances.length === 1 ? 'appliance' : 'appliances'} tracked`
        }
        icon={PlugZap}
      >
        {loading ? (
          <div className="eco-stack" style={{ padding: 22 }}>
            {[0, 1, 2].map((row) => (
              <Skeleton key={row} className="eco-skel-line" style={{ width: `${92 - row * 9}%` }} />
            ))}
          </div>
        ) : !hasAppliances ? (
          <EmptyState
            icon={PlugZap}
            title="No appliances yet"
            text="Add your first appliance above and EcoTrack will cost it exactly, using its real wattage and your daily hours."
          />
        ) : (
          <div className="eco-table-wrap">
            <table className="eco-table">
              <thead>
                <tr>
                  <th>Appliance</th>
                  <th className="eco-table-num">Qty</th>
                  <th className="eco-table-num">Wattage</th>
                  <th className="eco-table-num">Hours/day</th>
                  <th className="eco-table-num">Daily cost</th>
                  <th className="eco-table-num">Monthly cost</th>
                  <th className="eco-table-num">Annual cost</th>
                  <th className="eco-table-num">Actions</th>
                </tr>
              </thead>
              <tbody>
                {appliances.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <span className="eco-list-title">{item.name}</span>
                      <span className="eco-list-sub" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 5 }}>
                        <Badge tone="primary">{catalogById(item.catalogId).name}</Badge>
                        {item.isHighestCost ? <Badge tone="earth">Highest cost</Badge> : null}
                      </span>
                    </td>
                    <td className="eco-table-num">{item.quantity}</td>
                    <td className="eco-table-num">{item.wattage} W</td>
                    <td className="eco-table-num">{item.hoursPerDay}</td>
                    <td className="eco-table-num">₹{item.dailyCost.toFixed(2)}</td>
                    <td className="eco-table-num">₹{item.monthlyCost.toFixed(2)}</td>
                    <td className="eco-table-num">₹{item.annualCost.toFixed(2)}</td>
                    <td>
                      <div className="eco-table-actions">
                        <button
                          type="button"
                          className="eco-btn eco-btn-secondary eco-btn-sm"
                          onClick={() => startEdit(item)}
                          disabled={Boolean(deletingId)}
                        >
                          <Pencil size={15} aria-hidden="true" />
                          Edit
                        </button>
                        <LoadingButton
                          type="button"
                          className="eco-btn eco-btn-danger eco-btn-sm"
                          onClick={() => handleDelete(item.id)}
                          disabled={Boolean(deletingId)}
                          loading={deletingId === item.id}
                          loadingText="Removing…"
                        >
                          <Trash2 size={15} aria-hidden="true" />
                          Remove
                        </LoadingButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {hasAppliances ? (
        <div className="eco-grid eco-grid-2">
          <StatCard
            label="Total monthly cost"
            value={`₹${breakdown.totalMonthlyCost.toFixed(2)}`}
            meta={`Across ${appliances.length} tracked ${appliances.length === 1 ? 'appliance' : 'appliances'}`}
            icon={CalendarClock}
            tone="brand"
          />
          <StatCard
            label="Total annual cost"
            value={`₹${breakdown.totalAnnualCost.toFixed(2)}`}
            meta="Projected for the full year"
            icon={Wallet}
            tone="earth"
          />
        </div>
      ) : null}

      <RecommendationsPanel />
    </div>
  )
}

function RecommendationsPanel() {
  const { token } = useAuth()
  const [recommendations, setRecommendations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCompleted, setShowCompleted] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!token) return undefined
    let cancelled = false
    ;(async () => {
      try {
        const data = await getRecommendations(token)
        if (cancelled) return
        setRecommendations(data)
        setError('')
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load recommendations')
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

  const toggleCompleted = async (item) => {
    if (!token) return
    try {
      await setRecommendationCompleted(item.id, !item.completed, token)
      reload()
    } catch (err) {
      setError(err.message || 'Could not update recommendation')
    }
  }

  if (!token) return null

  const active = recommendations.filter((r) => !r.completed)
  const completed = recommendations.filter((r) => r.completed)

  return (
    <Card
      title="Recommendations"
      subtitle="Tailored tips based on your appliances, bills and budget."
      icon={Lightbulb}
    >
      {error ? (
        <Alert variant="error" className="eco-card-gap" onClose={() => setError('')}>
          {error}
        </Alert>
      ) : null}

      {loading ? (
        <div className="eco-stack">
          <Skeleton className="eco-skel-line" />
          <Skeleton className="eco-skel-line" style={{ width: '80%' }} />
        </div>
      ) : recommendations.length === 0 ? (
        <EmptyState
          icon={Lightbulb}
          title="No recommendations yet"
          text="No recommendations right now — add appliances, bills, or a budget to get tailored tips."
        />
      ) : (
        <>
          {active.length === 0 ? (
            <Alert variant="success">All caught up — no active recommendations.</Alert>
          ) : (
            <ul className="eco-list">
              {active.map((item) => (
                <li key={item.id}>
                  <label className="eco-check" style={{ flex: 1 }}>
                    <input
                      type="checkbox"
                      checked={item.completed}
                      onChange={() => toggleCompleted(item)}
                      aria-label="Mark completed"
                    />
                    <span>{item.text}</span>
                  </label>
                  <Badge>{item.category}</Badge>
                </li>
              ))}
            </ul>
          )}

          {completed.length > 0 ? (
            <div className="eco-card-gap">
              <button
                type="button"
                className="eco-btn eco-btn-ghost eco-btn-sm"
                onClick={() => setShowCompleted((s) => !s)}
              >
                {showCompleted ? 'Hide' : 'Show'} completed ({completed.length})
              </button>
              {showCompleted ? (
                <ul className="eco-list" style={{ marginTop: 6 }}>
                  {completed.map((item) => (
                    <li key={item.id}>
                      <label className="eco-check" style={{ flex: 1 }}>
                        <input
                          type="checkbox"
                          checked={item.completed}
                          onChange={() => toggleCompleted(item)}
                          aria-label="Mark not completed"
                        />
                        <span className="eco-muted">{item.text}</span>
                      </label>
                      <Badge>{item.category}</Badge>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </Card>
  )
}

export function QuickEstimateSection({ compact = false }) {
  const { applianceRows, setApplianceRows, addApplianceRow, removeApplianceRow, applianceEstimate } = useAppState()
  const applianceCount = applianceRows.reduce((total, row) => total + (Number(row.count) || 0), 0)

  return (
    <Card padded={false}>
      <div style={{ padding: compact ? '16px 16px 18px' : '22px 24px 24px' }}>
        <div className="eco-between" style={{ marginBottom: compact ? 10 : 14 }}>
          <div>
            {!compact ? <span className="eco-page-eyebrow">Plan ahead</span> : null}
            <h3 className="eco-card-title" style={compact ? { fontSize: '1rem' } : undefined}>
              <Calculator size={compact ? 15 : 17} aria-hidden="true" />
              Bill calculator
            </h3>
          </div>
          <Badge tone="primary">{applianceCount} total</Badge>
        </div>

        <p className="eco-small eco-muted" style={{ margin: '0 0 14px' }}>
          Add appliances, quantity and daily use for a pre-bill electricity estimate. Rate: ₹
          {applianceEstimate.rate.toFixed(2)}/kWh.
        </p>

        <div className="eco-stack" style={{ gap: 12 }}>
          {applianceRows.map((row) => (
            <div className="eco-field-row" key={row.id}>
              <SelectField
                label="Appliance"
                value={row.applianceId}
                onChange={(e) =>
                  setApplianceRows((rows) =>
                    rows.map((r) => (r.id === row.id ? { ...r, applianceId: e.target.value } : r)),
                  )
                }
                options={CATALOG_OPTIONS}
              />
              <TextField
                label="Quantity"
                type="number"
                min="1"
                value={row.count}
                onChange={(e) =>
                  setApplianceRows((rows) =>
                    rows.map((r) => (r.id === row.id ? { ...r, count: e.target.value } : r)),
                  )
                }
              />
              <TextField
                label="Hours / day"
                type="number"
                min="0"
                max="24"
                step="0.5"
                value={row.hours}
                onChange={(e) =>
                  setApplianceRows((rows) =>
                    rows.map((r) => (r.id === row.id ? { ...r, hours: e.target.value } : r)),
                  )
                }
              />
              <div className="eco-field">
                <span className="eco-label" aria-hidden="true">
                  &nbsp;
                </span>
                <button
                  type="button"
                  className="eco-btn eco-btn-ghost"
                  onClick={() => removeApplianceRow(row.id)}
                  disabled={applianceRows.length <= 1}
                  aria-label={`Remove ${
                    APPLIANCE_CATALOG.find((item) => item.id === row.applianceId)?.name || 'appliance'
                  }`}
                >
                  <Trash2 size={15} aria-hidden="true" />
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          className="eco-btn eco-btn-secondary eco-btn-sm eco-card-gap"
          onClick={addApplianceRow}
        >
          <Plus size={15} aria-hidden="true" />
          Add another appliance
        </button>

        <div className="eco-summary-row is-total" style={{ marginTop: 16 }}>
          <span>Estimated monthly electricity</span>
          <span className="eco-summary-value">
            ₹{applianceEstimate.low.toFixed(0)} – ₹{applianceEstimate.high.toFixed(0)}
          </span>
        </div>
        <p className="eco-small eco-muted" style={{ margin: '8px 0 0' }}>
          Estimate based on typical wattage and current tariff from {applianceEstimate.tariffName}. Excludes water,
          fixed charges and taxes.
        </p>
      </div>
    </Card>
  )
}

export function AppliancesPage() {
  const navigate = useNavigate()

  return (
    <div>
      <PageHeader
        breadcrumbs={[
          { label: 'Overview', onClick: () => navigate('/dashboard') },
          { label: 'My appliances' },
        ]}
        eyebrow="Tracking"
        title="My appliances"
        description="Track your own appliances with their actual wattage to get exact monthly and annual costs, see which appliance costs you the most, and get simple tips to reduce usage."
        icon={PlugZap}
      />

      <div className="eco-stack">
        <MyAppliancesSection />
        <QuickEstimateSection />
      </div>
    </div>
  )
}
