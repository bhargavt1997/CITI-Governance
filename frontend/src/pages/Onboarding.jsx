import { useEffect, useState } from 'react'
import { api, STAGES, STAGE_LABELS } from '../api'
import { useAuth } from '../auth'

function Stepper({ stage }) {
  const reached = STAGES.indexOf(stage)
  return (
    <div className="stepper">
      {STAGES.map((s, i) => (
        <div key={s} className={`step ${i < reached ? 'done' : ''} ${i === reached ? (s === 'ONBOARDED' ? 'done' : 'current') : ''}`}>
          <div className="dot">{i < reached || s === stage && s === 'ONBOARDED' ? '✓' : i + 1}</div>
          <div className="step-label">{STAGE_LABELS[s]}</div>
        </div>
      ))}
    </div>
  )
}

function AddCandidateModal({ onClose, onCreated, leadName }) {
  const [form, setForm] = useState({ name: '', email: '', band: 'C', wave: 'Wave 3', pod: '', reportingManager: leadName })
  const [err, setErr] = useState(null)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async () => {
    if (!form.name.trim() || !form.email.trim()) { setErr('Name and email are required'); return }
    try {
      await api.createCandidate(form)
      onCreated()
    } catch (e) { setErr(e.message) }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Nominate New Candidate</h3>
        {err && <div className="error-banner">{err}</div>}
        <div className="form-row"><label>Full Name *</label><input type="text" value={form.name} onChange={set('name')} /></div>
        <div className="form-row"><label>Email *</label><input type="text" value={form.email} onChange={set('email')} /></div>
        <div className="form-row"><label>Band</label>
          <select value={form.band} onChange={set('band')}>
            <option>A</option><option>B</option><option>C</option><option>D</option>
          </select>
        </div>
        <div className="form-row"><label>Wave</label><input type="text" value={form.wave} onChange={set('wave')} /></div>
        <div className="form-row"><label>Pod</label><input type="text" value={form.pod} onChange={set('pod')} /></div>
        <div className="form-row"><label>Reporting Manager</label><input type="text" value={form.reportingManager} onChange={set('reportingManager')} /></div>
        <div className="actions">
          <button className="btn secondary" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={submit}>Nominate</button>
        </div>
      </div>
    </div>
  )
}

export default function Onboarding() {
  const { user, isLead } = useAuth()
  const [candidates, setCandidates] = useState([])
  const [expanded, setExpanded] = useState(null)
  const [history, setHistory] = useState({})
  const [showAdd, setShowAdd] = useState(false)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)

  const load = () => api.candidates().then(setCandidates).catch((e) => setError(e.message))
  useEffect(() => { load() }, [])

  const toggle = async (id) => {
    const next = expanded === id ? null : id
    setExpanded(next)
    if (next && !history[id]) {
      try {
        const h = await api.stageHistory(id)
        setHistory((m) => ({ ...m, [id]: h }))
      } catch { /* non-fatal */ }
    }
  }

  const advance = async (c) => {
    const nextIdx = STAGES.indexOf(c.currentStage) + 1
    const nextLabel = STAGE_LABELS[STAGES[nextIdx]]
    if (!confirm(`Move ${c.name} to "${nextLabel}"?`)) return
    try {
      await api.advanceStage(c.id)
      setHistory((m) => ({ ...m, [c.id]: undefined }))
      load()
      setToast(`${c.name} → ${nextLabel} ✓`)
      setTimeout(() => setToast(null), 2500)
    } catch (e) {
      setToast(e.message)
      setTimeout(() => setToast(null), 4000)
    }
  }

  return (
    <div>
      <h1 className="page-title">Onboarding Pipeline</h1>
      <p className="page-sub">
        Track every candidate from nomination to onboarded. Click a row to expand the stage pipeline;
        leads can complete the current step to advance.
      </p>

      {error && <div className="error-banner">{error}</div>}

      <div className="toolbar">
        <span className="badge blue">{candidates.length} candidates</span>
        <span className="badge green">{candidates.filter((c) => c.currentStage === 'ONBOARDED').length} onboarded</span>
        <div className="spacer" />
        {isLead && <button className="btn" onClick={() => setShowAdd(true)}>+ Nominate Candidate</button>}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>Name</th><th>Employee ID</th><th>Band</th><th>Wave</th><th>Pod</th><th>Current Stage</th><th></th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((c) => (
              <FragmentRow
                key={c.id} c={c}
                expanded={expanded === c.id}
                history={history[c.id]}
                canAdvance={isLead}
                onToggle={() => toggle(c.id)}
                onAdvance={() => advance(c)}
              />
            ))}
          </tbody>
        </table>
        {candidates.length === 0 && <div className="empty">No candidates nominated yet.</div>}
      </div>

      {showAdd && (
        <AddCandidateModal
          leadName={user.name}
          onClose={() => setShowAdd(false)}
          onCreated={() => { setShowAdd(false); load() }}
        />
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

function FragmentRow({ c, expanded, history, canAdvance, onToggle, onAdvance }) {
  const isDone = c.currentStage === 'ONBOARDED'
  return (
    <>
      <tr className="clickable" onClick={onToggle}>
        <td><strong>{c.name}</strong><div style={{ fontSize: 11, color: 'var(--muted)' }}>{c.email}</div></td>
        <td>{c.employeeId || '—'}</td>
        <td>{c.band || '—'}</td>
        <td>{c.wave || '—'}</td>
        <td>{c.pod || '—'}</td>
        <td><span className={`badge ${isDone ? 'green' : 'blue'}`}>{STAGE_LABELS[c.currentStage]}</span></td>
        <td style={{ fontSize: 12, color: 'var(--muted)' }}>{expanded ? '▲' : '▼'}</td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={7} style={{ background: '#fafbfe' }}>
            <Stepper stage={c.currentStage} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 4px 4px' }}>
              {!isDone && canAdvance && (
                <button className="btn small" onClick={(e) => { e.stopPropagation(); onAdvance() }}>
                  Complete current step → {STAGE_LABELS[STAGES[STAGES.indexOf(c.currentStage) + 1]]}
                </button>
              )}
              {isDone && <span className="badge green">Fully onboarded {c.joinDate ? `· joined ${c.joinDate}` : ''}</span>}
              {history && history.length > 0 && (
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                  Last update: {STAGE_LABELS[history[history.length - 1].stage]} by {history[history.length - 1].completedBy}
                  {' on '}{new Date(history[history.length - 1].completedAt).toLocaleDateString()}
                </span>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
