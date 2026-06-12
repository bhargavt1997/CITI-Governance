import { useEffect, useMemo, useState } from 'react'
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { api, bandLabel, bandRank, STAGE_LABELS } from '../api'
import { useAuth } from '../auth'

// Pipeline-stage palette (indigo ramp + semantic red/green/amber/slate), keyed by label.
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
  'Offboarding': '#f59e0b',
  'Offboarded': '#64748b',
}

const riskBadge = (level) => (level === 'High' ? 'red' : level === 'Medium' ? 'amber' : 'green')
const riskColor = (level) => (level === 'High' ? '#e11d48' : level === 'Medium' ? '#f59e0b' : '#059669')
// CITI leadership is a separate dimension from the Deloitte chain - give each leader a distinct chip.
const CITI_COLORS = { Gonzalo: '#7c3aed', Joshua: '#0891b2' }
const citiStyle = (name) => ({
  background: (CITI_COLORS[name] || '#64748b') + '1a',
  color: CITI_COLORS[name] || '#64748b',
  border: `1px solid ${(CITI_COLORS[name] || '#64748b')}40`,
})

const levelText = (role, band) => {
  if (role !== 'MANAGER') return 'Developer'
  return ['b4l', 'b4h', 'b2'].includes(band) ? 'Leadership' : ['b5l', 'b5h'].includes(band) ? 'Senior Manager' : 'Manager'
}

const NUMERIC = new Set(['team', 'karatFailed', 'offboarding', 'lowGt', 'risk'])

export default function LeadershipDashboard() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [citiFilter, setCitiFilter] = useState(null)
  const [atRiskOnly, setAtRiskOnly] = useState(false)
  const [sort, setSort] = useState({ key: 'risk', dir: 'desc' })
  const [collapsed, setCollapsed] = useState(() => new Set())

  useEffect(() => {
    api.riskSummary().then(setData).catch((e) => setError(e.message))
  }, [])

  const sortBy = (key) => setSort((s) => (
    s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: NUMERIC.has(key) ? 'desc' : 'asc' }
  ))
  const toggle = (id) => setCollapsed((s) => {
    const n = new Set(s)
    n.has(id) ? n.delete(id) : n.add(id)
    return n
  })

  // Prune by filters, sort siblings recursively, then flatten to visible rows honouring collapse state.
  const rows = useMemo(() => {
    if (!data) return []
    const dir = sort.dir === 'asc' ? 1 : -1
    const cmp = (a, b) => {
      let av, bv
      switch (sort.key) {
        case 'name': return a.name.localeCompare(b.name) * dir
        case 'level': return (bandRank(a.band) - bandRank(b.band)) * dir || a.name.localeCompare(b.name)
        case 'citi': return String(a.citiLeadership || '').localeCompare(String(b.citiLeadership || '')) * dir
        case 'team': av = a.teamSize; bv = b.teamSize; break
        case 'karatFailed': av = a.karatFailed; bv = b.karatFailed; break
        case 'offboarding': av = a.offboarding; bv = b.offboarding; break
        case 'lowGt': av = a.lowGt; bv = b.lowGt; break
        default: av = a.riskScore; bv = b.riskScore
      }
      return (av - bv) * dir || a.name.localeCompare(b.name)
    }
    const prune = (node) => {
      const kids = (node.reports || []).map(prune).filter(Boolean)
      const selfMatch = (!citiFilter || node.citiLeadership === citiFilter) && (!atRiskOnly || node.riskScore > 0)
      if (selfMatch || kids.length) return { ...node, reports: kids }
      return null
    }
    const pruned = prune(data.root)
    if (!pruned) return []
    const sortRec = (n) => ({ ...n, reports: [...n.reports].sort(cmp).map(sortRec) })
    const sorted = sortRec(pruned)
    const out = []
    const walk = (n, depth) => {
      out.push({ node: n, depth })
      if (!collapsed.has(n.candidateId)) n.reports.forEach((c) => walk(c, depth + 1))
    }
    walk(sorted, 0)
    return out
  }, [data, citiFilter, atRiskOnly, sort, collapsed])

  if (error) return <div className="error-banner">Could not load the leadership view: {error}</div>
  if (!data) return <div className="empty">Loading leadership view…</div>

  const { org, stageBreakdown, citiSummary } = data
  const kpis = [
    { label: 'People in your org', value: org.total },
    { label: 'Onboarded', value: org.onboarded },
    { label: 'In Pipeline', value: org.inPipeline },
    { label: 'KARAT Failed', value: org.karatFailed, tone: 'danger' },
    { label: 'Offboarding', value: org.offboarding, tone: 'danger' },
    { label: 'Low GT (3 mo)', value: org.lowGt, tone: 'danger' },
  ]
  const pieData = Object.entries(stageBreakdown).map(([name, value]) => ({ name, value }))
  const totalRisk = Math.max(1, citiSummary.reduce((s, c) => s + c.riskScore, 0))

  // Flatten the tree to one row per person for the risk-report CSV, ordered top-down by hierarchy.
  const downloadReport = () => {
    const csvRows = []
    const walk = (n, depth) => {
      csvRows.push([
        depth, levelText(n.role, n.band), n.name, n.band ? bandLabel(n.band) : '',
        n.reportingManager || '', n.citiLeadership || '', STAGE_LABELS[n.stage] || n.stage || '',
        n.directReports, n.teamSize, n.karatFailed, n.offboarding, n.lowGt, n.riskScore, n.riskLevel,
      ])
      ;(n.reports || []).forEach((c) => walk(c, depth + 1))
    }
    walk(data.root, 0)
    const cols = ['Depth', 'Level', 'Name', 'Band', 'Reports To', 'CITI Leadership', 'Onboarding Stage',
      'Direct Reports', 'Team Size', 'KARAT Failed', 'Offboarding', 'Low GT', 'Risk Score', 'Risk Level']
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const csv = [cols, ...csvRows].map((r) => r.map(esc).join(',')).join('\r\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'risk-report.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const arrow = (key) => (sort.key === key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : '')
  const num = (v, tone) => (v > 0
    ? <span className={`risk-num ${tone}`}>{v}</span>
    : <span className="risk-num zero">0</span>)

  return (
    <div>
      <h1 className="page-title">Leadership Overview</h1>
      <p className="page-sub">
        Welcome, {user.name.split(' ')[0]}. Your organisation at a glance — sort or drill into any
        manager to see their team and where the delivery risk is concentrated.
      </p>

      <div className="grid kpis">
        {kpis.map((k) => (
          <div className="card kpi" key={k.label} style={{ cursor: 'default' }}>
            <div className={`kpi-value ${k.tone || ''}`}>{k.value}</div>
            <div className="kpi-label">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="grid charts">
        <div className="card">
          <h3>Organisation Stage Breakdown</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={pieData} dataKey="value" nameKey="name"
                innerRadius={55} outerRadius={90} paddingAngle={2}
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
          <h3>CITI Leadership · where the risk sits</h3>
          <p className="page-sub" style={{ marginTop: 0 }}>
            Client-side ownership (separate from the Deloitte chain). Risk = KARAT-failed +
            offboarding + sustained low GT.
          </p>
          <div className="risk-split">
            {citiSummary.map((c) => (
              <div key={c.name} className="rs-block">
                <div className="rs-row">
                  <span className="risk-citi" style={citiStyle(c.name)}>{c.name}</span>
                  <div className="rs-bar">
                    <div className="rs-fill" style={{ width: `${(c.riskScore / totalRisk) * 100}%`, background: riskColor(c.riskLevel) }} />
                  </div>
                  <span className={`badge ${riskBadge(c.riskLevel)}`}>{c.riskLevel} · {c.riskScore}</span>
                  <span className="rs-people">{c.people} people</span>
                </div>
                <div className="rs-break">
                  {c.karatFailed} KARAT failed · {c.offboarding} offboarding · {c.lowGt} low GT
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 8 }}>
        <div className="toolbar" style={{ marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
          <h3 style={{ margin: 0 }}>Org Risk — {data.root.name}'s organisation</h3>
          <div className="spacer" style={{ flex: 1 }} />
          <button
            className={`seg-btn standalone ${atRiskOnly ? 'active' : ''}`}
            onClick={() => setAtRiskOnly((v) => !v)}
          >
            {atRiskOnly ? '● At-risk only' : '○ At-risk only'}
          </button>
          <div className="seg">
            <button className={`seg-btn ${!citiFilter ? 'active' : ''}`} onClick={() => setCitiFilter(null)}>All CITI</button>
            {citiSummary.map((c) => (
              <button
                key={c.name}
                className={`seg-btn ${citiFilter === c.name ? 'active' : ''}`}
                onClick={() => setCitiFilter(citiFilter === c.name ? null : c.name)}
              >
                {c.name}
              </button>
            ))}
          </div>
          <button className="btn secondary" onClick={downloadReport}>↓ Download risk report</button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="risk-table">
            <thead>
              <tr>
                <th onClick={() => sortBy('name')}>Name{arrow('name')}</th>
                <th onClick={() => sortBy('level')}>Level{arrow('level')}</th>
                <th onClick={() => sortBy('citi')}>CITI{arrow('citi')}</th>
                <th className="num" onClick={() => sortBy('team')}>Team{arrow('team')}</th>
                <th className="num" onClick={() => sortBy('karatFailed')}>KARAT Failed{arrow('karatFailed')}</th>
                <th className="num" onClick={() => sortBy('offboarding')}>Offboarding{arrow('offboarding')}</th>
                <th className="num" onClick={() => sortBy('lowGt')} title="GitHub commits < 20 for 3 months">Low GT{arrow('lowGt')}</th>
                <th onClick={() => sortBy('risk')}>Risk{arrow('risk')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ node, depth }) => {
                const hasReports = node.reports && node.reports.length > 0
                const isCollapsed = collapsed.has(node.candidateId)
                return (
                  <tr key={node.candidateId} className={node.riskScore > 0 ? 'has-risk' : ''}>
                    <td>
                      <span className="risk-name-cell" style={{ paddingLeft: depth * 20 }}>
                        {hasReports
                          ? <button className="risk-caret" onClick={() => toggle(node.candidateId)}>{isCollapsed ? '▸' : '▾'}</button>
                          : <span className="risk-caret empty" />}
                        <strong>{node.name}</strong>
                      </span>
                    </td>
                    <td><span className="risk-level">{levelText(node.role, node.band)}</span></td>
                    <td>{node.citiLeadership
                      ? <span className="risk-citi" style={citiStyle(node.citiLeadership)}>{node.citiLeadership}</span>
                      : <span className="risk-num zero">—</span>}</td>
                    <td className="num">{hasReports ? node.teamSize : '—'}</td>
                    <td className="num">{num(node.karatFailed, 'bad')}</td>
                    <td className="num">{num(node.offboarding, 'warn')}</td>
                    <td className="num">{num(node.lowGt, 'warn')}</td>
                    <td><span className={`badge ${riskBadge(node.riskLevel)}`}>{node.riskLevel} · {node.riskScore}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {rows.length === 0 && <div className="empty">No people match the current filters.</div>}
        </div>
      </div>
    </div>
  )
}
