import { SERVICE_API_BASE, apiFetch } from './apiClient.js'

const APPLIANCES_BASE = `${SERVICE_API_BASE}/appliances`

export async function createAppliance(payload, token) {
  return apiFetch(APPLIANCES_BASE, {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  })
}

export async function listAppliances(token) {
  return apiFetch(APPLIANCES_BASE, {
    method: 'GET',
    token,
  })
}

export async function getApplianceBreakdown(token) {
  return apiFetch(`${APPLIANCES_BASE}/breakdown`, {
    method: 'GET',
    token,
  })
}

export async function getAppliance(id, token) {
  return apiFetch(`${APPLIANCES_BASE}/${id}`, {
    method: 'GET',
    token,
  })
}

export async function updateAppliance(id, payload, token) {
  return apiFetch(`${APPLIANCES_BASE}/${id}`, {
    method: 'PUT',
    token,
    body: JSON.stringify(payload),
  })
}

export async function deleteAppliance(id, token) {
  return apiFetch(`${APPLIANCES_BASE}/${id}`, {
    method: 'DELETE',
    token,
    responseType: 'none',
  })
}
