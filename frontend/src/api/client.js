import axios from 'axios'

const apiClient = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

apiClient.interceptors.request.use((config) => {
  const token = window.localStorage.getItem('foodloop.accessToken')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export async function getApiHealth() {
  const response = await apiClient.get('/health')
  return response.data
}

export async function registerUser(payload) {
  const response = await apiClient.post('/auth/register', payload)
  return response.data
}

export async function loginUser(payload) {
  const response = await apiClient.post('/auth/login', payload)
  return response.data
}

export async function getCurrentUser() {
  const response = await apiClient.get('/auth/me')
  return response.data
}

export async function getDonations(params = {}) {
  const response = await apiClient.get('/donations', { params })
  return response.data
}

export async function createDonation(payload) {
  const response = await apiClient.post('/donations', payload)
  return response.data
}

export async function uploadDonationImage(file) {
  const formData = new FormData()
  formData.append('image', file)
  const response = await apiClient.post('/donations/images', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return response.data
}

export async function claimDonation(donationId) {
  const response = await apiClient.post(`/donations/${donationId}/claim`)
  return response.data
}

export async function getPendingNGOs() {
  const response = await apiClient.get('/admin/ngos')
  return response.data
}

export async function approveNGO(ngoId) {
  const response = await apiClient.put(`/admin/ngos/${ngoId}/approve`)
  return response.data
}

export async function rejectNGO(ngoId) {
  const response = await apiClient.put(`/admin/ngos/${ngoId}/reject`)
  return response.data
}

export async function rejectCommunityReport(reportId) {
  const response = await apiClient.put(`/admin/community/reports/${reportId}/reject`)
  return response.data
}

export async function getAdminUsers() {
  const response = await apiClient.get('/admin/users')
  return response.data
}

export async function setUserActive(userId, isActive) {
  const response = await apiClient.put(`/admin/users/${userId}/status`, { is_active: isActive })
  return response.data
}

export async function getAdminCommunityReports() {
  const response = await apiClient.get('/admin/community/reports')
  return response.data
}

export async function generatePickupQr(donationId) {
  const response = await apiClient.post(`/verification/generate/${donationId}`)
  return response.data
}

export async function getActiveVolunteers() {
  const response = await apiClient.get('/verification/volunteers')
  return response.data
}

export async function authorizePickupVolunteer(donationId, volunteerId) {
  const response = await apiClient.put(`/verification/authorize/${donationId}`, { volunteer_id: volunteerId })
  return response.data
}

export async function confirmPickup(token) {
  const response = await apiClient.post('/verification/confirm', { token })
  return response.data
}

export async function confirmPledgeDistribution(pledgeId) {
  const response = await apiClient.put(`/community/pledges/${pledgeId}/distribution`, { status: 'distributed' })
  return response.data
}

export async function getCommunityPledges(needId) {
  const response = await apiClient.get(`/community/reports/${needId}/pledges`)
  return response.data
}

export async function getCommunityNeeds() {
  const response = await apiClient.get('/community/verified')
  return response.data
}

export async function getMyCommunityReports() {
  const response = await apiClient.get('/community/reports/mine')
  return response.data
}

export async function createCommunityReport(payload) {
  const response = await apiClient.post('/community/reports', payload)
  return response.data
}

export async function uploadCommunityPhoto(file) {
  const formData = new FormData()
  formData.append('image', file)
  const response = await apiClient.post('/community/images', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return response.data
}

export async function verifyCommunityNeed(needId) {
  const response = await apiClient.put(`/community/reports/${needId}/verify`)
  return response.data
}

export async function pledgeCommunityMeals(needId, meals) {
  const response = await apiClient.post(`/community/reports/${needId}/pledge`, { meals })
  return response.data
}

export async function getImpactOverview() {
  const response = await apiClient.get('/analytics/overview')
  return response.data
}

export async function getLeaderboard(period = 'weekly') {
  const response = await apiClient.get('/leaderboard', { params: { period } })
  return response.data
}

export async function predictSurplus(payload) {
  const response = await apiClient.post('/ml/predict', payload)
  return response.data
}

export async function getPredictionHistory() {
  const response = await apiClient.get('/ml/history')
  return response.data
}

export async function downloadCertificate(donationId) {
  const response = await apiClient.get(`/verification/certificates/${donationId}`, { responseType: 'blob' })
  return response.data
}

export async function getNotifications() {
  const response = await apiClient.get('/notifications')
  return response.data
}

export async function markNotificationRead(notificationId) {
  const response = await apiClient.put(`/notifications/${notificationId}/read`)
  return response.data
}

export async function rateDonation(donationId, payload) {
  const response = await apiClient.post(`/donations/${donationId}/ratings`, payload)
  return response.data
}

export default apiClient
