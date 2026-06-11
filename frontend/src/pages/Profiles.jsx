import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { api, STAGE_LABELS, bandLabel } from '../api'
import { useAuth } from '../auth'

export default function Profiles() {
  const { user, isManager } = useAuth()
  const [candidates, setCandidates] = useState([])
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    api.candidates().then(setCandidates).catch((e) => setError(e.message))
  }, [])

  // Profiles is a manager feature; developers reach their own profile via "My Profile".
  if (!isManager) return <Navigate to="/" replace />

  // Show only the manager's direct reportees.
  const reportees = candidates.filter((c) => c.reportingManager === user.name)

  return (
    <div>
      <h1 className="page-title">My Team</h1>
      <p className="page-sub">Your direct reportees — click anyone to open their full profile, skills and trainings.</p>

      {error && <div className="error-banner">{error}</div>}

      <div className="toolbar">
        <span className="badge blue">{reportees.length} reportee{reportees.length === 1 ? '' : 's'}</span>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr><th>Name</th><th>Band</th><th>SOEID</th><th>Location</th><th>Pod</th><th>Stage</th><th>Join Date</th></tr>
          </thead>
          <tbody>
            {reportees.map((c) => (
              <tr key={c.id} className="clickable" onClick={() => navigate(`/profiles/${c.id}`)}>
                <td><strong>{c.name}</strong><div style={{ fontSize: 11, color: 'var(--muted)' }}>{c.email}</div></td>
                <td>{c.band ? bandLabel(c.band) : '—'}</td>
                <td>{c.soeid || '—'}</td>
                <td>{c.location || '—'}</td>
                <td>{c.pod || '—'}</td>
                <td><span className={`badge ${c.currentStage === 'ONBOARDED' ? 'green' : 'blue'}`}>{STAGE_LABELS[c.currentStage]}</span></td>
                <td>{c.joinDate || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {reportees.length === 0 && <div className="empty">You have no direct reportees yet.</div>}
      </div>
    </div>
  )
}
