import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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

  // My Team is open to everyone:
  //  - managers see their direct reportees
  //  - developers see everyone who reports to the same manager (their peers)
  const me = candidates.find((c) => c.id === user.candidateId)
  const teamManager = isManager ? user.name : (me?.reportingManager || null)
  const team = teamManager ? candidates.filter((c) => c.reportingManager === teamManager) : []

  return (
    <div>
      <h1 className="page-title">My Team</h1>
      <p className="page-sub">
        {isManager
          ? 'The people who report to you and where each of them stands.'
          : teamManager
            ? <>Your team - everyone who reports to <strong>{teamManager}</strong>.</>
            : 'You haven\'t been assigned to a reporting manager yet.'}
      </p>

      {error && <div className="error-banner">{error}</div>}

      <div className="toolbar">
        <span className="badge blue">{team.length} {team.length === 1 ? 'member' : 'members'}</span>
        {!isManager && <span className="badge gray">View only · managers can edit</span>}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr><th>Name</th><th>Band</th><th>SOEID</th><th>Location</th><th>Pod</th><th>Stage</th><th>Join Date</th></tr>
          </thead>
          <tbody>
            {team.map((c) => (
              <tr key={c.id} className="clickable" onClick={() => navigate(`/profiles/${c.id}`)}>
                <td>
                  <strong>{c.name}</strong>
                  {c.id === user.candidateId && <span className="badge blue" style={{ marginLeft: 6 }}>You</span>}
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{c.email}</div>
                </td>
                <td>{c.band ? bandLabel(c.band) : '-'}</td>
                <td>{c.soeid || '-'}</td>
                <td>{c.location || '-'}</td>
                <td>{c.pod || '-'}</td>
                <td><span className={`badge ${c.currentStage === 'ONBOARDED' ? 'green' : c.currentStage === 'KARAT_FAILED' ? 'red' : 'blue'}`}>{STAGE_LABELS[c.currentStage]}</span></td>
                <td>{c.joinDate || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {team.length === 0 && <div className="empty">No teammates to show yet.</div>}
      </div>
    </div>
  )
}
