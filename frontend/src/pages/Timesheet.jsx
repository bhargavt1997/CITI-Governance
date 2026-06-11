import { useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'

const WEEKS = ['week1', 'week2', 'week3', 'week4', 'week5']
const currentMonth = () => new Date().toISOString().slice(0, 7)
const monthLabel = (m) => {
  const [y, mo] = m.split('-')
  return new Date(Number(y), Number(mo) - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' })
}
const sumWeeks = (obj) => WEEKS.reduce((s, wk) => s + (Number(obj?.[wk]) || 0), 0)

function StatusBadge({ sheet }) {
  if (!sheet) return <span className="badge gray">Not filled</span>
  const s = sheet.status || 'SUBMITTED'
  if (s === 'APPROVED') return <span className="badge green" title={`by ${sheet.approvedBy}`}>Approved</span>
  if (s === 'REJECTED') return <span className="badge red" title={`by ${sheet.approvedBy}`}>Rejected</span>
  return <span className="badge amber">Pending approval</span>
}

export default function Timesheet() {
  const { user, isManager } = useAuth()
  const [month, setMonth] = useState(currentMonth())
  const [tab, setTab] = useState('mine')
  const [ownRow, setOwnRow] = useState({})
  const [ownSheet, setOwnSheet] = useState(null)
  const [ownDirty, setOwnDirty] = useState(false)
  const [reports, setReports] = useState([])
  const [reportSheets, setReportSheets] = useState({})
  const [toast, setToast] = useState(null)
  const [error, setError] = useState(null)

  const notify = (msg, ms = 2500) => { setToast(msg); setTimeout(() => setToast(null), ms) }

  const load = async (m) => {
    try {
      const [cands, sheetList] = await Promise.all([api.candidates(), api.timesheets({ month: m })])
      const sheetMap = {}
      for (const t of sheetList) sheetMap[t.candidate.id] = t

      const mySheet = sheetMap[user.candidateId] || null
      setOwnSheet(mySheet)
      setOwnRow(mySheet ? { ...mySheet } : {})
      setOwnDirty(false)

      if (isManager) {
        const reps = cands
          .filter((c) => c.id !== user.candidateId && c.reportingManager === user.name)
          .sort((a, b) => a.name.localeCompare(b.name))
        setReports(reps)
        const rmap = {}
        reps.forEach((r) => { if (sheetMap[r.id]) rmap[r.id] = sheetMap[r.id] })
        setReportSheets(rmap)
      }
      setError(null)
    } catch (e) { setError(e.message) }
  }

  useEffect(() => { load(month) }, [month])

  const ownTotal = sumWeeks(ownRow)
  const setWeek = (wk, v) => {
    setOwnRow((r) => ({ ...r, [wk]: v === '' ? '' : Number(v) }))
    setOwnDirty(true)
  }

  const saveOwn = async () => {
    try {
      const saved = await api.saveTimesheet({
        candidateId: user.candidateId, month,
        week1: Number(ownRow.week1) || 0, week2: Number(ownRow.week2) || 0, week3: Number(ownRow.week3) || 0,
        week4: Number(ownRow.week4) || 0, week5: Number(ownRow.week5) || 0,
      })
      setOwnSheet(saved)
      setOwnRow({ ...saved })
      setOwnDirty(false)
      notify('Timesheet submitted for approval ✓')
    } catch (e) { notify(`Save failed: ${e.message}`, 4000) }
  }

  const decide = async (cid, approved) => {
    const sheet = reportSheets[cid]
    if (!sheet) return
    try {
      const updated = await api.decideTimesheet(sheet.id, approved)
      setReportSheets((s) => ({ ...s, [cid]: updated }))
      notify(approved ? 'Timesheet approved ✓' : 'Timesheet rejected')
    } catch (e) { notify(e.message, 4000) }
  }

  const pendingCount = reports.filter((r) => {
    const t = reportSheets[r.id]
    return t && (!t.status || t.status === 'SUBMITTED')
  }).length

  const myTimesheet = (
    <div className="card ts-own">
      <div className="ts-own-head">
        <div>
          <h3 style={{ margin: 0 }}>My Timesheet</h3>
          <span className="ts-own-month">{monthLabel(month)}</span>
        </div>
        <StatusBadge sheet={ownSheet} />
      </div>

      <div className="ts-weeks">
        {WEEKS.map((wk, i) => (
          <div className="ts-week" key={wk}>
            <label>Week {i + 1}</label>
            <input
              type="number" min="0" max="168" className="num-input"
              value={ownRow[wk] ?? ''}
              onChange={(e) => setWeek(wk, e.target.value)}
            />
          </div>
        ))}
        <div className="ts-week ts-total">
          <label>Total</label>
          <div className="ts-total-val">{ownTotal}<span className="ts-hrs">hrs</span></div>
        </div>
      </div>

      <div className="ts-own-foot">
        {ownSheet?.status === 'APPROVED' && !ownDirty && (
          <span className="ts-note ok">Approved by {ownSheet.approvedBy}</span>
        )}
        {ownSheet?.status === 'REJECTED' && !ownDirty && (
          <span className="ts-note bad">Rejected by {ownSheet.approvedBy} - please revise and resubmit</span>
        )}
        {(!ownSheet || ownDirty) && <span className="ts-note">Saving (re)submits the month for your manager's approval.</span>}
        <button className="btn" disabled={!ownDirty && !!ownSheet} onClick={saveOwn}>
          {ownSheet ? 'Resubmit' : 'Submit for approval'}
        </button>
      </div>
    </div>
  )

  const approvals = (
    <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
      <table>
        <thead>
          <tr>
            <th>Direct report</th>
            <th>Week 1</th><th>Week 2</th><th>Week 3</th><th>Week 4</th><th>Week 5</th>
            <th>Total</th><th>Status</th><th>Decision</th>
          </tr>
        </thead>
        <tbody>
          {reports.map((r) => {
            const sheet = reportSheets[r.id]
            const pending = sheet && (!sheet.status || sheet.status === 'SUBMITTED')
            return (
              <tr key={r.id}>
                <td>
                  <strong>{r.name}</strong>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{r.email}</div>
                </td>
                {WEEKS.map((wk) => (
                  <td key={wk} style={{ textAlign: 'right', color: sheet ? 'var(--ink)' : 'var(--faint)' }}>
                    {sheet ? sheet[wk] : '-'}
                  </td>
                ))}
                <td style={{ textAlign: 'right' }}>
                  <strong style={{ color: 'var(--blue-dark)' }}>{sheet ? (sheet.total ?? sumWeeks(sheet)) : '-'}</strong>
                </td>
                <td><StatusBadge sheet={sheet} /></td>
                <td>
                  {pending ? (
                    <span style={{ display: 'flex', gap: 6 }}>
                      <button className="btn small" onClick={() => decide(r.id, true)}>Approve</button>
                      <button className="btn small danger" onClick={() => decide(r.id, false)}>Reject</button>
                    </span>
                  ) : sheet?.status === 'APPROVED' ? (
                    <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>by {sheet.approvedBy}</span>
                  ) : sheet?.status === 'REJECTED' ? (
                    <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>by {sheet.approvedBy}</span>
                  ) : (
                    <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>Nothing to review</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {reports.length === 0 && <div className="empty">You have no direct reports.</div>}
    </div>
  )

  return (
    <div>
      <h1 className="page-title">PTS</h1>
      <p className="page-sub">
        {isManager
          ? 'Your monthly project hours, alongside the timesheets awaiting your approval.'
          : 'Your monthly project hours, submitted for your manager\'s approval.'}
      </p>

      {error && <div className="error-banner">{error}</div>}

      <div className="toolbar">
        <label style={{ fontSize: 13, color: 'var(--muted)' }}>Month:&nbsp;
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </label>
      </div>

      {isManager ? (
        <>
          <div className="tabs">
            <button className={`tab ${tab === 'mine' ? 'active' : ''}`} onClick={() => setTab('mine')}>
              My Timesheet
            </button>
            <button className={`tab ${tab === 'approvals' ? 'active' : ''}`} onClick={() => setTab('approvals')}>
              Approvals{pendingCount > 0 && <span className="tab-count">{pendingCount}</span>}
            </button>
          </div>
          {tab === 'mine' ? myTimesheet : approvals}
        </>
      ) : (
        myTimesheet
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
