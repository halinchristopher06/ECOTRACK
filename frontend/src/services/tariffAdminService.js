import { SERVICE_API_BASE, apiFetch } from './apiClient.js'

export async function fetchAdminTariffs(token, utilityType) {
  const query = utilityType ? `?utilityType=${encodeURIComponent(utilityType)}` : ''
  return apiFetch(`${SERVICE_API_BASE}/admin/tariffs${query}`, {
    token,
  })
}

export async function createTariffProvider(token, payload) {
  return apiFetch(`${SERVICE_API_BASE}/admin/tariffs`, {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  })
}

export async function addTariffRateVersion(token, groupKey, payload) {
  return apiFetch(`${SERVICE_API_BASE}/admin/tariffs/new-version`, {
    method: 'POST',
    token,
    body: JSON.stringify({ ...payload, groupKey }),
  })
}

export async function setTariffActive(token, id, value) {
  return apiFetch(`${SERVICE_API_BASE}/admin/tariffs/${id}/active?value=${value}`, {
    method: 'PUT',
    token,
  })
}

export async function fetchTariffHistory(token, groupKey) {
  return apiFetch(`${SERVICE_API_BASE}/admin/tariffs/history?groupKey=${encodeURIComponent(groupKey)}`, {
    token,
  })
}
