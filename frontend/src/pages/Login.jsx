import { useEffect, useMemo, useState } from 'react'
import { api, ALL_BANDS, bandLabel, bandRank, roleForBand } from '../api'
import { useAuth } from '../auth'

export default function Login() {
  const { login, register } = useAuth()
  const [mode, setMode] = useState('signin') // 'signin' | 'register'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [band, setBand] = useState(ALL_BANDS[0])
  const [reportingManager, setReportingManager] = useState('')
  const [pod, setPod] = useState('')
  const [wave, setWave] = useState('')
  const [location, setLocation] = useState('')
  const [managers, setManagers] = useState([])
  const [pods, setPods] = useState([])
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  // Only people at a more senior band can be your reporting manager.
  const eligibleManagers = useMemo(
    () => managers.filter((m) => bandRank(m.band) > bandRank(band)),
    [managers, band],
  )

  useEffect(() => {
    if (mode === 'register') {
      api.publicManagers().then(setManagers).catch(() => setManagers([]))
      api.pods().then(setPods).catch(() => setPods([]))
    }
  }, [mode])

  // CITI leadership is determined by the chosen project's CITI owner.
  const derivedCiti = pods.find((p) => p.name === pod)?.citiLeader || ''

  // If the chosen manager is no longer senior enough after a band change, drop the selection.
  useEffect(() => {
    if (reportingManager && !eligibleManagers.some((m) => m.name === reportingManager)) {
      setReportingManager('')
    }
  }, [eligibleManagers, reportingManager])

  const switchMode = (m) => { setMode(m); setError(null) }

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (mode === 'signin') {
        await login(email.trim(), password)
      } else {
        if (!pod) { setError('Please select a project'); setBusy(false); return }
        await register({
          name: name.trim(),
          email: email.trim(),
          password,
          band,
          reportingManager: reportingManager || null,
          pod,
          citiLeadership: derivedCiti || null,
          wave: wave || null,
          location: location || null,
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
            <label className="login-label">Band</label>
            <select value={band} onChange={(e) => setBand(e.target.value)}>
              {ALL_BANDS.map((b) => <option key={b} value={b}>{bandLabel(b)}</option>)}
            </select>
            <span className="login-help">
              Your band sets your role: B6H and above join as a Manager, B6L and below as a Developer.
              You will join as a <strong>{roleForBand(band)}</strong>.
            </span>

            <label className="login-label">Reporting manager</label>
            <select value={reportingManager} onChange={(e) => setReportingManager(e.target.value)}>
              <option value="">
                {eligibleManagers.length ? 'Select your manager…' : 'No senior manager available - leave blank'}
              </option>
              {eligibleManagers.map((m) => (
                <option key={m.id} value={m.name}>{m.name} · {bandLabel(m.band)}</option>
              ))}
            </select>
            <span className="login-help">
              A reporting manager must hold a more senior band than you, so only those people are listed.
            </span>

            <label className="login-label">Project</label>
            <select value={pod} onChange={(e) => setPod(e.target.value)}>
              <option value="">Select your project…</option>
              {pods.map((p) => <option key={p.id} value={p.name}>{p.name}{p.leadName ? ` · ${p.leadName}` : ''}</option>)}
            </select>

            <label className="login-label">CITI leadership</label>
            <input type="text" value={derivedCiti || 'Set by your project'} disabled readOnly />
            <span className="login-help">Determined by the project you join.</span>

            <label className="login-label">Wave</label>
            <input type="text" value={wave} onChange={(e) => setWave(e.target.value)} placeholder="e.g. Wave 4" />

            <label className="login-label">Location</label>
            <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Hyderabad" />
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
