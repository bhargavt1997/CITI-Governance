import { useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'

const currentMonth = () => new Date().toISOString().slice(0, 7)

function StatusBadge({ sheet }) {
  if (!sheet) return <span className="badge gray">Not filled</span>
  const s = sheet.status || 'SUBMITTED'
  if (s === 'APPROVED') return <span className="badge green" title={`by ${sheet.approvedBy}`}>Approved</span>
  if (s === 'REJECTED') return <span className="badge red" title={`by ${sheet.approvedBy}`}>Rejected</span>
  return <span className="badge amber">Pending approval</span>
}

export default function Timesheet() {
  const { user, isLead } = useAuth()
  const [month, setMonth] = useState(currentMonth())
  const [candidates, setCandidates] = useState([])
  const [rows, setRows] = useState({})    // candidateId -> {week1..week5}
  const [sheets, setSheets] = useState({}) // candidateId -> saved timesheet (id, status, approvedBy)
  const [dirty, setDirty] = useState({})   // candidateId -> true when edited since load/save
  const [toast, setToast] = useState(null)
  const [error, setError] = useState(null)
  const [soeidDraft, setSoeidDraft] = useState({})

  const notify = (msg, ms = 2500) => { setToast(msg); setTimeout(() => setToast(null), ms) }

  const load = async (m) => {
    try {
      const [cands, sheetList] = await Promise.all([api.candidates(), api.timesheets({ month: m })])
      // Developers only see (and fill) their own timesheet row
      setCandidates(isLead ? cands : cands.filter((c) => c.id === user.candidateId))
      const weekMap = {}
      const sheetMap = {}
      for (const t of sheetList) {
        weekMap[t.candidate.id] = { week1: t.week1, week2: t.week2, week3: t.week3, week4: t.week4, week5: t.week5 }
        sheetMap[t.candidate.id] = t
      }
      setRows(weekMap)
      setSheets(sheetMap)
      setDirty({})
      setError(null)
    } catch (e) { setError(e.message) }
  }

  useEffect(() => { load(month) }, [month])

  const weekVal = (cid, wk) => rows[cid]?.[wk] ?? ''
  const setWeek = (cid, wk, v) => {
    setRows((r) => ({ ...r, [cid]: { ...r[cid], [wk]: v === '' ? '' : Number(v) } }))
    setDirty((d) => ({ ...d, [cid]: true }))
  }

  const totalFor = (cid) => {
    const r = rows[cid] || {}
    return ['week1', 'week2', 'week3', 'week4', 'week5']
      .reduce((sum, wk) => sum + (Number(r[wk]) || 0), 0)
  }

  const save = async (cid) => {
    const r = rows[cid] || {}
    try {
      const saved = await api.saveTimesheet({
        candidateId: cid, month,
        week1: Number(r.week1) || 0, week2: Number(r.week2) || 0, week3: Number(r.week3) || 0,
        week4: Number(r.week4) || 0, week5: Number(r.week5) || 0,
      })
      setSheets((s) => ({ ...s, [cid]: saved }))
      setDirty((d) => ({ ...d, [cid]: false }))
      notify('Timesheet submitted for approval ✓')
    } catch (e) { notify(`Save failed: ${e.message}`, 4000) }
  }

  const decide = async (cid, approved) => {
    const sheet = sheets[cid]
    if (!sheet) return
    try {
      const updated = await api.decideTimesheet(sheet.id, approved)
      setSheets((s) => ({ ...s, [cid]: updated }))
      notify(approved ? 'Timesheet approved ✓' : 'Timesheet rejected')
    } catch (e) { notify(e.message, 4000) }
  }

  const addSoeid = async (cid) => {
    const v = (soeidDraft[cid] || '').trim()
    if (!v) return
    try {
      await api.setSoeid(cid, v)
      setSoeidDraft((d) => ({ ...d, [cid]: '' }))
      load(month)
      notify('SOEID added — it is now locked ✓')
    } catch (e) { notify(e.message, 4000) }
  }

  const pendingCount = Object.values(sheets)
    .filter((t) => !t.status || t.status === 'SUBMITTED').length

  return (
    <div>
      <h1 className="page-title">PTS — Timesheet</h1>
      <p className="page-sub">
        {isLead
          ? 'Review weekly hours and approve or reject submitted timesheets for your team.'
          : 'Fill your weekly hours for the month and save — your reporting manager will approve it.'}
        {' '}Name, email and SOEID are static; SOEID can be added once, then it locks.
      </p>

      {error && <div className="error-banner">{error}</div>}

      <div className="toolbar">
        <label style={{ fontSize: 13, color: 'var(--muted)' }}>Month:&nbsp;
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </label>
        <div className="spacer" />
        {isLead && pendingCount > 0 && (
          <span className="badge amber">{pendingCount} awaiting approval</span>
        )}
        <span className="badge blue">{isLead ? `${candidates.length} candidates` : 'My timesheet'}</span>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Name</th><th>SOEID</th>
              <th>Week 1</th><th>Week 2</th><th>Week 3</th><th>Week 4</th><th>Week 5</th>
              <th>Total</th><th>Status</th><th>{isLead ? 'Approval' : 'Actions'}</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((c) => {
              const sheet = sheets[c.id]
              const isPending = sheet && (!sheet.status || sheet.status === 'SUBMITTED')
              const canEdit = !isLead || c.id === user.candidateId || isLead // leads may correct any row
              return (
                <tr key={c.id}>
                  <td>
                    <strong>{c.name}</strong>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{c.email}</div>
                  </td>
                  <td>
                    {c.soeid
                      ? <span className="badge gray">{c.soeid}</span>
                      : (
                        <span style={{ display: 'flex', gap: 4 }}>
                          <input
                            type="text" placeholder="Add SOEID" className="num-input"
                            style={{ width: 90, textAlign: 'left' }}
                            value={soeidDraft[c.id] || ''}
                            onChange={(e) => setSoeidDraft((d) => ({ ...d, [c.id]: e.target.value }))}
                          />
                          <button className="btn small secondary" onClick={() => addSoeid(c.id)}>Add</button>
                        </span>
                      )}
                  </td>
                  {['week1', 'week2', 'week3', 'week4', 'week5'].map((wk) => (
                    <td key={wk}>
                      <input
                        type="number" min="0" max="168" className="num-input"
                        disabled={!canEdit}
                        value={weekVal(c.id, wk)}
                        onChange={(e) => setWeek(c.id, wk, e.target.value)}
                      />
                    </td>
                  ))}
                  <td><strong style={{ color: 'var(--blue-dark)' }}>{totalFor(c.id)}</strong></td>
                  <td><StatusBadge sheet={sheet} /></td>
                  <td>
                    <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      {(dirty[c.id] || !sheet) && (
                        <button className="btn small" onClick={() => save(c.id)}>
                          {sheet ? 'Resubmit' : 'Submit'}
                        </button>
                      )}
                      {isLead && isPending && !dirty[c.id] && (
                        <>
                          <button className="btn small" onClick={() => decide(c.id, true)}>Approve</button>
                          <button
                            className="btn small secondary"
                            style={{ color: 'var(--red)', borderColor: '#f6cdcd' }}
                            onClick={() => decide(c.id, false)}
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {sheet?.status === 'APPROVED' && !dirty[c.id] && (
                        <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>by {sheet.approvedBy}</span>
                      )}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {candidates.length === 0 && <div className="empty">No candidates yet.</div>}
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
