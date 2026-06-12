import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { api, STAGES, STAGE_LABELS } from '../api'
import { useAuth } from '../auth'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const monthShort = (m) => MONTHS[Number(String(m).split('-')[1]) - 1] || m
const enrollBadge = (s) => (s === 'COMPLETED' ? 'green' : s === 'IN_PROGRESS' ? 'amber' : 'gray')
const INDIGO = '#4f46e5'
const GREEN = '#059669'

export default function DeveloperDashboard() {
  const { user, isOnboarded } = useAuth()
  const navigate = useNavigate()
  const [c, setC] = useState(null)
  const [enrollments, setEnrollments] = useState([])
  const [timesheets, setTimesheets] = useState([])
  const [metrics, setMetrics] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    if (user.candidateId == null) return
    Promise.all([
      api.candidate(user.candidateId),
      api.candidateEnrollments(user.candidateId),
      api.timesheets({ candidateId: user.candidateId }),
      api.metrics({ candidateId: user.candidateId }).catch(() => []),
    ])
      .then(([cand, enr, ts, m]) => { setC(cand); setEnrollments(enr); setTimesheets(ts); setMetrics(m) })
      .catch((e) => setError(e.message))
  }, [user.candidateId])

  if (error) return <div className="error-banner">Could not load your dashboard: {error}</div>
  if (!c) return <div className="empty">Loading your dashboard…</div>

  const year = new Date().getFullYear()
  const month = new Date().toISOString().slice(0, 7)
  // Only plot months up to the current one (no future-month zeros).
  const monthsSoFar = MONTHS.slice(0, new Date().getMonth() + 1)
  const ptsData = monthsSoFar.map((_, i) => {
    const key = `${year}-${String(i + 1).padStart(2, '0')}`
    const t = timesheets.find((ts) => ts.month === key)
    return { month: key, hours: t ? (t.total ?? 0) : 0 }
  })
  const hoursThisYear = ptsData.reduce((s, d) => s + (d.hours || 0), 0)

  // Delivery metrics, only shown once the person is onboarded and working.
  const gtData = monthsSoFar.map((_, i) => {
    const key = `${year}-${String(i + 1).padStart(2, '0')}`
    const m = metrics.find((x) => x.month === key)
    return {
      month: key,
      commits: m?.githubCommits ?? 0,
      storiesAssigned: m?.storiesAssigned ?? 0,
      storiesCompleted: m?.storiesCompleted ?? 0,
      pointsAssigned: m?.storyPointsAssigned ?? 0,
      pointsCompleted: m?.storyPointsCompleted ?? 0,
    }
  })
  const thisMonthMetric = metrics.find((x) => x.month === month)

  // Happy-path milestones (KARAT Failed and offboarding are detours, not normal steps and
  // are never surfaced on an individual's own dashboard).
  const JOURNEY = STAGES.filter((s) => s !== 'KARAT_FAILED' && s !== 'OFFBOARDING' && s !== 'OFFBOARDED')
  const failed = c.currentStage === 'KARAT_FAILED'
  const offboarding = c.currentStage === 'OFFBOARDING' || c.currentStage === 'OFFBOARDED'
  // Offboarding people were onboarded - show the journey as complete rather than the detour.
  const journeyStage = failed ? 'CARAT_INTERVIEW' : offboarding ? 'ONBOARDED' : c.currentStage
  const curIdx = JOURNEY.indexOf(journeyStage)
  const completed = enrollments.filter((e) => e.status === 'COMPLETED').length

  const kpis = [
    { label: 'Onboarding Step', value: `${curIdx + 1}/${JOURNEY.length}` },
    ...(isOnboarded ? [{ label: 'GitHub Commits', value: thisMonthMetric?.githubCommits ?? 0, to: '/metrics' }] : []),
    { label: 'Trainings', value: enrollments.length, to: '/training' },
    { label: 'Completed', value: completed, to: '/training' },
    { label: `PTS Hours · ${year}`, value: hoursThisYear, to: '/pts' },
  ]

  return (
    <div>
      <h1 className="page-title">Welcome, {user.name.split(' ')[0]}</h1>
      <p className="page-sub">Your onboarding, training and timesheet at a glance.</p>

      <div className="grid kpis">
        {kpis.map((k) => (
          <div
            className={`card kpi ${k.to ? 'clickable' : ''}`}
            key={k.label}
            onClick={k.to ? () => navigate(k.to) : undefined}
            style={k.to ? undefined : { cursor: 'default' }}
          >
            <div className="kpi-value">{k.value}</div>
            <div className="kpi-label">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <h3>My Onboarding Journey</h3>
        <div className="journey">
          {JOURNEY.map((s, i) => {
            const state = i < curIdx ? 'done'
              : i === curIdx ? (failed ? 'done' : 'current')
              : 'upcoming'
            // KARAT was scheduled (and attended) but failed — the break is on the path to the next step.
            const showBreak = failed && i === curIdx
            return (
              <div className={`jstep ${state} ${showBreak ? 'break' : ''}`} key={s}>
                <div className="jdot">{state === 'done' ? '✓' : i + 1}</div>
                <div className="jlabel">{STAGE_LABELS[s]}</div>
                {showBreak && <span className="jbreak" title="Failed the KARAT assessment">✕</span>}
              </div>
            )
          })}
        </div>
        {failed && (
          <div className="jnote bad">
            You did not clear the KARAT assessment, so the onboarding journey ends here.
          </div>
        )}
      </div>

      {isOnboarded && (
        <div className="grid charts">
          <div className="card">
            <h3>GitHub Commits · {year}</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={gtData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef0f5" />
                <XAxis dataKey="month" tickFormatter={monthShort} fontSize={11} />
                <YAxis fontSize={11} allowDecimals={false} />
                <Tooltip labelFormatter={monthShort} />
                <Bar dataKey="commits" name="Commits" fill={INDIGO} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <h3>Stories (Jira) · {year}</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={gtData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef0f5" />
                <XAxis dataKey="month" tickFormatter={monthShort} fontSize={11} />
                <YAxis fontSize={11} allowDecimals={false} />
                <Tooltip labelFormatter={monthShort} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="storiesAssigned" name="Assigned" fill={INDIGO} radius={[4, 4, 0, 0]} />
                <Bar dataKey="storiesCompleted" name="Completed" fill={GREEN} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="grid charts">
        <div className="card">
          <h3>My PTS Hours · {year}</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={ptsData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef0f5" />
              <XAxis dataKey="month" tickFormatter={monthShort} fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip labelFormatter={monthShort} />
              <Bar dataKey="hours" fill="#4f46e5" name="Hours" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3>My Trainings</h3>
          {enrollments.length === 0 && <div className="empty">You're not enrolled in any training yet. Visit Training to enrol.</div>}
          {enrollments.length > 0 && (
            <table>
              <thead><tr><th>Training</th><th>Status</th><th>Progress</th></tr></thead>
              <tbody>
                {enrollments.map((e) => (
                  <tr key={e.id}>
                    <td><strong>{e.trainingTitle || '-'}</strong></td>
                    <td><span className={`badge ${enrollBadge(e.status)}`}>{e.status.replace('_', ' ')}</span></td>
                    <td style={{ width: 160 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="progress-track" style={{ flex: 1 }}>
                          <div className="progress-fill" style={{ width: `${e.progressPct}%` }} />
                        </div>
                        <span style={{ fontSize: 12 }}>{e.progressPct}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
