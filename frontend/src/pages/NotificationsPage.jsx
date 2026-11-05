import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  BarChart3,
  Bell,
  BellRing,
  CalendarClock,
  CheckCheck,
  Settings,
  Upload,
  Wallet,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth.js'
import { LoadingButton } from '../components/LoadingButton.jsx'
import { PageHeader } from '../components/ui/PageHeader.jsx'
import { Card } from '../components/ui/Card.jsx'
import { Badge } from '../components/ui/Badge.jsx'
import { Alert } from '../components/ui/Alert.jsx'
import { EmptyState, Skeleton } from '../components/ui/EmptyState.jsx'
import {
  getNotificationPreferences,
  getNotifications,
  markNotificationRead,
  updateNotificationPreferences,
} from '../services/notificationService.js'

const TYPE_META = {
  PAYMENT_REMINDER: { label: 'Payment reminder', tone: 'primary', icon: CalendarClock },
  OVERDUE: { label: 'Overdue', tone: 'danger', icon: AlertTriangle },
  BILL_UPLOAD_REMINDER: { label: 'Upload reminder', tone: 'earth', icon: Upload },
  BUDGET_ALERT: { label: 'Budget alert', tone: 'earth', icon: Wallet },
  ANOMALY_ALERT: { label: 'Anomaly alert', tone: 'danger', icon: AlertTriangle },
  MONTHLY_SUMMARY: { label: 'Monthly summary', tone: 'water', icon: BarChart3 },
}

const PREFERENCE_FIELDS = [
  { key: 'emailEnabled', label: 'Email notifications (global)' },
  { key: 'paymentRemindersEnabled', label: 'Payment reminders' },
  { key: 'overdueAlertsEnabled', label: 'Overdue alerts' },
  { key: 'budgetAlertsEnabled', label: 'Budget alerts' },
  { key: 'anomalyAlertsEnabled', label: 'Anomaly alerts' },
  { key: 'billUploadRemindersEnabled', label: 'Bill upload reminders' },
  { key: 'monthlySummaryEnabled', label: 'Monthly summary emails' },
]

function typeMeta(type) {
  return TYPE_META[type] || { label: type, tone: 'default', icon: Bell }
}

/** Compact "2 h ago" style stamp, with the exact date kept in the element's title. */
function formatWhen(iso) {
  if (!iso) return ''
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return ''
  const minutes = Math.round((Date.now() - then.getTime()) / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days} d ago`
  return then.toLocaleDateString()
}

export function NotificationsPage() {
  const navigate = useNavigate()
  const { token } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [preferences, setPreferences] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [markingAll, setMarkingAll] = useState(false)
  const [busyNotifId, setBusyNotifId] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!token) return undefined
    let cancelled = false
    ;(async () => {
      try {
        const [list, prefs] = await Promise.all([
          getNotifications(token),
          getNotificationPreferences(token),
        ])
        if (cancelled) return
        setNotifications(Array.isArray(list) ? list : [])
        setPreferences(prefs)
        setError('')
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load notifications')
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

  const handleMarkRead = async (id, value) => {
    if (!token || busyNotifId) return
    setBusyNotifId(id)
    try {
      await markNotificationRead(id, value, token)
      setNotifications((list) => list.map((n) => (n.id === id ? { ...n, read: value } : n)))
    } catch (err) {
      setError(err.message || 'Could not update notification')
    } finally {
      setBusyNotifId(null)
    }
  }

  const handleMarkAllRead = async () => {
    if (!token || markingAll) return
    const unread = notifications.filter((n) => !n.read)
    setMarkingAll(true)
    try {
      await Promise.all(unread.map((n) => markNotificationRead(n.id, true, token)))
      setNotifications((list) => list.map((n) => ({ ...n, read: true })))
    } catch (err) {
      setError(err.message || 'Could not mark all as read')
    } finally {
      setMarkingAll(false)
    }
  }

  const handleTogglePreference = async (key) => {
    if (!token || !preferences) return
    const updated = { ...preferences, [key]: !preferences[key] }
    setPreferences(updated)
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const saved = await updateNotificationPreferences({ [key]: updated[key] }, token)
      setPreferences(saved)
      setMessage('Preferences saved.')
    } catch (err) {
      setError(err.message || 'Could not save preferences')
      reload()
    } finally {
      setSaving(false)
    }
  }

  const handleSavePreferences = async () => {
    if (!token || !preferences || saving) return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const payload = Object.fromEntries(
        PREFERENCE_FIELDS.map((field) => [field.key, !!preferences[field.key]]),
      )
      const saved = await updateNotificationPreferences(payload, token)
      setPreferences(saved)
      setMessage('Preferences saved.')
    } catch (err) {
      setError(err.message || 'Could not save preferences')
      reload()
    } finally {
      setSaving(false)
    }
  }

  const breadcrumbs = [
    { label: 'Overview', onClick: () => navigate('/dashboard') },
    { label: 'Notifications' },
  ]

  if (!token) {
    return (
      <div>
        <PageHeader
          breadcrumbs={breadcrumbs}
          eyebrow="Alerts"
          title="Notifications"
          description="Payment reminders, overdue alerts, budget and anomaly alerts, and monthly summaries."
          icon={Bell}
        />
        <Card>
          <Alert variant="info">Log in to view your notifications and manage preferences.</Alert>
        </Card>
      </div>
    )
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <div>
      <PageHeader
        breadcrumbs={breadcrumbs}
        eyebrow="Alerts"
        title="Notifications"
        description="Payment reminders, overdue alerts, budget and anomaly alerts, and monthly summaries all appear here. Configure which categories you want below."
        icon={Bell}
        actions={
          unreadCount > 0 ? (
            <Badge tone="primary" icon={BellRing}>
              {unreadCount} unread
            </Badge>
          ) : (
            <Badge icon={CheckCheck}>All caught up</Badge>
          )
        }
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

        <Card
          padded={false}
          title="Your notifications"
          subtitle={
            loading
              ? 'Loading your notifications…'
              : `${notifications.length} ${notifications.length === 1 ? 'notification' : 'notifications'}${
                  unreadCount > 0 ? ` · ${unreadCount} unread` : ' · all read'
                }`
          }
          icon={Bell}
          actions={
            <LoadingButton
              className="eco-btn eco-btn-secondary eco-btn-sm"
              onClick={handleMarkAllRead}
              disabled={unreadCount === 0}
              loading={markingAll}
              loadingText="Marking…"
            >
              <CheckCheck size={15} aria-hidden="true" /> Mark all read
            </LoadingButton>
          }
        >
          {loading ? (
            <div className="eco-stack" style={{ padding: 22 }}>
              {[0, 1, 2, 3].map((row) => (
                <div key={row} className="eco-row" style={{ gap: 13 }}>
                  <Skeleton style={{ width: 38, height: 38, flex: 'none', borderRadius: 'var(--radius-sm)' }} />
                  <div style={{ flex: 1 }}>
                    <Skeleton className="eco-skel-line" style={{ width: '52%' }} />
                    <Skeleton className="eco-skel-line" style={{ width: '84%', marginTop: 8 }} />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="No notifications yet"
              text="Payment reminders, overdue alerts, budget warnings and monthly summaries will appear here."
            />
          ) : (
            <div style={{ padding: '4px 22px' }}>
              <ul className="eco-list">
                {notifications.map((notification) => {
                  const meta = typeMeta(notification.type)
                  const Icon = meta.icon
                  return (
                    <li key={notification.id}>
                      <div style={{ display: 'flex', gap: 13, alignItems: 'flex-start', minWidth: 0 }}>
                        <span className={`eco-notice-icon ${notification.read ? '' : 'is-unread'}`.trim()}>
                          <Icon size={17} aria-hidden="true" />
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <div className="eco-list-title">{notification.title}</div>
                          <div className="eco-list-sub" style={{ marginTop: 4 }}>
                            {notification.message}
                          </div>
                          <div
                            className="eco-list-sub"
                            style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 6 }}
                          >
                            <Badge tone={meta.tone}>{meta.label}</Badge>
                            <span
                              title={
                                notification.createdAt
                                  ? new Date(notification.createdAt).toLocaleString()
                                  : undefined
                              }
                            >
                              {formatWhen(notification.createdAt)}
                            </span>
                            {notification.emailSent ? <span>· emailed</span> : null}
                          </div>
                        </div>
                      </div>
                      <LoadingButton
                        className="eco-btn eco-btn-ghost eco-btn-sm"
                        style={{ whiteSpace: 'nowrap' }}
                        onClick={() => handleMarkRead(notification.id, !notification.read)}
                        loading={busyNotifId === notification.id}
                        loadingText={null}
                        disabled={busyNotifId !== null && busyNotifId !== notification.id}
                      >
                        {notification.read ? 'Mark unread' : 'Mark read'}
                      </LoadingButton>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </Card>

        {preferences ? (
          <Card
            title="Alert preferences"
            subtitle="Turning a category off also stops it from being recorded here."
            icon={Settings}
          >
            <div className="eco-stack">
              {PREFERENCE_FIELDS.map((field) => (
                <label key={field.key} className="eco-check">
                  <input
                    type="checkbox"
                    checked={!!preferences[field.key]}
                    disabled={saving}
                    onChange={() => handleTogglePreference(field.key)}
                  />
                  <span>{field.label}</span>
                </label>
              ))}
            </div>

            <div className="eco-between" style={{ marginTop: 18 }}>
              <span className="eco-help">Changes save as you toggle them.</span>
              <LoadingButton
                className="eco-btn eco-btn-primary eco-btn-sm"
                onClick={handleSavePreferences}
                loading={saving}
                loadingText="Saving…"
              >
                Save preferences
              </LoadingButton>
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  )
}
