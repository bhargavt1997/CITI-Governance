import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
} from 'recharts'
import { api, STAGE_LABELS, ALL_BANDS, bandLabel, soeidVisible } from '../api'
import { useAuth } from '../auth'
import { useCrumbs } from '../crumbs'

const AXES = [
  { key: 'skillTechnical', label: 'Technical', field: 'technical' },
  { key: 'skillFunctional', label: 'Functional', field: 'functional' },
  { key: 'skillLeadership', label: 'Leadership', field: 'leadership' },
  { key: 'skillDomain', label: 'Domain', field: 'domain' },
  { key: 'skillCertifications', label: 'Certifications', field: 'certifications' },
]

export default function ProfileDetail() {
  const { user, isManager } = useAuth()
  const { setLabel } = useCrumbs()
  const { id } = useParams()
  const [c, setC] = useState(null)
  const [enrollments, setEnrollments] = useState([])
  const [error, setError] = useState(null)
  const [editSkills, setEditSkills] = useState(false)
  const [skillDraft, setSkillDraft] = useState({})
  const [toast, setToast] = useState(null)
  const [leads, setLeads] = useState([])
  const [editManager, setEditManager] = useState(false)
  const [managerDraft, setManagerDraft] = useState('')
  const [editDetails, setEditDetails] = useState(false)
  const [detailsDraft, setDetailsDraft] = useState({})

  const load = () => {
    Promise.all([api.candidate(id), api.candidateEnrollments(id)])
      .then(([cand, enr]) => { setC(cand); setEnrollments(enr); setLabel(`/profiles/${id}`, cand.name.split(' ')[0]) })
      .catch((e) => setError(e.message))
  }
  useEffect(() => { load() }, [id])
  // Fetch managers for everyone (used for the reporting-manager email tooltip; managers also use it to remap).
  useEffect(() => { api.managers().then(setLeads).catch(() => {}) }, [])

  const saveManager = async () => {
    try {
      const updated = await api.updateCandidate(c.id, { reportingManager: managerDraft })
      setC(updated)
      setEditManager(false)
      setToast('Reporting manager updated ✓')
      setTimeout(() => setToast(null), 2500)
    } catch (e) {
      setToast(e.message)
      setTimeout(() => setToast(null), 4000)
    }
  }

  if (error) return <div className="error-banner">{error}</div>
  if (!c) return <div className="empty">Loading profile…</div>

  const radarData = AXES.map((a) => ({ axis: a.label, value: c[a.key] ?? 0 }))

  const startEdit = () => {
    const d = {}
    AXES.forEach((a) => { d[a.field] = c[a.key] ?? 0 })
    setSkillDraft(d)
    setEditSkills(true)
  }

  const saveSkills = async () => {
    try {
      const updated = await api.updateSkills(c.id, skillDraft)
      setC(updated)
      setEditSkills(false)
      setToast('Skill profile updated ✓')
      setTimeout(() => setToast(null), 2500)
    } catch (e) {
      setToast(e.message)
      setTimeout(() => setToast(null), 4000)
    }
  }

  const DETAIL_FIELDS = ['employeeId', 'band', 'wave', 'pod', 'location', 'joinDate', 'skillGaps', 'allocations', 'activities']
  const startEditDetails = () => {
    const d = {}
    DETAIL_FIELDS.forEach((f) => { d[f] = c[f] ?? '' })
    setDetailsDraft(d)
    setEditDetails(true)
  }
  const saveDetails = async () => {
    try {
      const payload = {}
      DETAIL_FIELDS.forEach((f) => { payload[f] = detailsDraft[f] === '' ? null : detailsDraft[f] })
      const updated = await api.updateCandidate(c.id, payload)
      setC(updated)
      setEditDetails(false)
      setToast('Profile updated ✓')
      setTimeout(() => setToast(null), 2500)
    } catch (e) {
      setToast(e.message)
      setTimeout(() => setToast(null), 4000)
    }
  }
  const setField = (f) => (e) => setDetailsDraft((d) => ({ ...d, [f]: e.target.value }))
  const canEditProfile = isManager || user.candidateId === c.id

  return (
    <div>
      <h1 className="page-title">{c.name}</h1>
      <p className="page-sub">
        {c.email}{' '}
        {soeidVisible(c.currentStage) && (
          <><span className="badge gray">{c.soeid || 'SOEID pending'}</span>{' '}</>
        )}
        <span className={`badge ${c.currentStage === 'ONBOARDED' ? 'green' : c.currentStage === 'KARAT_FAILED' ? 'red' : 'blue'}`}>{STAGE_LABELS[c.currentStage]}</span>
      </p>

      <div className="two-col">
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ margin: 0 }}>Details</h3>
            {!editDetails
              ? canEditProfile && <button className="btn small secondary" onClick={startEditDetails}>Edit profile</button>
              : (
                <span style={{ display: 'flex', gap: 8 }}>
                  <button className="btn small secondary" onClick={() => setEditDetails(false)}>Cancel</button>
                  <button className="btn small" onClick={saveDetails}>Save</button>
                </span>
              )}
          </div>

          {!editDetails ? (
            <>
              <div className="field-grid">
                <div className="field"><label>Employee ID</label><div>{c.employeeId || '-'}</div></div>
                <div className="field"><label>Band</label><div>{c.band ? bandLabel(c.band) : '-'}</div></div>
                <div className="field"><label>Wave</label><div>{c.wave || '-'}</div></div>
                <div className="field"><label>Pod</label><div>{c.pod || '-'}</div></div>
                <div className="field"><label>Location</label><div>{c.location || '-'}</div></div>
                <div className="field"><label>Join Date</label><div>{c.joinDate || '-'}</div></div>
                <div className="field">
                  <label>Reporting Manager</label>
                  {!editManager ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span title={(leads.find((l) => l.name === c.reportingManager) || {}).email || undefined}>
                        {c.reportingManager || '-'}
                      </span>
                      {isManager && (
                        <button
                          className="btn small secondary"
                          onClick={() => { setManagerDraft(c.reportingManager || ''); setEditManager(true) }}
                        >
                          Change
                        </button>
                      )}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <select value={managerDraft} onChange={(e) => setManagerDraft(e.target.value)}>
                        <option value="">Select manager…</option>
                        {leads.map((l) => <option key={l.id} value={l.name}>{l.name}</option>)}
                      </select>
                      <button className="btn small" disabled={!managerDraft} onClick={saveManager}>Save</button>
                      <button className="btn small secondary" onClick={() => setEditManager(false)}>Cancel</button>
                    </div>
                  )}
                </div>
              </div>
              <h3 style={{ marginTop: 18 }}>Skill Gaps</h3>
              <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>{c.skillGaps || 'None recorded.'}</p>
              <h3 style={{ marginTop: 18 }}>Allocations</h3>
              <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>{c.allocations || 'Not allocated yet.'}</p>
              <h3 style={{ marginTop: 18 }}>Activities</h3>
              <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>{c.activities || 'No activities recorded.'}</p>
            </>
          ) : (
            <div className="field-grid">
              <div className="field"><label>Employee ID</label><input type="text" value={detailsDraft.employeeId} onChange={setField('employeeId')} /></div>
              <div className="field"><label>Band</label>
                <select value={detailsDraft.band || ''} onChange={setField('band')}>
                  <option value="">-</option>
                  {ALL_BANDS.map((b) => <option key={b} value={b}>{bandLabel(b)}</option>)}
                </select>
              </div>
              <div className="field"><label>Wave</label><input type="text" value={detailsDraft.wave} onChange={setField('wave')} /></div>
              <div className="field"><label>Pod</label><input type="text" value={detailsDraft.pod} onChange={setField('pod')} /></div>
              <div className="field"><label>Location</label><input type="text" value={detailsDraft.location} onChange={setField('location')} /></div>
              <div className="field"><label>Join Date</label><input type="date" value={detailsDraft.joinDate || ''} onChange={setField('joinDate')} /></div>
              <div className="field" style={{ gridColumn: '1 / -1' }}><label>Skill Gaps</label><textarea rows={2} value={detailsDraft.skillGaps} onChange={setField('skillGaps')} /></div>
              <div className="field" style={{ gridColumn: '1 / -1' }}><label>Allocations</label><textarea rows={2} value={detailsDraft.allocations} onChange={setField('allocations')} /></div>
              <div className="field" style={{ gridColumn: '1 / -1' }}><label>Activities</label><textarea rows={2} value={detailsDraft.activities} onChange={setField('activities')} /></div>
            </div>
          )}
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Skill Profile</h3>
            {!editSkills
              ? (isManager || user.candidateId === c.id) && <button className="btn small secondary" onClick={startEdit}>Edit</button>
              : (
                <span style={{ display: 'flex', gap: 8 }}>
                  <button className="btn small secondary" onClick={() => setEditSkills(false)}>Cancel</button>
                  <button className="btn small" onClick={saveSkills}>Save</button>
                </span>
              )}
          </div>
          {!editSkills ? (
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="axis" fontSize={12} />
                <PolarRadiusAxis domain={[0, 100]} fontSize={10} />
                <Radar dataKey="value" stroke="#1e62d0" fill="#1e62d0" fillOpacity={0.35} />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ paddingTop: 12 }}>
              {AXES.map((a) => (
                <div key={a.field} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span style={{ width: 110, fontSize: 13 }}>{a.label}</span>
                  <input
                    type="range" min="0" max="100" style={{ flex: 1 }}
                    value={skillDraft[a.field]}
                    onChange={(e) => setSkillDraft((d) => ({ ...d, [a.field]: Number(e.target.value) }))}
                  />
                  <span style={{ width: 32, fontSize: 13, fontWeight: 700, color: 'var(--blue)' }}>{skillDraft[a.field]}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Assigned Trainings & Progress</h3>
        {enrollments.length === 0 && <div className="empty">No trainings assigned.</div>}
        {enrollments.length > 0 && (
          <table>
            <thead>
              <tr><th>Training</th><th>Status</th><th>Progress</th><th>Notes</th></tr>
            </thead>
            <tbody>
              {enrollments.map((e) => (
                <tr key={e.id}>
                  <td><strong>{e.trainingTitle || '-'}</strong></td>
                  <td><span className={`badge ${e.status === 'COMPLETED' ? 'green' : e.status === 'IN_PROGRESS' ? 'amber' : 'gray'}`}>{e.status.replace('_', ' ')}</span></td>
                  <td style={{ width: 220 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="progress-track" style={{ flex: 1 }}>
                        <div className="progress-fill" style={{ width: `${e.progressPct}%` }} />
                      </div>
                      <span style={{ fontSize: 12 }}>{e.progressPct}%</span>
                    </div>
                  </td>
                  <td style={{ fontSize: 12.5, color: 'var(--muted)' }}>{e.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {c.trainingNotes && (
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 10 }}>
            <strong>Training notes:</strong> {c.trainingNotes}
          </p>
        )}
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
