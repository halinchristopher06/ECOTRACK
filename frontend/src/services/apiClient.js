/** Backend auth API: same machine as the page host unless explicitly overridden. */
function getAuthApiBase() {
  const fromEnv = import.meta.env.VITE_API_BASE
  if (fromEnv && String(fromEnv).trim()) {
    return String(fromEnv).trim().replace(/\/$/, '')
  }
  const backendPort = String(import.meta.env.VITE_BACKEND_PORT || '8080').trim()
  if (typeof window === 'undefined') {
    return `http://localhost:${backendPort}/api/auth`
  }
  const { hostname, protocol } = window.location
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `http://localhost:${backendPort}/api/auth`
  }
  return `${protocol}//${hostname}:${backendPort}/api/auth`
}

export const API_BASE = getAuthApiBase()
export const SERVICE_API_BASE = API_BASE.replace(/\/auth$/, '')

/** Default budget for a normal JSON call. Uploads/OCR pass their own, larger, value. */
export const DEFAULT_TIMEOUT_MS = 20000
/** OCR + PDF extraction can genuinely take a while, so uploads get a longer budget. */
export const UPLOAD_TIMEOUT_MS = 90000

/** Event name the auth layer listens for so an expired session can log the user out cleanly. */
export const UNAUTHORIZED_EVENT = 'ecotrack:unauthorized'

/** An error that carries the HTTP status, so callers can branch on 401/404/413 without string matching. */
export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export function fallbackMessageFor(status) {
  switch (status) {
    case 400:
      return 'That request was not valid. Please check the details and try again.'
    case 401:
      return 'Your session has expired. Please sign in again.'
    case 403:
      return 'You do not have permission to do that.'
    case 404:
      return 'We could not find what you were looking for.'
    case 413:
      return 'That file is too large. Please upload a smaller file.'
    case 429:
      return 'Too many attempts. Please wait a moment and try again.'
    case 503:
      return 'The service is temporarily unavailable. Please try again in a moment.'
    default:
      return status >= 500
        ? 'Something went wrong on our side. Please try again.'
        : 'The request could not be completed.'
  }
}

/** Reads a response body as JSON without throwing when the body is empty or not JSON. */
export async function readJsonSafely(res) {
  try {
    const text = await res.text()
    if (!text) return null
    return JSON.parse(text)
  } catch {
    return null
  }
}

function notifyUnauthorized() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT))
  }
}

/**
 * Single fetch wrapper for the whole frontend.
 *
 * Guarantees: a request never hangs forever (AbortController timeout), a non-JSON error body
 * never crashes the caller (safe parse + status-based fallback message), and a 401 on an
 * authenticated request notifies the auth layer so the user is returned to the sign-in screen
 * instead of being left on a broken page.
 *
 * @param url           absolute request URL
 * @param options.token session token, sent as X-Session-Token when present
 * @param options.timeoutMs how long to wait before aborting
 * @param options.responseType 'json' (default) | 'blob' | 'none'
 */
export async function apiFetch(url, { token, timeoutMs = DEFAULT_TIMEOUT_MS, responseType = 'json', ...init } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const callerSignal = init.signal

  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        // Only JSON bodies get a JSON content-type — FormData must be left for the browser to
        // set (including its boundary), otherwise the upload would be rejected.
        ...(typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { 'X-Session-Token': token } : {}),
        ...(init.headers || {}),
      },
      signal: callerSignal || controller.signal,
    })

    // Only treat 401 as "session expired" when the call actually carried a session token —
    // a 401 from the sign-in form itself is a wrong-password error, not an expiry.
    if (res.status === 401 && token) {
      notifyUnauthorized()
    }

    if (!res.ok) {
      const data = await readJsonSafely(res)
      throw new ApiError(data?.message || fallbackMessageFor(res.status), res.status)
    }
    if (responseType === 'none') return null
    if (responseType === 'blob') return res.blob()
    return readJsonSafely(res)
  } catch (err) {
    if (err instanceof ApiError) throw err
    if (err?.name === 'AbortError') {
      // A caller-supplied signal that fired is the caller's business (e.g. a superseded
      // type-ahead request) — rethrow untouched so they can ignore it.
      if (callerSignal?.aborted) throw err
      throw new ApiError('The request took too long. Please check your connection and try again.', 0)
    }
    throw new ApiError('We could not reach the server. Please check your connection and try again.', 0)
  } finally {
    clearTimeout(timer)
  }
}

/** Auth-API convenience wrapper (keeps the existing callApi signature working). */
export async function callApi(path, payload, withToken = false, method = 'POST', token = '') {
  return apiFetch(`${API_BASE}${path}`, {
    method,
    token: withToken ? token : '',
    body: method !== 'GET' ? JSON.stringify(payload ?? {}) : undefined,
  })
}
