import { SERVICE_API_BASE, apiFetch } from './apiClient.js'

const DASHBOARD_BASE = `${SERVICE_API_BASE}/dashboard`

export async function fetchDashboardSummary(token) {
  return apiFetch(`${DASHBOARD_BASE}/summary`, {
    method: 'GET',
    token,
  })
}

export async function fetchDashboardCharts(token) {
  return apiFetch(`${DASHBOARD_BASE}/charts`, {
    method: 'GET',
    token,
  })
}
