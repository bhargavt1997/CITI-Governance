const BASE = '/api'

let onAuthFailure = null
export const setAuthFailureHandler = (fn) => { onAuthFailure = fn }

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' }
  const token = localStorage.getItem('cg_token')
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, { headers, ...options })

  if (res.status === 401 && !path.startsWith('/auth/login')) {
    onAuthFailure?.()
    throw new Error('Session expired — please sign in again')
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.message || `Request failed (${res.status})`)
  }
  if (res.status === 204) return null
  return res.json()
}

export const api = {
  // Auth
  login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),

  // Dashboard
  dashboardSummary: () => request('/dashboard/summary'),

  // Candidates
  candidates: (q) => request(`/candidates${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  candidate: (id) => request(`/candidates/${id}`),
  createCandidate: (data) => request('/candidates', { method: 'POST', body: JSON.stringify(data) }),
  updateCandidate: (id, data) => request(`/candidates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  setSoeid: (id, soeid) => request(`/candidates/${id}/soeid`, { method: 'POST', body: JSON.stringify({ soeid }) }),
  updateSkills: (id, skills) => request(`/candidates/${id}/skills`, { method: 'PUT', body: JSON.stringify(skills) }),
  advanceStage: (id, notes) =>
    request(`/candidates/${id}/advance-stage`, { method: 'POST', body: JSON.stringify({ notes }) }),
  stageHistory: (id) => request(`/candidates/${id}/stage-history`),
  candidateEnrollments: (id) => request(`/candidates/${id}/enrollments`),

  // Timesheets (PTS)
  timesheets: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/timesheets${qs ? `?${qs}` : ''}`)
  },
  saveTimesheet: (data) => request('/timesheets', { method: 'POST', body: JSON.stringify(data) }),
  decideTimesheet: (id, approved) =>
    request(`/timesheets/${id}/decision`, { method: 'POST', body: JSON.stringify({ approved }) }),

  // Users
  leads: () => request('/users/leads'),

  // Trainings
  trainings: () => request('/trainings'),
  training: (id) => request(`/trainings/${id}`),
  createTraining: (data) => request('/trainings', { method: 'POST', body: JSON.stringify(data) }),
  enroll: (trainingId, candidateId) =>
    request(`/trainings/${trainingId}/enroll`, { method: 'POST', body: JSON.stringify({ candidateId }) }),
  updateEnrollment: (id, data) => request(`/enrollments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
}

export const STAGES = [
  'NOMINATED',
  'CARAT_INTERVIEW',
  'CLIENT_INTERVIEW',
  'FINAL_SELECTION',
  'ONBOARDING_INITIATED',
  'CITI_CLEARANCE_RECEIVED',
  'VDI_SETUP_IN_PROGRESS',
  'ONBOARDED',
]

export const STAGE_LABELS = {
  NOMINATED: 'Nominated',
  CARAT_INTERVIEW: 'CARAT Interview',
  CLIENT_INTERVIEW: 'Client Interview',
  FINAL_SELECTION: 'Final Selection',
  ONBOARDING_INITIATED: 'Onboarding Initiated',
  CITI_CLEARANCE_RECEIVED: 'Citi Clearance Received',
  VDI_SETUP_IN_PROGRESS: 'VDI Setup In Progress',
  ONBOARDED: 'Onboarded',
}
