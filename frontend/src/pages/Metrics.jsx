import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import {
  BarChart, Bar, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { api } from '../api'
import { useAuth } from '../auth'
import { useToast } from '../toast'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const monthShort = (m) => MONTHS[Number(String(m).split('-')[1]) - 1] || m
const currentMonth = () => new Date().toISOString().slice(0, 7)
const monthLabel = (m) => {
  const [y, mo] = m.split('-')
  return new Date(Number(y), Number(mo) - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' })
}

const FIELDS = [
  { key: 'githubCommits', label: 'GitHub Commits', hint: 'Your GT metric for the month' },
  { key: 'storiesAssigned', label: 'Stories Assigned' },
  { key: 'storiesCompleted', label: 'Stories Completed' },
  { key: 'storyPointsAssigned', label: 'Story Points Assigned' },
  { key: 'storyPointsCompleted', label: 'Story Points Completed' },
]
const BLANK = { githubCommits: '', storiesAssigned: '', storiesCompleted: '', storyPointsAssigned: '', storyPointsCompleted: '', highlights: '' }

const INDIGO = '#4f46e5'
const GREEN = '#059669'

export default function Metrics() {
  const { user, isOnboarded } = useAuth()
  const toast = useToast()
  const [month, setMonth] = useState(currentMonth())
  const [history, setHistory] = useState([])
  const [row, setRow] = useState(BLANK)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState(null)

  const noProfile = user.candidateId == null

  const load = () => {
    if (noProfile) return
    api.metrics({ candidateId: user.candidateId })
      .then(setHistory)
      .catch((e) => setError(e.message))
  }
  useEffect(() => { load() }, [user.candidateId])

  // When the month (or loaded history) changes, populate the editor from the stored row.
  useEffect(() => {
    const found = history.find((m) => m.month === month)
    setRow(found ? {
      githubCommits: found.githubCommits ?? '',
      storiesAssigned: found.storiesAssigned ?? '',
      storiesCompleted: found.storiesCompleted ?? '',
      storyPointsAssigned: found.storyPointsAssigned ?? '',
      storyPointsCompleted: found.storyPointsCompleted ?? '',
      highlights: found.highlights ?? '',
    } : BLANK)
    setDirty(false)
  }, [month, history])

  const setField = (k) => (e) => { setRow((r) => ({ ...r, [k]: e.target.value })); setDirty(true) }

  const save = async () => {
    try {
      await api.saveMetric({
        candidateId: user.candidateId,
        month,
        githubCommits: Number(row.githubCommits) || 0,
        storiesAssigned: Number(row.storiesAssigned) || 0,
        storiesCompleted: Number(row.storiesCompleted) || 0,
        storyPointsAssigned: Number(row.storyPointsAssigned) || 0,
        storyPointsCompleted: Number(row.storyPointsCompleted) || 0,
        highlights: row.highlights || null,
      })
      toast.success(`Your metrics for ${monthLabel(month)} were saved.`)
      load()
    } catch (e) {
      toast.error(e.message)
    }
  }

  // Current-year series for the charts.
  const year = new Date().getFullYear()
  const series = useMemo(() => MONTHS.map((_, i) => {
    const key = `${year}-${String(i + 1).padStart(2, '0')}`
    const m = history.find((h) => h.month === key)
    return {
      month: key,
      commits: m?.githubCommits ?? 0,
      storiesAssigned: m?.storiesAssigned ?? 0,
      storiesCompleted: m?.storiesCompleted ?? 0,
      pointsAssigned: m?.storyPointsAssigned ?? 0,
      pointsCompleted: m?.storyPointsCompleted ?? 0,
    }
  }), [history, year])

  const thisMonth = history.find((m) => m.month === month)
  const kpis = [
    { label: 'GitHub Commits', value: thisMonth?.githubCommits ?? 0 },
    { label: 'Stories Completed', value: `${thisMonth?.storiesCompleted ?? 0} / ${thisMonth?.storiesAssigned ?? 0}` },
    { label: 'Story Points Completed', value: `${thisMonth?.storyPointsCompleted ?? 0} / ${thisMonth?.storyPointsAssigned ?? 0}` },
  ]

  // GT Metrics only apply once a person is onboarded and working.
  if (!isOnboarded) return <Navigate to="/" replace />

  if (noProfile) {
    return (
      <div>
        <h1 className="page-title">GT Metrics</h1>
        <p className="page-sub">Your GitHub and Jira delivery, captured month by month.</p>
        <div className="empty">Your account isn't linked to a profile yet, so there are no metrics to record.</div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="page-title">GT Metrics</h1>
      <p className="page-sub">Your GitHub and Jira delivery, captured month by month.</p>

      {error && <div className="error-banner">{error}</div>}

      <div className="toolbar">
        <label style={{ fontSize: 13, color: 'var(--muted)' }}>Month:&nbsp;
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </label>
      </div>

      <div className="grid kpis" style={{ marginBottom: 18 }}>
        {kpis.map((k) => (
          <div className="card kpi" key={k.label} style={{ cursor: 'default' }}>
            <div className="kpi-value">{k.value}</div>
            <div className="kpi-label">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="ts-own-head">
          <div>
            <h3 style={{ margin: 0 }}>My Metrics</h3>
            <span className="ts-own-month">{monthLabel(month)}</span>
          </div>
        </div>

        <div className="metric-grid">
          {FIELDS.map((f) => (
            <div className="metric-field" key={f.key}>
              <label>{f.label}</label>
              <input
                type="number" min="0" className="num-input"
                value={row[f.key]} onChange={setField(f.key)} placeholder="0"
              />
            </div>
          ))}
        </div>

        <div className="metric-highlights">
          <label>Work highlights</label>
          <textarea
            rows={3}
            value={row.highlights}
            onChange={setField('highlights')}
            placeholder="Key deliverables, wins, and notable work this month."
          />
        </div>

        <div className="ts-own-foot">
          <span className="ts-note">Your highlights and metrics appear in your team's report.</span>
          <button className="btn" disabled={!dirty} onClick={save}>{thisMonth ? 'Save changes' : 'Save'}</button>
        </div>
      </div>

      <div className="grid charts">
        <div className="card">
          <h3>GitHub Commits · {year}</h3>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={series}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef0f5" />
              <XAxis dataKey="month" tickFormatter={monthShort} fontSize={11} />
              <YAxis fontSize={11} allowDecimals={false} />
              <Tooltip labelFormatter={monthShort} />
              <Bar dataKey="commits" name="Commits" barSize={20} fill="#c7d2fe" radius={[4, 4, 0, 0]} />
              <Line type="monotone" dataKey="commits" name="Trend" stroke={INDIGO} strokeWidth={2.5} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3>Stories · {year}</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={series}>
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
    </div>
  )
}
