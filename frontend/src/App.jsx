import { Component, lazy, memo, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { NavLink, Route, Routes, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { api, slug } from './api'
import { useAuth } from './auth'
import { useCrumbs } from './crumbs'

// ─── Route-level code splitting ────────────────────────────────────────────
// Each page is a separate JS chunk; loaded only when the user first navigates
// to that route. Initial bundle contains only the shell + login.
const Login           = lazy(() => import('./pages/Login.jsx'))
const Dashboard       = lazy(() => import('./pages/Dashboard.jsx'))
const Timesheet       = lazy(() => import('./pages/Timesheet.jsx'))
const Onboarding      = lazy(() => import('./pages/Onboarding.jsx'))
const Profiles        = lazy(() => import('./pages/Profiles.jsx'))
const ProfileDetail   = lazy(() => import('./pages/ProfileDetail.jsx'))
const Training        = lazy(() => import('./pages/Training.jsx'))
const TrainingDetail  = lazy(() => import('./pages/TrainingDetail.jsx'))
const KaratAssessment = lazy(() => import('./pages/KaratAssessment.jsx'))
const People          = lazy(() => import('./pages/People.jsx'))
const Metrics         = lazy(() => import('./pages/Metrics.jsx'))
const Projects        = lazy(() => import('./pages/Projects.jsx'))

// ─── Breadcrumb labels ──────────────────────────────────────────────────────
const CRUMB_NAMES = {
  '': 'Dashboard',
  pts: 'PTS',
  metrics: 'GT Metrics',
  onboarding: 'Onboarding',
  'my-team': 'My Team',
  profiles: 'Profile',
  training: 'Training',
  karat: 'KARAT Assessment',
  people: 'CITI Org Directory',
  projects: 'Projects & Leadership',
}

// ─── Page-level spinner ────────────────────────────────────────────────────
function PageLoader() {
  return (
    <div className="page-loader">
      <div className="page-spinner" />
    </div>
  )
}

// ─── Error boundary for lazy chunks ────────────────────────────────────────
// ChunkLoadError happens when a new deploy lands mid-session (old chunk URLs
// 404). Auto-reload once picks up the fresh bundle.
class PageErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(err) {
    if (err?.name === 'ChunkLoadError') window.location.reload()
  }

  render() {
    if (this.state.hasError)
      return <div className="error-banner">This page failed to load. Please refresh.</div>
    return this.props.children
  }
}

// ─── Breadcrumb ────────────────────────────────────────────────────────────
const Breadcrumb = memo(function Breadcrumb() {
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
})

// ─── Search box ────────────────────────────────────────────────────────────
const SearchBox = memo(function SearchBox() {
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
    const close = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const handleSelect = useCallback((c) => {
    setOpen(false)
    setQ('')
    navigate(`/profiles/${slug(c.name)}`)
  }, [navigate])

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
            <div key={c.id} className="search-result" onClick={() => handleSelect(c)}>
              <strong>{c.name}</strong>
              <span>{c.soeid || 'No SOEID'} · {c.pod || '-'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
})

// ─── User menu ────────────────────────────────────────────────────────────
const UserMenu = memo(function UserMenu() {
  const { user, logout, roleLabel } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const initials = user.name.split(' ').map((w) => w[0]).join('').slice(0, 2)

  const goProfile = useCallback(() => {
    setOpen(false)
    if (user.candidateId) navigate(`/profiles/${slug(user.name)}`)
    else navigate('/my-team')
  }, [navigate, user.candidateId, user.name])

  const handleLogout = useCallback(() => {
    setOpen(false)
    logout()
  }, [logout])

  return (
    <div className="user-menu" ref={ref}>
      <button className="user-chip" onClick={() => setOpen((v) => !v)}>
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
          <button onClick={handleLogout}>↪ Logout</button>
        </div>
      )}
    </div>
  )
})

// ─── App shell ────────────────────────────────────────────────────────────
function Shell() {
  const { user, isManager, isSeniorManager, isOnboarded, roleLabel } = useAuth()
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
          <NavLink to="/my-team">My Team</NavLink>
          {isOnboarded && <NavLink to="/metrics">GT Metrics</NavLink>}
          <NavLink to="/training">Training</NavLink>
          <NavLink to="/karat">KARAT Assessment</NavLink>
          {isSeniorManager && <NavLink to="/people">CITI Org Directory</NavLink>}
          {isSeniorManager && <NavLink to="/projects">Projects & Leadership</NavLink>}
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
        {/* Suspense here keeps sidebar + topbar visible while page chunks load */}
        <main className="content">
          <PageErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              <Outlet />
            </Suspense>
          </PageErrorBoundary>
        </main>
      </div>
    </div>
  )
}

function Booting() {
  return <div className="boot-screen">Loading…</div>
}

function RequireAuth() {
  const { user, booting } = useAuth()
  const loc = useLocation()
  if (booting) return <Booting />
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />
  return <Shell />
}

function LoginRoute() {
  const { user, booting } = useAuth()
  if (booting) return <Booting />
  if (user) return <Navigate to="/" replace />
  return (
    <Suspense fallback={<Booting />}>
      <Login />
    </Suspense>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route element={<RequireAuth />}>
        <Route path="/"             element={<Dashboard />} />
        <Route path="/pts"          element={<Timesheet />} />
        <Route path="/metrics"      element={<Metrics />} />
        <Route path="/onboarding"   element={<Onboarding />} />
        <Route path="/my-team"      element={<Profiles />} />
        <Route path="/profiles/:id" element={<ProfileDetail />} />
        <Route path="/training"     element={<Training />} />
        <Route path="/training/:id" element={<TrainingDetail />} />
        <Route path="/karat"        element={<KaratAssessment />} />
        <Route path="/people"       element={<People />} />
        <Route path="/projects"     element={<Projects />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
