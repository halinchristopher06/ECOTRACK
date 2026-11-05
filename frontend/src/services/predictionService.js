import { SERVICE_API_BASE, apiFetch } from './apiClient.js'

const PREDICTIONS_BASE = `${SERVICE_API_BASE}/predictions`

export async function fetchUpcomingBillPrediction(utilityType, token) {
  return apiFetch(`${PREDICTIONS_BASE}/upcoming?utilityType=${utilityType}`, {
    method: 'GET',
    token,
  })
}
