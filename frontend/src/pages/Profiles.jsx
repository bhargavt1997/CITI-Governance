import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, STAGE_LABELS, bandLabel } from '../api'
import { useAuth } from '../auth'

const currentMonth = () => new Date().toISOString().slice(0, 7)

export default function Profiles() {
  const { user, isManager } = useAuth()
  const [candidates, setCandidates] = useState([])
  const [metrics, setMetrics] = useState([])
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    api.candidates().then(setCandidates).catch((e) => setError(e.message))
    api.metrics().then(setMetrics).catch(() => setMetrics([]))
  }, [])

  // My Team is open to everyone:
  //  - managers see their direct reportees
  //  - developers see everyone who reports to the same manager (their peers)
  const me = candidates.find((c) => c.id === user.candidateId)
  const teamManager = isManager ? user.name : (me?.reportingManager || null)
  const team = teamManager ? candidates.filter((c) => c.reportingManager === teamManager) : []

  // Metrics keyed by candidate id (all months), plus a quick this-month commits lookup.
  const byCandidate = useMemo(() => {
    const map = {}
    for (const m of metrics) {
      const cid = m.candidate?.id
      if (cid == null) continue
      ;(map[cid] = map[cid] || []).push(m)
    }
    return map
  }, [metrics])
  const month = currentMonth()
  const commitsThisMonth = (cid) => byCandidate[cid]?.find((m) => m.month === month)?.githubCommits

  const downloadReport = () => {
    const cols = [
      'Name', 'Email', 'Band', 'Reporting Manager', 'Month',
      'GitHub Commits', 'Stories Assigned', 'Stories Completed',
      'Story Points Assigned', 'Story Points Completed', 'Work Highlights',
    ]
    const rows = []
    for (const c of team) {
      const months = [...(byCandidate[c.id] || [])].sort((a, b) => a.month.localeCompare(b.month))
      const base = [c.name, c.email, c.band ? bandLabel(c.band) : '', c.reportingManager || '']
      if (months.length === 0) {
        rows.push([...base, '', '', '', '', '', '', ''])
      } else {
        for (const m of months) {
          rows.push([
            ...base, m.month,
            m.githubCommits ?? 0, m.storiesAssigned ?? 0, m.storiesCompleted ?? 0,
            m.storyPointsAssigned ?? 0, m.storyPointsCompleted ?? 0, m.highlights || '',
          ])
        }
      }
    }
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const csv = [cols, ...rows].map((r) => r.map(esc).join(',')).join('\r\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'team-gt-metrics.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

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
        <div className="spacer" />
        <button className="btn secondary" disabled={team.length === 0} onClick={downloadReport}>
          ↓ Download report
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Name</th><th>Band</th><th>SOEID</th><th>Location</th><th>Pod</th>
              <th>GT Metrics</th><th>Stage</th><th>Join Date</th>
            </tr>
          </thead>
          <tbody>
            {team.map((c) => {
              const commits = commitsThisMonth(c.id)
              return (
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
                  <td>
                    {commits != null
                      ? <span title={`Commits in ${month}`}><strong>{commits}</strong> <span style={{ fontSize: 11, color: 'var(--muted)' }}>commits</span></span>
                      : <span style={{ color: 'var(--faint)' }}>-</span>}
                  </td>
                  <td><span className={`badge ${c.currentStage === 'ONBOARDED' ? 'green' : c.currentStage === 'KARAT_FAILED' ? 'red' : 'blue'}`}>{STAGE_LABELS[c.currentStage]}</span></td>
                  <td>{c.joinDate || '-'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {team.length === 0 && <div className="empty">No teammates to show yet.</div>}
      </div>
    </div>
  )
}
