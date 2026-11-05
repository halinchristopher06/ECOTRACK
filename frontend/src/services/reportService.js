import { SERVICE_API_BASE, apiFetch } from './apiClient.js'

async function downloadReport(path, token) {
  // Reports are binary files, so read the response as a blob.
  return apiFetch(`${SERVICE_API_BASE}${path}`, {
    method: 'GET',
    token,
    responseType: 'blob',
  })
}

export async function downloadBillsReport(token, { utilityType, format } = {}) {
  const params = new URLSearchParams()
  if (utilityType) params.set('utilityType', utilityType)
  params.set('format', format || 'excel')
  return downloadReport(`/reports/bills?${params.toString()}`, token)
}

export async function downloadApplianceReport(token, { format } = {}) {
  const params = new URLSearchParams({ format: format || 'excel' })
  return downloadReport(`/reports/appliances?${params.toString()}`, token)
}

export async function downloadPaymentHistoryReport(token, { format } = {}) {
  const params = new URLSearchParams({ format: format || 'excel' })
  return downloadReport(`/reports/payment-history?${params.toString()}`, token)
}

export async function downloadAnnualReport(token, { year, format } = {}) {
  const params = new URLSearchParams({ year: String(year), format: format || 'excel' })
  return downloadReport(`/reports/annual?${params.toString()}`, token)
}

export function triggerBlobDownload(blob, filename) {
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(url)
}
