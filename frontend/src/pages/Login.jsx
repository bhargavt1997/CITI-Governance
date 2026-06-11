import { useEffect, useState } from 'react'
import { api, MANAGER_BANDS, DEVELOPER_BANDS, bandLabel } from '../api'
import { useAuth } from '../auth'

export default function Login() {
  const { login, register } = useAuth()
  const [mode, setMode] = useState('signin') // 'signin' | 'register'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState('DEVELOPER')
  const [band, setBand] = useState(DEVELOPER_BANDS[0])
  const [reportingManager, setReportingManager] = useState('')
  const [managers, setManagers] = useState([])
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const bandOptions = role === 'MANAGER' ? MANAGER_BANDS : DEVELOPER_BANDS
  const pickRole = (r) => {
    setRole(r)
    setBand((r === 'MANAGER' ? MANAGER_BANDS : DEVELOPER_BANDS)[0])
  }

  useEffect(() => {
    if (mode === 'register') {
      api.publicManagers().then(setManagers).catch(() => setManagers([]))
    }
  }, [mode])

  const switchMode = (m) => { setMode(m); setError(null) }

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (mode === 'signin') {
        await login(email.trim(), password)
      } else {
        await register({
          name: name.trim(),
          email: email.trim(),
          password,
          role,
          band,
          reportingManager: reportingManager || null,
        })
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const isRegister = mode === 'register'

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit}>
        <div className="login-logo">CG</div>
        <h2>Citi Governance</h2>
        <p className="login-sub">{isRegister ? 'Create your account' : 'Sign in to continue'}</p>

        {error && <div className="error-banner">{error}</div>}

        {isRegister && (
          <>
            <label className="login-label">Full name</label>
            <input
              type="text" required autoFocus
              value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </>
        )}

        <label className="login-label">Email</label>
        <input
          type="email" required autoFocus={!isRegister}
          value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="Email address"
        />

        <label className="login-label">Password</label>
        <input
          type="password" required
          value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder={isRegister ? 'At least 6 characters' : 'Password'}
        />

        {isRegister && (
          <>
            <label className="login-label">I am a</label>
            <div className="role-toggle">
              <button
                type="button"
                className={role === 'DEVELOPER' ? 'active' : ''}
                onClick={() => pickRole('DEVELOPER')}
              >
                Developer
              </button>
              <button
                type="button"
                className={role === 'MANAGER' ? 'active' : ''}
                onClick={() => pickRole('MANAGER')}
              >
                Manager
              </button>
            </div>

            <label className="login-label">Band</label>
            <select value={band} onChange={(e) => setBand(e.target.value)}>
              {bandOptions.map((b) => <option key={b} value={b}>{bandLabel(b)}</option>)}
            </select>
            <span className="login-help">
              {role === 'MANAGER'
                ? 'Manager-eligible bands: B6H, B5L, B5H, B4L, B4H.'
                : 'Developer bands: B8, B7, B6L.'}
            </span>

            <label className="login-label">Reporting manager</label>
            <select value={reportingManager} onChange={(e) => setReportingManager(e.target.value)}>
              <option value="">
                {managers.length ? 'Select your manager…' : 'No managers yet — leave blank'}
              </option>
              {managers.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
            </select>
            <span className="login-help">
              {role === 'MANAGER'
                ? 'Optional — managers can report to another manager.'
                : 'Your manager approves your PTS timesheets.'}
            </span>
          </>
        )}

        <button className="btn login-btn" type="submit" disabled={busy}>
          {busy ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}
        </button>

        <p className="login-switch">
          {isRegister ? (
            <>Already have an account?{' '}
              <button type="button" onClick={() => switchMode('signin')}>Sign in</button>
            </>
          ) : (
            <>New here?{' '}
              <button type="button" onClick={() => switchMode('register')}>Create an account</button>
            </>
          )}
        </p>
      </form>

      <p className="login-foot">Authorized access only · Deloitte × Citi</p>
    </div>
  )
}
