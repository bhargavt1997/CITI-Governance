import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import { api, STAGE_LABELS } from '../api'
import { useAuth } from '../auth'
import DeveloperDashboard from './DeveloperDashboard.jsx'

// One cohesive palette: an indigo ramp (the app's accent) for pipeline stages,
// plus the app's semantic red (failed) and green (onboarded) used elsewhere.
const STAGE_PIE = {
  'Nominated': '#c7d2fe',
  'KARAT Scheduled': '#a5b4fc',
  'KARAT Failed': '#e11d48',
  'Client Interview': '#818cf8',
  'Final Selection': '#6366f1',
  'Onboarding Initiated': '#4f46e5',
  'Citi Clearance Received': '#4338ca',
  'VDI Setup In Progress': '#3730a3',
  'Onboarded': '#059669',
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const monthShort = (m) => MONTHS[Number(String(m).split('-')[1]) - 1] || m

const stageBadge = (stage) => {
  if (stage === 'ONBOARDED') return 'green'
  if (stage === 'KARAT_FAILED') return 'red'
  if (stage === 'NOMINATED') return 'gray'
  return 'blue'
}

function ManagerDashboard() {
  const { user } = useAuth()
  const [summary, setSummary] = useState(null)
  const [candidates, setCandidates] = useState([])
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([api.dashboardSummary(), api.candidates()])
      .then(([s, c]) => {
        setSummary(s)
        // Scope the candidate table to the same people the KPIs count (everyone who reports to you).
        setCandidates(c.filter((x) => x.reportingManager === user.name))
      })
      .catch((e) => setError(e.message))
  }, [user])

  if (error) return <div className="error-banner">Could not load dashboard: {error}. Is the backend running on :8080?</div>
  if (!summary) return <div className="empty">Loading dashboard…</div>

  // A manager with no reportees gets the personal dashboard (delivery, PTS, trainings) instead of empty team charts.
  if (candidates.length === 0) return <DeveloperDashboard />

  const year = new Date().getFullYear()
  const kpis = [
    { label: 'Total Candidates', value: summary.totalCandidates, to: '/onboarding' },
    { label: 'Newly Nominated', value: summary.nominated, to: '/onboarding' },
    { label: 'KARAT Cleared', value: summary.caratCleared, to: '/onboarding' },
    { label: 'Total Selected', value: summary.totalSelected, to: '/onboarding' },
    { label: 'Onboarded', value: summary.onboarded, to: '/onboarding' },
    { label: 'KARAT Failed', value: summary.karatFailed ?? 0, to: '/onboarding', tone: 'danger' },
    { label: 'PTS Awaiting Approval', value: summary.pendingApprovals ?? 0, to: '/pts' },
  ]

  const pieData = Object.entries(summary.stageBreakdown)
    .map(([name, value]) => ({ name, value }))
    .filter((d) => d.value > 0)

  return (
    <div>
      <h1 className="page-title">Dashboard</h1>
      <p className="page-sub">A snapshot of your team's onboarding progress, hiring trends and project hours.</p>

      <div className="grid kpis">
        {kpis.map((k) => (
          <div className="card kpi clickable" key={k.label} onClick={() => navigate(k.to)} title={`Go to ${k.to === '/pts' ? 'PTS' : 'Onboarding'}`}>
            <div className={`kpi-value ${k.tone || ''}`}>{k.value}</div>
            <div className="kpi-label">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="grid charts">
        <div className="card">
          <h3>Monthly Trend - Nominations vs Onboardings</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={summary.monthlyTrends}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef0f5" />
              <XAxis dataKey="month" fontSize={11} />
              <YAxis allowDecimals={false} fontSize={11} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="nominated" stroke="#4f46e5" strokeWidth={2.5} name="Nominated" />
              <Line type="monotone" dataKey="onboarded" stroke="#059669" strokeWidth={2.5} name="Onboarded" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3>My PTS Hours · {year}</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={summary.ptsByMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef0f5" />
              <XAxis dataKey="month" tickFormatter={monthShort} fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip labelFormatter={monthShort} />
              <Bar dataKey="hours" fill="#4f46e5" name="Hours" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid charts">
        <div className="card">
          <h3>Pipeline Stage Breakdown</h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={pieData} dataKey="value" nameKey="name"
                innerRadius={50} outerRadius={85} paddingAngle={2}
                isAnimationActive={false}
              >
                {pieData.map((d, i) => <Cell key={i} fill={STAGE_PIE[d.name] || '#6366f1'} />)}
              </Pie>
              <Tooltip />
              <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3>Candidate Status - click a row for full profile</h3>
          <div style={{ maxHeight: 240, overflowY: 'auto' }}>
            <table>
              <thead>
                <tr><th>Name</th><th>Pod</th><th>Stage</th><th>Reporting To</th></tr>
              </thead>
              <tbody>
                {candidates.map((c) => (
                  <tr key={c.id} className="clickable" onClick={() => navigate(`/profiles/${c.id}`)}>
                    <td><strong>{c.name}</strong></td>
                    <td>{c.pod || '-'}</td>
                    <td><span className={`badge ${stageBadge(c.currentStage)}`}>{STAGE_LABELS[c.currentStage]}</span></td>
                    <td>{c.reportingManager || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {candidates.length === 0 && <div className="empty">No team members yet.</div>}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { isManager } = useAuth()
  return isManager ? <ManagerDashboard /> : <DeveloperDashboard />
}
