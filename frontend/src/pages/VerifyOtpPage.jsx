import { useNavigate } from 'react-router-dom'
import { KeyRound, Mail, MailCheck } from 'lucide-react'
import { useAuth } from '../hooks/useAuth.js'
import { useAsyncAction } from '../hooks/useAsyncAction.js'
import { useCooldown } from '../hooks/useCooldown.js'
import { TextField } from '../components/ui/Field.jsx'
import { Alert } from '../components/ui/Alert.jsx'
import { LoadingButton } from '../components/LoadingButton.jsx'
import { BrandLogo } from '../components/BrandLogo.jsx'

export function VerifyOtpPage() {
  const navigate = useNavigate()
  const { otpData, setOtpData, verifyOtp, resendSignupOtp, authMessage, setAuthMessage, authError } = useAuth()

  const { run: handleVerify, loading: verifying } = useAsyncAction(async (e) => {
    await verifyOtp(e, () => navigate('/login'))
  })

  const resendCooldown = useCooldown(60)
  const { run: handleResend, loading: resending } = useAsyncAction(async () => {
    // Only start the countdown when the OTP was actually accepted, so a failed send can be retried.
    const sent = await resendSignupOtp()
    if (sent) resendCooldown.start()
  })

  const resendDisabled = resendCooldown.active || resending

  return (
    <div className="eco-auth-plain">
      <div className="eco-auth-card">
        <span className="eco-auth-brand-inline">
          <BrandLogo size={36} />
        </span>

        <div className="eco-auth-head">
          <h1 className="eco-auth-title">Verify your email</h1>
          <p className="eco-auth-sub">
            Enter the one-time code we sent to your email address to finish creating your account.
          </p>
        </div>

        {authMessage ? (
          <Alert variant={authError ? 'error' : 'success'} onClose={() => setAuthMessage('')}>
            {authMessage}
          </Alert>
        ) : null}

        <form className="eco-auth-form eco-stack" onSubmit={handleVerify}>
          <TextField
            label="Email"
            type="email"
            icon={Mail}
            value={otpData.email}
            onChange={(e) => setOtpData({ ...otpData, email: e.target.value })}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
          <TextField
            label="One-time code"
            icon={KeyRound}
            value={otpData.emailOtp}
            onChange={(e) => setOtpData({ ...otpData, emailOtp: e.target.value })}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="Enter the 6-digit code"
            required
          />

          <div className="eco-auth-actions">
            <LoadingButton
              type="submit"
              className="eco-btn eco-btn-primary eco-btn-lg eco-btn-block"
              loading={verifying}
              loadingText="Verifying…"
            >
              <MailCheck size={17} /> Verify account
            </LoadingButton>
            <LoadingButton
              type="button"
              className="eco-btn eco-btn-secondary eco-btn-block"
              loading={resending}
              loadingText="Sending…"
              disabled={resendDisabled}
              onClick={handleResend}
            >
              {resendCooldown.active ? `Resend code in ${resendCooldown.seconds}s` : 'Resend code'}
            </LoadingButton>
          </div>
        </form>

        <p className="eco-auth-alt">
          <span>Already verified?</span>
          <button type="button" className="eco-auth-link" onClick={() => navigate('/login')}>
            Back to sign in
          </button>
        </p>
      </div>
    </div>
  )
}
