import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, STAGE_LABELS, bandLabel, slug } from '../api'
import { useAuth } from '../auth'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const now = new Date()
const CURRENT_YEAR = now.getFullYear()
const CURRENT_MONTH = now.getMonth() + 1 // 1-indexed

export default function Profiles() {
  const { user, isManager } = useAuth()
  const [candidates, setCandidates] = useState([])
  const [metrics, setMetrics] = useState([])
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  // Period selection state — default to current year/month
  const [selYear, setSelYear] = useState(CURRENT_YEAR)
  const [selMonth, setSelMonth] = useState(CURRENT_MONTH)

  useEffect(() => {
    api.candidates().then(setCandidates).catch((e) => setError(e.message))
    api.metrics().then(setMetrics).catch(() => setMetrics([]))
  }, [])

  // My Team is open to everyone:
  //  - managers see themselves + their direct reportees
  //  - developers see themselves + everyone who reports to the same manager (peers)
  const me = candidates.find((c) => c.id === user.candidateId)
  const teamManager = isManager ? user.name : (me?.reportingManager || null)
  const reportees = teamManager ? candidates.filter((c) => c.reportingManager === teamManager) : []
  const team = me && !reportees.find((c) => c.id === me.id) ? [me, ...reportees] : reportees

  // Metrics keyed by candidate id (all months)
  const byCandidate = useMemo(() => {
    const map = {}
    for (const m of metrics) {
      const cid = m.candidate?.id
      if (cid == null) continue
      ;(map[cid] = map[cid] || []).push(m)
    }
    return map
  }, [metrics])

  // Distinct years from the loaded data, always including the current year, min 2024
  const yearOptions = useMemo(() => {
    const years = new Set([CURRENT_YEAR])
    for (const m of metrics) {
      const y = parseInt(m.month?.slice(0, 4), 10)
      if (!isNaN(y) && y >= 2024) years.add(y)
    }
    return [...years].sort((a, b) => a - b)
  }, [metrics])

  // Selected period as a yyyy-MM key and a display label
  const selMonthKey = `${selYear}-${String(selMonth).padStart(2, '0')}`
  const selMonthLabel = `${MONTH_NAMES[selMonth - 1].slice(0, 3)} ${selYear}`

  // Commits for a given candidate in the selected period
  const commitsForPeriod = (cid) =>
    byCandidate[cid]?.find((m) => m.month === selMonthKey)?.githubCommits

  const downloadReport = () => {
    const cols = [
      'Name', 'Email', 'Band', 'Reporting Manager',
      'Year', 'Month',
      'GitHub Commits', 'Stories Assigned', 'Stories Completed',
      'Story Points Assigned', 'Story Points Completed', 'Work Highlights',
    ]
    const rows = []
    for (const c of team) {
      const entry = byCandidate[c.id]?.find((m) => m.month === selMonthKey)
      rows.push([
        c.name,
        c.email,
        c.band ? bandLabel(c.band) : '',
        c.reportingManager || '',
        selYear,
        MONTH_NAMES[selMonth - 1],
        entry?.githubCommits ?? 0,
        entry?.storiesAssigned ?? 0,
        entry?.storiesCompleted ?? 0,
        entry?.storyPointsAssigned ?? 0,
        entry?.storyPointsCompleted ?? 0,
        entry?.highlights || '',
      ])
    }
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const csv = [cols, ...rows].map((r) => r.map(esc).join(',')).join('\r\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `team-gt-metrics-${selMonthKey}.csv`
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
        <div className="period-group">
          <span className="period-label">Period</span>
          <select
            className="period-select"
            value={selYear}
            onChange={(e) => setSelYear(Number(e.target.value))}
            aria-label="Select year"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <select
            className="period-select period-select--month"
            value={selMonth}
            onChange={(e) => setSelMonth(Number(e.target.value))}
            aria-label="Select month"
          >
            {MONTH_NAMES.map((name, i) => (
              <option key={i + 1} value={i + 1}>{name}</option>
            ))}
          </select>
        </div>
        <button className="btn secondary" disabled={team.length === 0} onClick={downloadReport}>
          ↓ Download report
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Name</th><th>Band</th><th>SOEID</th><th>Location</th><th>Pod</th>
              <th>
                GT Metrics
                <span className="th-period">({selMonthLabel})</span>
              </th>
              <th>Stage</th><th>Join Date</th>
            </tr>
          </thead>
          <tbody>
            {team.map((c) => {
              const commits = commitsForPeriod(c.id)
              return (
                <tr key={c.id} className="clickable" onClick={() => navigate(`/profiles/${slug(c.name)}`)}>
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
                      ? <span title={`Commits in ${selMonthKey}`}><strong>{commits}</strong> <span style={{ fontSize: 11, color: 'var(--muted)' }}>commits</span></span>
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
