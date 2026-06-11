import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import { api, STAGE_LABELS } from '../api'

const PIE_COLORS = ['#9aa7c7', '#7c91c4', '#5f7cc1', '#4267be', '#2f55b0', '#234699', '#173782', '#0b3d91']

const stageBadge = (stage) => {
  if (stage === 'ONBOARDED') return 'green'
  if (stage === 'NOMINATED') return 'gray'
  return 'blue'
}

export default function Dashboard() {
  const [summary, setSummary] = useState(null)
  const [candidates, setCandidates] = useState([])
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([api.dashboardSummary(), api.candidates()])
      .then(([s, c]) => { setSummary(s); setCandidates(c) })
      .catch((e) => setError(e.message))
  }, [])

  if (error) return <div className="error-banner">Could not load dashboard: {error}. Is the backend running on :8080?</div>
  if (!summary) return <div className="empty">Loading dashboard…</div>

  const kpis = [
    { label: 'Total Candidates', value: summary.totalCandidates },
    { label: 'Newly Nominated', value: summary.nominated },
    { label: 'CARAT Cleared', value: summary.caratCleared },
    { label: 'Total Selected', value: summary.totalSelected },
    { label: 'Onboarded', value: summary.onboarded },
    { label: 'In Pipeline', value: summary.inPipeline },
  ]

  const pieData = Object.entries(summary.stageBreakdown)
    .map(([name, value]) => ({ name, value }))
    .filter((d) => d.value > 0)

  return (
    <div>
      <h1 className="page-title">Dashboard</h1>
      <p className="page-sub">Governance at a glance — candidate funnel, monthly trends and PTS hours.</p>

      <div className="grid kpis">
        {kpis.map((k) => (
          <div className="card kpi" key={k.label}>
            <div className="kpi-value">{k.value}</div>
            <div className="kpi-label">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="grid charts">
        <div className="card">
          <h3>Monthly Trend — Nominations vs Onboardings</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={summary.monthlyTrends}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef0f5" />
              <XAxis dataKey="month" fontSize={11} />
              <YAxis allowDecimals={false} fontSize={11} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="nominated" stroke="#1e62d0" strokeWidth={2} name="Nominated" />
              <Line type="monotone" dataKey="onboarded" stroke="#1a8f4d" strokeWidth={2} name="Onboarded" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3>PTS Hours by Month</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={summary.ptsByMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef0f5" />
              <XAxis dataKey="month" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Bar dataKey="hours" fill="#1e62d0" name="Hours" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid charts">
        <div className="card">
          <h3>Pipeline Stage Breakdown</h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={85} label={(d) => `${d.name} (${d.value})`} fontSize={10}>
                {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3>Candidate Status — click a row for full profile</h3>
          <div style={{ maxHeight: 240, overflowY: 'auto' }}>
            <table>
              <thead>
                <tr><th>Name</th><th>Pod</th><th>Stage</th><th>Reporting To</th></tr>
              </thead>
              <tbody>
                {candidates.map((c) => (
                  <tr key={c.id} className="clickable" onClick={() => navigate(`/profiles/${c.id}`)}>
                    <td><strong>{c.name}</strong></td>
                    <td>{c.pod || '—'}</td>
                    <td><span className={`badge ${stageBadge(c.currentStage)}`}>{STAGE_LABELS[c.currentStage]}</span></td>
                    <td>{c.reportingManager || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
