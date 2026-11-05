import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, Calendar, Home, Mail, Upload, User } from 'lucide-react'
import { useAuth } from '../hooks/useAuth.js'
import { useAsyncAction } from '../hooks/useAsyncAction.js'
import { AuthAside } from '../components/auth/AuthAside.jsx'
import { TextField, PasswordStrength } from '../components/ui/Field.jsx'
import { Alert } from '../components/ui/Alert.jsx'
import { LoadingButton } from '../components/LoadingButton.jsx'
import { BrandLogo } from '../components/BrandLogo.jsx'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function SignupPage() {
  const navigate = useNavigate()
  const {
    signupData,
    setSignupData,
    rememberEmailAfterSignup,
    setRememberEmailAfterSignup,
    onSignupPhoto,
    signup,
    emailAlreadyExists,
    authMessage,
    setAuthMessage,
    authError,
  } = useAuth()

  const [confirmPassword, setConfirmPassword] = useState('')
  const [confirmError, setConfirmError] = useState('')
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')

  const validate = () => {
    let ok = true
    if (!EMAIL_RE.test(signupData.email.trim())) {
      setEmailError('Enter a valid email address.')
      ok = false
    } else {
      setEmailError('')
    }
    if (signupData.password.length < 8) {
      setPasswordError('Password must be at least 8 characters.')
      ok = false
    } else {
      setPasswordError('')
    }
    if (signupData.password !== confirmPassword) {
      setConfirmError('Passwords do not match.')
      ok = false
    } else {
      setConfirmError('')
    }
    return ok
  }

  const { run: handleSignup, loading: signingUp } = useAsyncAction(async (e) => {
    e.preventDefault()
    if (!validate()) return
    await signup(e, () => navigate('/verify'))
  })

  return (
    <div className="eco-auth">
      <AuthAside
        title="Create your EcoTrack account"
        lead="One account to read every bill, watch both meters and cut what you waste. It takes about a minute."
        points={[
          'Free to start — no card needed.',
          'Your data stays private to your account.',
          'Scan a bill straight away and see the savings.',
        ]}
      />

      <div className="eco-auth-form-side">
        <div className="eco-auth-card eco-auth-card-wide">
          <span className="eco-auth-brand-inline">
            <BrandLogo size={36} />
          </span>

          <div className="eco-auth-head">
            <h1 className="eco-auth-title">Create account</h1>
            <p className="eco-auth-sub">Tell us a little about your home and utility so we can set up your workspace.</p>
          </div>

          {emailAlreadyExists ? (
            <Alert variant="error">
              An account with this email already exists.{' '}
              <button type="button" className="eco-auth-link" onClick={() => navigate('/login')}>
                Sign in instead
              </button>
            </Alert>
          ) : authMessage ? (
            <Alert variant={authError ? 'error' : 'success'} onClose={() => setAuthMessage('')}>
              {authMessage}
            </Alert>
          ) : null}

          <form className="eco-auth-form eco-stack" onSubmit={handleSignup}>
            <label className="eco-photo-picker" htmlFor="signup-photo">
              {signupData.photoDataUrl ? (
                <img src={signupData.photoDataUrl} alt="" className="eco-photo-preview" />
              ) : (
                <span className="eco-photo-placeholder" aria-hidden="true">
                  <User size={24} />
                </span>
              )}
              <span className="eco-photo-meta">
                <strong className="eco-photo-label">Profile photo</strong>
                <span className="eco-help">Optional — a square image looks best.</span>
              </span>
              <span className="eco-btn eco-btn-secondary eco-btn-sm">
                <Upload size={15} /> Choose
              </span>
              <input id="signup-photo" type="file" accept="image/*" onChange={onSignupPhoto} className="eco-sr-only" />
            </label>

            <div className="eco-field-row">
              <TextField
                label="Full name"
                icon={User}
                value={signupData.fullName}
                onChange={(e) => setSignupData({ ...signupData, fullName: e.target.value })}
                placeholder="Jordan Rao"
                autoComplete="name"
                required
              />
              <TextField
                label="Birthdate"
                type="date"
                icon={Calendar}
                value={signupData.birthdate}
                onChange={(e) => setSignupData({ ...signupData, birthdate: e.target.value })}
                autoComplete="bday"
                required
              />
            </div>

            <TextField
              label="Email"
              type="email"
              icon={Mail}
              value={signupData.email}
              onChange={(e) => {
                setSignupData({ ...signupData, email: e.target.value })
                if (emailError) setEmailError('')
              }}
              onBlur={() => {
                if (signupData.email && !EMAIL_RE.test(signupData.email.trim())) {
                  setEmailError('Enter a valid email address.')
                }
              }}
              error={emailError}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />

            <div className="eco-field-row">
              <TextField
                label="Address"
                icon={Home}
                value={signupData.address}
                onChange={(e) => setSignupData({ ...signupData, address: e.target.value })}
                placeholder="Street, city"
                autoComplete="street-address"
                required
              />
              <TextField
                label="Utility company"
                icon={Building2}
                value={signupData.utilityCompany}
                onChange={(e) => setSignupData({ ...signupData, utilityCompany: e.target.value })}
                placeholder="Who bills you?"
                required
              />
            </div>

            <div className="eco-field-row">
              <div>
                <TextField
                  label="Password"
                  type="password"
                  value={signupData.password}
                  onChange={(e) => {
                    setSignupData({ ...signupData, password: e.target.value })
                    if (passwordError) setPasswordError('')
                  }}
                  onBlur={() => {
                    if (signupData.password && signupData.password.length < 8) {
                      setPasswordError('Password must be at least 8 characters.')
                    }
                  }}
                  error={passwordError}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  required
                />
                <PasswordStrength password={signupData.password} />
              </div>
              <TextField
                label="Confirm password"
                type="password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value)
                  if (confirmError) setConfirmError('')
                }}
                error={confirmError}
                placeholder="Repeat your password"
                autoComplete="new-password"
                required
              />
            </div>

            <label className="eco-check">
              <input
                type="checkbox"
                checked={rememberEmailAfterSignup}
                onChange={(e) => setRememberEmailAfterSignup(e.target.checked)}
              />
              <span>Remember my email on this device</span>
            </label>

            <div className="eco-auth-actions">
              <LoadingButton
                type="submit"
                className="eco-btn eco-btn-primary eco-btn-lg eco-btn-block"
                loading={signingUp}
                loadingText="Creating your account…"
              >
                Create account
              </LoadingButton>
            </div>
          </form>

          <p className="eco-auth-alt">
            <span>Already have an account?</span>
            <button type="button" className="eco-auth-link" onClick={() => navigate('/login')}>
              Sign in
            </button>
          </p>

          <div className="eco-auth-footer">
            <button type="button" className="eco-auth-link" onClick={() => navigate('/')}>
              Back to home
            </button>
            <span>We email a one-time code to verify your address.</span>
          </div>
        </div>
      </div>
    </div>
  )
}
