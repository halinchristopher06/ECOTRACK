import { SERVICE_API_BASE, UPLOAD_TIMEOUT_MS, apiFetch } from './apiClient.js'

const OCR_BASE = `${SERVICE_API_BASE}/ocr`

/**
 * Server-side OCR health probe.
 *
 * The endpoint is public (no session token) and always answers 200, so it is safe to call on
 * mount for a troubleshooting banner. Resolves to `{ available, tessdataPath, languages, reason }`.
 */
export function fetchOcrStatus() {
  return apiFetch(`${OCR_BASE}/status`, { timeoutMs: 8000 })
}

/**
 * Reads a meter display from a photo.
 *
 * Resolves to `{ reading, confidence, rawText, ocrAvailable, reason }`. `reading` is null whenever
 * the server could not read a number — the reason explains why — so the UI never fills in an
 * invented value. Never throws for an OCR problem; only a genuine transport error rejects.
 *
 * @param file        the meter photo (JPG/PNG)
 * @param utilityType optional "ELECTRICITY" | "WATER"
 * @param token       session token (X-Session-Token)
 */
export function readMeterPhoto(file, utilityType, token) {
  const form = new FormData()
  form.append('file', file)
  if (utilityType) form.append('utilityType', utilityType)

  return apiFetch(`${OCR_BASE}/meter`, {
    method: 'POST',
    body: form,
    token,
    timeoutMs: UPLOAD_TIMEOUT_MS,
  })
}
