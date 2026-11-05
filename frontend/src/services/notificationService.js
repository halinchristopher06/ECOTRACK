import { SERVICE_API_BASE, apiFetch } from './apiClient.js'

const NOTIFICATIONS_BASE = `${SERVICE_API_BASE}/notifications`

export async function getNotifications(token) {
  return apiFetch(NOTIFICATIONS_BASE, {
    method: 'GET',
    token,
  })
}

export async function markNotificationRead(id, value, token) {
  return apiFetch(`${NOTIFICATIONS_BASE}/${id}/read?value=${value}`, {
    method: 'PUT',
    token,
  })
}

export async function getNotificationPreferences(token) {
  return apiFetch(`${NOTIFICATIONS_BASE}/preferences`, {
    method: 'GET',
    token,
  })
}

export async function updateNotificationPreferences(payload, token) {
  return apiFetch(`${NOTIFICATIONS_BASE}/preferences`, {
    method: 'PUT',
    token,
    body: JSON.stringify(payload),
  })
}
