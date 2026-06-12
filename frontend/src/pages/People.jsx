import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate, useLocation } from 'react-router-dom'
import { api, STAGES, STAGE_LABELS, bandLabel } from '../api'
import { useAuth } from '../auth'
import { useToast } from '../toast'

const stageBadge = (stage) => (stage === 'ONBOARDED' ? 'green' : stage === 'KARAT_FAILED' ? 'red' : stage === 'OFFBOARDING' ? 'amber' : stage === 'OFFBOARDED' ? 'gray' : stage === 'NOMINATED' ? 'gray' : 'blue')
const stageDot = (stage) => (stage === 'ONBOARDED' ? 'var(--green)' : stage === 'KARAT_FAILED' ? 'var(--red)' : stage === 'OFFBOARDING' ? 'var(--amber)' : stage === 'OFFBOARDED' ? 'var(--faint)' : stage === 'NOMINATED' ? 'var(--faint)' : 'var(--accent)')
const SENIOR_BANDS = ['b5l', 'b5h', 'b4l', 'b4h']
const roleText = (c) => (c.role === 'MANAGER'
  ? (SENIOR_BANDS.includes(c.band) ? 'Senior Manager' : 'Manager')
  : 'Developer')

// Bulk-import template: industry-standard column layout. Name/Email/Band/Project are required.
const TEMPLATE_COLS = ['Name', 'Email', 'Band', 'Project', 'Reporting Manager Email', 'CITI Leadership', 'Wave', 'Join Date', 'SOEID']
const TEMPLATE_EXAMPLES = [
  ['Asha Verma', 'asha.verma@deloitte.com', 'b6l', 'RUBY', 'tsbhargav@deloitte.com', 'Gonzalo', 'Wave 4', '', ''],
  ['Rohit Saxena', 'rohit.saxena@deloitte.com', 'b7', 'HY', 'suresh.iyer@deloitte.com', 'Joshua', 'Wave 4', '', ''],
]
// Map any reasonable header spelling to the backend field name. The reporting manager is given by
// EMAIL (unique, typo-proof) and resolved to the manager server-side. Project is stored in pod.
const FIELD_BY_HEADER = {
  name: 'name', fullname: 'name',
  email: 'email', emailaddress: 'email',
  band: 'band', grade: 'band',
  project: 'pod', pod: 'pod', team: 'pod',
  reportingmanageremail: 'reportingManagerEmail', manageremail: 'reportingManagerEmail',
  reportingmanager: 'reportingManagerEmail', manager: 'reportingManagerEmail', reportsto: 'reportingManagerEmail',
  citileadership: 'citiLeadership', citi: 'citiLeadership', citileader: 'citiLeadership',
  wave: 'wave',
  joindate: 'joinDate', startdate: 'joinDate',
  soeid: 'soeid', citiid: 'soeid',
}
const normHeader = (s) => String(s).toLowerCase().replace(/[^a-z]/g, '')

function OnboardPeopleModal({ onClose, onImported }) {
  const toast = useToast()
  const [rows, setRows] = useState([])
  const [fileName, setFileName] = useState('')
  const [parseError, setParseError] = useState(null)
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)

  const downloadTemplate = () => {
    const csv = [TEMPLATE_COLS, ...TEMPLATE_EXAMPLES]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'people-onboarding-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleFile = async (file) => {
    if (!file) return
    setFileName(file.name)
    setParseError(null)
    setResult(null)
    try {
      const XLSX = await import('xlsx') // loaded on demand to keep the main bundle small
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const records = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false })
      const mapped = records.map((rec) => {
        const out = {}
        for (const [header, value] of Object.entries(rec)) {
          const field = FIELD_BY_HEADER[normHeader(header)]
          if (field) out[field] = typeof value === 'string' ? value.trim() : value
        }
        return out
      }).filter((r) => r.name || r.email) // drop blank rows
      if (mapped.length === 0) {
        setParseError('No rows found. Make sure the first row has the column headers from the template.')
        setRows([])
        return
      }
      setRows(mapped)
    } catch (err) {
      setParseError(`Could not read that file: ${err.message}`)
      setRows([])
    }
  }
  const onInput = (e) => handleFile(e.target.files?.[0])
  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files?.[0])
  }

  const upload = async () => {
    setBusy(true)
    try {
      const res = await api.bulkCandidates(rows)
      setResult(res)
      if (res.created > 0) {
        toast.success(`${res.created} ${res.created === 1 ? 'person' : 'people'} onboarded.`, { title: 'Import complete' })
        onImported()
      } else if (!res.errors?.length) {
        toast.info('No new people were added (all already existed).')
      }
    } catch (err) {
      toast.error(err.message, { title: 'Import failed' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <h3>Onboard People in Bulk</h3>

        <label
          className={`dropzone ${dragging ? 'drag' : ''} ${fileName ? 'has-file' : ''}`}
          onDragOver={(e) => { e.preventDefault(); if (!dragging) setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <input type="file" accept=".csv,.xlsx,.xls" onChange={onInput} style={{ display: 'none' }} />
          <svg className="dz-icon" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            {fileName
              ? <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><polyline points="9 15 11 17 15 13" /></>
              : <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></>}
          </svg>
          <div className="dz-title">
            {fileName || <>Drag &amp; drop, or <span className="dz-strong">click to upload</span></>}
          </div>
          <div className="dz-sub">
            {fileName ? `${rows.length} row${rows.length === 1 ? '' : 's'} ready` : 'CSV or Excel (.xlsx)'}
          </div>
        </label>

        <button className="link-btn" onClick={downloadTemplate}>↓ Download template</button>

        {parseError && <div className="error-banner" style={{ marginTop: 4 }}>{parseError}</div>}

        {rows.length > 0 && !result && (
          <div className="import-preview">
            <table>
              <thead><tr><th>Name</th><th>Email</th><th>Band</th><th>Project</th><th>Reporting Mgr (email)</th><th>CITI</th></tr></thead>
              <tbody>
                {rows.slice(0, 6).map((r, i) => (
                  <tr key={i}>
                    <td>{r.name || <span className="bad">missing</span>}</td>
                    <td>{r.email || <span className="bad">missing</span>}</td>
                    <td>{r.band ? bandLabel(r.band) : <span className="bad">missing</span>}</td>
                    <td>{r.pod || <span className="bad">missing</span>}</td>
                    <td>{r.reportingManagerEmail || '-'}</td>
                    <td>{r.citiLeadership || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 6 && <div className="import-hint">…and {rows.length - 6} more</div>}
          </div>
        )}

        {result && (
          <div className="import-result">
            <div className="badge green">{result.created} created</div>{' '}
            {result.skipped?.length > 0 && <div className="badge amber">{result.skipped.length} skipped (already exist)</div>}{' '}
            {result.errors?.length > 0 && <div className="badge red">{result.errors.length} error{result.errors.length === 1 ? '' : 's'}</div>}
            {result.errors?.length > 0 && (
              <ul className="import-errors">
                {result.errors.map((e, i) => <li key={i}>Row {e.row}{e.name ? ` (${e.name})` : ''}: {e.message}</li>)}
              </ul>
            )}
            {result.skipped?.length > 0 && (
              <ul className="import-errors muted">
                {result.skipped.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            )}
          </div>
        )}

        <div className="actions">
          <button className="btn secondary" onClick={onClose}>{result ? 'Close' : 'Cancel'}</button>
          {!result && (
            <button className="btn" onClick={upload} disabled={busy || rows.length === 0}>
              {busy ? 'Importing…' : `Onboard ${rows.length || ''} ${rows.length === 1 ? 'person' : 'people'}`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function People() {
  const { isSeniorManager } = useAuth()
  const [people, setPeople] = useState([])
  const [error, setError] = useState(null)
  const [q, setQ] = useState('')
  const [stage, setStage] = useState(null) // selected stage filter
  const [preset, setPreset] = useState(null) // filter passed in from a dashboard KPI
  const [showImport, setShowImport] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  const load = () => api.candidates().then(setPeople).catch((e) => setError(e.message))
  useEffect(() => { load() }, [])

  // A dashboard KPI can deep-link here. Stage filters just select the matching chip; the only
  // non-chip case (In Pipeline) uses a preset.
  useEffect(() => {
    const f = location.state?.filter
    if (!f) return
    if (f.type === 'stage') { setStage(f.stage); setPreset(null) }
    else if (f.type === 'pipeline') { setPreset({ kind: 'pipeline', label: 'In Pipeline' }); setStage(null) }
    else { setStage(null); setPreset(null) } // 'all'
  }, [location.key])

  // Stage counts over the full directory (independent of the search box).
  const stageCount = useMemo(() => {
    const counts = {}
    for (const c of people) counts[c.currentStage] = (counts[c.currentStage] || 0) + 1
    return counts
  }, [people])

  // A preset filter (from a dashboard KPI) matches by stage list, pipeline membership, or an id list.
  const matchesPreset = (c) => {
    if (!preset) return true
    switch (preset.kind) {
      case 'stage': return preset.stages.includes(c.currentStage)
      case 'pipeline': return !['ONBOARDED', 'KARAT_FAILED', 'OFFBOARDING', 'OFFBOARDED'].includes(c.currentStage)
      case 'ids': return preset.ids.includes(c.id)
      default: return true // 'all'
    }
  }

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    return people.filter((c) => {
      if (!matchesPreset(c)) return false
      if (stage && c.currentStage !== stage) return false
      if (!term) return true
      return [
        c.name, c.email, c.soeid, c.reportingManager, c.pod, c.location,
        c.band, roleText(c), STAGE_LABELS[c.currentStage],
      ].some((v) => v && String(v).toLowerCase().includes(term))
    })
  }, [people, q, stage, preset])

  // Gate: only senior managers may view the full directory.
  if (!isSeniorManager) return <Navigate to="/" replace />

  const managers = people.filter((p) => p.role === 'MANAGER').length

  const downloadSheet = () => {
    const cols = ['Name', 'Email', 'Role', 'Band', 'Reporting Manager', 'CITI Leadership', 'Onboarding Status', 'Project', 'SOEID', 'Join Date']
    const rows = people.map((c) => [
      c.name, c.email, roleText(c), c.band ? bandLabel(c.band) : '',
      c.reportingManager || '', c.citiLeadership || '', STAGE_LABELS[c.currentStage] || '',
      c.pod || '', c.soeid || '', c.joinDate || '',
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

      {preset && (
        <div className="dir-preset">
          Showing <strong>{preset.label}</strong> · {filtered.length} {filtered.length === 1 ? 'person' : 'people'}
          <button className="btn small secondary" onClick={() => setPreset(null)}>Clear filter</button>
        </div>
      )}

      {/* Stage distribution - each chip shows a count and filters the table when clicked */}
      <div className="dir-stats">
        <button className={`dir-stat ${!stage && !preset ? 'active' : ''}`} onClick={() => { setStage(null); setPreset(null) }}>
          All <b>{people.length}</b>
        </button>
        {STAGES.map((s) => (
          <button
            key={s}
            className={`dir-stat ${stage === s ? 'active' : ''}`}
            onClick={() => { setPreset(null); setStage(stage === s ? null : s) }}
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
        <button className="btn" onClick={() => setShowImport(true)}>+ Onboard People</button>
      </div>

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Name</th><th>Role</th><th>Band</th><th>Reporting Manager</th><th>CITI Leadership</th>
              <th>Onboarding Status</th><th>Project</th><th>SOEID</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="clickable" onClick={() => navigate(`/profiles/${c.id}`)}>
                <td><strong>{c.name}</strong><div style={{ fontSize: 11, color: 'var(--muted)' }}>{c.email}</div></td>
                <td><span className={`badge ${c.role === 'MANAGER' ? 'blue' : 'gray'}`}>{roleText(c)}</span></td>
                <td>{c.band ? bandLabel(c.band) : '-'}</td>
                <td>{c.reportingManager || '-'}</td>
                <td>{c.citiLeadership || '-'}</td>
                <td><span className={`badge ${stageBadge(c.currentStage)}`}>{STAGE_LABELS[c.currentStage]}</span></td>
                <td>{c.pod || '-'}</td>
                <td>{c.soeid || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="empty">{q || stage ? 'No people match the current filters.' : 'No registered people yet.'}</div>
        )}
      </div>

      {showImport && (
        <OnboardPeopleModal
          onClose={() => setShowImport(false)}
          onImported={load}
        />
      )}
    </div>
  )
}
