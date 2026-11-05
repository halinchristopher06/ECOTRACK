import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, KeyRound, Mail, ShieldCheck } from 'lucide-react'
import { useAuth } from '../hooks/useAuth.js'
import { useAsyncAction } from '../hooks/useAsyncAction.js'
import { useCooldown } from '../hooks/useCooldown.js'
import { AuthAside } from '../components/auth/AuthAside.jsx'
import { TextField, PasswordStrength } from '../components/ui/Field.jsx'
import { Alert } from '../components/ui/Alert.jsx'
import { LoadingButton } from '../components/LoadingButton.jsx'
import { BrandLogo } from '../components/BrandLogo.jsx'

const ASIDE_POINTS = [
  'See electricity and water use in one clear dashboard.',
  'Scan a bill and let OCR fill in the numbers for you.',
  'Set a budget and get warned before you overshoot.',
]

export function LoginPage() {
  const navigate = useNavigate()
  const {
    loginIdentifier,
    setLoginIdentifier,
    loginOtpSent,
    loginOtpCode,
    setLoginOtpCode,
    loginOtpVerified,
    loginData,
    setLoginData,
    rememberEmail,
    setRememberEmail,
    sendLoginOtp,
    verifyLoginOtp,
    login,
    authMessage,
    setAuthMessage,
    authError,
    forgotPasswordData,
    setForgotPasswordData,
    forgotPasswordStage,
    setForgotPasswordStage,
    forgotPassword,
    resetPassword,
  } = useAuth()

  const [showForgotPassword, setShowForgotPassword] = useState(false)

  const closeForgotPassword = () => {
    setShowForgotPassword(false)
    setForgotPasswordStage('idle')
  }

  // The 60s cooldown only starts after a successful send, so a failed request can be retried.
  const sendOtpCooldown = useCooldown(60)
  const { run: handleSendLoginOtp, loading: sendingOtp } = useAsyncAction(async () => {
    const ok = await sendLoginOtp()
    if (ok) sendOtpCooldown.start()
  })
  const { run: handleVerifyLoginOtp, loading: verifyingOtp } = useAsyncAction(verifyLoginOtp)
  const { run: handleLogin, loading: loggingIn } = useAsyncAction(async (e) => {
    await login(e, () => navigate('/dashboard'))
  })

  const resetCodeCooldown = useCooldown(60)
  const { run: handleForgotPassword, loading: sendingResetCode } = useAsyncAction(async () => {
    const ok = await forgotPassword()
    if (ok) resetCodeCooldown.start()
  })
  const { run: handleResetPassword, loading: resettingPassword } = useAsyncAction(async () => {
    await resetPassword(closeForgotPassword)
  })

  const openForgotPassword = () => {
    setForgotPasswordData({ email: loginData.email || loginIdentifier || '', otp: '', newPassword: '' })
    setForgotPasswordStage('idle')
    setShowForgotPassword(true)
  }

  const message = authMessage ? (
    <Alert variant={authError ? 'error' : 'success'} onClose={() => setAuthMessage('')}>
      {authMessage}
    </Alert>
  ) : null

  if (showForgotPassword) {
    return (
      <div className="eco-auth">
        <AuthAside
          title="Reset your password securely"
          lead="We email a one-time code to your account address. Enter it with a new password and you are back in."
          points={['Codes expire quickly and work once.', 'Nothing changes until the code is verified.']}
        />
        <div className="eco-auth-form-side">
          <div className="eco-auth-card">
            <button type="button" className="eco-auth-back" onClick={closeForgotPassword}>
              <ArrowLeft size={16} /> Back to sign in
            </button>

            <div className="eco-auth-head">
              <h1 className="eco-auth-title">Reset password</h1>
              <p className="eco-auth-sub">Enter the email on your account and we will send a one-time reset code.</p>
            </div>

            {message}

            <form
              className="eco-auth-form eco-stack"
              onSubmit={(e) => {
                e.preventDefault()
                if (forgotPasswordStage === 'idle') handleForgotPassword()
                else handleResetPassword()
              }}
            >
              <TextField
                label="Email"
                type="email"
                icon={Mail}
                value={forgotPasswordData.email}
                onChange={(e) => setForgotPasswordData({ ...forgotPasswordData, email: e.target.value })}
                autoComplete="email"
                placeholder="you@example.com"
                required
              />

              {forgotPasswordStage !== 'idle' ? (
                <>
                  <TextField
                    label="Reset code"
                    icon={KeyRound}
                    value={forgotPasswordData.otp}
                    onChange={(e) => setForgotPasswordData({ ...forgotPasswordData, otp: e.target.value })}
                    placeholder="6-digit code"
                    required
                  />
                  <div>
                    <TextField
                      label="New password"
                      type="password"
                      value={forgotPasswordData.newPassword}
                      onChange={(e) => setForgotPasswordData({ ...forgotPasswordData, newPassword: e.target.value })}
                      autoComplete="new-password"
                      placeholder="At least 8 characters"
                      required
                      help="Use at least 8 characters with a mix of letters and numbers."
                    />
                    <PasswordStrength password={forgotPasswordData.newPassword} />
                  </div>
                </>
              ) : null}

              <div className="eco-auth-actions">
                {forgotPasswordStage === 'idle' ? (
                  <LoadingButton
                    type="submit"
                    className="eco-btn eco-btn-primary eco-btn-lg eco-btn-block"
                    loading={sendingResetCode}
                    loadingText="Sending code…"
                    disabled={resetCodeCooldown.active}
                  >
                    {resetCodeCooldown.active ? `Resend in ${resetCodeCooldown.seconds}s` : 'Send reset code'}
                  </LoadingButton>
                ) : (
                  <LoadingButton
                    type="submit"
                    className="eco-btn eco-btn-primary eco-btn-lg eco-btn-block"
                    loading={resettingPassword}
                    loadingText="Resetting…"
                  >
                    Reset password
                  </LoadingButton>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="eco-auth">
      <AuthAside
        title="Welcome back to EcoTrack"
        lead="Sign in to track your electricity and water use, scan bills and stay inside your budget."
        points={ASIDE_POINTS}
        quote={{ value: '12%', label: 'average monthly saving our members find in the first quarter.' }}
      />

      <div className="eco-auth-form-side">
        <div className="eco-auth-card">
          <span className="eco-auth-brand-inline">
            <BrandLogo size={36} />
          </span>

          <div className="eco-auth-head">
            <h1 className="eco-auth-title">{loginOtpVerified ? 'Enter your password' : 'Sign in'}</h1>
            <p className="eco-auth-sub">
              {loginOtpVerified
                ? `Signed in as ${loginData.email || loginIdentifier}.`
                : 'We verify your email with a one-time code before the password step.'}
            </p>
          </div>

          {message}

          {!loginOtpVerified ? (
            <form
              className="eco-auth-form eco-stack"
              onSubmit={(e) => {
                e.preventDefault()
                if (!loginOtpSent) handleSendLoginOtp()
                else handleVerifyLoginOtp()
              }}
            >
              <TextField
                label="Email"
                type="email"
                icon={Mail}
                value={loginIdentifier}
                onChange={(e) => setLoginIdentifier(e.target.value)}
                autoComplete="email"
                placeholder="you@example.com"
                disabled={loginOtpSent}
                help={loginOtpSent ? 'Code sent — check your inbox and spam folder.' : 'Use the email you registered with.'}
              />

              {loginOtpSent ? (
                <TextField
                  label="One-time code"
                  icon={KeyRound}
                  value={loginOtpCode}
                  onChange={(e) => setLoginOtpCode(e.target.value)}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="Enter the 6-digit code"
                  required
                />
              ) : null}

              <div className="eco-auth-actions">
                {!loginOtpSent ? (
                  <LoadingButton
                    type="submit"
                    className="eco-btn eco-btn-primary eco-btn-lg eco-btn-block"
                    loading={sendingOtp}
                    loadingText="Sending code…"
                    disabled={sendOtpCooldown.active}
                  >
                    {sendOtpCooldown.active ? `Retry in ${sendOtpCooldown.seconds}s` : 'Continue'}
                  </LoadingButton>
                ) : (
                  <LoadingButton
                    type="submit"
                    className="eco-btn eco-btn-primary eco-btn-lg eco-btn-block"
                    loading={verifyingOtp}
                    loadingText="Verifying…"
                  >
                    <ShieldCheck size={17} /> Verify code
                  </LoadingButton>
                )}
              </div>

              {loginOtpSent ? (
                <button
                  type="button"
                  className="eco-auth-link eco-auth-link-center"
                  onClick={handleSendLoginOtp}
                  disabled={sendOtpCooldown.active || sendingOtp}
                >
                  {sendOtpCooldown.active ? `Resend code in ${sendOtpCooldown.seconds}s` : 'Resend code'}
                </button>
              ) : null}
            </form>
          ) : (
            <form className="eco-auth-form eco-stack" onSubmit={(e) => handleLogin(e)}>
              <TextField
                label="Password"
                type="password"
                value={loginData.password}
                onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                autoComplete="current-password"
                placeholder="Your password"
                required
              />

              <div className="eco-between">
                <label className="eco-check">
                  <input
                    type="checkbox"
                    checked={rememberEmail}
                    onChange={(e) => setRememberEmail(e.target.checked)}
                  />
                  <span>Remember my email</span>
                </label>
                <button type="button" className="eco-auth-link" onClick={openForgotPassword}>
                  Forgot password?
                </button>
              </div>

              <div className="eco-auth-actions">
                <LoadingButton
                  type="submit"
                  className="eco-btn eco-btn-primary eco-btn-lg eco-btn-block"
                  loading={loggingIn}
                  loadingText="Signing in…"
                >
                  Sign in
                </LoadingButton>
              </div>
            </form>
          )}

          <p className="eco-auth-alt">
            <span>New to EcoTrack?</span>
            <button type="button" className="eco-auth-link" onClick={() => navigate('/signup')}>
              Create an account
            </button>
          </p>

          <div className="eco-auth-footer">
            <button type="button" className="eco-auth-link" onClick={() => navigate('/')}>
              Back to home
            </button>
            <button type="button" className="eco-auth-link" onClick={() => navigate('/admin-login')}>
              Admin portal
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
