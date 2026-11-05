import {
  ApiError,
  SERVICE_API_BASE,
  UNAUTHORIZED_EVENT,
  UPLOAD_TIMEOUT_MS,
  apiFetch,
  fallbackMessageFor,
} from './apiClient.js'

const BILLS_BASE = `${SERVICE_API_BASE}/bills`

/**
 * Uploads a bill document and reports genuine byte-level progress.
 *
 * fetch() cannot report upload progress, so this single call uses XMLHttpRequest, which can. The
 * error handling deliberately mirrors apiFetch so callers see the same ApiError messages: a JSON
 * error body becomes its `message`, a 401 notifies the auth layer, and the request is abandoned
 * once it exceeds the upload time budget instead of hanging forever.
 *
 * @param onProgress called with a 0–100 percentage as the file is transferred
 */
export function uploadBillDocument(file, utilityType, token, onProgress) {
  const form = new FormData()
  form.append('file', file)
  if (utilityType) form.append('utilityType', utilityType)

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${BILLS_BASE}/upload`)
    if (token) xhr.setRequestHeader('X-Session-Token', token)
    xhr.timeout = UPLOAD_TIMEOUT_MS

    xhr.upload.onprogress = (event) => {
      if (onProgress && event.lengthComputable && event.total > 0) {
        onProgress(Math.round((event.loaded / event.total) * 100))
      }
    }

    xhr.onload = () => {
      let data
      try {
        data = xhr.responseText ? JSON.parse(xhr.responseText) : null
      } catch {
        data = null
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data)
        return
      }
      if (xhr.status === 401 && token) {
        window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT))
      }
      reject(new ApiError(data?.message || fallbackMessageFor(xhr.status), xhr.status))
    }
    xhr.onerror = () =>
      reject(new ApiError('We could not reach the server. Please check your connection and try again.', 0))
    xhr.ontimeout = () =>
      reject(new ApiError('The request took too long. Please check your connection and try again.', 0))

    xhr.send(form)
  })
}

export async function createBill(payload, token) {
  return apiFetch(BILLS_BASE, {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  })
}

export async function listBills(token, filters = {}) {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value)
  })
  const query = params.toString() ? `?${params.toString()}` : ''
  return apiFetch(`${BILLS_BASE}${query}`, {
    method: 'GET',
    token,
  })
}

export async function getBill(id, token) {
  return apiFetch(`${BILLS_BASE}/${id}`, {
    method: 'GET',
    token,
  })
}

export async function updateBill(id, payload, token) {
  return apiFetch(`${BILLS_BASE}/${id}`, {
    method: 'PUT',
    token,
    body: JSON.stringify(payload),
  })
}

export async function deleteBill(id, token) {
  return apiFetch(`${BILLS_BASE}/${id}`, {
    method: 'DELETE',
    token,
    responseType: 'none',
  })
}

export async function markBillPaid(id, paymentDate, token) {
  return apiFetch(`${BILLS_BASE}/${id}/mark-paid`, {
    method: 'PUT',
    token,
    body: JSON.stringify({ paymentDate: paymentDate || null }),
  })
}

export async function downloadBillDocument(id, token) {
  // The document is a binary file, so read the response as a blob rather than JSON.
  return apiFetch(`${BILLS_BASE}/${id}/document`, {
    method: 'GET',
    token,
    responseType: 'blob',
  })
}
