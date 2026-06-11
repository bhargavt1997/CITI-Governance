import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { api, STAGES, STAGE_LABELS, bandLabel } from '../api'
import { useAuth } from '../auth'

const stageBadge = (stage) => (stage === 'ONBOARDED' ? 'green' : stage === 'KARAT_FAILED' ? 'red' : stage === 'NOMINATED' ? 'gray' : 'blue')
const stageDot = (stage) => (stage === 'ONBOARDED' ? 'var(--green)' : stage === 'KARAT_FAILED' ? 'var(--red)' : stage === 'NOMINATED' ? 'var(--faint)' : 'var(--accent)')
const SENIOR_BANDS = ['b5l', 'b5h', 'b4l', 'b4h']
const roleText = (c) => (c.role === 'MANAGER'
  ? (SENIOR_BANDS.includes(c.band) ? 'Senior Manager' : 'Manager')
  : 'Developer')

export default function People() {
  const { isSeniorManager } = useAuth()
  const [people, setPeople] = useState([])
  const [error, setError] = useState(null)
  const [q, setQ] = useState('')
  const [stage, setStage] = useState(null) // selected stage filter
  const navigate = useNavigate()

  useEffect(() => {
    api.candidates().then(setPeople).catch((e) => setError(e.message))
  }, [])

  // Stage counts over the full directory (independent of the search box).
  const stageCount = useMemo(() => {
    const counts = {}
    for (const c of people) counts[c.currentStage] = (counts[c.currentStage] || 0) + 1
    return counts
  }, [people])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    return people.filter((c) => {
      if (stage && c.currentStage !== stage) return false
      if (!term) return true
      return [
        c.name, c.email, c.soeid, c.reportingManager, c.pod, c.location,
        c.band, roleText(c), STAGE_LABELS[c.currentStage],
      ].some((v) => v && String(v).toLowerCase().includes(term))
    })
  }, [people, q, stage])

  // Gate: only senior managers may view the full directory.
  if (!isSeniorManager) return <Navigate to="/" replace />

  const managers = people.filter((p) => p.role === 'MANAGER').length

  const downloadSheet = () => {
    const cols = ['Name', 'Email', 'Role', 'Band', 'Reporting Manager', 'Onboarding Status', 'Pod', 'Location', 'SOEID', 'Join Date']
    const rows = people.map((c) => [
      c.name, c.email, roleText(c), c.band ? bandLabel(c.band) : '',
      c.reportingManager || '', STAGE_LABELS[c.currentStage] || '',
      c.pod || '', c.location || '', c.soeid || '', c.joinDate || '',
    ])
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const csv = [cols, ...rows].map((r) => r.map(esc).join(',')).join('\r\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'organization-directory.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <h1 className="page-title">CITI Organization Directory</h1>
      <p className="page-sub">
        A complete view of everyone in the organisation and where they stand in onboarding.
      </p>

      {error && <div className="error-banner">{error}</div>}

      {/* Stage distribution - each chip shows a count and filters the table when clicked */}
      <div className="dir-stats">
        <button className={`dir-stat ${!stage ? 'active' : ''}`} onClick={() => setStage(null)}>
          All <b>{people.length}</b>
        </button>
        {STAGES.map((s) => (
          <button
            key={s}
            className={`dir-stat ${stage === s ? 'active' : ''}`}
            onClick={() => setStage(stage === s ? null : s)}
          >
            <span className="dir-dot" style={{ background: stageDot(s) }} />
            {STAGE_LABELS[s]} <b>{stageCount[s] || 0}</b>
          </button>
        ))}
      </div>

      <div className="toolbar">
        <span className="badge gray">{managers} managers</span>
        {stage && <span className="badge blue">Filtered: {STAGE_LABELS[stage]}</span>}
        <div className="spacer" />
        <input
          type="text"
          className="dir-search"
          placeholder="Search name, email, manager, pod, band…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="btn secondary" onClick={downloadSheet}>↓ Download sheet</button>
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
                <td>{c.band ? bandLabel(c.band) : '-'}</td>
                <td>{c.reportingManager || '-'}</td>
                <td><span className={`badge ${stageBadge(c.currentStage)}`}>{STAGE_LABELS[c.currentStage]}</span></td>
                <td>{c.pod || '-'}</td>
                <td>{c.location || '-'}</td>
                <td>{c.soeid || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="empty">{q || stage ? 'No people match the current filters.' : 'No registered people yet.'}</div>
        )}
      </div>
    </div>
  )
}
