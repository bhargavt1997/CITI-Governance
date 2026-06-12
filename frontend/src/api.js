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
    throw new Error('Session expired - please sign in again')
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
  riskSummary: () => request('/dashboard/risk'),

  // Candidates
  candidates: (q) => request(`/candidates${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  candidate: (id) => request(`/candidates/${id}`),
  createCandidate: (data) => request('/candidates', { method: 'POST', body: JSON.stringify(data) }),
  bulkCandidates: (people) => request('/candidates/bulk', { method: 'POST', body: JSON.stringify({ people }) }),
  updateCandidate: (id, data) => request(`/candidates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  setSoeid: (id, soeid) => request(`/candidates/${id}/soeid`, { method: 'POST', body: JSON.stringify({ soeid }) }),
  updateSkills: (id, skills) => request(`/candidates/${id}/skills`, { method: 'PUT', body: JSON.stringify(skills) }),
  advanceStage: (id, notes) =>
    request(`/candidates/${id}/advance-stage`, { method: 'POST', body: JSON.stringify({ notes }) }),
  setStage: (id, stage, notes, offboardingReason) =>
    request(`/candidates/${id}/stage`, { method: 'POST', body: JSON.stringify({ stage, notes, offboardingReason }) }),
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

  // Delivery metrics (GT / Jira)
  metrics: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/metrics${qs ? `?${qs}` : ''}`)
  },
  saveMetric: (data) => request('/metrics', { method: 'POST', body: JSON.stringify(data) }),

  // Users
  managers: () => request('/users/managers'),

  // Projects (pods)
  pods: () => request('/pods'),
  createPod: (data) => request('/pods', { method: 'POST', body: JSON.stringify(data) }),

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
export const ALL_BANDS = ['b8', 'b7', 'b6l', 'b6h', 'b5l', 'b5h', 'b4l', 'b4h', 'b2']
export const MANAGER_BANDS = ['b6h', 'b5l', 'b5h', 'b4l', 'b4h', 'b2']
export const DEVELOPER_BANDS = ['b8', 'b7', 'b6l']
// Top-level leadership (B4L and above, including the CEO band b2) get the org-wide risk view.
export const LEADERSHIP_BANDS = ['b4l', 'b4h', 'b2']
// Delivery projects (stored in the candidate's `pod` field) and the client-side CITI leaders.
export const PROJECTS = ['RUBY', 'HY', 'MES']
export const CITI_LEADERS = ['Gonzalo', 'Joshua']
export const bandLabel = (b) => (b ? String(b).toUpperCase() : '')
// Seniority rank by band order (b8 lowest .. b4h highest). Higher = more senior.
export const bandRank = (b) => ALL_BANDS.indexOf(b)
// The band alone decides the role: B6H and above manage, B6L and below build.
export const roleForBand = (b) => (MANAGER_BANDS.includes(b) ? 'Manager' : 'Developer')

export const STAGES = [
  'NOMINATED',
  'CARAT_INTERVIEW',
  'KARAT_FAILED',
  'CLIENT_INTERVIEW',
  'FINAL_SELECTION',
  'ONBOARDING_INITIATED',
  'CITI_CLEARANCE_RECEIVED',
  'VDI_SETUP_IN_PROGRESS',
  'ONBOARDED',
  'OFFBOARDING',
  'OFFBOARDED',
]

// SOEID is only relevant once onboarding has started - hide it (value or "pending") before that stage.
export const soeidVisible = (stage) => STAGES.indexOf(stage) >= STAGES.indexOf('ONBOARDING_INITIATED')

export const STAGE_LABELS = {
  NOMINATED: 'Nominated',
  CARAT_INTERVIEW: 'KARAT Scheduled',
  KARAT_FAILED: 'KARAT Failed',
  CLIENT_INTERVIEW: 'Client Interview',
  FINAL_SELECTION: 'Final Selection',
  ONBOARDING_INITIATED: 'Onboarding Initiated',
  CITI_CLEARANCE_RECEIVED: 'Citi Clearance Received',
  VDI_SETUP_IN_PROGRESS: 'VDI Setup In Progress',
  ONBOARDED: 'Onboarded',
  OFFBOARDING: 'Offboarding',
  OFFBOARDED: 'Offboarded',
}
