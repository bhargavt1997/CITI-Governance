import { useEffect, useRef, useState } from 'react'
import { NavLink, Route, Routes, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { api } from './api'
import { useAuth } from './auth'
import { useCrumbs } from './crumbs'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Timesheet from './pages/Timesheet.jsx'
import Onboarding from './pages/Onboarding.jsx'
import Profiles from './pages/Profiles.jsx'
import ProfileDetail from './pages/ProfileDetail.jsx'
import Training from './pages/Training.jsx'
import TrainingDetail from './pages/TrainingDetail.jsx'
import KaratAssessment from './pages/KaratAssessment.jsx'
import People from './pages/People.jsx'

const CRUMB_NAMES = {
  '': 'Dashboard',
  pts: 'PTS',
  onboarding: 'Onboarding',
  profiles: 'My Team',
  training: 'Training',
  karat: 'KARAT Assessment',
  people: 'Org Directory',
}

function Breadcrumb() {
  const { pathname } = useLocation()
  const { labels } = useCrumbs()
  const parts = pathname.split('/').filter(Boolean)
  const crumbs = [{ label: 'Citi Governance', to: '/' }]
  let acc = ''
  for (const part of parts) {
    acc += `/${part}`
    crumbs.push({ label: CRUMB_NAMES[part] || labels[acc] || `#${part}`, to: acc })
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
              <span>{c.soeid || 'No SOEID'} · {c.pod || '-'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function UserMenu() {
  const { user, logout, roleLabel } = useAuth()
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
        <span className="user-role">{roleLabel}</span>
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

function Shell() {
  const { user, isManager, isSeniorManager, roleLabel } = useAuth()
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">
          <span>Citi Governance</span>
        </div>
        <nav>
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/pts">PTS</NavLink>
          {isManager && <NavLink to="/onboarding">Onboarding</NavLink>}
          <NavLink to="/profiles">My Team</NavLink>
          <NavLink to="/training">Training</NavLink>
          <NavLink to="/karat">KARAT Assessment</NavLink>
          {isSeniorManager && <NavLink to="/people">Org Directory</NavLink>}
        </nav>
        <div className="sidebar-foot">
          Signed in as <strong>{user.name.split(' ')[0]}</strong> · {roleLabel}
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <Breadcrumb />
          <SearchBox />
          <UserMenu />
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function Booting() {
  return <div className="boot-screen">Loading…</div>
}

/** Guards the authenticated app; sends unauthenticated users to /login, remembering where they were. */
function RequireAuth() {
  const { user, booting } = useAuth()
  const loc = useLocation()
  if (booting) return <Booting />
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />
  return <Shell />
}

/** The login screen; if already authenticated, bounces to the originally requested page (or the dashboard). */
function LoginRoute() {
  const { user, booting } = useAuth()
  const loc = useLocation()
  if (booting) return <Booting />
  if (user) return <Navigate to={loc.state?.from || '/'} replace />
  return <Login />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route element={<RequireAuth />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/pts" element={<Timesheet />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/profiles" element={<Profiles />} />
        <Route path="/profiles/:id" element={<ProfileDetail />} />
        <Route path="/training" element={<Training />} />
        <Route path="/training/:id" element={<TrainingDetail />} />
        <Route path="/karat" element={<KaratAssessment />} />
        <Route path="/people" element={<People />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
