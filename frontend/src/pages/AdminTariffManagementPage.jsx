import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Droplets, Landmark, Percent, Plus, Table, Trash2, Zap } from 'lucide-react'
import { useAuth } from '../hooks/useAuth.js'
import { useAsyncAction } from '../hooks/useAsyncAction.js'
import { LoadingButton } from '../components/LoadingButton.jsx'
import { PageHeader } from '../components/ui/PageHeader.jsx'
import { Card } from '../components/ui/Card.jsx'
import { Badge } from '../components/ui/Badge.jsx'
import { Alert } from '../components/ui/Alert.jsx'
import { EmptyState, Skeleton } from '../components/ui/EmptyState.jsx'
import { TextField, SelectField } from '../components/ui/Field.jsx'
import { Modal } from '../components/ui/Modal.jsx'
import {
  fetchAdminTariffs,
  createTariffProvider,
  addTariffRateVersion,
  setTariffActive,
  fetchTariffHistory,
} from '../services/tariffAdminService.js'

const UTILITY_OPTIONS = [
  { value: 'ELECTRICITY', label: 'Electricity' },
  { value: 'WATER', label: 'Water' },
]

const emptySlabRow = () => ({ upto: '', rate: '' })

const emptyNewProviderForm = () => ({
  utilityType: 'ELECTRICITY',
  providerName: '',
  category: '',
  unit: '',
  note: '',
  fixedCharges: '0',
  taxesPercent: '0',
  effectiveFrom: new Date().toISOString().slice(0, 10),
  slabs: [emptySlabRow()],
})

function slabsToPayload(slabs) {
  return slabs
    .filter((s) => s.rate !== '' && s.rate !== null)
    .map((s) => ({
      upto: s.upto === '' || s.upto === null ? null : Number(s.upto),
      rate: Number(s.rate),
    }))
}

function SlabRowsEditor({ slabs, onChange }) {
  const update = (idx, field, value) => {
    onChange(slabs.map((s, i) => (i === idx ? { ...s, [field]: value } : s)))
  }
  const addRow = () => onChange([...slabs, emptySlabRow()])
  const removeRow = (idx) => onChange(slabs.filter((_, i) => i !== idx))

  return (
    <div className="eco-stack">
      <div className="eco-table-wrap">
        <table className="eco-table">
          <thead>
            <tr>
              <th>Up to (blank = above previous)</th>
              <th className="eco-table-num">Rate</th>
              <th className="eco-table-num">Actions</th>
            </tr>
          </thead>
          <tbody>
            {slabs.length === 0 ? (
              <tr>
                <td colSpan={3} className="eco-muted">
                  No slabs yet — add one below.
                </td>
              </tr>
            ) : (
              slabs.map((s, i) => (
                <tr key={i}>
                  <td>
                    <input
                      type="number"
                      className="eco-input eco-input-compact"
                      placeholder="leave blank for last slab"
                      value={s.upto}
                      onChange={(e) => update(i, 'upto', e.target.value)}
                      aria-label="Slab upper limit"
                    />
                  </td>
                  <td className="eco-table-num">
                    <input
                      type="number"
                      step="0.01"
                      className="eco-input eco-input-compact"
                      value={s.rate}
                      onChange={(e) => update(i, 'rate', e.target.value)}
                      aria-label="Slab rate"
                    />
                  </td>
                  <td>
                    <div className="eco-table-actions">
                      <button
                        type="button"
                        className="eco-btn eco-btn-ghost eco-btn-sm"
                        onClick={() => removeRow(i)}
                        title="Remove slab"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div>
        <button type="button" className="eco-btn eco-btn-secondary eco-btn-sm" onClick={addRow}>
          <Plus size={15} aria-hidden="true" />
          Add slab
        </button>
      </div>
    </div>
  )
}

function ProviderCard({ config, token, onChanged, setMessage, setMessageError }) {
  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState(null)
  const [showUpdateForm, setShowUpdateForm] = useState(false)
  const [updateForm, setUpdateForm] = useState(null)

  const openHistory = async () => {
    try {
      const data = await fetchTariffHistory(token, config.groupKey)
      setHistory(data)
      setShowHistory(true)
    } catch (err) {
      setMessage(err.message)
      setMessageError(true)
    }
  }

  const openUpdateForm = () => {
    setUpdateForm({
      unit: config.unit,
      note: config.note || '',
      fixedCharges: String(config.fixedCharges ?? 0),
      taxesPercent: String(config.taxesPercent ?? 0),
      effectiveFrom: new Date().toISOString().slice(0, 10),
      slabs: (config.slabs || []).map((s) => ({
        upto: s.upto == null ? '' : String(s.upto),
        rate: String(s.rate),
      })),
    })
    setShowUpdateForm(true)
  }

  const { run: submitUpdate, loading: savingUpdate } = useAsyncAction(async (e) => {
    e.preventDefault()
    try {
      await addTariffRateVersion(token, config.groupKey, {
        utilityType: config.utilityType,
        providerName: config.providerName,
        category: config.category,
        unit: updateForm.unit,
        note: updateForm.note,
        fixedCharges: Number(updateForm.fixedCharges) || 0,
        taxesPercent: Number(updateForm.taxesPercent) || 0,
        effectiveFrom: updateForm.effectiveFrom,
        slabs: slabsToPayload(updateForm.slabs),
      })
      setMessage('New rate version added successfully.')
      setMessageError(false)
      setShowUpdateForm(false)
      onChanged()
    } catch (err) {
      setMessage(err.message)
      setMessageError(true)
    }
  })

  const { run: toggleActive, loading: togglingActive } = useAsyncAction(async () => {
    try {
      await setTariffActive(token, config.id, !config.active)
      setMessage(`Provider ${!config.active ? 'activated' : 'deactivated'}.`)
      setMessageError(false)
      onChanged()
    } catch (err) {
      setMessage(err.message)
      setMessageError(true)
    }
  })

  return (
    <div className="eco-stack" style={{ padding: 20 }}>
      <div className="eco-between" style={{ alignItems: 'flex-start' }}>
        <div>
          <p className="eco-list-title">{config.providerName}</p>
          <p className="eco-list-sub">
            {config.category} · {config.unit} · effective from {config.effectiveFrom}
          </p>
        </div>
        <div className="eco-row" style={{ gap: 8, flexWrap: 'wrap' }}>
          {config.seedData ? <Badge tone="primary">Illustrative sample data</Badge> : null}
          <Badge tone={config.active ? 'primary' : 'earth'}>{config.active ? 'Active' : 'Inactive'}</Badge>
        </div>
      </div>

      <div className="eco-table-wrap">
        <table className="eco-table">
          <thead>
            <tr>
              <th>Slab</th>
              <th className="eco-table-num">Rate</th>
            </tr>
          </thead>
          <tbody>
            {(config.slabs || []).map((s, i) => (
              <tr key={i}>
                <td>{s.upto == null ? 'Above previous' : `0 – ${s.upto}`}</td>
                <td className="eco-table-num">₹{s.rate.toFixed ? s.rate.toFixed(2) : s.rate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="eco-small eco-muted" style={{ margin: 0 }}>
        Fixed charges: ₹{config.fixedCharges} · Taxes: {config.taxesPercent}% {config.note ? `· ${config.note}` : ''}
      </p>

      <div className="eco-row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="eco-btn eco-btn-secondary eco-btn-sm" onClick={openHistory}>
          View history
        </button>
        <button type="button" className="eco-btn eco-btn-secondary eco-btn-sm" onClick={openUpdateForm}>
          Update rates
        </button>
        <LoadingButton
          className="eco-btn eco-btn-secondary eco-btn-sm"
          onClick={toggleActive}
          loading={togglingActive}
          loadingText={config.active ? 'Deactivating…' : 'Activating…'}
        >
          {config.active ? 'Deactivate' : 'Activate'}
        </LoadingButton>
      </div>

      <Modal
        open={showHistory && Boolean(history)}
        title={`History — ${config.providerName} (${config.category})`}
        onClose={() => setShowHistory(false)}
        size="lg"
      >
        <div className="eco-table-wrap">
          <table className="eco-table">
            <thead>
              <tr>
                <th>Effective from</th>
                <th>Effective to</th>
                <th>Active</th>
                <th>Slabs</th>
              </tr>
            </thead>
            <tbody>
              {(history || []).map((h) => (
                <tr key={h.id}>
                  <td>{h.effectiveFrom}</td>
                  <td>{h.effectiveTo || 'Open-ended'}</td>
                  <td>{h.active ? 'Yes' : 'No'}</td>
                  <td>
                    {(h.slabs || [])
                      .map((s) => (s.upto == null ? `${s.rate}` : `${s.upto}:${s.rate}`))
                      .join(', ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>

      <Modal
        open={showUpdateForm}
        title={`Update rates — ${config.providerName}`}
        onClose={() => setShowUpdateForm(false)}
        size="lg"
      >
        <form onSubmit={submitUpdate} className="eco-stack">
          <div className="eco-field-row">
            <TextField
              label="Unit"
              value={updateForm?.unit ?? ''}
              onChange={(e) => setUpdateForm((f) => ({ ...f, unit: e.target.value }))}
            />
            <TextField
              label="Note"
              value={updateForm?.note ?? ''}
              onChange={(e) => setUpdateForm((f) => ({ ...f, note: e.target.value }))}
            />
          </div>
          <div className="eco-field-row">
            <TextField
              label="Fixed charges"
              type="number"
              value={updateForm?.fixedCharges ?? ''}
              onChange={(e) => setUpdateForm((f) => ({ ...f, fixedCharges: e.target.value }))}
            />
            <TextField
              label="Taxes %"
              type="number"
              value={updateForm?.taxesPercent ?? ''}
              onChange={(e) => setUpdateForm((f) => ({ ...f, taxesPercent: e.target.value }))}
            />
            <TextField
              label="New effective-from date"
              type="date"
              value={updateForm?.effectiveFrom ?? ''}
              onChange={(e) => setUpdateForm((f) => ({ ...f, effectiveFrom: e.target.value }))}
            />
          </div>
          <SlabRowsEditor
            slabs={updateForm?.slabs || []}
            onChange={(slabs) => setUpdateForm((f) => ({ ...f, slabs }))}
          />
          <div>
            <LoadingButton type="submit" className="eco-btn eco-btn-primary" loading={savingUpdate} loadingText="Saving…">
              Save new rate version
            </LoadingButton>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export function AdminTariffManagementPage() {
  const navigate = useNavigate()
  const { token, profile, setAuthMessage, setAuthError } = useAuth()
  const [tariffs, setTariffs] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [newProviderForm, setNewProviderForm] = useState(emptyNewProviderForm())

  // Server-verified role only — the cached local profile must not be able to grant admin access.
  const isAdmin = profile?.role === 'ADMIN'

  useEffect(() => {
    if (!isAdmin || !token) return undefined
    let cancelled = false
    ;(async () => {
      try {
        const data = await fetchAdminTariffs(token)
        if (cancelled) return
        setTariffs(data)
        setLoadError('')
      } catch (err) {
        if (!cancelled) setLoadError(err.message || 'Could not load tariffs.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isAdmin, token, reloadKey])

  const reload = () => {
    setLoading(true)
    setLoadError('')
    setReloadKey((value) => value + 1)
  }

  const load = async () => {
    try {
      const data = await fetchAdminTariffs(token)
      setTariffs(data)
      setLoadError('')
    } catch (err) {
      setLoadError(err.message || 'Could not load tariffs.')
    }
  }

  const { run: submitNewProvider, loading: addingProvider } = useAsyncAction(async (e) => {
    e.preventDefault()
    try {
      await createTariffProvider(token, {
        utilityType: newProviderForm.utilityType,
        providerName: newProviderForm.providerName,
        category: newProviderForm.category,
        unit: newProviderForm.unit,
        note: newProviderForm.note,
        fixedCharges: Number(newProviderForm.fixedCharges) || 0,
        taxesPercent: Number(newProviderForm.taxesPercent) || 0,
        effectiveFrom: newProviderForm.effectiveFrom,
        slabs: slabsToPayload(newProviderForm.slabs),
      })
      setAuthMessage('Provider added successfully.')
      setAuthError(false)
      setNewProviderForm(emptyNewProviderForm())
      load()
    } catch (err) {
      setAuthMessage(err.message)
      setAuthError(true)
    }
  })

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />
  }

  const electricity = tariffs.filter((t) => t.utilityType === 'ELECTRICITY' && t.active)
  const water = tariffs.filter((t) => t.utilityType === 'WATER' && t.active)

  const sections = [
    {
      key: 'electricity',
      title: 'Electricity providers',
      icon: Zap,
      providers: electricity,
      emptyTitle: 'No electricity providers',
      emptyText: 'Add an electricity provider below to make it available to users.',
    },
    {
      key: 'water',
      title: 'Water providers',
      icon: Droplets,
      providers: water,
      emptyTitle: 'No water providers',
      emptyText: 'Add a water provider below to make it available to users.',
    },
  ]

  return (
    <div>
      <PageHeader
        breadcrumbs={[
          { label: 'Overview', onClick: () => navigate('/dashboard') },
          { label: 'Admin', onClick: () => navigate('/admin-dashboard') },
          { label: 'Tariff management' },
        ]}
        eyebrow="Admin"
        title="Tariff management"
        description="Manage persisted, versioned tariff configurations. Editing rates never overwrites history — it closes out the current version and opens a new one."
        icon={Landmark}
      />

      <div className="eco-stack">
        {loadError ? (
          <Alert variant="error" onClose={() => setLoadError('')}>
            <div className="eco-between">
              <span>{loadError}</span>
              <button type="button" className="eco-btn eco-btn-secondary eco-btn-sm" onClick={reload}>
                Try again
              </button>
            </div>
          </Alert>
        ) : null}

        {loading ? (
          <div className="eco-grid eco-grid-2" aria-hidden="true">
            <Skeleton className="eco-skel-block" style={{ height: 240 }} />
            <Skeleton className="eco-skel-block" style={{ height: 240 }} />
          </div>
        ) : (
          sections.map(({ key, title, icon, providers, emptyTitle, emptyText }) => (
            <Card
              key={key}
              padded={false}
              title={title}
              subtitle={`${providers.length} active ${providers.length === 1 ? 'provider' : 'providers'}`}
              icon={icon}
            >
              {providers.length === 0 ? (
                <EmptyState icon={icon} title={emptyTitle} text={emptyText} />
              ) : (
                providers.map((provider, index) => (
                  <div
                    key={provider.id}
                    style={index === 0 ? undefined : { borderTop: '1px solid var(--color-border)' }}
                  >
                    <ProviderCard
                      config={provider}
                      token={token}
                      onChanged={load}
                      setMessage={setAuthMessage}
                      setMessageError={setAuthError}
                    />
                  </div>
                ))
              )}
            </Card>
          ))
        )}

        <Card title="Add new provider" subtitle="Create a versioned tariff configuration." icon={Plus}>
          <form onSubmit={submitNewProvider}>
            <div className="eco-form-section">
              <h4 className="eco-form-section-title">
                <Landmark size={15} aria-hidden="true" />
                Provider details
              </h4>
              <div className="eco-field-row">
                <SelectField
                  label="Utility type"
                  value={newProviderForm.utilityType}
                  onChange={(e) => setNewProviderForm((f) => ({ ...f, utilityType: e.target.value }))}
                  options={UTILITY_OPTIONS}
                  required
                />
                <TextField
                  label="Provider name"
                  required
                  value={newProviderForm.providerName}
                  onChange={(e) => setNewProviderForm((f) => ({ ...f, providerName: e.target.value }))}
                />
                <TextField
                  label="Category"
                  required
                  value={newProviderForm.category}
                  onChange={(e) => setNewProviderForm((f) => ({ ...f, category: e.target.value }))}
                />
                <TextField
                  label="Unit"
                  required
                  value={newProviderForm.unit}
                  onChange={(e) => setNewProviderForm((f) => ({ ...f, unit: e.target.value }))}
                />
              </div>
            </div>

            <div className="eco-form-section">
              <h4 className="eco-form-section-title">
                <Percent size={15} aria-hidden="true" />
                Charges &amp; validity
              </h4>
              <div className="eco-field-row">
                <TextField
                  label="Fixed charges"
                  type="number"
                  value={newProviderForm.fixedCharges}
                  onChange={(e) => setNewProviderForm((f) => ({ ...f, fixedCharges: e.target.value }))}
                />
                <TextField
                  label="Taxes %"
                  type="number"
                  value={newProviderForm.taxesPercent}
                  onChange={(e) => setNewProviderForm((f) => ({ ...f, taxesPercent: e.target.value }))}
                />
                <TextField
                  label="Effective from"
                  type="date"
                  value={newProviderForm.effectiveFrom}
                  onChange={(e) => setNewProviderForm((f) => ({ ...f, effectiveFrom: e.target.value }))}
                />
                <TextField
                  label="Note"
                  value={newProviderForm.note}
                  onChange={(e) => setNewProviderForm((f) => ({ ...f, note: e.target.value }))}
                />
              </div>
            </div>

            <div className="eco-form-section">
              <h4 className="eco-form-section-title">
                <Table size={15} aria-hidden="true" />
                Slabs
              </h4>
              <SlabRowsEditor
                slabs={newProviderForm.slabs}
                onChange={(slabs) => setNewProviderForm((f) => ({ ...f, slabs }))}
              />
            </div>

            <div style={{ marginTop: 18 }}>
              <LoadingButton type="submit" className="eco-btn eco-btn-primary" loading={addingProvider} loadingText="Adding…">
                Add provider
              </LoadingButton>
            </div>
          </form>
        </Card>
      </div>
    </div>
  )
}
