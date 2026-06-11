import { useEffect, useRef, useState } from 'react'
import { NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { api } from './api'
import { useAuth } from './auth'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Timesheet from './pages/Timesheet.jsx'
import Onboarding from './pages/Onboarding.jsx'
import Profiles from './pages/Profiles.jsx'
import ProfileDetail from './pages/ProfileDetail.jsx'
import Training from './pages/Training.jsx'
import TrainingDetail from './pages/TrainingDetail.jsx'

const CRUMB_NAMES = {
  '': 'Dashboard',
  pts: 'PTS — Timesheet',
  onboarding: 'Onboarding',
  profiles: 'Profiles',
  training: 'Training',
}

function Breadcrumb() {
  const { pathname } = useLocation()
  const parts = pathname.split('/').filter(Boolean)
  const crumbs = [{ label: 'Citi Governance', to: '/' }]
  let acc = ''
  for (const part of parts) {
    acc += `/${part}`
    crumbs.push({ label: CRUMB_NAMES[part] || `#${part}`, to: acc })
  }
  if (parts.length === 0) crumbs.push({ label: 'Dashboard', to: '/' })
  return (
    <nav className="breadcrumb">
      {crumbs.map((c, i) => (
        <span key={c.to}>
          {i > 0 && <span className="crumb-sep">›</span>}
          <NavLink to={c.to} className="crumb">{c.label}</NavLink>
        </span>
      ))}
    </nav>
  )
}

function SearchBox() {
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const boxRef = useRef(null)

  useEffect(() => {
    if (!q.trim()) { setResults([]); setOpen(false); return }
    const t = setTimeout(async () => {
      try {
        const r = await api.candidates(q.trim())
        setResults(r.slice(0, 8))
        setOpen(true)
      } catch { /* backend not reachable */ }
    }, 250)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    const onClick = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  return (
    <div className="search-box" ref={boxRef}>
      <svg className="search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search candidates…"
      />
      {open && results.length > 0 && (
        <div className="search-results">
          {results.map((c) => (
            <div
              key={c.id}
              className="search-result"
              onClick={() => { setOpen(false); setQ(''); navigate(`/profiles/${c.id}`) }}
            >
              <strong>{c.name}</strong>
              <span>{c.soeid || 'No SOEID'} · {c.pod || '—'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function UserMenu() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const initials = user.name.split(' ').map((w) => w[0]).join('').slice(0, 2)

  const goProfile = () => {
    setOpen(false)
    if (user.candidateId) navigate(`/profiles/${user.candidateId}`)
    else navigate('/profiles')
  }

  return (
    <div className="user-menu" ref={ref}>
      <button className="user-chip" onClick={() => setOpen(!open)}>
        <span className="avatar">{initials}</span>
        <span className="user-name">{user.name}</span>
        <span className="user-role">{user.role}</span>
      </button>
      {open && (
        <div className="user-dropdown">
          <div className="user-dropdown-header">
            <strong>{user.name}</strong>
            <span>{user.email}</span>
          </div>
          <button onClick={goProfile}>👤 My Profile</button>
          <button onClick={() => { setOpen(false); logout() }}>↪ Logout</button>
        </div>
      )}
    </div>
  )
}

export default function App() {
  const { user, booting } = useAuth()

  if (booting) return <div className="boot-screen">Loading…</div>
  if (!user) return <Login />

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">
          <span className="logo-mark">CG</span>
          <span>Citi Governance</span>
        </div>
        <nav>
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/pts">PTS — Timesheet</NavLink>
          <NavLink to="/onboarding">Onboarding</NavLink>
          <NavLink to="/profiles">Profiles</NavLink>
          <NavLink to="/training">Training</NavLink>
        </nav>
        <div className="sidebar-foot">
          Signed in as <strong>{user.name.split(' ')[0]}</strong> · {user.role === 'MANAGER' ? 'Manager' : 'Developer'}
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <Breadcrumb />
          <SearchBox />
          <UserMenu />
        </header>
        <main className="content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/pts" element={<Timesheet />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/profiles" element={<Profiles />} />
            <Route path="/profiles/:id" element={<ProfileDetail />} />
            <Route path="/training" element={<Training />} />
            <Route path="/training/:id" element={<TrainingDetail />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
