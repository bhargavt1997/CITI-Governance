// Same-origin '/api' by default (local dev proxy + the single Docker image). For a split deploy
// (e.g. frontend on GitHub Pages), set VITE_API_BASE_URL to the backend, e.g. https://api.example.com/api
const BASE = import.meta.env.VITE_API_BASE_URL || '/api'

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
  register: (data) => request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  publicManagers: () => request('/auth/managers'),
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
  setStage: (id, stage, notes) =>
    request(`/candidates/${id}/stage`, { method: 'POST', body: JSON.stringify({ stage, notes }) }),
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
  managers: () => request('/users/managers'),

  // Trainings
  trainings: () => request('/trainings'),
  training: (id) => request(`/trainings/${id}`),
  createTraining: (data) => request('/trainings', { method: 'POST', body: JSON.stringify(data) }),
  enroll: (trainingId, candidateId) =>
    request(`/trainings/${trainingId}/enroll`, { method: 'POST', body: JSON.stringify({ candidateId }) }),
  updateEnrollment: (id, data) => request(`/enrollments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
}

// Career bands. Stored lowercase; displayed uppercase (use bandLabel). Manager-eligible vs developer bands
// form a clean split.
export const ALL_BANDS = ['b8', 'b7', 'b6l', 'b6h', 'b5l', 'b5h', 'b4l', 'b4h']
export const MANAGER_BANDS = ['b6h', 'b5l', 'b5h', 'b4l', 'b4h']
export const DEVELOPER_BANDS = ['b8', 'b7', 'b6l']
export const bandLabel = (b) => (b ? String(b).toUpperCase() : '')

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
  CARAT_INTERVIEW: 'KARAT Interview',
  CLIENT_INTERVIEW: 'Client Interview',
  FINAL_SELECTION: 'Final Selection',
  ONBOARDING_INITIATED: 'Onboarding Initiated',
  CITI_CLEARANCE_RECEIVED: 'Citi Clearance Received',
  VDI_SETUP_IN_PROGRESS: 'VDI Setup In Progress',
  ONBOARDED: 'Onboarded',
}
