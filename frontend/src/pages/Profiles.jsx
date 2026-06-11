import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, STAGE_LABELS } from '../api'

export default function Profiles() {
  const [candidates, setCandidates] = useState([])
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    api.candidates().then(setCandidates).catch((e) => setError(e.message))
  }, [])

  return (
    <div>
      <h1 className="page-title">Profiles</h1>
      <p className="page-sub">All candidates — click anyone to open their full profile, skills and trainings.</p>

      {error && <div className="error-banner">{error}</div>}

      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr><th>Name</th><th>SOEID</th><th>Location</th><th>Pod</th><th>Manager</th><th>Stage</th><th>Join Date</th></tr>
          </thead>
          <tbody>
            {candidates.map((c) => (
              <tr key={c.id} className="clickable" onClick={() => navigate(`/profiles/${c.id}`)}>
                <td><strong>{c.name}</strong><div style={{ fontSize: 11, color: 'var(--muted)' }}>{c.email}</div></td>
                <td>{c.soeid || '—'}</td>
                <td>{c.location || '—'}</td>
                <td>{c.pod || '—'}</td>
                <td>{c.reportingManager || '—'}</td>
                <td><span className={`badge ${c.currentStage === 'ONBOARDED' ? 'green' : 'blue'}`}>{STAGE_LABELS[c.currentStage]}</span></td>
                <td>{c.joinDate || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {candidates.length === 0 && <div className="empty">No candidates yet.</div>}
      </div>
    </div>
  )
}
