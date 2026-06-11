const BASE = '/api'

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.message || `Request failed (${res.status})`)
  }
  if (res.status === 204) return null
  return res.json()
}

export const api = {
  // Dashboard
  dashboardSummary: () => request('/dashboard/summary'),

  // Candidates
  candidates: (q) => request(`/candidates${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  candidate: (id) => request(`/candidates/${id}`),
  createCandidate: (data) => request('/candidates', { method: 'POST', body: JSON.stringify(data) }),
  updateCandidate: (id, data) => request(`/candidates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  setSoeid: (id, soeid) => request(`/candidates/${id}/soeid`, { method: 'POST', body: JSON.stringify({ soeid }) }),
  updateSkills: (id, skills) => request(`/candidates/${id}/skills`, { method: 'PUT', body: JSON.stringify(skills) }),
  advanceStage: (id, completedBy, notes) =>
    request(`/candidates/${id}/advance-stage`, { method: 'POST', body: JSON.stringify({ completedBy, notes }) }),
  stageHistory: (id) => request(`/candidates/${id}/stage-history`),
  candidateEnrollments: (id) => request(`/candidates/${id}/enrollments`),

  // Timesheets (PTS)
  timesheets: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/timesheets${qs ? `?${qs}` : ''}`)
  },
  saveTimesheet: (data) => request('/timesheets', { method: 'POST', body: JSON.stringify(data) }),

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

// Simulated logged-in user until SSO/auth lands in a later phase
export const CURRENT_USER = {
  name: 'Suresh Iyer',
  email: 'suresh.iyer@deloitte.com',
  role: 'LEAD',
}
