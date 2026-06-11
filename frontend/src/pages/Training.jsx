import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'

function AddTrainingModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ title: '', provider: '', category: 'Technical', description: '', targetDate: '' })
  const [err, setErr] = useState(null)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async () => {
    if (!form.title.trim()) { setErr('Title is required'); return }
    try {
      await api.createTraining({ ...form, targetDate: form.targetDate || null })
      onCreated()
    } catch (e) { setErr(e.message) }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Add Certification / Training</h3>
        {err && <div className="error-banner">{err}</div>}
        <div className="form-row"><label>Title *</label><input type="text" value={form.title} onChange={set('title')} /></div>
        <div className="form-row"><label>Provider</label><input type="text" value={form.provider} onChange={set('provider')} placeholder="AWS, Udemy, Internal…" /></div>
        <div className="form-row"><label>Category</label>
          <select value={form.category} onChange={set('category')}>
            <option>Technical</option><option>Functional</option><option>Domain</option><option>Cloud</option><option>Leadership</option>
          </select>
        </div>
        <div className="form-row"><label>Target Date</label><input type="date" value={form.targetDate} onChange={set('targetDate')} /></div>
        <div className="form-row"><label>Description</label><textarea rows={3} value={form.description} onChange={set('description')} /></div>
        <div className="actions">
          <button className="btn secondary" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={submit}>Add Training</button>
        </div>
      </div>
    </div>
  )
}

export default function Training() {
  const { isLead } = useAuth()
  const [items, setItems] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  const load = () => api.trainings().then(setItems).catch((e) => setError(e.message))
  useEffect(() => { load() }, [])

  return (
    <div>
      <h1 className="page-title">Training & Certifications</h1>
      <p className="page-sub">
        Catalog of certifications published by leads. Click a card to see enrolled candidates
        and their progress; leads can add new certifications.
      </p>

      {error && <div className="error-banner">{error}</div>}

      <div className="toolbar">
        <span className="badge blue">{items.length} certifications</span>
        <div className="spacer" />
        {isLead && (
          <button className="btn" onClick={() => setShowAdd(true)}>+ Add Certification</button>
        )}
      </div>

      <div className="training-grid">
        {items.map(({ training: t, enrolledCount }) => (
          <div key={t.id} className="card training-card" onClick={() => navigate(`/training/${t.id}`)}>
            <span className="badge blue">{t.category || 'General'}</span>
            <h4>{t.title}</h4>
            <p>{t.description}</p>
            <div className="training-meta">
              <span>📚 {t.provider || '—'}</span>
              <span>👥 {enrolledCount} enrolled</span>
            </div>
            {t.targetDate && <div className="training-meta" style={{ marginTop: 6 }}><span>🎯 Target: {t.targetDate}</span></div>}
          </div>
        ))}
      </div>
      {items.length === 0 && !error && <div className="empty">No certifications published yet.</div>}

      {showAdd && <AddTrainingModal onClose={() => setShowAdd(false)} onCreated={() => { setShowAdd(false); load() }} />}
    </div>
  )
}
