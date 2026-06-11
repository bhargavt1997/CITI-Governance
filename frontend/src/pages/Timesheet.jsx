import { useEffect, useState } from 'react'
import { api } from '../api'

const currentMonth = () => new Date().toISOString().slice(0, 7)

export default function Timesheet() {
  const [month, setMonth] = useState(currentMonth())
  const [candidates, setCandidates] = useState([])
  const [rows, setRows] = useState({}) // candidateId -> {week1..week5}
  const [savedIds, setSavedIds] = useState({}) // candidateId -> true when persisted
  const [toast, setToast] = useState(null)
  const [error, setError] = useState(null)
  const [soeidDraft, setSoeidDraft] = useState({})

  const load = async (m) => {
    try {
      const [cands, sheets] = await Promise.all([api.candidates(), api.timesheets({ month: m })])
      setCandidates(cands)
      const map = {}
      const saved = {}
      for (const t of sheets) {
        map[t.candidate.id] = { week1: t.week1, week2: t.week2, week3: t.week3, week4: t.week4, week5: t.week5 }
        saved[t.candidate.id] = true
      }
      setRows(map)
      setSavedIds(saved)
      setError(null)
    } catch (e) { setError(e.message) }
  }

  useEffect(() => { load(month) }, [month])

  const weekVal = (cid, wk) => rows[cid]?.[wk] ?? ''
  const setWeek = (cid, wk, v) => {
    setRows((r) => ({ ...r, [cid]: { ...r[cid], [wk]: v === '' ? '' : Number(v) } }))
    setSavedIds((s) => ({ ...s, [cid]: false }))
  }

  const totalFor = (cid) => {
    const r = rows[cid] || {}
    return ['week1', 'week2', 'week3', 'week4', 'week5']
      .reduce((sum, wk) => sum + (Number(r[wk]) || 0), 0)
  }

  const save = async (cid) => {
    const r = rows[cid] || {}
    try {
      await api.saveTimesheet({
        candidateId: cid, month,
        week1: Number(r.week1) || 0, week2: Number(r.week2) || 0, week3: Number(r.week3) || 0,
        week4: Number(r.week4) || 0, week5: Number(r.week5) || 0,
      })
      setSavedIds((s) => ({ ...s, [cid]: true }))
      setToast('Timesheet saved ✓')
      setTimeout(() => setToast(null), 2500)
    } catch (e) {
      setToast(`Save failed: ${e.message}`)
      setTimeout(() => setToast(null), 4000)
    }
  }

  const addSoeid = async (cid) => {
    const v = (soeidDraft[cid] || '').trim()
    if (!v) return
    try {
      await api.setSoeid(cid, v)
      setSoeidDraft((d) => ({ ...d, [cid]: '' }))
      load(month)
      setToast('SOEID added — it is now locked ✓')
      setTimeout(() => setToast(null), 2500)
    } catch (e) {
      setToast(e.message)
      setTimeout(() => setToast(null), 4000)
    }
  }

  return (
    <div>
      <h1 className="page-title">PTS — Timesheet</h1>
      <p className="page-sub">
        Weekly hours per candidate for the selected month. Name, email and SOEID are static —
        SOEID can be added once if it was missing at registration, then it locks.
      </p>

      {error && <div className="error-banner">{error}</div>}

      <div className="toolbar">
        <label style={{ fontSize: 13, color: 'var(--muted)' }}>Month:&nbsp;
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </label>
        <div className="spacer" />
        <span className="badge blue">{candidates.length} candidates</span>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Name</th><th>Email</th><th>SOEID</th>
              <th>Week 1</th><th>Week 2</th><th>Week 3</th><th>Week 4</th><th>Week 5</th>
              <th>Total</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((c) => (
              <tr key={c.id}>
                <td><strong>{c.name}</strong></td>
                <td style={{ color: 'var(--muted)' }}>{c.email}</td>
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
                      value={weekVal(c.id, wk)}
                      onChange={(e) => setWeek(c.id, wk, e.target.value)}
                    />
                  </td>
                ))}
                <td><strong style={{ color: 'var(--blue)' }}>{totalFor(c.id)}</strong></td>
                <td>
                  <button
                    className="btn small"
                    disabled={savedIds[c.id] === true}
                    onClick={() => save(c.id)}
                  >
                    {savedIds[c.id] === true ? 'Saved ✓' : 'Save'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {candidates.length === 0 && <div className="empty">No candidates yet.</div>}
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
