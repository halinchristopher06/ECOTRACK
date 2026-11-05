import { SERVICE_API_BASE, apiFetch } from './apiClient.js'

const RECOMMENDATIONS_BASE = `${SERVICE_API_BASE}/recommendations`

export async function getRecommendations(token) {
  return apiFetch(RECOMMENDATIONS_BASE, {
    method: 'GET',
    token,
  })
}

export async function setRecommendationCompleted(id, value, token) {
  return apiFetch(`${RECOMMENDATIONS_BASE}/${id}/completed?value=${value}`, {
    method: 'PUT',
    token,
  })
}
