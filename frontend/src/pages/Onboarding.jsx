import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { api, STAGES, STAGE_LABELS, DEVELOPER_BANDS, bandLabel } from '../api'
import { useAuth } from '../auth'

function AddCandidateModal({ onClose, onCreated, leadName }) {
  const [form, setForm] = useState({ name: '', email: '', band: 'b6l', wave: 'Wave 3', pod: '', reportingManager: leadName })
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
            {DEVELOPER_BANDS.map((b) => <option key={b} value={b}>{bandLabel(b)}</option>)}
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

const initials = (name) => name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()

export default function Onboarding() {
  const { user, isManager, isSeniorManager } = useAuth()
  const navigate = useNavigate()
  const [candidates, setCandidates] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)
  const [dragId, setDragId] = useState(null)
  const [dropStage, setDropStage] = useState(null)

  // Managers/senior managers only; the board shows their direct reportees.
  // (Senior managers can see everyone via the Org Directory.)
  const load = () => api.candidates()
    .then((cs) => {
      const devs = cs.filter((c) => c.role !== 'MANAGER')
      setCandidates(devs.filter((c) => c.reportingManager === user.name))
    })
    .catch((e) => setError(e.message))
  useEffect(() => { load() }, [])

  const notify = (m, ms = 2500) => { setToast(m); setTimeout(() => setToast(null), ms) }

  const moveTo = async (c, stage) => {
    if (!c || stage === c.currentStage) return
    // optimistic update
    setCandidates((cs) => cs.map((x) => (x.id === c.id ? { ...x, currentStage: stage } : x)))
    try {
      await api.setStage(c.id, stage)
      notify(`${c.name} → ${STAGE_LABELS[stage]} ✓`)
    } catch (e) {
      notify(e.message, 4000)
      load() // revert to server truth
    }
  }

  const onDrop = (stage) => {
    const c = candidates.find((x) => x.id === dragId)
    setDropStage(null)
    setDragId(null)
    moveTo(c, stage)
  }

  const byStage = (s) => candidates.filter((c) => c.currentStage === s)
  const onboardedCount = byStage('ONBOARDED').length

  // Onboarding is a manager/senior-manager feature.
  if (!isManager) return <Navigate to="/" replace />

  return (
    <div>
      <h1 className="page-title">Onboarding Pipeline</h1>
      <p className="page-sub">
        {isManager
          ? 'Each row is a stage. Drag a candidate into another stage to update it, or click a card to open the full profile.'
          : 'Each row is a stage in the onboarding journey. Click a card to open the full profile.'}
      </p>

      {error && <div className="error-banner">{error}</div>}

      <div className="toolbar">
        <span className="badge blue">{candidates.length} in pipeline</span>
        <span className="badge green">{onboardedCount} onboarded</span>
        <div className="spacer" />
        {isSeniorManager && (
          <button className="btn secondary" onClick={() => navigate('/people')}>
            Open Org Directory →
          </button>
        )}
        {isManager && <button className="btn" onClick={() => setShowAdd(true)}>+ Nominate Candidate</button>}
      </div>

      <div className="lanes">
        {STAGES.map((s) => {
          const cards = byStage(s)
          const done = s === 'ONBOARDED'
          return (
            <div
              key={s}
              className={`lane ${done ? 'done' : ''} ${dropStage === s ? 'drop' : ''}`}
              onDragOver={isManager ? (e) => { e.preventDefault(); if (dropStage !== s) setDropStage(s) } : undefined}
              onDragLeave={isManager ? () => setDropStage((p) => (p === s ? null : p)) : undefined}
              onDrop={isManager ? () => onDrop(s) : undefined}
            >
              <div className="lane-head">
                <span className="lane-title">{STAGE_LABELS[s]}</span>
                <span className="kan-count">{cards.length}</span>
              </div>
              <div className="lane-cards">
                {cards.map((c) => (
                  <div
                    key={c.id}
                    className="kan-card"
                    draggable={isManager}
                    onDragStart={() => setDragId(c.id)}
                    onDragEnd={() => { setDragId(null); setDropStage(null) }}
                    onClick={() => navigate(`/profiles/${c.id}`)}
                  >
                    <div className="kc-top">
                      <span className="kc-avatar">{initials(c.name)}</span>
                      <span className="kc-name">{c.name}</span>
                    </div>
                    <div className="kc-meta">{c.pod || '—'} · {c.wave || '—'}</div>
                    <div className="kc-tags">
                      {c.band && <span className="badge gray">{bandLabel(c.band)}</span>}
                      {c.soeid
                        ? <span className="badge blue">{c.soeid}</span>
                        : <span className="badge amber">SOEID pending</span>}
                    </div>
                  </div>
                ))}
                {cards.length === 0 && <div className="kan-empty">No candidates in this stage</div>}
              </div>
            </div>
          )
        })}
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
