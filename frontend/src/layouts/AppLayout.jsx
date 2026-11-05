import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  Bell,
  Calculator,
  FileSpreadsheet,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Percent,
  PlugZap,
  TrendingUp,
  Upload,
  UserRound,
  Wallet,
  X,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth.js'
import { useAppState } from '../hooks/useAppState.js'
import { exportUsersExcel as exportUsersExcelApi } from '../services/adminService.js'
import { getNotifications } from '../services/notificationService.js'
import { ThemeToggle } from '../components/ThemeToggle.jsx'
import { LoadingButton } from '../components/LoadingButton.jsx'
import { BrandLogo } from '../components/BrandLogo.jsx'
import { Toast } from '../components/ui/Alert.jsx'
import { useAsyncAction } from '../hooks/useAsyncAction.js'

/**
 * Every major feature is a first-class link in the navigation bar so nothing has to be hunted
 * for inside a dropdown. Icons make the bar scannable; the row wraps on narrow screens instead
 * of hiding anything, and the drawer below 1080px lists the same set.
 */
const NAV_LINKS = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { label: 'Upload bill', path: '/upload-bill', icon: Upload },
  { label: 'Bill history', path: '/bills', icon: FileText },
  { label: 'Bill calculator', path: '/manual', icon: Calculator },
  { label: 'Bill prediction', path: '/prediction', icon: TrendingUp },
  { label: 'Appliances', path: '/appliances', icon: PlugZap },
  { label: 'Analytics', path: '/analytics', icon: BarChart3 },
  { label: 'Budget', path: '/budget', icon: Wallet },
  { label: 'Tariffs', path: '/tariffs', icon: Percent },
  { label: 'Reports', path: '/reports', icon: FileSpreadsheet },
]

const ADMIN_LINKS = [
  { label: 'Admin overview', path: '/admin-dashboard', icon: BarChart3 },
  { label: 'Manage tariffs', path: '/admin/tariffs', icon: Wallet },
]

export function AppLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const { token, profile, localProfile, displayPhoto, logout, authMessage, authError, setAuthMessage, setAuthError } =
    useAuth()
  const { currentEcoTip } = useAppState()
  const [unreadCount, setUnreadCount] = useState(0)
  // Admin UI is driven only by the role the server returned for this session. The cached local
  // profile is a display fallback and must never be able to grant admin navigation.
  const isAdmin = profile?.role === 'ADMIN'

  useEffect(() => {
    if (!token) return undefined
    let cancelled = false
    getNotifications(token)
      .then((list) => {
        if (!cancelled) setUnreadCount(list.filter((n) => !n.read).length)
      })
      .catch(() => {
        if (!cancelled) setUnreadCount(0)
      })
    return () => {
      cancelled = true
    }
  }, [token])

  // Drawer behaviour: Escape closes it and the page behind it cannot scroll.
  useEffect(() => {
    if (!menuOpen) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [menuOpen])

  const { run: exportUsersExcel, loading: exportingUsers } = useAsyncAction(async () => {
    if (!token) {
      setAuthMessage('Sign in as an administrator first.')
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

  const navigateTo = (path) => {
    setMenuOpen(false)
    navigate(path)
  }

  const name =
    profile?.fullName?.split(' ')[0] || localProfile?.fullName?.split(' ')[0] || 'Profile'
  const initials =
    (profile?.fullName || localProfile?.fullName || 'E')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'E'

  const isActive = (path) => location.pathname === path
  const allLinks = isAdmin ? [...NAV_LINKS, ...ADMIN_LINKS] : NAV_LINKS

  const pageInnerClass =
    location.pathname === '/dashboard'
      ? 'page-inner-dashboard'
      : [
          '/manual',
          '/appliances',
          '/budget',
          '/tariffs',
          '/notifications',
          '/reports',
          '/bills',
          '/upload-bill',
          '/analytics',
          '/prediction',
          '/admin/tariffs',
        ].includes(location.pathname)
        ? 'page-inner page-inner-standalone'
        : 'page-inner'

  return (
    <div className="app">
      <header className="eco-navbar eco-navbar-app is-scrolled">
        <div className="eco-navbar-inner eco-navbar-app-inner">
          <div className="eco-navbar-top">
            <button
              type="button"
              className="eco-brand"
              onClick={() => navigateTo('/dashboard')}
              aria-label="EcoTrack dashboard"
            >
              <BrandLogo size={42} responsive alt="" />
            </button>

            <div className="eco-nav-actions">
              <div className="eco-nav-actions-desktop eco-row" style={{ gap: 9 }}>
                <ThemeToggle />
                <button
                  type="button"
                  className="eco-icon-btn"
                  onClick={() => navigateTo('/notifications')}
                  aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
                >
                  <Bell size={18} />
                  {unreadCount > 0 ? (
                    <span className="eco-icon-dot">{unreadCount > 9 ? '9+' : unreadCount}</span>
                  ) : null}
                </button>
                <button type="button" className="eco-avatar-btn" onClick={() => navigateTo('/profile')}>
                  {displayPhoto ? (
                    <img className="eco-avatar-img" src={displayPhoto} alt="" />
                  ) : (
                    <span className="eco-avatar-fallback">{initials}</span>
                  )}
                  <span className="eco-avatar-name">{name}</span>
                </button>
                {isAdmin ? (
                  <LoadingButton
                    type="button"
                    className="eco-btn eco-btn-secondary eco-btn-sm"
                    loading={exportingUsers}
                    loadingText="Exporting…"
                    onClick={exportUsersExcel}
                  >
                    Export
                  </LoadingButton>
                ) : null}
                <button
                  type="button"
                  className="eco-icon-btn"
                  aria-label="Log out"
                  onClick={() => {
                    logout()
                    navigateTo('/login')
                  }}
                >
                  <LogOut size={18} />
                </button>
              </div>

              <button
                type="button"
                className="eco-nav-toggle"
                aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((open) => !open)}
              >
                {menuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>

          <nav className="eco-navbar-nav" aria-label="Main navigation">
            {NAV_LINKS.map(({ label, path, icon: Icon }) => (
              <button
                key={path}
                type="button"
                className={`eco-nav-link ${isActive(path) ? 'is-active' : ''}`.trim()}
                aria-current={isActive(path) ? 'page' : undefined}
                onClick={() => navigateTo(path)}
              >
                <Icon size={15} aria-hidden="true" />
                {label}
              </button>
            ))}
            {isAdmin
              ? ADMIN_LINKS.map(({ label, path, icon: Icon }) => (
                  <button
                    key={path}
                    type="button"
                    className={`eco-nav-link ${isActive(path) ? 'is-active' : ''}`.trim()}
                    aria-current={isActive(path) ? 'page' : undefined}
                    onClick={() => navigateTo(path)}
                  >
                    <Icon size={15} aria-hidden="true" />
                    {label}
                  </button>
                ))
              : null}
          </nav>
        </div>
      </header>

      {menuOpen ? (
        <>
          <div className="eco-drawer-backdrop" onClick={() => setMenuOpen(false)} role="presentation" />
          <aside className="eco-drawer-panel" aria-label="Navigation">
            <div className="eco-drawer-head">
              <span className="eco-brand" style={{ cursor: 'default' }}>
                <BrandLogo size={38} />
              </span>
              <button
                type="button"
                className="eco-icon-btn"
                onClick={() => setMenuOpen(false)}
                aria-label="Close navigation"
              >
                <X size={18} />
              </button>
            </div>

            {allLinks.map(({ label, path, icon: Icon }) => (
              <button
                key={path}
                type="button"
                className={`eco-drawer-link ${isActive(path) ? 'is-active' : ''}`.trim()}
                onClick={() => navigateTo(path)}
              >
                <Icon size={17} />
                {label}
                {path === '/notifications' && unreadCount > 0 ? (
                  <span className="eco-badge is-danger" style={{ marginLeft: 'auto' }}>
                    {unreadCount}
                  </span>
                ) : null}
              </button>
            ))}

            <button
              type="button"
              className={`eco-drawer-link ${isActive('/notifications') ? 'is-active' : ''}`.trim()}
              onClick={() => navigateTo('/notifications')}
            >
              <Bell size={17} />
              Alerts
              {unreadCount > 0 ? (
                <span className="eco-badge is-danger" style={{ marginLeft: 'auto' }}>
                  {unreadCount}
                </span>
              ) : null}
            </button>

            <div className="eco-drawer-foot">
              <div className="eco-row" style={{ justifyContent: 'space-between' }}>
                <span className="eco-help">Appearance</span>
                <ThemeToggle />
              </div>
              <button type="button" className="eco-btn eco-btn-secondary eco-btn-block" onClick={() => navigateTo('/profile')}>
                <UserRound size={16} />
                My profile
              </button>
              {isAdmin ? (
                <LoadingButton
                  type="button"
                  className="eco-btn eco-btn-secondary eco-btn-block"
                  loading={exportingUsers}
                  loadingText="Exporting…"
                  onClick={exportUsersExcel}
                >
                  Export users to Excel
                </LoadingButton>
              ) : null}
              <button
                type="button"
                className="eco-btn eco-btn-primary eco-btn-block"
                onClick={() => {
                  logout()
                  navigateTo('/login')
                }}
              >
                <LogOut size={16} />
                Log out
              </button>
            </div>
          </aside>
        </>
      ) : null}

      <main className="page-main">
        <div key={location.pathname} className={`${pageInnerClass} page-fade`}>
          <Outlet />
        </div>
      </main>

      <Toast variant={authError ? 'error' : 'success'} onClose={() => setAuthMessage('')}>
        {authMessage}
      </Toast>

      {currentEcoTip && location.pathname === '/dashboard' ? (
        <div className="eco-page" style={{ paddingTop: 0 }}>
          <p className="eco-tip-strip">
            <span>Eco tip</span>
            {currentEcoTip}
          </p>
        </div>
      ) : null}
    </div>
  )
}
