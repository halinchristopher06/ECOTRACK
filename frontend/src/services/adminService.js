import { API_BASE, callApi, apiFetch } from './apiClient.js'

export async function fetchAllUsers(token) {
  return callApi('/admin/users', {}, true, 'GET', token)
}

export async function fetchUserHistory(userId, token) {
  return callApi(`/admin/users/${userId}/history`, {}, true, 'GET', token)
}

export async function getAdminStats(token) {
  return callApi('/admin/stats', {}, true, 'GET', token)
}

export async function exportUsersExcel(token) {
  // The export is an Excel binary file, so read the response as a blob.
  return apiFetch(`${API_BASE.replace('/auth', '')}/admin/export-users`, {
    method: 'GET',
    token,
    responseType: 'blob',
  })
}
