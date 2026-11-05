import { SERVICE_API_BASE, apiFetch } from './apiClient.js'

const BUDGET_BASE = `${SERVICE_API_BASE}/budget`

export async function getBudget(token) {
  return apiFetch(BUDGET_BASE, {
    method: 'GET',
    token,
  })
}

export async function updateBudget(payload, token) {
  return apiFetch(BUDGET_BASE, {
    method: 'PUT',
    token,
    body: JSON.stringify(payload),
  })
}

export async function getBudgetStatus(token) {
  return apiFetch(`${BUDGET_BASE}/status`, {
    method: 'GET',
    token,
  })
}
