import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { api, STAGE_LABELS, bandLabel } from '../api'
import { useAuth } from '../auth'

const stageBadge = (stage) => (stage === 'ONBOARDED' ? 'green' : stage === 'NOMINATED' ? 'gray' : 'blue')
const SENIOR_BANDS = ['b5l', 'b5h', 'b4l', 'b4h']
const roleText = (c) => (c.role === 'MANAGER'
  ? (SENIOR_BANDS.includes(c.band) ? 'Senior Manager' : 'Manager')
  : 'Developer')

export default function People() {
  const { isSeniorManager } = useAuth()
  const [people, setPeople] = useState([])
  const [error, setError] = useState(null)
  const [q, setQ] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    api.candidates().then(setPeople).catch((e) => setError(e.message))
  }, [])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return people
    return people.filter((c) => [
      c.name, c.email, c.soeid, c.reportingManager, c.pod, c.location,
      c.band, roleText(c), STAGE_LABELS[c.currentStage],
    ].some((v) => v && String(v).toLowerCase().includes(term)))
  }, [people, q])

  // Gate: only senior managers may view the full directory.
  if (!isSeniorManager) return <Navigate to="/" replace />

  const managers = people.filter((p) => p.role === 'MANAGER').length
  const onboarded = people.filter((p) => p.currentStage === 'ONBOARDED').length

  return (
    <div>
      <h1 className="page-title">Organization Directory</h1>
      <p className="page-sub">
        A complete view of everyone in the organisation and where they stand in onboarding.
      </p>

      {error && <div className="error-banner">{error}</div>}

      <div className="toolbar">
        <span className="badge blue">{people.length} people</span>
        <span className="badge gray">{managers} managers</span>
        <span className="badge green">{onboarded} onboarded</span>
        <div className="spacer" />
        <input
          type="text"
          className="dir-search"
          placeholder="Search name, email, manager, pod, band…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Name</th><th>Role</th><th>Band</th><th>Reporting Manager</th>
              <th>Onboarding Status</th><th>Pod</th><th>Location</th><th>SOEID</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="clickable" onClick={() => navigate(`/profiles/${c.id}`)}>
                <td><strong>{c.name}</strong><div style={{ fontSize: 11, color: 'var(--muted)' }}>{c.email}</div></td>
                <td><span className={`badge ${c.role === 'MANAGER' ? 'blue' : 'gray'}`}>{roleText(c)}</span></td>
                <td>{c.band ? bandLabel(c.band) : '—'}</td>
                <td>{c.reportingManager || '—'}</td>
                <td><span className={`badge ${stageBadge(c.currentStage)}`}>{STAGE_LABELS[c.currentStage]}</span></td>
                <td>{c.pod || '—'}</td>
                <td>{c.location || '—'}</td>
                <td>{c.soeid || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="empty">{q ? `No people match “${q}”.` : 'No registered people yet.'}</div>
        )}
      </div>
    </div>
  )
}
