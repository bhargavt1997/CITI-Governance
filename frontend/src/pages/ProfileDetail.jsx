import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
} from 'recharts'
import { api, STAGE_LABELS, ALL_BANDS, bandLabel, bandRank, soeidVisible } from '../api'
import { useAuth } from '../auth'
import { useCrumbs } from '../crumbs'
import { useToast } from '../toast'

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
  const toast = useToast()
  const navigate = useNavigate()
  const { id } = useParams()
  const [c, setC] = useState(null)
  const [enrollments, setEnrollments] = useState([])
  const [allPeople, setAllPeople] = useState([])
  const [error, setError] = useState(null)
  const [editSkills, setEditSkills] = useState(false)
  const [skillDraft, setSkillDraft] = useState({})
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
  // All people, to list this person's direct reportees.
  useEffect(() => { api.candidates().then(setAllPeople).catch(() => {}) }, [])

  const saveManager = async () => {
    try {
      const updated = await api.updateCandidate(c.id, { reportingManager: managerDraft })
      setC(updated)
      setEditManager(false)
      toast.success('Reporting manager updated.', { title: 'Saved' })
    } catch (e) {
      toast.error(e.message, { title: 'Could not update manager' })
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
      toast.success('Skill profile updated.', { title: 'Saved' })
    } catch (e) {
      toast.error(e.message, { title: 'Could not save skills' })
    }
  }

  const offboarding = c.currentStage === 'OFFBOARDING' || c.currentStage === 'OFFBOARDED'
  const DETAIL_FIELDS = ['employeeId', 'band', 'wave', 'pod', 'location', 'joinDate', 'skillGaps',
    'allocations', 'activities', 'remarks', ...(offboarding ? ['offboardingReason'] : [])]
  const startEditDetails = () => {
    const d = {}
    DETAIL_FIELDS.forEach((f) => { d[f] = c[f] ?? '' })
    d.soeid = c.soeid ?? ''
    setDetailsDraft(d)
    setEditDetails(true)
  }
  const saveDetails = async () => {
    try {
      const payload = {}
      DETAIL_FIELDS.forEach((f) => { payload[f] = detailsDraft[f] === '' ? null : detailsDraft[f] })
      let updated = await api.updateCandidate(c.id, payload)
      // SOEID has its own endpoint and rules: only a manager can set it, and only once onboarding has started.
      const newSoeid = (detailsDraft.soeid || '').trim().toUpperCase()
      if (isManager && soeidVisible(c.currentStage) && newSoeid && newSoeid !== (c.soeid || '')) {
        updated = await api.setSoeid(c.id, newSoeid)
      }
      setC(updated)
      setEditDetails(false)
      toast.success('Profile updated.')
    } catch (e) {
      toast.error(e.message)
    }
  }
  const setField = (f) => (e) => setDetailsDraft((d) => ({ ...d, [f]: e.target.value }))
  const canEditProfile = isManager || user.candidateId === c.id
  // This person's direct reportees (if they manage anyone).
  const reportees = allPeople.filter((p) => p.reportingManager && c.name && p.reportingManager === c.name)
  const stageBadge = (s) => (s === 'ONBOARDED' ? 'green' : s === 'KARAT_FAILED' ? 'red' : s === 'OFFBOARDING' ? 'amber' : s === 'OFFBOARDED' ? 'gray' : s === 'NOMINATED' ? 'gray' : 'blue')

  return (
    <div>
      <h1 className="page-title">{c.name}</h1>
      <p className="page-sub">
        {c.email}{' '}
        {soeidVisible(c.currentStage) && (
          <><span className="badge gray">{c.soeid || 'SOEID pending'}</span>{' '}</>
        )}
        <span className={`badge ${c.currentStage === 'ONBOARDED' ? 'green' : c.currentStage === 'KARAT_FAILED' ? 'red' : c.currentStage === 'OFFBOARDING' ? 'amber' : c.currentStage === 'OFFBOARDED' ? 'gray' : 'blue'}`}>{STAGE_LABELS[c.currentStage]}</span>
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
                {soeidVisible(c.currentStage) && (
                  <div className="field"><label>SOEID</label><div>{c.soeid || 'Not assigned'}</div></div>
                )}
                <div className="field"><label>Band</label><div>{c.band ? bandLabel(c.band) : '-'}</div></div>
                <div className="field"><label>Wave</label><div>{c.wave || '-'}</div></div>
                <div className="field"><label>Project</label><div>{c.pod || '-'}</div></div>
                <div className="field"><label>Location</label><div>{c.location || '-'}</div></div>
                <div className="field"><label>Join Date</label><div>{c.joinDate || '-'}</div></div>
                <div className="field"><label>CITI Leadership</label><div>{c.citiLeadership || '-'}</div></div>
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
                        {leads
                          .filter((l) => bandRank(l.band) > bandRank(c.band))
                          .map((l) => <option key={l.id} value={l.name}>{l.name} · {bandLabel(l.band)}</option>)}
                      </select>
                      <button className="btn small" disabled={!managerDraft} onClick={saveManager}>Save</button>
                      <button className="btn small secondary" onClick={() => setEditManager(false)}>Cancel</button>
                    </div>
                  )}
                </div>
              </div>
              {offboarding && (
                <>
                  <h3 style={{ marginTop: 18, color: 'var(--amber)' }}>Reason for Offboarding</h3>
                  <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>{c.offboardingReason || 'No reason recorded.'}</p>
                </>
              )}
              <h3 style={{ marginTop: 18 }}>Skill Gaps</h3>
              <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>{c.skillGaps || 'None recorded.'}</p>
              <h3 style={{ marginTop: 18 }}>Allocations</h3>
              <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>{c.allocations || 'Not allocated yet.'}</p>
              <h3 style={{ marginTop: 18 }}>Activities</h3>
              <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>{c.activities || 'No activities recorded.'}</p>
              <h3 style={{ marginTop: 18 }}>Remarks</h3>
              <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>{c.remarks || 'No remarks.'}</p>
            </>
          ) : (
            <div className="field-grid">
              <div className="field"><label>Employee ID</label><input type="text" value={detailsDraft.employeeId} onChange={setField('employeeId')} /></div>
              {isManager && (
                <div className="field">
                  <label>SOEID</label>
                  {soeidVisible(c.currentStage) ? (
                    <input type="text" value={detailsDraft.soeid || ''} onChange={setField('soeid')} placeholder="e.g. AB12345" />
                  ) : (
                    <input type="text" disabled value="" placeholder="Available once onboarding starts" />
                  )}
                </div>
              )}
              <div className="field"><label>Band</label>
                <select value={detailsDraft.band || ''} onChange={setField('band')}>
                  <option value="">-</option>
                  {ALL_BANDS.map((b) => <option key={b} value={b}>{bandLabel(b)}</option>)}
                </select>
              </div>
              <div className="field"><label>Wave</label><input type="text" value={detailsDraft.wave} onChange={setField('wave')} /></div>
              <div className="field"><label>Project</label><input type="text" value={detailsDraft.pod} onChange={setField('pod')} /></div>
              <div className="field"><label>Location</label><input type="text" value={detailsDraft.location} onChange={setField('location')} /></div>
              <div className="field"><label>Join Date</label><input type="date" value={detailsDraft.joinDate || ''} onChange={setField('joinDate')} /></div>
              <div className="field" style={{ gridColumn: '1 / -1' }}><label>Skill Gaps</label><textarea rows={2} value={detailsDraft.skillGaps} onChange={setField('skillGaps')} /></div>
              <div className="field" style={{ gridColumn: '1 / -1' }}><label>Allocations</label><textarea rows={2} value={detailsDraft.allocations} onChange={setField('allocations')} /></div>
              <div className="field" style={{ gridColumn: '1 / -1' }}><label>Activities</label><textarea rows={2} value={detailsDraft.activities} onChange={setField('activities')} /></div>
              {offboarding && (
                <div className="field" style={{ gridColumn: '1 / -1' }}>
                  <label>Reason for Offboarding</label>
                  <textarea rows={2} value={detailsDraft.offboardingReason} onChange={setField('offboardingReason')} placeholder="Why is this person being offboarded?" />
                </div>
              )}
              <div className="field" style={{ gridColumn: '1 / -1' }}><label>Remarks</label><textarea rows={2} value={detailsDraft.remarks} onChange={setField('remarks')} placeholder="Any notes about this person…" /></div>
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
                <Radar dataKey="value" stroke="#4f46e5" fill="#4f46e5" fillOpacity={0.32} />
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

      {reportees.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3>Reportees · {reportees.length}</h3>
          <table>
            <thead>
              <tr><th>Name</th><th>Band</th><th>Project</th><th>Stage</th></tr>
            </thead>
            <tbody>
              {reportees.map((r) => (
                <tr key={r.id} className="clickable" onClick={() => navigate(`/profiles/${r.id}`)}>
                  <td><strong>{r.name}</strong></td>
                  <td>{r.band ? bandLabel(r.band) : '-'}</td>
                  <td>{r.pod || '-'}</td>
                  <td><span className={`badge ${stageBadge(r.currentStage)}`}>{STAGE_LABELS[r.currentStage]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
