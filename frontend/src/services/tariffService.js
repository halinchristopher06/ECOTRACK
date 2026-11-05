import { SERVICE_API_BASE, apiFetch } from './apiClient.js'

export async function fetchTariffCatalog() {
  return apiFetch(`${SERVICE_API_BASE}/billing/tariffs`)
}
