import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BadgeCheck,
  BarChart3,
  Download,
  PlugZap,
  Receipt,
  ShieldCheck,
  TrendingUp,
  UserCog,
  Users,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth.js'
import { useAppState } from '../hooks/useAppState.js'
import { useAsyncAction } from '../hooks/useAsyncAction.js'
import { LoadingButton } from '../components/LoadingButton.jsx'
import { PageHeader } from '../components/ui/PageHeader.jsx'
import { Card } from '../components/ui/Card.jsx'
import { StatCard } from '../components/ui/StatCard.jsx'
import { Badge } from '../components/ui/Badge.jsx'
import { Alert } from '../components/ui/Alert.jsx'
import { EmptyState, Skeleton } from '../components/ui/EmptyState.jsx'
import { Modal } from '../components/ui/Modal.jsx'
import { fetchUserHistory, exportUsersExcel as exportUsersExcelApi, getAdminStats } from '../services/adminService.js'

export function AdminDashboardPage() {
  const navigate = useNavigate()
  const { token, setAuthMessage, setAuthError } = useAuth()
  const { adminUsersList, selectedUserRecords, setSelectedUserRecords } = useAppState()
  const [stats, setStats] = useState(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [statsError, setStatsError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [viewingUserId, setViewingUserId] = useState(null)

  useEffect(() => {
    if (!token) return undefined
    let cancelled = false
    ;(async () => {
      try {
        const data = await getAdminStats(token)
        if (cancelled) return
        setStats(data)
        setStatsError('')
      } catch (err) {
        if (!cancelled) setStatsError(err.message || 'Could not load system statistics.')
      } finally {
        if (!cancelled) setStatsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, reloadKey])

  const reload = () => {
    setStatsLoading(true)
    setStatsError('')
    setReloadKey((value) => value + 1)
  }

  const { run: exportUsersExcel, loading: exporting } = useAsyncAction(async () => {
    if (!token) {
      setAuthMessage('Login as admin first')
      setAuthError(true)
      return
    }
    try {
      const blob = await exportUsersExcelApi(token)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'ecotrack_users_report.xlsx'
      document.body.appendChild(a)
      a.click()
      a.remove()
      setAuthMessage('Excel report downloaded successfully')
      setAuthError(false)
    } catch (err) {
      setAuthMessage(err.message)
      setAuthError(true)
    }
  })

  const fetchUserHistoryForAdmin = async (userId) => {
    if (viewingUserId) return
    setViewingUserId(userId)
    try {
      const data = await fetchUserHistory(userId, token)
      setSelectedUserRecords(data)
    } catch (err) {
      setAuthMessage(err.message)
      setAuthError(true)
    } finally {
      setViewingUserId(null)
    }
  }

  if (!token) {
    return (
      <Card title="Administrative console">
        <p className="eco-muted">Sign in as an administrator to view system statistics and export users.</p>
      </Card>
    )
  }

  const signupsThisMonth = stats?.signupsByMonth?.[stats.signupsByMonth.length - 1]?.count ?? 0
  const recordsOwner = adminUsersList.find((u) => u.id === selectedUserRecords?.[0]?.user?.id)?.fullName

  return (
    <div>
      <PageHeader
        breadcrumbs={[
          { label: 'Overview', onClick: () => navigate('/dashboard') },
          { label: 'Admin' },
        ]}
        eyebrow="Admin console"
        title="Administrative console"
        description="System-wide statistics across every registered user, with a one-click export of the full user directory."
        icon={ShieldCheck}
        actions={
          <>
            <Badge tone="earth" icon={ShieldCheck}>
              Admin
            </Badge>
            <LoadingButton
              className="eco-btn eco-btn-primary"
              onClick={exportUsersExcel}
              loading={exporting}
              loadingText="Exporting…"
            >
              <Download size={16} aria-hidden="true" />
              Export users to Excel
            </LoadingButton>
          </>
        }
      />

      <div className="eco-stack">
        {statsError ? (
          <Alert variant="error" onClose={() => setStatsError('')}>
            <div className="eco-between">
              <span>{statsError}</span>
              <button type="button" className="eco-btn eco-btn-secondary eco-btn-sm" onClick={reload}>
                Try again
              </button>
            </div>
          </Alert>
        ) : null}

        {statsLoading && !stats ? (
          <div className="eco-grid eco-grid-3" aria-hidden="true">
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <Skeleton key={index} className="eco-skel-block" style={{ height: 116 }} />
            ))}
          </div>
        ) : stats ? (
          <div className="eco-grid eco-grid-3">
            <StatCard label="Total users" value={stats.totalUsers} icon={Users} tone="brand" />
            <StatCard
              label="Verified accounts"
              value={stats.verifiedUsers}
              meta={`${stats.unverifiedUsers} unverified`}
              icon={BadgeCheck}
              tone="brand"
            />
            <StatCard label="Bills uploaded" value={stats.totalBillsUploaded} icon={Receipt} tone="earth" />
            <StatCard
              label="Appliances tracked"
              value={stats.totalAppliancesTracked}
              icon={PlugZap}
              tone="water"
            />
            <StatCard
              label="Customers / Admins"
              value={`${stats.usersByRole?.CUSTOMER || 0} / ${stats.usersByRole?.ADMIN || 0}`}
              icon={UserCog}
              tone="brand"
            />
            <StatCard
              label="Signups this month"
              value={signupsThisMonth}
              meta="last 6 months tracked"
              icon={TrendingUp}
              tone="earth"
            />
          </div>
        ) : (
          <Card>
            <EmptyState
              icon={BarChart3}
              title="No statistics available"
              text="System statistics will appear here once the admin statistics endpoint responds."
            />
          </Card>
        )}

        <Card
          padded={false}
          title="All users"
          subtitle={`${adminUsersList.length} ${adminUsersList.length === 1 ? 'user' : 'users'} registered`}
        >
          {adminUsersList.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No users loaded"
              text="The user directory is empty. Sign in through the admin login to load every registered account."
            />
          ) : (
            <div className="eco-table-wrap">
              <table className="eco-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Company</th>
                    <th>Role</th>
                    <th className="eco-table-num">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {adminUsersList.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <strong>{user.fullName}</strong>
                      </td>
                      <td>{user.email}</td>
                      <td>{user.company?.name || 'N/A'}</td>
                      <td>
                        <Badge tone={user.role === 'ADMIN' ? 'earth' : 'primary'}>{user.role}</Badge>
                      </td>
                      <td>
                        <div className="eco-table-actions">
                          <LoadingButton
                            className="eco-btn eco-btn-secondary eco-btn-sm"
                            onClick={() => fetchUserHistoryForAdmin(user.id)}
                            loading={viewingUserId === user.id}
                            loadingText="Loading…"
                            disabled={viewingUserId !== null && viewingUserId !== user.id}
                          >
                            View records
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
      </div>

      <Modal
        open={Boolean(selectedUserRecords)}
        title={`Records for ${recordsOwner || 'user'}`}
        onClose={() => setSelectedUserRecords(null)}
        size="lg"
      >
        {selectedUserRecords?.length === 0 ? (
          <p className="eco-muted">No history records found for this user.</p>
        ) : (
          <div className="eco-table-wrap">
            <table className="eco-table">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {(selectedUserRecords || []).map((record) => (
                  <tr key={record.id}>
                    <td>
                      <strong>{record.action}</strong>
                    </td>
                    <td>{new Date(record.timestamp).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  )
}
