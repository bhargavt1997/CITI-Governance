import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { api, bandLabel } from '../api'
import { useAuth } from '../auth'
import { useToast } from '../toast'

const SENIOR_BANDS = ['b5l', 'b5h', 'b4l', 'b4h', 'b2']

export default function Projects() {
  const { isSeniorManager } = useAuth()
  const toast = useToast()
  const [pods, setPods] = useState([])
  const [managers, setManagers] = useState([])
  const [name, setName] = useState('')
  const [leadEmail, setLeadEmail] = useState('')
  const [citiLeader, setCitiLeader] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [citiLeaders, setCitiLeaders] = useState([])
  const [newCiti, setNewCiti] = useState('')
  const [citiBusy, setCitiBusy] = useState(false)

  const load = () => api.pods().then(setPods).catch((e) => setError(e.message))
  const loadCiti = () => api.citiLeaders().then(setCitiLeaders).catch(() => {})
  useEffect(() => {
    load()
    loadCiti()
    api.managers().then(setManagers).catch(() => {})
  }, [])

  // A pod lead must be senior management.
  const seniorManagers = useMemo(() => managers.filter((m) => SENIOR_BANDS.includes(m.band)), [managers])

  if (!isSeniorManager) return <Navigate to="/" replace />

  const create = async () => {
    if (!name.trim()) { toast.warning('Enter a project name'); return }
    if (!leadEmail) { toast.warning('Choose a pod lead'); return }
    setBusy(true)
    try {
      await api.createPod({ name: name.trim(), leadEmail, citiLeader: citiLeader || null })
      toast.success(`Project ${name.trim().toUpperCase()} created.`, { title: 'Project added' })
      setName(''); setLeadEmail(''); setCitiLeader('')
      load()
    } catch (e) {
      toast.error(e.message, { title: 'Could not create project' })
    } finally {
      setBusy(false)
    }
  }

  const createCiti = async () => {
    if (!newCiti.trim()) { toast.warning('Enter a CITI leader name'); return }
    setCitiBusy(true)
    try {
      await api.createCitiLeader(newCiti.trim())
      toast.success(`CITI leader ${newCiti.trim()} added.`, { title: 'Added' })
      setNewCiti('')
      loadCiti()
    } catch (e) {
      toast.error(e.message, { title: 'Could not add CITI leader' })
    } finally {
      setCitiBusy(false)
    }
  }

  return (
    <div>
      <h1 className="page-title">Projects & CITI Leadership</h1>
      <p className="page-sub">Delivery pods and the client-side CITI leaders. Senior management can add new ones.</p>

      {error && <div className="error-banner">{error}</div>}

      <div className="card proj-create">
        <h3 style={{ margin: 0 }}>Create a project</h3>
        <div className="proj-form">
          <div className="field">
            <label>Project name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. ORION" />
          </div>
          <div className="field">
            <label>Pod lead</label>
            <select value={leadEmail} onChange={(e) => setLeadEmail(e.target.value)}>
              <option value="">Select a senior manager…</option>
              {seniorManagers.map((m) => (
                <option key={m.id} value={m.email}>{m.name} · {bandLabel(m.band)}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>CITI leader</label>
            <select value={citiLeader} onChange={(e) => setCitiLeader(e.target.value)}>
              <option value="">Select CITI leader…</option>
              {citiLeaders.map((l) => <option key={l.id} value={l.name}>{l.name}</option>)}
            </select>
          </div>
          <button className="btn" onClick={create} disabled={busy}>{busy ? 'Creating…' : 'Create project'}</button>
        </div>
      </div>

      <h3 className="proj-section-title">All projects · {pods.length}</h3>
      <div className="proj-grid">
        {pods.map((p) => (
          <div key={p.id} className="card proj-card">
            <div className="proj-name">{p.name}</div>
            <div className="proj-lead-label">Pod Lead</div>
            <div className="proj-lead-name">{p.leadName || '—'}</div>
            <div className="proj-lead-email">{p.leadEmail}</div>
            <div className="proj-lead-label" style={{ marginTop: 10 }}>CITI Leader</div>
            <div className="proj-lead-name">{p.citiLeader || '—'}</div>
          </div>
        ))}
      </div>
      {pods.length === 0 && <div className="empty">No projects yet.</div>}

      <h3 className="proj-section-title">CITI Leadership · {citiLeaders.length}</h3>
      <div className="card proj-create">
        <div className="proj-form">
          <div className="field">
            <label>New CITI leader</label>
            <input type="text" value={newCiti} onChange={(e) => setNewCiti(e.target.value)} placeholder="e.g. Marco" />
          </div>
          <button className="btn" onClick={createCiti} disabled={citiBusy}>{citiBusy ? 'Adding…' : 'Add CITI leader'}</button>
        </div>
        <div className="citi-chip-row">
          {citiLeaders.map((l) => <span key={l.id} className="badge blue">{l.name}</span>)}
          {citiLeaders.length === 0 && <span className="page-sub" style={{ margin: 0 }}>No CITI leaders yet.</span>}
        </div>
      </div>
    </div>
  )
}
