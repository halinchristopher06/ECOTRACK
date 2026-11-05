import { Fragment, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Pencil, Receipt, Trash2, Upload } from 'lucide-react'
import { useAuth } from '../hooks/useAuth.js'
import {
  deleteBill,
  downloadBillDocument,
  listBills,
  markBillPaid,
  updateBill,
} from '../services/billsService.js'
import { PageHeader } from '../components/ui/PageHeader.jsx'
import { Card } from '../components/ui/Card.jsx'
import { Badge } from '../components/ui/Badge.jsx'
import { Alert } from '../components/ui/Alert.jsx'
import { EmptyState, Skeleton } from '../components/ui/EmptyState.jsx'
import { SelectField } from '../components/ui/Field.jsx'
import { LoadingButton } from '../components/LoadingButton.jsx'

const UTILITY_OPTIONS = [
  { value: 'ELECTRICITY', label: 'Electricity' },
  { value: 'WATER', label: 'Water' },
]

const STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'PAID', label: 'Paid' },
  { value: 'OVERDUE', label: 'Overdue' },
]

const UTILITY_TONE = { ELECTRICITY: 'primary', WATER: 'water' }
const STATUS_TONE = { PAID: 'primary', PENDING: 'earth', OVERDUE: 'danger' }

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 })

function formatMoney(value) {
  if (value === null || value === undefined || value === '') return '—'
  return money.format(Number(value))
}

function titleCase(value = '') {
  return value ? value.charAt(0) + value.slice(1).toLowerCase() : ''
}

export function BillHistoryPage() {
  const navigate = useNavigate()
  const { token, setAuthMessage, setAuthError } = useAuth()
  const [bills, setBills] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [utilityFilter, setUtilityFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editDraft, setEditDraft] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [busyAction, setBusyAction] = useState('')

  useEffect(() => {
    if (!token) return undefined
    let cancelled = false
    ;(async () => {
      try {
        const data = await listBills(token, { utilityType: utilityFilter, paymentStatus: statusFilter })
        if (cancelled) return
        setBills(Array.isArray(data) ? data : [])
        setLoadError('')
      } catch (err) {
        if (!cancelled) setLoadError(err.message || 'Could not load your bills.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, utilityFilter, statusFilter, reloadKey])

  const reload = () => setReloadKey((value) => value + 1)

  const handleFilter = (setter) => (event) => {
    setLoading(true)
    setter(event.target.value)
  }

  // Guards against double-firing a row action: if a request for this bill is
  // already in flight, further clicks on any of its buttons are ignored.
  const runRowAction = async (bill, action, fn) => {
    if (busyId === bill.id) return
    setBusyId(bill.id)
    setBusyAction(action)
    try {
      await fn()
    } finally {
      setBusyId(null)
      setBusyAction('')
    }
  }

  const handleDownload = (bill) =>
    runRowAction(bill, 'download', async () => {
      if (!bill.documentPath) {
        setAuthMessage('This bill has no attached document.')
        setAuthError(true)
        return
      }
      try {
        const blob = await downloadBillDocument(bill.id, token)
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = bill.documentOriginalName || 'bill-document'
        document.body.appendChild(a)
        a.click()
        a.remove()
        window.URL.revokeObjectURL(url)
      } catch (err) {
        setAuthMessage(err.message)
        setAuthError(true)
      }
    })

  const handleMarkPaid = (bill) =>
    runRowAction(bill, 'markPaid', async () => {
      try {
        await markBillPaid(bill.id, new Date().toISOString().slice(0, 10), token)
        setAuthMessage('Bill marked as paid.')
        setAuthError(false)
        reload()
      } catch (err) {
        setAuthMessage(err.message)
        setAuthError(true)
      }
    })

  const handleDelete = (bill) =>
    runRowAction(bill, 'delete', async () => {
      if (!window.confirm(`Delete the bill from ${bill.provider || 'this provider'}?`)) return
      try {
        await deleteBill(bill.id, token)
        setAuthMessage('Bill deleted.')
        setAuthError(false)
        reload()
      } catch (err) {
        setAuthMessage(err.message)
        setAuthError(true)
      }
    })

  const startEdit = (bill) => {
    setEditingId(bill.id)
    setEditDraft({
      provider: bill.provider || '',
      billAmount: bill.billAmount ?? '',
      dueDate: bill.dueDate || '',
      paymentStatus: bill.paymentStatus || 'PENDING',
    })
  }

  const saveEdit = (bill) =>
    runRowAction(bill, 'save', async () => {
      try {
        await updateBill(
          bill.id,
          {
            provider: editDraft.provider,
            billAmount: editDraft.billAmount === '' ? null : Number(editDraft.billAmount),
            dueDate: editDraft.dueDate,
            paymentStatus: editDraft.paymentStatus,
          },
          token,
        )
        setAuthMessage('Bill updated.')
        setAuthError(false)
        setEditingId(null)
        reload()
      } catch (err) {
        setAuthMessage(err.message)
        setAuthError(true)
      }
    })

  const pendingTotal = bills
    .filter((bill) => bill.paymentStatus !== 'PAID')
    .reduce((sum, bill) => sum + (Number(bill.billAmount) || 0), 0)

  const table = (() => {
    if (loading) {
      return (
        <div className="eco-stack" style={{ padding: 22 }}>
          {[0, 1, 2, 3].map((row) => (
            <Skeleton key={row} className="eco-skel-line" style={{ width: `${100 - row * 9}%` }} />
          ))}
        </div>
      )
    }

    if (loadError) {
      return (
        <div style={{ padding: 22 }}>
          <Alert variant="error">
            <div className="eco-between">
              <span>{loadError}</span>
              <button type="button" className="eco-btn eco-btn-secondary eco-btn-sm" onClick={reload}>
                Try again
              </button>
            </div>
          </Alert>
        </div>
      )
    }

    if (bills.length === 0) {
      return (
        <EmptyState
          icon={Receipt}
          title="No bills yet"
          text="Upload a bill or add a manual reading and it will show up here with its payment status."
          actions={
            <>
              <button type="button" className="eco-btn eco-btn-primary" onClick={() => navigate('/upload-bill')}>
                <Upload size={16} /> Upload a bill
              </button>
              <button type="button" className="eco-btn eco-btn-secondary" onClick={() => navigate('/manual')}>
                Enter a reading
              </button>
            </>
          }
        />
      )
    }

    return (
      <div className="eco-table-wrap">
        <table className="eco-table">
          <thead>
            <tr>
              <th>Provider</th>
              <th>Utility</th>
              <th>Billing month</th>
              <th className="eco-table-num">Amount</th>
              <th>Due date</th>
              <th>Status</th>
              <th className="eco-table-num">Actions</th>
            </tr>
          </thead>
          <tbody>
            {bills.map((bill) => (
              <Fragment key={bill.id}>
                <tr>
                  <td>
                    {editingId === bill.id ? (
                      <input
                        className="eco-input eco-input-compact"
                        value={editDraft.provider}
                        onChange={(e) => setEditDraft((d) => ({ ...d, provider: e.target.value }))}
                        aria-label="Provider"
                      />
                    ) : (
                      <strong>{bill.provider || '—'}</strong>
                    )}
                  </td>
                  <td>
                    <Badge tone={UTILITY_TONE[bill.utilityType] || 'default'}>{titleCase(bill.utilityType)}</Badge>
                  </td>
                  <td>{bill.billingMonth || '—'}</td>
                  <td className="eco-table-num">
                    {editingId === bill.id ? (
                      <input
                        className="eco-input eco-input-compact"
                        type="number"
                        step="0.01"
                        value={editDraft.billAmount}
                        onChange={(e) => setEditDraft((d) => ({ ...d, billAmount: e.target.value }))}
                        aria-label="Bill amount"
                      />
                    ) : (
                      formatMoney(bill.billAmount)
                    )}
                  </td>
                  <td>
                    {editingId === bill.id ? (
                      <input
                        className="eco-input eco-input-compact"
                        type="date"
                        value={editDraft.dueDate}
                        onChange={(e) => setEditDraft((d) => ({ ...d, dueDate: e.target.value }))}
                        aria-label="Due date"
                      />
                    ) : (
                      bill.dueDate || '—'
                    )}
                  </td>
                  <td>
                    {editingId === bill.id ? (
                      <select
                        className="eco-select eco-input-compact"
                        value={editDraft.paymentStatus}
                        onChange={(e) => setEditDraft((d) => ({ ...d, paymentStatus: e.target.value }))}
                        aria-label="Payment status"
                      >
                        <option value="PENDING">Pending</option>
                        <option value="PAID">Paid</option>
                        <option value="OVERDUE">Overdue</option>
                      </select>
                    ) : (
                      <Badge tone={STATUS_TONE[bill.paymentStatus] || 'default'}>
                        {titleCase(bill.paymentStatus)}
                      </Badge>
                    )}
                  </td>
                  <td>
                    <div className="eco-table-actions">
                      {editingId === bill.id ? (
                        <>
                          <LoadingButton
                            className="eco-btn eco-btn-primary eco-btn-sm"
                            onClick={() => saveEdit(bill)}
                            loading={busyId === bill.id && busyAction === 'save'}
                            loadingText="Saving…"
                          >
                            Save
                          </LoadingButton>
                          <button
                            type="button"
                            className="eco-btn eco-btn-ghost eco-btn-sm"
                            onClick={() => setEditingId(null)}
                            disabled={busyId === bill.id}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="eco-btn eco-btn-ghost eco-btn-sm"
                            onClick={() => setExpandedId(expandedId === bill.id ? null : bill.id)}
                            aria-expanded={expandedId === bill.id}
                            title={expandedId === bill.id ? 'Hide details' : 'Show details'}
                          >
                            {expandedId === bill.id ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                          <button
                            type="button"
                            className="eco-btn eco-btn-ghost eco-btn-sm"
                            onClick={() => startEdit(bill)}
                            disabled={busyId === bill.id}
                            title="Edit bill"
                          >
                            <Pencil size={15} />
                          </button>
                          <LoadingButton
                            className="eco-btn eco-btn-secondary eco-btn-sm"
                            onClick={() => handleDownload(bill)}
                            disabled={busyId === bill.id}
                            loading={busyId === bill.id && busyAction === 'download'}
                            loadingText="…"
                            title="Download document"
                          >
                            Document
                          </LoadingButton>
                          {bill.paymentStatus !== 'PAID' && (
                            <LoadingButton
                              className="eco-btn eco-btn-primary eco-btn-sm"
                              onClick={() => handleMarkPaid(bill)}
                              disabled={busyId === bill.id}
                              loading={busyId === bill.id && busyAction === 'markPaid'}
                              loadingText="Marking…"
                            >
                              Mark paid
                            </LoadingButton>
                          )}
                          <LoadingButton
                            className="eco-btn eco-btn-danger eco-btn-sm"
                            onClick={() => handleDelete(bill)}
                            disabled={busyId === bill.id}
                            loading={busyId === bill.id && busyAction === 'delete'}
                            loadingText="…"
                            title="Delete bill"
                          >
                            <Trash2 size={15} />
                          </LoadingButton>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
                {expandedId === bill.id && (
                  <tr>
                    <td colSpan={7}>
                      <div className="eco-bill-detail">
                        <span>
                          Previous reading <strong>{bill.previousReading ?? '—'}</strong>
                        </span>
                        <span>
                          Current reading <strong>{bill.currentReading ?? '—'}</strong>
                        </span>
                        <span>
                          Units consumed <strong>{bill.unitsConsumed ?? '—'}</strong>
                        </span>
                        <span>
                          Fixed charges <strong>{formatMoney(bill.fixedCharges)}</strong>
                        </span>
                        <span>
                          Additional charges <strong>{formatMoney(bill.additionalCharges)}</strong>
                        </span>
                        <span>
                          Issue date <strong>{bill.issueDate || '—'}</strong>
                        </span>
                        <span>
                          Entry source <strong>{titleCase(bill.entrySource) || '—'}</strong>
                        </span>
                        <span>
                          Payment date <strong>{bill.paymentDate || '—'}</strong>
                        </span>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    )
  })()

  return (
    <div>
      <PageHeader
        breadcrumbs={[
          { label: 'Overview', onClick: () => navigate('/dashboard') },
          { label: 'My bills' },
        ]}
        eyebrow="Billing"
        title="My bills"
        description="Every bill you've uploaded or entered manually, with its payment status and attached document."
        icon={Receipt}
        actions={
          <>
            <button type="button" className="eco-btn eco-btn-secondary" onClick={() => navigate('/manual')}>
              Enter a reading
            </button>
            <button type="button" className="eco-btn eco-btn-primary" onClick={() => navigate('/upload-bill')}>
              <Upload size={16} /> Upload a bill
            </button>
          </>
        }
      />

      <div className="eco-stack">
        <Card padded>
          <div className="eco-field-row">
            <SelectField
              label="Utility type"
              value={utilityFilter}
              onChange={handleFilter(setUtilityFilter)}
              options={UTILITY_OPTIONS}
              placeholder="All utilities"
            />
            <SelectField
              label="Payment status"
              value={statusFilter}
              onChange={handleFilter(setStatusFilter)}
              options={STATUS_OPTIONS}
              placeholder="All statuses"
            />
          </div>
        </Card>

        <Card
          padded={false}
          title="Bill records"
          subtitle={
            loading
              ? 'Loading your bills…'
              : `${bills.length} ${bills.length === 1 ? 'bill' : 'bills'}${
                  pendingTotal > 0 ? ` · ${formatMoney(pendingTotal)} outstanding` : ' · nothing outstanding'
                }`
          }
        >
          {table}
        </Card>
      </div>
    </div>
  )
}
