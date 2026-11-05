import { SERVICE_API_BASE, apiFetch } from './apiClient.js'
import { catalogById } from '../appliancesCatalog.js'

export async function fetchBillingEstimate({ electricityUnits, waterUnits }, signal) {
  return apiFetch(`${SERVICE_API_BASE}/billing/estimate`, {
    method: 'POST',
    body: JSON.stringify({ electricityUnits, waterUnits }),
    signal,
  })
}

export async function fetchApplianceEstimate(applianceRows, signal) {
  const rows = applianceRows.map((row) => {
    const appliance = catalogById(row.applianceId)
    return {
      applianceId: row.applianceId,
      count: Math.max(0, Number(row.count) || 0),
      hours: Math.max(0, Number(row.hours) || 0),
      wMin: appliance.wMin,
      wMax: appliance.wMax,
    }
  })
  return apiFetch(`${SERVICE_API_BASE}/billing/appliances/estimate`, {
    method: 'POST',
    body: JSON.stringify({ rows }),
    signal,
  })
}
