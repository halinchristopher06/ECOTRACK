import { SERVICE_API_BASE, apiFetch } from './apiClient.js'

const ANOMALIES_BASE = `${SERVICE_API_BASE}/anomalies`

export async function checkUnusualConsumption(utilityType, token) {
  return apiFetch(`${ANOMALIES_BASE}/check?utilityType=${utilityType}`, {
    method: 'GET',
    token,
  })
}
