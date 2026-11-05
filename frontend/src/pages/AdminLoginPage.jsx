import { useNavigate } from 'react-router-dom'
import { KeyRound, Mail, ShieldCheck } from 'lucide-react'
import { useAuth } from '../hooks/useAuth.js'
import { TextField } from '../components/ui/Field.jsx'
import { Alert } from '../components/ui/Alert.jsx'
import { LoadingButton } from '../components/LoadingButton.jsx'
import { BrandLogo } from '../components/BrandLogo.jsx'
import { Badge } from '../components/ui/Badge.jsx'
import { useAsyncAction } from '../hooks/useAsyncAction.js'
import { useAppState } from '../hooks/useAppState.js'
import { fetchAllUsers } from '../services/adminService.js'

export function AdminLoginPage() {
  const navigate = useNavigate()
  const { loginData, setLoginData, adminLogin, token, setAuthMessage, setAuthError, authMessage, authError } =
    useAuth()
  const { setAdminUsersList } = useAppState()

  // `sessionToken` is the token the sign-in just issued — the page-level `token` is still the
  // pre-login value inside this closure, so it must not be used for the directory request.
  const fetchAllUsersForAdmin = async (sessionToken = token) => {
    try {
      const data = await fetchAllUsers(sessionToken)
      setAdminUsersList(data)
      navigate('/admin-dashboard')
    } catch (err) {
      setAuthMessage(err.message)
      setAuthError(true)
    }
  }

  const { run: handleAdminLogin, loading: loggingIn } = useAsyncAction(async (e) => {
    await adminLogin(e, fetchAllUsersForAdmin)
  })

  return (
    <div className="eco-auth-plain eco-auth-admin">
      <div className="eco-auth-card">
        <span className="eco-auth-brand-inline">
          <BrandLogo size={36} />
          <Badge tone="earth">Admin</Badge>
        </span>

        <div className="eco-auth-head">
          <h1 className="eco-auth-title">Admin portal</h1>
          <p className="eco-auth-sub">
            Sign in to manage users, tariffs and platform reports. Authorised personnel only.
          </p>
        </div>

        {authMessage ? (
          <Alert variant={authError ? 'error' : 'success'} onClose={() => setAuthMessage('')}>
            {authMessage}
          </Alert>
        ) : null}

        <form className="eco-auth-form eco-stack" onSubmit={handleAdminLogin}>
          <TextField
            label="Admin email"
            type="email"
            icon={Mail}
            value={loginData.email}
            onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
            placeholder="admin@ecotrack.com"
            autoComplete="email"
            required
          />
          <TextField
            label="Master password"
            type="password"
            icon={KeyRound}
            value={loginData.password}
            onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
            placeholder="Your admin password"
            autoComplete="current-password"
            required
          />

          <div className="eco-auth-actions">
            <LoadingButton
              type="submit"
              className="eco-btn eco-btn-primary eco-btn-lg eco-btn-block"
              loading={loggingIn}
              loadingText="Signing in…"
            >
              <ShieldCheck size={17} /> Enter console
            </LoadingButton>
          </div>
        </form>

        <div className="eco-auth-footer">
          <button type="button" className="eco-auth-link" onClick={() => navigate('/login')}>
            Regular sign in
          </button>
          <button type="button" className="eco-auth-link" onClick={() => navigate('/')}>
            Back to home
          </button>
        </div>
      </div>
    </div>
  )
}
