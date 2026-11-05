export const LS_USAGE_HISTORY = 'ecotrack_usage_history'
export const LS_PROFILE = 'ecotrack_local_profile'
/** Session token, kept so a page refresh does not sign the user out. */
export const LS_SESSION = 'ecotrack_session'
/** Remembered email address only — never a password. */
export const LS_REMEMBERED_EMAIL = 'ecotrack_remembered_email'
/** Legacy key that used to hold a plaintext password; actively cleared on boot. */
export const LEGACY_LS_SAVED_LOGIN = 'ecotrack_saved_login'

export function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

export function saveJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // ignore persistence failures (private mode, quota, etc.)
  }
}

export function removeKey(key) {
  try {
    localStorage.removeItem(key)
  } catch {
    // ignore
  }
}

/** Reads the persisted session token, returning '' when absent or malformed. */
export function loadSessionToken() {
  const stored = loadJson(LS_SESSION, null)
  return typeof stored?.token === 'string' ? stored.token : ''
}

export function saveSessionToken(token) {
  saveJson(LS_SESSION, { token })
}

export function clearSessionToken() {
  removeKey(LS_SESSION)
}

export function loadRememberedEmail() {
  const stored = loadJson(LS_REMEMBERED_EMAIL, null)
  return typeof stored?.email === 'string' ? stored.email : ''
}

export function saveRememberedEmail(email) {
  saveJson(LS_REMEMBERED_EMAIL, { email: String(email || '').trim().toLowerCase() })
}

export function clearRememberedEmail() {
  removeKey(LS_REMEMBERED_EMAIL)
}

/**
 * Removes any plaintext password a previous version of the app may have written to this
 * browser. Called once on startup so upgrading users are cleaned up automatically.
 */
export function purgeLegacyStoredPassword() {
  removeKey(LEGACY_LS_SAVED_LOGIN)
}
