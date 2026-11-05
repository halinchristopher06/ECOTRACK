import { useCallback, useEffect, useState } from 'react'
import { callApi, UNAUTHORIZED_EVENT } from '../services/apiClient.js'
import { ageFromDob } from '../utils/date.js'
import {
  LS_PROFILE,
  clearRememberedEmail,
  clearSessionToken,
  loadJson,
  loadRememberedEmail,
  loadSessionToken,
  purgeLegacyStoredPassword,
  removeKey,
  saveRememberedEmail,
  saveSessionToken,
} from '../utils/storage.js'
import { AuthContext } from '../hooks/useAuth.js'

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => loadSessionToken())
  // When a stored token exists we must confirm it is still valid before rendering the
  // authenticated shell — otherwise the user briefly lands on a dashboard with no data.
  const [sessionReady, setSessionReady] = useState(() => !loadSessionToken())
  const [authMessage, setAuthMessage] = useState('')
  const [authError, setAuthError] = useState(false)
  const [emailAlreadyExists, setEmailAlreadyExists] = useState(false)
  const [profile, setProfile] = useState(null)
  const [localProfile, setLocalProfile] = useState(() => loadJson(LS_PROFILE, null))
  const [rememberEmail, setRememberEmail] = useState(() => !!loadRememberedEmail())
  const [rememberEmailAfterSignup, setRememberEmailAfterSignup] = useState(true)

  const [signupData, setSignupData] = useState({
    fullName: '',
    birthdate: '',
    address: '',
    email: '',
    utilityCompany: '',
    password: '',
    role: 'CUSTOMER',
    photoDataUrl: '',
  })

  const [otpData, setOtpData] = useState({ email: '', emailOtp: '' })
  const [loginData, setLoginData] = useState(() => {
    const remembered = loadRememberedEmail()
    return { email: remembered, password: '' }
  })

  const [loginIdentifier, setLoginIdentifier] = useState('')
  const [loginOtpCode, setLoginOtpCode] = useState('')
  const [loginOtpSent, setLoginOtpSent] = useState(false)
  const [loginOtpVerified, setLoginOtpVerified] = useState(false)

  const [forgotPasswordData, setForgotPasswordData] = useState({ email: '', otp: '', newPassword: '' })
  const [forgotPasswordStage, setForgotPasswordStage] = useState('idle') // idle | requested | done

  // Once logged in, the backend profile is the source of truth; localProfile is the
  // pre-login/offline fallback only. With no session there is no identity at all — an empty
  // string lets each screen use its own neutral wording instead of inventing a "Guest" user.
  const displayName = token ? (profile?.fullName || localProfile?.fullName || 'User') : ''
  const displayPhoto = token ? (profile?.photoDataUrl || localProfile?.photoDataUrl || '') : ''

  // One-time cleanup of any plaintext password a previous build wrote to this browser.
  useEffect(() => {
    purgeLegacyStoredPassword()
  }, [])

  // Restore a persisted session on first load: validate the token against the backend and
  // hydrate the profile. A rejected token is cleared; a network failure keeps the token so the
  // user is not signed out just because the server was briefly unreachable.
  useEffect(() => {
    const saved = loadSessionToken()
    // No stored token: `sessionReady` already started as true, so there is nothing to validate.
    if (!saved) return
    let cancelled = false
    ;(async () => {
      try {
        const data = await callApi('/profile', {}, true, 'GET', saved)
        if (cancelled) return
        setProfile(data)
        setToken(saved)
      } catch (err) {
        if (cancelled) return
        const status = err?.status ?? 0
        if (status === 401 || status === 403 || status === 404) {
          clearSessionToken()
          setToken('')
          setProfile(null)
          setAuthMessage('Your session has expired. Please sign in again.')
          setAuthError(true)
        }
        // status === 0 (offline/server down): keep the token and let the app render with
        // retryable error states rather than bouncing the user to the sign-in screen.
      } finally {
        if (!cancelled) setSessionReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Any authenticated request that comes back 401 ends the session cleanly.
  useEffect(() => {
    const onUnauthorized = () => {
      clearSessionToken()
      setToken('')
      setProfile(null)
      setAuthMessage('Your session has expired. Please sign in again.')
      setAuthError(true)
    }
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
  }, [])

  const persistLocalProfile = (partial) => {
    setLocalProfile((prev) => {
      const next = { ...(prev || {}), ...partial }
      if (partial.birthdate) next.age = ageFromDob(partial.birthdate)
      localStorage.setItem(LS_PROFILE, JSON.stringify(next))
      return next
    })
  }

  const onSignupPhoto = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setSignupData((s) => ({ ...s, photoDataUrl: reader.result }))
      persistLocalProfile({ photoDataUrl: reader.result })
    }
    reader.readAsDataURL(file)
  }

  const beginSession = useCallback(async (newToken) => {
    saveSessionToken(newToken)
    setToken(newToken)
    try {
      const profileData = await callApi('/profile', {}, true, 'GET', newToken)
      setProfile(profileData)
      return profileData
    } catch {
      // A failed profile fetch must not block sign-in — the pages load their own data and
      // show retryable errors; the token is already valid enough to proceed.
      return null
    }
  }, [])

  const signup = async (e, onSuccess) => {
    e.preventDefault()
    try {
      persistLocalProfile({
        fullName: signupData.fullName,
        birthdate: signupData.birthdate,
        age: ageFromDob(signupData.birthdate),
        address: signupData.address,
        email: signupData.email.toLowerCase(),
        utilityCompany: signupData.utilityCompany,
        photoDataUrl: signupData.photoDataUrl || localProfile?.photoDataUrl,
      })
      if (rememberEmailAfterSignup) {
        saveRememberedEmail(signupData.email)
      } else {
        clearRememberedEmail()
      }
      setRememberEmail(rememberEmailAfterSignup)

      const data = await callApi('/signup', {
        fullName: signupData.fullName,
        email: signupData.email.trim().toLowerCase(),
        password: signupData.password,
        role: signupData.role,
        birthdate: signupData.birthdate,
        address: signupData.address,
        utilityCompany: signupData.utilityCompany,
        photoDataUrl: signupData.photoDataUrl || localProfile?.photoDataUrl || '',
      })
      setOtpData((prev) => ({ ...prev, email: signupData.email.trim().toLowerCase() }))
      setAuthMessage(data.message)
      setAuthError(false)
      setEmailAlreadyExists(false)
      onSuccess?.()
    } catch (err) {
      setAuthMessage(err.message)
      setAuthError(true)
      setEmailAlreadyExists(/already (exists|registered)/i.test(err.message || ''))
    }
  }

  const verifyOtp = async (e, onSuccess) => {
    e.preventDefault()
    try {
      const data = await callApi('/verify-otp', otpData)
      setAuthMessage(data.message)
      setAuthError(false)
      onSuccess?.()
    } catch (err) {
      setAuthMessage(err.message)
      setAuthError(true)
    }
  }

  const resendSignupOtp = async () => {
    if (!otpData.email) {
      setAuthMessage('Enter the email address you signed up with, then try again.')
      setAuthError(true)
      return false
    }
    try {
      const data = await callApi('/resend-otp', { email: otpData.email })
      setAuthMessage(data.message)
      setAuthError(false)
      return true
    } catch (err) {
      setAuthMessage(err.message)
      setAuthError(true)
      return false
    }
  }

  const sendLoginOtp = async () => {
    const target = loginIdentifier.trim()
    if (!target) {
      setAuthMessage('Enter your email address.')
      setAuthError(true)
      return false
    }

    // Admin bypass logic
    if (target.toLowerCase() === 'admin@ecotrack.com') {
      setLoginData((l) => ({ ...l, email: 'admin@ecotrack.com' }))
      setLoginOtpVerified(true)
      setAuthMessage('Admin login: enter your password below.')
      setAuthError(false)
      return true
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) {
      setAuthMessage('Enter a valid email address.')
      setAuthError(true)
      return false
    }
    const requestTarget = target.toLowerCase()

    try {
      const data = await callApi('/login/send-otp', {
        channel: 'email',
        target: requestTarget,
      })
      setLoginOtpSent(true)
      setLoginOtpVerified(false)
      setLoginOtpCode('')
      setAuthMessage(data.message)
      setAuthError(false)
      return true
    } catch (err) {
      setAuthMessage(err.message)
      setAuthError(true)
      return false
    }
  }

  const verifyLoginOtp = async () => {
    const requestTarget = loginIdentifier.trim().toLowerCase()

    try {
      const data = await callApi('/login/verify-otp', {
        channel: 'email',
        target: requestTarget,
        otp: loginOtpCode.trim(),
      })
      const email = data.email
      // Prefill the email only — the password is never stored on the device, so the user
      // always retypes it (or uses the browser's own password manager).
      setLoginData((l) => ({ ...l, email, password: '' }))
      const remembered = loadRememberedEmail()
      if (remembered && remembered === email) {
        setRememberEmail(true)
      }
      setLoginOtpVerified(true)
      setAuthMessage(data.message)
      setAuthError(false)
      return true
    } catch (err) {
      setAuthMessage(err.message)
      setAuthError(true)
      return false
    }
  }

  const login = async (e, onSuccess) => {
    e.preventDefault()
    try {
      const data = await callApi('/login', loginData)
      if (rememberEmail) {
        saveRememberedEmail(loginData.email)
      } else {
        clearRememberedEmail()
      }
      await beginSession(data.token)
      setAuthMessage('')
      setAuthError(false)
      setLoginOtpSent(false)
      setLoginOtpVerified(false)
      setLoginOtpCode('')
      setLoginIdentifier('')
      onSuccess?.()
      return true
    } catch (err) {
      setAuthMessage(err.message)
      setAuthError(true)
      return false
    }
  }

  const loadProfile = useCallback(async () => {
    if (!token) {
      setAuthMessage('Please sign in to view your profile.')
      setAuthError(true)
      return null
    }
    try {
      const data = await callApi('/profile', {}, true, 'GET', token)
      setProfile(data)
      setAuthError(false)
      return data
    } catch (err) {
      setAuthMessage(err.message)
      setAuthError(true)
      throw err
    }
  }, [token])

  const updateProfile = async (partial) => {
    if (!token) {
      setAuthMessage('Please sign in to update your profile.')
      setAuthError(true)
      return null
    }
    try {
      const data = await callApi('/profile', partial, true, 'PUT', token)
      setProfile(data)
      setAuthMessage('Profile updated successfully')
      setAuthError(false)
      return data
    } catch (err) {
      setAuthMessage(err.message)
      setAuthError(true)
      throw err
    }
  }

  const forgotPassword = async () => {
    if (!forgotPasswordData.email.trim()) {
      setAuthMessage('Enter your email address.')
      setAuthError(true)
      return false
    }
    try {
      const data = await callApi('/forgot-password', { email: forgotPasswordData.email.trim().toLowerCase() })
      setForgotPasswordStage('requested')
      setAuthMessage(data.message)
      setAuthError(false)
      return true
    } catch (err) {
      setAuthMessage(err.message)
      setAuthError(true)
      return false
    }
  }

  const resetPassword = async (onSuccess) => {
    try {
      const data = await callApi('/reset-password', {
        email: forgotPasswordData.email.trim().toLowerCase(),
        otp: forgotPasswordData.otp.trim(),
        newPassword: forgotPasswordData.newPassword,
      })
      setForgotPasswordStage('done')
      setAuthMessage(data.message)
      setAuthError(false)
      onSuccess?.()
      return true
    } catch (err) {
      setAuthMessage(err.message)
      setAuthError(true)
      return false
    }
  }

  const adminLogin = async (e, onSuccess) => {
    e.preventDefault()
    try {
      const data = await callApi('/login', loginData)
      const profileData = await callApi('/profile', {}, true, 'GET', data.token)
      if (profileData.role !== 'ADMIN') {
        throw new Error('Access denied. Admin credentials required.')
      }
      await beginSession(data.token)
      setProfile(profileData)
      setAuthMessage('')
      setAuthError(false)
      // Hand the freshly issued token to the caller: the page's own `token` value is still the
      // pre-login one at this point, so anything it fetches immediately would go out unauthenticated.
      onSuccess?.(data.token)
      return true
    } catch (err) {
      setAuthMessage(err.message)
      setAuthError(true)
      return false
    }
  }

  const logout = () => {
    clearSessionToken()
    // Drop the cached profile as well. Leaving it in localStorage meant the previous user's
    // name (and role) came back on the next page load, which looked like a session that had
    // survived signing out.
    removeKey(LS_PROFILE)
    setToken('')
    setProfile(null)
    setLocalProfile(null)
    setAuthMessage('Logged out successfully')
    setAuthError(false)
  }

  const value = {
    token,
    sessionReady,
    authMessage,
    setAuthMessage,
    authError,
    setAuthError,
    emailAlreadyExists,
    profile,
    localProfile,
    rememberEmail,
    setRememberEmail,
    rememberEmailAfterSignup,
    setRememberEmailAfterSignup,
    signupData,
    setSignupData,
    otpData,
    setOtpData,
    loginData,
    setLoginData,
    loginIdentifier,
    setLoginIdentifier,
    loginOtpCode,
    setLoginOtpCode,
    loginOtpSent,
    loginOtpVerified,
    displayName,
    displayPhoto,
    onSignupPhoto,
    signup,
    verifyOtp,
    resendSignupOtp,
    sendLoginOtp,
    verifyLoginOtp,
    login,
    adminLogin,
    loadProfile,
    updateProfile,
    forgotPasswordData,
    setForgotPasswordData,
    forgotPasswordStage,
    setForgotPasswordStage,
    forgotPassword,
    resetPassword,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
