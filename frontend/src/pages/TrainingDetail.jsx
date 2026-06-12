import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { useCrumbs } from '../crumbs'
import { useToast } from '../toast'

export default function TrainingDetail() {
  const { user, isManager } = useAuth()
  const { setLabel } = useCrumbs()
  const toast = useToast()
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(null) // enrollment id being edited
  const [draft, setDraft] = useState({})

  const load = () => {
    api.training(id)
      .then((d) => { setData(d); setLabel(`/training/${id}`, d.training.title) })
      .catch((e) => setError(e.message))
  }
  useEffect(() => { load() }, [id])

  if (error) return <div className="error-banner">{error}</div>
  if (!data) return <div className="empty">Loading…</div>

  const { training: t, enrollments } = data
  const enrolledIds = new Set(enrollments.map((e) => e.candidate.id))
  const myEnrolled = user.candidateId != null && enrolledIds.has(user.candidateId)

  const enroll = async () => {
    if (user.candidateId == null) return
    try {
      await api.enroll(t.id, Number(user.candidateId))
      load()
      toast.success(`You are enrolled in ${t.title}.`, { title: 'Enrolled' })
    } catch (e) {
      toast.error(e.message, { title: 'Could not enrol' })
    }
  }

  const startEdit = (e) => {
    setEditing(e.id)
    setDraft({ status: e.status, progressPct: e.progressPct, notes: e.notes || '' })
  }

  const saveEdit = async () => {
    try {
      await api.updateEnrollment(editing, draft)
      setEditing(null)
      load()
      toast.success('Training progress updated.', { title: 'Saved' })
    } catch (e) {
      toast.error(e.message, { title: 'Could not update progress' })
    }
  }

  return (
    <div>
      <h1 className="page-title">{t.title}</h1>
      <p className="page-sub">
        <span className="badge blue">{t.category || 'General'}</span>{' '}
        📚 {t.provider || '-'} {t.targetDate && <>· 🎯 Target {t.targetDate}</>} · Added by {t.createdBy || '-'}
      </p>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>About this certification</h3>
        <p style={{ fontSize: 13.5, color: 'var(--muted)', margin: 0, lineHeight: 1.6 }}>{t.description || 'No description.'}</p>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
          <h3 style={{ margin: 0 }}>Enrolled Candidates ({enrollments.length})</h3>
          {user.candidateId != null && (
            myEnrolled
              ? <button className="btn small" disabled>Enrolled</button>
              : <button className="btn small" onClick={enroll}>Enroll</button>
          )}
        </div>

        {enrollments.length === 0 && <div className="empty">Nobody enrolled yet.</div>}
        {enrollments.length > 0 && (
          <table>
            <thead>
              <tr><th>Candidate</th><th>Status</th><th>Progress</th><th>Notes</th><th></th></tr>
            </thead>
            <tbody>
              {enrollments.map((e) => (
                <tr key={e.id}>
                  <td>
                    <strong>{e.candidate.name}</strong>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{e.candidate.soeid || e.candidate.email}</div>
                  </td>
                  {editing === e.id ? (
                    <>
                      <td>
                        <select value={draft.status} onChange={(ev) => setDraft((d) => ({ ...d, status: ev.target.value }))}>
                          <option value="ENROLLED">ENROLLED</option>
                          <option value="IN_PROGRESS">IN PROGRESS</option>
                          <option value="COMPLETED">COMPLETED</option>
                        </select>
                      </td>
                      <td style={{ width: 180 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input
                            type="range" min="0" max="100" style={{ flex: 1 }}
                            value={draft.progressPct}
                            onChange={(ev) => setDraft((d) => ({ ...d, progressPct: Number(ev.target.value) }))}
                          />
                          <span style={{ fontSize: 12, width: 32 }}>{draft.progressPct}%</span>
                        </div>
                      </td>
                      <td>
                        <input
                          type="text" style={{ width: '100%' }}
                          value={draft.notes}
                          onChange={(ev) => setDraft((d) => ({ ...d, notes: ev.target.value }))}
                        />
                      </td>
                      <td>
                        <span style={{ display: 'flex', gap: 6 }}>
                          <button className="btn small secondary" onClick={() => setEditing(null)}>Cancel</button>
                          <button className="btn small" onClick={saveEdit}>Save</button>
                        </span>
                      </td>
                    </>
                  ) : (
                    <>
                      <td><span className={`badge ${e.status === 'COMPLETED' ? 'green' : e.status === 'IN_PROGRESS' ? 'amber' : 'gray'}`}>{e.status.replace('_', ' ')}</span></td>
                      <td style={{ width: 180 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div className="progress-track" style={{ flex: 1 }}>
                            <div className="progress-fill" style={{ width: `${e.progressPct}%` }} />
                          </div>
                          <span style={{ fontSize: 12 }}>{e.progressPct}%</span>
                        </div>
                      </td>
                      <td style={{ fontSize: 12.5, color: 'var(--muted)' }}>{e.notes || '-'}</td>
                      <td>
                        {(isManager || e.candidate.id === user.candidateId) && (
                          <button className="btn small secondary" onClick={() => startEdit(e)}>Update</button>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
