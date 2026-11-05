import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import './App.css'
// Imported after App.css so the new design system wins on any equal-specificity overlap.
import './styles/ecotrack.css'
import { AppLayout } from './layouts/AppLayout.jsx'
import { PublicLayout } from './layouts/PublicLayout.jsx'
import { useAuth } from './hooks/useAuth.js'
import { ErrorBoundary } from './components/ErrorBoundary.jsx'
import { LandingPage } from './pages/LandingPage.jsx'
import { DashboardPage } from './pages/DashboardPage.jsx'
import { SignupPage } from './pages/SignupPage.jsx'
import { VerifyOtpPage } from './pages/VerifyOtpPage.jsx'
import { LoginPage } from './pages/LoginPage.jsx'
import { AdminLoginPage } from './pages/AdminLoginPage.jsx'
import { AdminDashboardPage } from './pages/AdminDashboardPage.jsx'
import { ProfilePage } from './pages/ProfilePage.jsx'
import { ManualCheckerPage } from './pages/ManualCheckerPage.jsx'
import { BillHistoryPage } from './pages/BillHistoryPage.jsx'
import { UploadBillPage } from './pages/UploadBillPage.jsx'
import { AppliancesPage } from './pages/AppliancesPage.jsx'
import { BudgetManagementPage } from './pages/BudgetManagementPage.jsx'
import { TariffsPage } from './pages/TariffsPage.jsx'
import { AdminTariffManagementPage } from './pages/AdminTariffManagementPage.jsx'
import { AboutPage } from './pages/AboutPage.jsx'
import { NotificationsPage } from './pages/NotificationsPage.jsx'
import { ReportsPage } from './pages/ReportsPage.jsx'
import { AnalyticsPage } from './pages/AnalyticsPage.jsx'
import { PredictionPage } from './pages/PredictionPage.jsx'

/**
 * Gate for the signed-in application shell. It wraps the layout itself (not each page) so an
 * unauthenticated visitor never renders the workspace chrome — no avatar, no profile, no
 * navigation. Admin URLs are sent to the admin portal instead of the customer sign-in screen.
 */
function RequireAuth({ children }) {
  const { token } = useAuth()
  const { pathname } = useLocation()
  if (!token) {
    const isAdminArea = pathname === '/admin-dashboard' || pathname.startsWith('/admin/')
    return <Navigate to={isAdminArea ? '/admin-login' : '/login'} replace />
  }
  return children
}

/** Role gate for admin-only screens. The role comes from the server profile, never from storage. */
function RequireAdmin({ children }) {
  const { profile } = useAuth()
  if (profile?.role !== 'ADMIN') return <Navigate to="/dashboard" replace />
  return children
}

function RedirectIfAuthed({ children }) {
  const { token } = useAuth()
  if (token) return <Navigate to="/dashboard" replace />
  return children
}

/** Shown while a persisted session is being validated, so the app never flashes an empty shell. */
function SessionSplash() {
  return (
    <div className="app-splash" role="status" aria-live="polite">
      <div className="app-splash-inner">
        <span className="btn-spinner" aria-hidden="true" />
        <p>Loading your EcoTrack workspace…</p>
      </div>
    </div>
  )
}

/** Catch-all for unknown URLs — a real screen instead of a blank page. */
function NotFoundPage() {
  const navigate = useNavigate()
  const { token } = useAuth()
  return (
    <div className="not-found-page">
      <h1>Page not found</h1>
      <p>The page you were looking for does not exist or has moved.</p>
      <div className="app-fallback-actions">
        <button type="button" className="btn-primary" onClick={() => navigate(token ? '/dashboard' : '/')}>
          {token ? 'Back to dashboard' : 'Back to home'}
        </button>
      </div>
    </div>
  )
}

function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route
          path="/"
          element={
            <RedirectIfAuthed>
              <LandingPage />
            </RedirectIfAuthed>
          }
        />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/verify" element={<VerifyOtpPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/about" element={<AboutPage />} />
      </Route>

      {/* The admin sign-in screen is public and deliberately outside both layouts: rendering it
          inside the app shell made it look like a signed-in "guest" session had been created. */}
      <Route path="/admin-login" element={<AdminLoginPage />} />

      {/* Every workspace screen sits behind RequireAuth, so no signed-in chrome (avatar, profile,
          navigation) can ever render for a visitor who has not signed in. */}
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/bills" element={<BillHistoryPage />} />
        <Route path="/upload-bill" element={<UploadBillPage />} />
        <Route path="/manual" element={<ManualCheckerPage />} />
        <Route path="/appliances" element={<AppliancesPage />} />
        <Route path="/budget" element={<BudgetManagementPage />} />
        <Route path="/tariffs" element={<TariffsPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/prediction" element={<PredictionPage />} />
        <Route
          path="/admin-dashboard"
          element={
            <RequireAdmin>
              <AdminDashboardPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/tariffs"
          element={
            <RequireAdmin>
              <AdminTariffManagementPage />
            </RequireAdmin>
          }
        />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

function App() {
  const { sessionReady } = useAuth()

  return (
    <ErrorBoundary>
      {sessionReady ? <AppRoutes /> : <SessionSplash />}
    </ErrorBoundary>
  )
}

export default App
