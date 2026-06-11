import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { api, STAGES, STAGE_LABELS, bandLabel, soeidVisible } from '../api'
import { useAuth } from '../auth'

const initials = (name) => name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()

export default function Onboarding() {
  const { user, isManager, isSeniorManager } = useAuth()
  const navigate = useNavigate()
  const [candidates, setCandidates] = useState([])
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)
  const [dragId, setDragId] = useState(null)
  const [dropStage, setDropStage] = useState(null)

  // Managers/senior managers only; the board shows everyone who reports to them
  // (including managers who report to them, e.g. a senior manager seeing their managers).
  const load = () => api.candidates()
    .then((cs) => setCandidates(cs.filter((c) => c.reportingManager === user.name)))
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
        Where each of your team members stands on the journey from nomination to fully onboarded.
      </p>

      {error && <div className="error-banner">{error}</div>}

      <div className="toolbar">
        <span className="badge blue">{candidates.length} in pipeline</span>
        <span className="badge green">{onboardedCount} onboarded</span>
        <div className="spacer" />
        {isSeniorManager && (
          <button className="btn secondary" onClick={() => navigate('/people')}>
            Open CITI Org Directory →
          </button>
        )}
      </div>

      <div className="lanes">
        {STAGES.map((s) => {
          const cards = byStage(s)
          const done = s === 'ONBOARDED'
          return (
            <div
              key={s}
              className={`lane ${done ? 'done' : ''} ${s === 'KARAT_FAILED' ? 'failed' : ''} ${dropStage === s ? 'drop' : ''}`}
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
                    <div className="kc-meta">{c.pod || '-'} · {c.wave || '-'}</div>
                    <div className="kc-tags">
                      {c.band && <span className="badge gray">{bandLabel(c.band)}</span>}
                      {soeidVisible(c.currentStage) && (c.soeid
                        ? <span className="badge blue">{c.soeid}</span>
                        : <span className="badge amber">SOEID pending</span>)}
                    </div>
                  </div>
                ))}
                {cards.length === 0 && <div className="kan-empty">No candidates in this stage</div>}
              </div>
            </div>
          )
        })}
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
