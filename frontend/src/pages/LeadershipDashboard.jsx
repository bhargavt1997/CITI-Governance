import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, bandLabel, bandRank, STAGE_LABELS } from '../api'
import { useAuth } from '../auth'

const stageBadge = (s) => (s === 'ONBOARDED' ? 'green' : s === 'KARAT_FAILED' ? 'red' : s === 'OFFBOARDING' ? 'amber' : s === 'OFFBOARDED' ? 'gray' : s === 'NOMINATED' ? 'gray' : 'blue')

const riskBadge = (level) => (level === 'High' ? 'red' : level === 'Medium' ? 'amber' : 'green')
const riskColor = (level) => (level === 'High' ? '#e11d48' : level === 'Medium' ? '#f59e0b' : '#059669')
// Distinct chip colours for the two risk dimensions.
const CITI_COLORS = { Gonzalo: '#7c3aed', Joshua: '#0891b2' }
const PROJECT_COLORS = { RUBY: '#e11d48', HY: '#0891b2', MES: '#7c3aed' }
const pill = (map) => (name) => ({
  background: (map[name] || '#64748b') + '1a',
  color: map[name] || '#64748b',
  border: `1px solid ${(map[name] || '#64748b')}40`,
})
const citiStyle = pill(CITI_COLORS)
const projectStyle = pill(PROJECT_COLORS)

const levelText = (role, band) => {
  if (role !== 'MANAGER') return 'Developer'
  return ['b4l', 'b4h', 'b2'].includes(band) ? 'Leadership' : ['b5l', 'b5h'].includes(band) ? 'Senior Manager' : 'Manager'
}

// A compact "where the risk sits" composition-bar group (used for Pod and CITI). When onSelect is
// given, each row is clickable (used to pop up the pod's people).
function RiskBars({ items, labelStyle, onSelect }) {
  const total = Math.max(1, items.reduce((s, c) => s + c.riskScore, 0))
  return (
    <div className="risk-split">
      {items.map((c) => (
        <div
          key={c.name}
          className={`rs-block ${onSelect ? 'clickable' : ''}`}
          onClick={onSelect ? () => onSelect(c.name) : undefined}
          title={onSelect ? `See who is in ${c.name}` : undefined}
        >
          <div className="rs-row">
            <span className="risk-citi" style={labelStyle(c.name)}>{c.name}</span>
            <div className="rs-bar">
              <div className="rs-fill" style={{ width: `${(c.riskScore / total) * 100}%`, background: riskColor(c.riskLevel) }} />
            </div>
            <span className={`badge ${riskBadge(c.riskLevel)}`}>{c.riskLevel} · {c.riskScore}</span>
            <span className="rs-people">{c.people} {c.people === 1 ? 'person' : 'people'}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// Popup of everyone in a pod, flagging who is at risk.
function PodModal({ pod, people, onClose, onOpenProfile }) {
  const atRisk = people.filter((p) => p.atRisk).length
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <h3>Pod · {pod}</h3>
        <p className="page-sub" style={{ marginTop: 0 }}>
          {people.length} {people.length === 1 ? 'person' : 'people'} · {atRisk} at risk
        </p>
        <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          <table className="risk-table">
            <thead><tr><th>Name</th><th>Level</th><th>CITI</th><th>Status</th><th>Risk</th></tr></thead>
            <tbody>
              {people.map((p) => (
                <tr
                  key={p.candidateId}
                  className={`clickable ${p.atRisk ? 'has-risk' : ''}`}
                  onClick={() => onOpenProfile(p.candidateId)}
                  title="Open profile"
                >
                  <td><strong>{p.name}</strong></td>
                  <td><span className="risk-level">{levelText(p.role, p.band)}</span></td>
                  <td>{p.citiLeadership || '—'}</td>
                  <td><span className={`badge ${stageBadge(p.stage)}`}>{STAGE_LABELS[p.stage] || p.stage}</span></td>
                  <td>{p.atRisk
                    ? <span className="badge red">{p.riskReason}</span>
                    : <span className="risk-num zero">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="actions"><button className="btn secondary" onClick={onClose}>Close</button></div>
      </div>
    </div>
  )
}

const NUMERIC = new Set(['risk'])

export default function LeadershipDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [citiFilter, setCitiFilter] = useState(null)
  const [atRiskOnly, setAtRiskOnly] = useState(false)
  const [sort, setSort] = useState({ key: 'risk', dir: 'desc' })
  const [collapsed, setCollapsed] = useState(() => new Set())
  const [podModal, setPodModal] = useState(null)

  useEffect(() => {
    api.riskSummary().then(setData).catch((e) => setError(e.message))
  }, [])

  // Default the tree to "collapsed down to senior management": senior-manager nodes start collapsed
  // so only leadership + senior managers show; expand a senior manager to reveal their managers.
  useEffect(() => {
    if (!data) return
    const ids = new Set()
    const walk = (n) => {
      if (['b5l', 'b5h'].includes(n.band) && n.reports?.length) ids.add(n.candidateId)
      ;(n.reports || []).forEach(walk)
    }
    walk(data.root)
    setCollapsed(ids)
  }, [data])

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
        case 'project': return String(a.pod || '').localeCompare(String(b.pod || '')) * dir || a.name.localeCompare(b.name)
        case 'citi': return String(a.citiLeadership || '').localeCompare(String(b.citiLeadership || '')) * dir
        default: av = a.riskScore; bv = b.riskScore
      }
      return (av - bv) * dir || a.name.localeCompare(b.name)
    }
    // Show only leadership/senior-managers/managers; developers are pruned (their risk still rolls
    // up into their manager's numbers).
    const prune = (node) => {
      const kids = (node.reports || []).map(prune).filter(Boolean)
      if (node.role !== 'MANAGER') return null
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

  const { org, citiSummary } = data
  // Everyone in the org (full tree, includes developers) - used for the pod popup.
  const allPeople = []
  ;(function walk(n) { if (!n) return; allPeople.push(n); (n.reports || []).forEach(walk) })(data.root)
  const podPeople = podModal ? allPeople.filter((p) => p.pod === podModal) : []
  // Each KPI opens the org directory and selects the matching filter there.
  const kpis = [
    { label: 'People in your org', value: org.total, filter: { type: 'all' } },
    { label: 'Onboarded', value: org.onboarded, filter: { type: 'stage', stage: 'ONBOARDED' } },
    { label: 'In Pipeline', value: org.inPipeline, filter: { type: 'pipeline' } },
    { label: 'KARAT Failed', value: org.karatFailed, tone: 'danger', filter: { type: 'stage', stage: 'KARAT_FAILED' } },
    { label: 'Offboarding', value: org.offboarding, tone: 'danger', filter: { type: 'stage', stage: 'OFFBOARDING' } },
    // No filter: the org directory doesn't surface GT metrics, so this KPI isn't a drill-down.
    { label: 'Low GT (3 mo)', value: org.lowGt, tone: 'danger' },
  ]

  // Flatten the tree to one row per person for the risk-report CSV, ordered top-down by hierarchy.
  const downloadReport = () => {
    const csvRows = []
    const walk = (n, depth) => {
      csvRows.push([
        depth, levelText(n.role, n.band), n.name, n.band ? bandLabel(n.band) : '',
        n.pod || '', n.reportingManager || '', n.citiLeadership || '',
        n.directReports, n.teamSize, n.karatFailed, n.offboarding, n.lowGt, n.riskScore, n.riskLevel,
      ])
      ;(n.reports || []).forEach((c) => walk(c, depth + 1))
    }
    walk(data.root, 0)
    const cols = ['Depth', 'Level', 'Name', 'Band', 'Project', 'Reports To', 'CITI Leadership',
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

  return (
    <div>
      <h1 className="page-title">Leadership Overview</h1>
      <p className="page-sub">
        Welcome, {user.name.split(' ')[0]}. Your organisation at a glance — sort or drill into any
        manager to see their team and where the delivery risk is concentrated.
      </p>

      <div className="grid kpis">
        {kpis.map((k) => (
          <div
            className={`card kpi ${k.filter ? 'clickable' : ''}`}
            key={k.label}
            onClick={k.filter ? () => navigate('/people', { state: { filter: k.filter } }) : undefined}
            style={k.filter ? undefined : { cursor: 'default' }}
            title={k.filter ? 'View these people in the directory' : undefined}
          >
            <div className={`kpi-value ${k.tone || ''}`}>{k.value}</div>
            <div className="kpi-label">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="grid charts">
        <div className="card">
          <h3>Risk by Pod</h3>
          <RiskBars items={data.projectRisk || []} labelStyle={projectStyle} onSelect={setPodModal} />
        </div>
        <div className="card">
          <h3>Risk by CITI Leadership</h3>
          <RiskBars items={citiSummary} labelStyle={citiStyle} />
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="toolbar" style={{ marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
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
                <th onClick={() => sortBy('project')}>Pod{arrow('project')}</th>
                <th onClick={() => sortBy('citi')}>CITI{arrow('citi')}</th>
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
                        <button
                          className="risk-name-link"
                          onClick={() => navigate(`/profiles/${node.candidateId}`)}
                          title="Open profile"
                        >
                          {node.name}
                        </button>
                      </span>
                    </td>
                    <td><span className="risk-level">{levelText(node.role, node.band)}</span></td>
                    <td>{node.pod
                      ? <span className="risk-citi" style={projectStyle(node.pod)}>{node.pod}</span>
                      : <span className="risk-num zero">—</span>}</td>
                    <td>{node.citiLeadership
                      ? <span className="risk-citi" style={citiStyle(node.citiLeadership)}>{node.citiLeadership}</span>
                      : <span className="risk-num zero">—</span>}</td>
                    <td><span className={`badge ${riskBadge(node.riskLevel)}`}>{node.riskLevel} · {node.riskScore}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {rows.length === 0 && <div className="empty">No people match the current filters.</div>}
        </div>
      </div>

      {podModal && (
        <PodModal
          pod={podModal}
          people={podPeople}
          onClose={() => setPodModal(null)}
          onOpenProfile={(id) => { setPodModal(null); navigate(`/profiles/${id}`) }}
        />
      )}
    </div>
  )
}
